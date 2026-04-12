"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ExternalLink, RefreshCw, SortAsc, Clock, Newspaper, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, getMonth, getYear, isSameMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, BarChart2, TrendingUp } from "lucide-react";

// Naver News API Item Type
interface NaverNewsItem {
    title: string;
    originallink: string;
    link: string;
    description: string;
    pubDate: string;
}

interface NewsGroup {
    main: NaverNewsItem;
    all: NaverNewsItem[];
}

interface CompetitorResult {
    brand: string;
    news: NewsGroup[];
    totalCount: number;
}

export default function NewsClippingPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <NewsClippingContent />
        </Suspense>
    );
}

function NewsClippingContent() {
    // General Search States
    const [query, setQuery] = useState("데스커");
    const [news, setNews] = useState<NaverNewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [sort, setSort] = useState<"date" | "sim">("date");
    const [selectedYear, setSelectedYear] = useState<string>("all");
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Competitor Monitoring States
    const [competitors, setCompetitors] = useState<string[]>(["한샘", "리바트", "이케아", "시디즈", "일룸", "퍼시스", "가구"]);
    const [newCompetitor, setNewCompetitor] = useState("");
    const [competitorResults, setCompetitorResults] = useState<CompetitorResult[]>([]);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

    // Build a refined query based on keyword and filters
    const getRefinedQuery = (keyword: string) => {
        return keyword; // User requested to search only by keyword
    };

    const searchParams = useSearchParams();
    const urlYear = searchParams.get("year");
    const urlMonth = searchParams.get("month");

    useEffect(() => {
        const y = urlYear || "all";
        const m = urlMonth || "all";
        setSelectedYear(y);
        setSelectedMonth(m);

        // URL 파라미터(연도/월)로 넘어온 경우(성과리포트에서 클릭시):
        // 실제로 검색을 자동 실행하여 원하는 기간의 기사를 관련성 순으로 가져옵니다.
        // 일반 로딩시(URL 파라미터 없음):
        // 사용자가 검색어 입력 후 검색 버튼을 놀레야만 실행됨 (자동 모드 X)
        if (urlYear || urlMonth) {
            const currentYearStr = new Date().getFullYear().toString();
            const searchSort = (y !== "all" && y !== currentYearStr) ? "sim" : "date";
            setSort(searchSort);
            fetchNews(query, searchSort);
        }
    }, [urlYear, urlMonth]);

    // 연도/월 필터 변경은 클라이언트에서만 필터링 수행 (재호출 없음)
    // groupedNewsByDate가 useMemo로 자동 필터링하므로 별도 fetch 불필요


    const fetchNews = async (searchQuery: string = query, searchSort: string = sort) => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        const allItems: NaverNewsItem[] = [];
        try {
            // Fetch up to 10 pages to match the report counting logic (max 1000 items)
            const maxPages = 10;
            for (let p = 0; p < maxPages; p++) {
                const start = p * 100 + 1;
                // Add timestamp to completely bypass browser caching during search
                const res = await fetch(`/api/news-search?query=${encodeURIComponent(searchQuery)}&sort=${searchSort}&display=100&start=${start}&_t=${Date.now()}`);

                if (!res.ok) {
                    console.error("Naver API error:", await res.text());
                    break;
                }

                const data = await res.json();

                if (data.items && data.items.length > 0) {
                    allItems.push(...data.items);
                    // If we got fewer than 100 items, it's the last page
                    if (data.items.length < 100) break;
                } else {
                    break;
                }

                // Rate limit 방지: 200ms 딜레이 (Reports와 동시 호출 시 충돌 방지)
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            setNews(allItems);
        } catch (error) {
            console.error("Failed to fetch Naver news", error);
            if (allItems.length > 0) setNews(allItems);
        } finally {
            setLoading(false);
        }
    };

    const fetchCompetitorNews = async () => {
        setIsMonitoring(true);
        const results: CompetitorResult[] = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
            for (const brand of competitors) {
                const res = await fetch(`/api/news-search?query=${encodeURIComponent(brand)}&sort=date&display=50`);
                const data = await res.json();

                if (data.items) {
                    const rawItems: NaverNewsItem[] = data.items;
                    // Filter for last 7 days
                    const recentItems = rawItems.filter(item => new Date(item.pubDate) >= sevenDaysAgo);

                    // Group similar news for competitors too
                    const groups: NewsGroup[] = [];
                    recentItems.forEach(item => {
                        const foundGroup = groups.find(g => isSimilar(g.main.title, item.title));
                        if (foundGroup) {
                            foundGroup.all.push(item);
                        } else {
                            groups.push({ main: item, all: [item] });
                        }
                    });

                    results.push({
                        brand,
                        news: groups,
                        totalCount: recentItems.length
                    });
                }
            }
            setCompetitorResults(results);
        } catch (error) {
            console.error("Failed to fetch competitor news", error);
        } finally {
            setIsMonitoring(false);
        }
    };


    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        // 검색 실행 시 기존에 적용된 연도/월 필터를 초기화하여 새 검색 결과가 가려지지 않게 함
        setSelectedYear("all");
        setSelectedMonth("all");

        // 필터 초기화 시 위 useEffect가 동작하여 fetchNews를 중복 호출할 수 있지만, query와 sort가 동일하므로 큰 문제는 없음
        // 명시적으로 여기서도 호출하여 확실히 갱신되도록 보장
        fetchNews(query, sort);
    };

    const addCompetitor = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCompetitor.trim() && !competitors.includes(newCompetitor.trim())) {
            setCompetitors([...competitors, newCompetitor.trim()]);
            setNewCompetitor("");
        }
    };

    const removeCompetitor = (brand: string) => {
        setCompetitors(competitors.filter(c => c !== brand));
    };

    const toggleSort = () => {
        const newSort = sort === "date" ? "sim" : "date";
        setSort(newSort);
        fetchNews(query, newSort);
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    // Clean HTML tags, brackets, and special characters for grouping
    const normalizeTitle = (html: string) => {
        return html
            .replace(/<[^>]*>?/gm, "") // Remove HTML tags
            .replace(/\[[^\]]*\]/g, "") // Remove content in brackets like [언론사]
            .replace(/\([^)]*\)/g, "") // Remove content in parentheses
            .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣]/g, "") // Remove non-alphanumeric/non-Korean characters
            .replace(/\s+/g, "") // Remove whitespace
            .trim();
    };

    // Simple similarity check (Jaccard-like or substring check)
    const isSimilar = (t1: string, t2: string) => {
        if (!t1 || !t2) return false;
        const n1 = normalizeTitle(t1);
        const n2 = normalizeTitle(t2);

        if (n1 === n2) return true;
        if (n1.includes(n2) && n2.length > 10) return true;
        if (n2.includes(n1) && n1.length > 10) return true;

        // Character-wise overlap check for near-duplicates
        let overlap = 0;
        const shorter = n1.length < n2.length ? n1 : n2;
        const longer = n1.length < n2.length ? n2 : n1;

        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) overlap++;
        }

        return overlap / shorter.length > 0.85; // 85% overlap threshold
    };

    // Group news by similarity and filter by year/month based on actual pubDate
    const groupedNewsByDate = useMemo(() => {
        let filteredNews = news;

        // Filter by actual publication date
        if (selectedYear !== "all") {
            filteredNews = filteredNews.filter(item => {
                const date = new Date(item.pubDate);
                return getYear(date).toString() === selectedYear;
            });
        }

        if (selectedMonth !== "all") {
            filteredNews = filteredNews.filter(item => {
                const date = new Date(item.pubDate);
                return (getMonth(date) + 1).toString() === selectedMonth;
            });
        }

        const dateGroups: Record<string, NewsGroup[]> = {};

        filteredNews.forEach(item => {
            const dateKey = format(new Date(item.pubDate), "yyyy년 MM월 dd일 (eee)", { locale: ko });
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }

            const foundGroup = dateGroups[dateKey].find(g => isSimilar(g.main.title, item.title));
            if (foundGroup) {
                foundGroup.all.push(item);
            } else {
                dateGroups[dateKey].push({ main: item, all: [item] });
            }
        });

        return dateGroups;
    }, [news, selectedYear, selectedMonth]);

    // Unified Competitor Timeline
    const competitorTimeline = useMemo(() => {
        const allNewsGroups: (NewsGroup & { brand: string })[] = [];

        competitorResults.forEach(res => {
            // Filter by selected brand if set
            if (selectedBrand && res.brand !== selectedBrand) return;

            res.news.forEach(group => {
                allNewsGroups.push({ ...group, brand: res.brand });
            });
        });

        // Group by Date first
        const dateGroups: Record<string, (NewsGroup & { brand: string })[]> = {};

        allNewsGroups.forEach(group => {
            const dateKey = format(new Date(group.main.pubDate), "yyyy년 MM월 dd일 (eee)", { locale: ko });
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(group);
        });

        // Sort dates descending
        return Object.keys(dateGroups).sort((a, b) => b.localeCompare(a)).map(date => ({
            date,
            items: dateGroups[date].sort((a, b) => new Date(b.main.pubDate).getTime() - new Date(a.main.pubDate).getTime())
        }));
    }, [competitorResults, selectedBrand]);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 4 }, (_, i) => (currentYear - i).toString());
    }, []);

    const months = Array.from({ length: 12 }, (_, i) => ({
        label: `${i + 1}월`,
        value: (i + 1).toString()
    }));

    // Clean HTML tags from Naver API strings
    const cleanContent = (html: string) => {
        return html.replace(/<[^>]*>?/gm, "")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">뉴스 클리핑</h2>
                <p className="text-muted-foreground">네이버 뉴스를 통해 최신 PR 트렌드와 경쟁사 동향을 파악하세요.</p>
            </div>

            <Tabs defaultValue="search" className="space-y-6">
                <TabsList className="bg-muted/50 p-1 h-12 w-full max-w-[400px]">
                    <TabsTrigger value="search" className="flex-1 h-10 gap-2">
                        <Search className="h-4 w-4" />
                        일반 검색
                    </TabsTrigger>
                    <TabsTrigger value="competitor" className="flex-1 h-10 gap-2" onClick={() => competitorResults.length === 0 && fetchCompetitorNews()}>
                        <BarChart2 className="h-4 w-4" />
                        경쟁사 모니터링
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-6 border-none p-0 outline-none">
                    <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50">
                        <CardContent className="p-6">
                            <form onSubmit={handleSearch} className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="검색어를 입력하세요..."
                                        className="pl-10"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                    />
                                </div>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue placeholder="연도" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체 연도</SelectItem>
                                        {years.map((y) => <SelectItem key={y} value={y}>{y}년</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue placeholder="월" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체 월</SelectItem>
                                        {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                    검색
                                </Button>
                                <Button variant="outline" onClick={toggleSort} type="button">
                                    {sort === "date" ? <Clock className="h-4 w-4 mr-2" /> : <SortAsc className="h-4 w-4 mr-2" />}
                                    {sort === "date" ? "최신순" : "관련도순"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        {loading && news.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                                <p>뉴스를 불러오는 중입니다...</p>
                            </div>
                        ) : Object.keys(groupedNewsByDate).length > 0 ? (
                            <>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {selectedYear === "all" ? "" : `${selectedYear}년 `}
                                        {selectedMonth === "all" ? (selectedYear === "all" ? "전체 기간" : "전체 월") : `${selectedMonth}월`}
                                        {' '}실제 기사 수 <span className="text-primary font-bold">{Object.values(groupedNewsByDate).flat().reduce((acc, g) => acc + g.all.length, 0)}</span>건
                                        <span className="mx-2 text-border">|</span>
                                        클리핑 <span className="font-bold text-foreground">{Object.values(groupedNewsByDate).flat().length}</span>건
                                    </span>
                                </div>
                                {Object.keys(groupedNewsByDate).sort((a, b) => b.localeCompare(a)).map((date, dIdx) => (
                                    <div key={dIdx} className="space-y-4 pt-4 first:pt-0">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="bg-muted/50 text-muted-foreground px-3 py-1 font-bold">{date}</Badge>
                                            <div className="h-[1px] flex-1 bg-border" />
                                        </div>
                                        {groupedNewsByDate[date].map((group, idx) => (
                                            <NewsItemCard key={idx} group={group} isExpanded={expandedGroups[`s-${dIdx}-${idx}`]} onToggle={() => toggleGroup(`s-${dIdx}-${idx}`)} />
                                        ))}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <EmptyState isFiltered={selectedYear !== "all" || selectedMonth !== "all"} />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="competitor" className="space-y-6 border-none p-0 outline-none">
                    <Card>
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                브랜드 모니터링 설정
                            </CardTitle>
                            <CardDescription>모니터링할 브랜드를 추가하고 최근 7일간의 보도 현황을 확인하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-4 space-y-4">
                            <form onSubmit={addCompetitor} className="flex gap-2">
                                <Input
                                    placeholder="새 브랜드 추가..."
                                    className="max-w-[300px]"
                                    value={newCompetitor}
                                    onChange={(e) => setNewCompetitor(e.target.value)}
                                />
                                <Button type="submit" variant="secondary">
                                    <Plus className="h-4 w-4 mr-1" /> 추가
                                </Button>
                                <div className="flex-1" />
                                <Button onClick={fetchCompetitorNews} disabled={isMonitoring}>
                                    {isMonitoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                    지금 업데이트 (최근 7일)
                                </Button>
                            </form>
                            <div className="flex flex-wrap gap-2 pt-2">
                                <Badge
                                    variant={selectedBrand === null ? "default" : "outline"}
                                    className={cn("px-3 py-1 cursor-pointer hover:bg-primary/90 hover:text-primary-foreground transition-colors", selectedBrand === null ? "" : "hover:bg-accent")}
                                    onClick={() => setSelectedBrand(null)}
                                >
                                    전체
                                </Badge>
                                {competitors.map(brand => (
                                    <Badge
                                        key={brand}
                                        variant={selectedBrand === brand ? "default" : "outline"}
                                        className={cn("pl-3 pr-1 py-1 gap-1 text-sm font-medium flex items-center cursor-pointer transition-colors",
                                            selectedBrand === brand
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                                        )}
                                        onClick={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                                    >
                                        {brand}
                                        <X
                                            className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors ml-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeCompetitor(brand);
                                                if (selectedBrand === brand) setSelectedBrand(null);
                                            }}
                                        />
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-8">
                        {isMonitoring && competitorResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
                                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                                <p>브랜드별 최신 소식을 수집하는 중입니다...</p>
                            </div>
                        ) : competitorTimeline.length > 0 ? (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-bold text-xl flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-primary" />
                                        최신 모니터링 타임라인
                                    </h3>
                                    <Badge variant="secondary">총 {competitorResults.reduce((sum, r) => sum + r.totalCount, 0)}건의 기사</Badge>
                                </div>
                                {competitorTimeline.map((day, dIdx) => (
                                    <div key={dIdx} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-3 font-bold">{day.date}</Badge>
                                            <div className="h-[1px] flex-1 bg-border/60" />
                                        </div>
                                        <div className="grid gap-3">
                                            {day.items.map((group, idx) => (
                                                <div key={idx} className="relative">
                                                    <Badge className="absolute -left-2 top-2 z-10 px-1 py-0 h-4 min-w-10 text-[10px] bg-slate-800 pointer-events-none">
                                                        {group.brand}
                                                    </Badge>
                                                    <NewsItemCard
                                                        group={group}
                                                        compact
                                                        isExpanded={expandedGroups[`c-${dIdx}-${idx}`]}
                                                        onToggle={() => toggleGroup(`c-${dIdx}-${idx}`)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl">
                                <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground font-medium">상단 업데이트 버튼을 클릭하여 경쟁사 동향을 확인하세요.</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">오늘 기준 지난 7일간의 기사를 분석합니다.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function NewsItemCard({ group, isExpanded, onToggle, compact = false }: { group: NewsGroup, isExpanded: boolean, onToggle: () => void, compact?: boolean }) {
    const hasDuplicates = group.all.length > 1;
    return (
        <Card className={cn("group transition-all hover:shadow-md border-l-4", hasDuplicates ? "border-l-primary/40" : "border-l-transparent")}>
            <CardHeader className={cn("p-4 pb-2", compact && "p-3 pb-1")}>
                <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-1">
                        <h3 className={cn("font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2", compact && "text-base")}>
                            <a href={group.main.link} target="_blank" rel="noopener noreferrer" dangerouslySetInnerHTML={{ __html: group.main.title }} />
                        </h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                        <a href={group.main.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className={cn("p-4 pt-0", compact && "p-3 pt-0")}>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3" dangerouslySetInnerHTML={{ __html: group.main.description }} />
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="font-normal">네이버 뉴스</Badge>
                        <span>{format(new Date(group.main.pubDate), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}</span>
                    </div>
                    {hasDuplicates && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/5" onClick={onToggle}>
                            <Layers className="h-3 w-3" />
                            관련 기사 {group.all.length - 1}건 더보기
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                    )}
                </div>
                {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {group.all.slice(1).map((dup, dIdx) => (
                            <div key={dIdx} className="flex items-center justify-between group/dup p-2 hover:bg-accent/5 rounded-md transition-colors">
                                <div className="flex-1 overflow-hidden pr-4">
                                    <a href={dup.link} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary hover:underline line-clamp-1 truncate block" dangerouslySetInnerHTML={{ __html: dup.title }} />
                                </div>
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="text-[10px] text-muted-foreground/60">{format(new Date(dup.pubDate), "HH:mm")}</span>
                                    <a href={dup.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3 w-3" /></a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyState({ isFiltered }: { isFiltered?: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl">
            <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{isFiltered ? "해당 기간의 검색 결과가 없습니다." : "검색 결과가 없습니다."}</p>
            {isFiltered && <p className="text-xs text-muted-foreground/70 mt-2">최근 1,000건의 기사 중 해당 연/월의 기사가 없을 수 있습니다.</p>}
        </div>
    );
}
