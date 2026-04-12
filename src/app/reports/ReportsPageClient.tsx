"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ExternalLink, Calendar as CalendarIcon, FileUp, CheckCircle2, Download, Loader2, BarChart3, Trash2, RefreshCw, X, BookOpen, Search, Newspaper } from "lucide-react";
import { format, isSameMonth, startOfYear, addMonths, isPast, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
// ✅ Recharts는 SSR에서 width/height=-1 계산으로 전체 앱을 크래시시킵니다.
// dynamic(ssr:false)로 완전히 클라이언트에서만 로드합니다.
const DynamicReportsChart = dynamic(() => import('@/components/ReportsChart'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
});
import { extractTextFromFile as globalExtractText } from "@/lib/file-parser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Types matching CalendarPage
interface Event {
    _id?: Id<"calendarEvents">;
    id: number | Id<"calendarEvents">;
    title: string;
    date: Date;
    status: string;
    type: string;
    content?: string;
    image?: string;
    imageContent?: string;
    performanceFile?: string;
    performanceFileName?: string;
    articleCount?: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

export default function ReportsPageClient() {
    const router = useRouter();

    // ✅ SSR 비활성화 모드이므로 직접 new Date() 사용 가능
    const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
    const [today] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    });

    const [isAnalyzing, setIsAnalyzing] = useState<string | number | null>(null);
    const [isFetchingCount, setIsFetchingCount] = useState<string | number | null>(null);
    const [keywordMonthlyStats, setKeywordMonthlyStats] = useState<Record<number, number>>({});
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
    const bulkInputRef = useRef<HTMLInputElement>(null);

    // Hardcoded default brand keyword for Naver search (same as News Clipping default)
    const BRAND_KEYWORD = "데스커";

    // Convex data
    const trainedPrs = useQuery(api.pressReleases.getList);
    const rawEvents = useQuery(api.calendarEvents.getAll); // fallback [] 제거하여 안정성 확보
    const createEvent = useMutation(api.calendarEvents.create);
    const removeEvent = useMutation(api.calendarEvents.remove);
    const updateEvent = useMutation(api.calendarEvents.update);
    const updatePerf = useMutation(api.calendarEvents.updatePerformance);
    const generateUploadUrl = useMutation(api.calendarEvents.generateUploadUrl);

    // ✅ transform rawEvents into stable events using useMemo (infinite loop crash fix)
    const events = useMemo(() => {
        if (!rawEvents) return [];
        return rawEvents.map(e => {
            let d = new Date(e.date);
            if (isNaN(d.getTime())) {
                d = new Date();
            }
            return {
                ...e,
                id: e._id,
                date: d
            };
        });
    }, [rawEvents]);

    const fetchKeywordMonthlyStats = async () => {
        setIsLoadingStats(true);
        const stats: Record<number, number> = {};
        for (let i = 0; i < 12; i++) stats[i] = 0;

        try {
            const searchQuery = BRAND_KEYWORD;
            const sortType = "date";
            const maxPages = 10;

            for (let p = 0; p < maxPages; p++) {
                const start = p * 100 + 1;
                const res = await fetch(`/api/news-search?query=${encodeURIComponent(searchQuery)}&sort=${sortType}&display=100&start=${start}&_t=${Date.now()}`);
                const data = await res.json();

                if (data.items && data.items.length > 0) {
                    data.items.forEach((item: any) => {
                        const date = new Date(item.pubDate);
                        const itemYear = date.getFullYear();
                        const itemMonth = date.getMonth();

                        const now = new Date();
                        const isFutureMonth = itemYear === now.getFullYear() && itemMonth > now.getMonth();

                        if (itemYear === currentYear && !isFutureMonth) {
                            stats[itemMonth] = (stats[itemMonth] || 0) + 1;
                        }
                    });

                    if (data.items.length < 100) break;
                } else {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
            setKeywordMonthlyStats(stats);
        } catch (error) {
            console.error("Failed to fetch keyword stats", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const processFileLocal = async (file: File): Promise<{ base64: string, text: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64 = reader.result as string;
                    let extractedText = "";

                    try {
                        if (file.type.startsWith('image/')) {
                            const TesseractModule = await import('tesseract.js');
                            const Tesseract = TesseractModule.default || TesseractModule;
                            const { data: { text } } = await Tesseract.recognize(base64, 'kor+eng');
                            extractedText = text;
                        } else {
                            extractedText = await globalExtractText(file);
                        }
                    } catch (parseError) {
                        console.error(`Text parsing error for ${file.name}:`, parseError);
                    }

                    resolve({ base64, text: extractedText });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const extractDateFromText = (text: string): Date | null => {
        const datePatterns = [
            /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/,
            /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const day = parseInt(match[3]);
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) return date;
            }
        }
        return null;
    };

    const extractTitleFromText = (text: string, filename: string): string => {
        const explicitMatch = text.match(/(?:Title|제목|Headline)[:\s]+([^\n]+)/i);
        if (explicitMatch && explicitMatch[1].trim()) return explicitMatch[1].trim();

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        if (lines.length > 0) {
            return lines[0].substring(0, 50);
        }

        return filename.replace(/\.[^/.]+$/, "");
    };

    const countArticlesFromText = (text: string): number => {
        const noHeaderPattern = /(NO|번호|No\.)/gi;
        const headerMatch = noHeaderPattern.exec(text);

        if (headerMatch) {
            const afterHeader = text.substring(headerMatch.index);
            const numbersFound = afterHeader.match(/\b\d+\b/g);
            if (numbersFound) {
                const numericIndices = Array.from(new Set(numbersFound.map(Number)))
                    .filter(n => n > 0 && n < 500)
                    .sort((a, b) => a - b);

                if (numericIndices.length > 0) {
                    let sequenceMax = 0;
                    for (let i = 0; i < numericIndices.length; i++) {
                        if (numericIndices[i] === i + 1) {
                            sequenceMax = numericIndices[i];
                        } else {
                            break;
                        }
                    }

                    if (sequenceMax > 0) return sequenceMax;
                    return numericIndices.length;
                }
            }
        }

        const copyrights = (text.match(/ⓒ|Copyright|All rights reserved/gi) || []).length;
        const reporters = (text.match(/[가-힣]{2,4}\s기자|reporter/gi) || []).length;
        const emails = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).length;

        let total = Math.max(copyrights, reporters, emails);
        if (total === 0 && text.trim().length > 100) total = 1;
        return total || 0;
    };


    const extractInfoFromFilename = (filename: string): { date: Date | null, title: string } => {
        let date: Date | null = null;
        let title = "";

        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
        const parts = nameWithoutExt.split('_');

        const dateRegex = /^(20\d{2}|\d{2})[.-]?(\d{2})[.-]?(\d{2})$/;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            const match = part.match(dateRegex);
            if (match) {
                let year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const day = parseInt(match[3]);

                if (year < 100) year += 2000;

                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) {
                    date = d;
                    date.setDate(date.getDate() - 1);
                    break;
                }
            }
        }

        if (parts.length >= 2) {
            title = parts[1].trim();
        } else {
            title = nameWithoutExt;
        }

        return { date, title };
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsBulkAnalyzing(true);
        const newEvents: (Event & { originalFile: File })[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const { date: fileDate, title: fileTitle } = extractInfoFromFilename(file.name);
                    const { text } = await processFileLocal(file);

                    const extractedDate = fileDate || extractDateFromText(text) || new Date();
                    const extractedTitle = fileTitle || extractTitleFromText(text, file.name);
                    const count = countArticlesFromText(text);

                    const newEvent = {
                        id: Date.now() + i,
                        title: extractedTitle,
                        date: extractedDate,
                        status: "배포 완료",
                        type: "보도자료",
                        performanceFileName: file.name,
                        articleCount: count,
                        originalFile: file,
                    };
                    newEvents.push(newEvent);
                } catch (err) {
                    console.error(`Failed to process file ${file.name}`, err);
                }
            }

            if (newEvents.length > 0) {
                let storedCount = 0;
                let failedCount = 0;

                for (let i = 0; i < newEvents.length; i++) {
                    const ev = newEvents[i];
                    const originalFile = ev.originalFile;
                    try {
                        let performanceStorageId: string | undefined;

                        if (originalFile) {
                            const uploadUrl: string = await generateUploadUrl();

                            const uploadRes = await fetch(uploadUrl, {
                                method: "POST",
                                headers: { "Content-Type": originalFile.type || "application/octet-stream" },
                                body: originalFile,
                            });

                            if (!uploadRes.ok) throw new Error("Storage 업로드 실패");

                            const { storageId } = await uploadRes.json();
                            performanceStorageId = storageId;
                        }

                        await createEvent({
                            title: ev.title,
                            date: ev.date.toISOString(),
                            status: ev.status,
                            type: ev.type,
                            performanceStorageId: performanceStorageId as any,
                            performanceFileName: ev.performanceFileName,
                            articleCount: ev.articleCount
                        });

                        storedCount++;
                    } catch (e) {
                        console.error("파일 저장 실패:", ev.performanceFileName, e);
                        failedCount++;
                        alert(`${ev.performanceFileName} 파일 업로드 실패: ${(e as Error).message}`);
                    }
                }

                alert(`${storedCount}개 파일 저장 완료${failedCount > 0 ? `, ${failedCount}개 실패` : "!"}`);
            } else {
                alert("처리할 수 있는 파일이 없습니다. (지원하지 않는 형식이거나 용량이 너무 큼)");
            }
        } catch (error) {
            console.error("Bulk upload failed", error);
            alert("일괄 업로드 중 오류가 발생했습니다.");
        } finally {
            setIsBulkAnalyzing(false);
            if (bulkInputRef.current) bulkInputRef.current.value = "";
        }
    };

    const handleDeleteEvent = async (eventId: Id<"calendarEvents"> | number) => {
        if (!confirm("정말로 이 성과 리포트를 삭제하시겠습니까? (복구할 수 없습니다)")) return;

        try {
            if (typeof eventId !== "number") {
                await removeEvent({ id: eventId });
            }
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    const handleDeletePerformanceFile = async (eventId: Id<"calendarEvents"> | number) => {
        if (!confirm("성과 파일을 삭제하시겠습니까? 관련 기사 수도 초기화됩니다.")) return;

        try {
            if (typeof eventId !== "number") {
                await updatePerf({
                    id: eventId,
                    articleCount: 0,
                    performanceFile: undefined,
                    performanceFileName: undefined
                });
            }
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    const handleFileUpload = async (eventId: Id<"calendarEvents"> | number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(eventId);

        try {
            const { base64, text } = await processFileLocal(file);
            const count = countArticlesFromText(text);

            if (typeof eventId !== "number") {
                await updatePerf({
                    id: eventId,
                    articleCount: count,
                    performanceFile: base64,
                    performanceFileName: file.name
                });
            }
        } catch (error) {
            console.error("Analysis failed", error);
            alert("파일 분석 중 오류가 발생했습니다. 용량이 너무 크거나 지원하지 않는 형식일 수 있습니다.");
        } finally {
            setIsAnalyzing(null);
        }
    };

    const handleUpdateArticleCount = async (eventId: Id<"calendarEvents"> | number, count: string | number) => {
        const numCount = typeof count === "string" ? parseInt(count) || 0 : count;

        try {
            if (typeof eventId !== "number") {
                await updatePerf({
                    id: eventId,
                    articleCount: numCount
                });
            }
        } catch (e) {
            console.error("count update failed", e);
        }
    };

    const handleFetchArticleCount = async (eventId: Id<"calendarEvents"> | number, title: string) => {
        setIsFetchingCount(eventId);
        try {
            const res = await fetch(`/api/news-search?query=${encodeURIComponent(title)}&sort=sim&display=100`);
            const data = await res.json();

            if (data.total !== undefined) {
                await handleUpdateArticleCount(eventId, data.total);
            }
        } catch (error) {
            console.error("Failed to fetch article count from Naver", error);
            alert("네이버 API에서 정보를 가져오는데 실패했습니다.");
        } finally {
            setIsFetchingCount(null);
        }
    };

    const getMonthStats = (monthIndex: number) => {
        const monthDate = new Date(currentYear, monthIndex, 1);
        const monthEvents = events.filter(e => isSameMonth(e.date, monthDate));

        const scheduled = monthEvents.filter(e => e.status === "예정됨" && (today ? e.date >= today : false)).length;
        const published = monthEvents.filter(e => e.status === "배포 완료" || (e.status === "예정됨" && (today ? e.date < today : false))).length;

        const manualArticles = monthEvents.reduce((sum, e) => sum + (e.articleCount || 0), 0);

        const nowDate = new Date();
        const isFuture = currentYear > nowDate.getFullYear()
            || (currentYear === nowDate.getFullYear() && monthIndex > nowDate.getMonth());
        const naverArticles = isFuture ? 0 : (keywordMonthlyStats[monthIndex] || 0);

        return { scheduled, published, manualArticles, naverArticles, monthName: `${monthIndex + 1}월` };
    };

    const chartData = MONTHS.map(m => getMonthStats(m));

    const totalStats = chartData.reduce((acc, curr) => ({
        scheduled: acc.scheduled + curr.scheduled,
        published: acc.published + curr.published,
        manualArticles: acc.manualArticles + curr.manualArticles,
        naverArticles: acc.naverArticles + curr.naverArticles
    }), { scheduled: 0, published: 0, manualArticles: 0, naverArticles: 0 });

    const publishedEvents = events.filter(e => e.status === "배포 완료" || (e.status === "예정됨" && (today ? e.date < today : false)))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    // currentYear가 0이면 아직 초기화 전이므로 로딩 처리
    if (currentYear === 0) {
        return <div className="flex items-center justify-center min-h-[500px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">성과 리포트</h2>
                    <p className="text-muted-foreground">배포 캘린더 데이터 기반 연간 및 상세 성과 현황입니다.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={fetchKeywordMonthlyStats}
                        disabled={isLoadingStats}
                    >
                        {isLoadingStats
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> 검색 중...&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>
                            : <><Search className="w-4 h-4" /> 네이버 뉴스 불러오기</>
                        }
                    </Button>
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCurrentYear(prev => prev - 1)}>{currentYear - 1}</Button>
                        <div className="px-3 font-bold text-primary text-sm">{currentYear}</div>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCurrentYear(prev => prev + 1)}>{currentYear + 1}</Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>배포 계획 (연간)</CardDescription>
                        <CardTitle className="text-2xl">{totalStats.scheduled + totalStats.published}건</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>배포 완료 (연간)</CardDescription>
                        <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">{totalStats.published}건</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-primary/5 to-white dark:from-primary/10">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>뉴스 기사 수 (아카이브)</CardDescription>
                        <CardTitle className="text-2xl text-primary">{totalStats.manualArticles}건</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/10">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription>네이버 뉴스 기사 수</CardDescription>
                        <CardTitle className="text-2xl text-green-600">{totalStats.naverArticles}건</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Tabs defaultValue="yearly" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="yearly" className="gap-2"><BarChart3 className="w-4 h-4" /> 연간 현황</TabsTrigger>
                    <TabsTrigger value="archive" className="gap-2"><FileText className="w-4 h-4" /> 성과 자료 아카이브</TabsTrigger>
                </TabsList>

                <TabsContent value="yearly" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>월별 배포 성과 추이</CardTitle>
                            <CardDescription>배포 계획(예정) 대비 배포 완료 및 기사 게재 건수입니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <DynamicReportsChart
                                data={chartData}
                                onBarClick={(month) => router.push(`/calendar?year=${currentYear}&month=${month}`)}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {MONTHS.map(m => {
                            const { scheduled, published, manualArticles, naverArticles } = getMonthStats(m);
                            const hasData = scheduled > 0 || published > 0 || manualArticles > 0 || naverArticles > 0;

                            return (
                                <Card
                                    key={m}
                                    className={cn("transition-all cursor-pointer hover:border-primary/50 hover:shadow-md", hasData ? "border-primary/20 shadow-sm" : "opacity-60")}
                                    onClick={() => router.push(`/calendar?year=${currentYear}&month=${m + 1}`)}
                                >
                                    <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                                        <CardTitle className="text-base font-bold">{m + 1}월</CardTitle>
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            {manualArticles > 0 && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] h-5 cursor-pointer hover:bg-secondary/80 flex items-center gap-1 shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard?year=${currentYear}&month=${m + 1}`);
                                                    }}
                                                >
                                                    <FileText className="h-3 w-3" />
                                                    {manualArticles}건
                                                </Badge>
                                            )}
                                            {naverArticles > 0 && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] h-5 text-green-700 border-green-200 cursor-pointer hover:bg-green-50 flex items-center gap-1 shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard?year=${currentYear}&month=${m + 1}`);
                                                    }}
                                                >
                                                    <Search className="h-3 w-3" />
                                                    {naverArticles}건
                                                </Badge>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-full hover:bg-muted shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/dashboard?year=${currentYear}&month=${m + 1}`);
                                                }}
                                                title="뉴스 클리핑 보기"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-1">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> 예정
                                                </span>
                                                <span className="font-semibold">{scheduled}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 완료
                                                </span>
                                                <span className="font-semibold">{published}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="archive">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="space-y-1.5">
                                <CardTitle>보도 성과 아카이빙</CardTitle>
                                <CardDescription>배포된 보도자료의 파일을 업로드하면 텍스트를 분석하여 뉴스 기사 수를 자동으로 추출합니다.</CardDescription>
                            </div>
                            <div>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    ref={bulkInputRef}
                                    accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={handleBulkUpload}
                                />
                                <Button
                                    onClick={() => bulkInputRef.current?.click()}
                                    disabled={isBulkAnalyzing}
                                    className="bg-primary/90 hover:bg-primary"
                                >
                                    {isBulkAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                                    {isBulkAnalyzing ? "분석 및 업로드 중..." : "성과 리포트 일괄 업로드"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {publishedEvents.length === 0 ? (
                                    <div className="text-center py-12 border rounded-lg bg-muted/10 border-dashed">
                                        <p className="text-muted-foreground">아직 배포 완료된 보도자료가 없습니다.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-muted/50 border-b">
                                                        <th className="p-3 text-left font-medium">배포일</th>
                                                        <th className="p-3 text-left font-medium">보도자료 제목</th>
                                                        <th className="p-3 text-center font-medium">뉴스 기사 수</th>
                                                        <th className="p-3 text-left font-medium">성과 자료</th>
                                                        <th className="p-3 text-center font-medium w-[80px]">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {publishedEvents.map((event, idx) => (
                                                        <tr key={String(event._id || event.id || idx)} className="border-b last:border-0 hover:bg-muted/30">
                                                            <td className="p-3 text-muted-foreground w-[120px]">
                                                                {format(event.date, "yyyy-MM-dd", { locale: ko })}
                                                            </td>
                                                            <td className="p-3 font-medium min-w-[200px]">{event.title}</td>
                                                            <td className="p-3 text-center w-[160px]">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="relative flex items-center gap-1">
                                                                        <Input
                                                                            type="number"
                                                                            className="w-16 h-8 text-center"
                                                                            value={event.articleCount || 0}
                                                                            onChange={(e) => handleUpdateArticleCount(event.id, e.target.value)}
                                                                        />
                                                                        {event.articleCount && event.articleCount > 0 ? (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                                onClick={() => handleUpdateArticleCount(event.id, 0)}
                                                                                title="기사 수 초기화"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </Button>
                                                                        ) : null}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className={cn("h-8 w-8 text-primary hover:text-primary hover:bg-primary/5", String(isFetchingCount) === String(event.id) && "animate-spin")}
                                                                            onClick={() => handleFetchArticleCount(event.id, event.title)}
                                                                            disabled={isFetchingCount !== null}
                                                                            title="네이버 뉴스에서 기사 수 동기화"
                                                                        >
                                                                            {String(isFetchingCount) === String(event.id) ? <Loader2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                                                                        </Button>
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">건</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    {event.performanceFileName ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                                                            <span className="text-xs text-muted-foreground truncate max-w-[160px]">{event.performanceFileName}</span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                                                                onClick={() => handleDeletePerformanceFile(event.id)}
                                                                                title="성과 파일 삭제"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-primary transition-colors">
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                accept="image/*,application/pdf,.docx"
                                                                                onChange={(e) => handleFileUpload(event.id, e)}
                                                                            />
                                                                            <Upload className="w-3.5 h-3.5" /> 파일 업로드
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => handleDeleteEvent(event.id)}
                                                                    title="삭제"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
