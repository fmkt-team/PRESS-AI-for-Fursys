"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Upload, Edit, X, Trash2, CalendarIcon, Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { format, isSameDay, isSameMonth, addDays, subDays, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isPast, isToday } from "date-fns";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Types
interface Event {
    _id?: Id<"calendarEvents">;
    id: number | Id<"calendarEvents">; // 호환성용
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

// Mock Events
// const MOCK_EVENTS: Event[] = [...]; 
// STORAGE_KEY 

function CalendarContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [newEventOpen, setNewEventOpen] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState("");
    const [selectedDetailEvent, setSelectedDetailEvent] = useState<Event | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    const [editDate, setEditDate] = useState<Date | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [isMigrating, setIsMigrating] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Convex
    const rawEvents = useQuery(api.calendarEvents.getAll);
    const createEvent = useMutation(api.calendarEvents.create);
    const removeEvent = useMutation(api.calendarEvents.remove);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (rawEvents) {
            const parsed = rawEvents.map(e => {
                let d = new Date(e.date);
                if (isNaN(d.getTime())) d = new Date();
                return {
                    ...e,
                    id: e._id,
                    date: d
                };
            });
            setEvents(parsed);
        }
    }, [rawEvents]);

    // Update currentMonth when date changes (e.g. from header buttons)
    useEffect(() => {
        if (date) {
            setCurrentMonth(date);
        }
    }, [date]);

    // Initial date from query params
    useEffect(() => {
        const year = searchParams.get("year");
        const month = searchParams.get("month");
        if (year && month) {
            const initialDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            if (!isNaN(initialDate.getTime())) {
                setDate(initialDate);
                setCurrentMonth(initialDate);
            }
        }
    }, [searchParams]);

    const selectedDateEvents = events.filter(e => date && isSameDay(e.date, date));
    const selectedMonthEvents = events.filter(e => date && isSameMonth(e.date, date)).sort((a, b) => a.date.getTime() - b.date.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scheduledDates = events
        .filter(e => e.status === "예정됨" && e.date >= today)
        .map(e => e.date);

    const publishedDates = events
        .filter(e => e.status === "배포됨" || (e.status === "예정됨" && e.date < today))
        .map(e => e.date);

    const handleCreateEvent = async () => {
        if (!date || !newEventTitle) return;

        try {
            await createEvent({
                title: newEventTitle,
                date: date.toISOString(),
                status: "예정됨",
                type: "보도자료"
            });
            setNewEventTitle("");
            setNewEventOpen(false);
        } catch (error) {
            console.error("Failed to create event:", error);
            alert("일정 생성에 실패했습니다.");
        }
    };

    const handleMigrateLocalData = async () => {
        const confirmMsg = "현재 기기에 예전 방식으로 저장되어 있던 전체 캘린더 데이터를 새 클라우드(Convex)로 불러옵니다.\n\n진행하시겠습니까? (이 작업에는 몇 초 정도 소요될 수 있으며, 이미 가져온 데이터는 중복될 수 있습니다.)";
        if (!window.confirm(confirmMsg)) return;

        try {
            setIsMigrating(true);
            const localforage = (await import('localforage')).default;
            let localData: any[] | null = await localforage.getItem('calendarEvents');

            // ✅ 이전 마이그레이션 시도로 인해 백업된 데이터가 있다면 대신 가져옵니다.
            if (!localData || localData.length === 0) {
                localData = await localforage.getItem('calendarEvents_migrated_backup');
            }

            if (!localData || localData.length === 0) {
                alert("가져올 기존 로컬 데이터가 없습니다.");
                setIsMigrating(false);
                return;
            }

            let successCount = 0;
            let failCount = 0;

            for (const oldEvent of localData) {
                try {
                    // MOCK_EVENTS 등에서 온 ID가 숫자인지 확인, 로컬 데이터는 무작위일 수 있음
                    await createEvent({
                        title: oldEvent.title,
                        date: new Date(oldEvent.date).toISOString(),
                        status: oldEvent.status || "예정됨",
                        type: oldEvent.type || "보도자료",
                        content: oldEvent.content,
                        image: oldEvent.image,
                        imageContent: oldEvent.imageContent, // 주의: Convex 무료 용량 제한(1MB) 초과 시 여기서 튕길 수 있음
                        performanceFile: oldEvent.performanceFile,
                        performanceFileName: oldEvent.performanceFileName,
                        articleCount: oldEvent.articleCount
                    });
                    successCount++;
                } catch (e) {
                    console.error("Failed to migrate specific event", oldEvent.title, e);
                    failCount++;
                }
            }

            if (failCount > 0) {
                alert(`가져오기 완료: ${successCount}건 성공 (첨부파일 용량 초과 등 1MB를 넘는 파일 때문에 ${failCount}건 실패)`);
            } else {
                alert(`성공적으로 총 ${successCount}건의 기존 데이터를 Convex 클라우드에 복구했습니다!`);

                // 중복 방지를 위해 삭제할 수도 있으나, 안전을 위해 일단 이름만 변경
                await localforage.setItem('calendarEvents_migrated_backup', localData);
                await localforage.removeItem('calendarEvents');
            }
        } catch (error) {
            console.error("Failed to run local migration", error);
            alert("마이그레이션 도중 오류가 발생했습니다.");
        } finally {
            setIsMigrating(false);
        }
    };

    const handleDownloadImage = (filename: string, content: string) => {
        const link = document.createElement("a");
        link.href = content;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadText = (filename: string, content: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleStartEdit = (event: Event) => {
        // 기존 캘린더 내 모달 수정 대신, PR 생성기 화면으로 이동 (임시 세션 저장 후)
        sessionStorage.setItem('presscraft-edit-event', JSON.stringify(event));

        // 컨텐츠 본문 유무에 따라 라우팅 파라미터 전달
        // hasContent=true -> generator step 2
        // hasContent=false -> generator step 1
        const hasContent = event.content && event.content.trim().length > 0;
        router.push(`/generator?editEventId=${event.id}&hasContent=${hasContent ? 'true' : 'false'}`);
    };

    const handleDeleteEvent = async (id: number | Id<"calendarEvents">) => {
        if (!window.confirm("정말로 이 일정을 삭제하시겠습니까?")) return;

        try {
            // Convert to Convex Id
            if (typeof id === "string") {
                await removeEvent({ id: id as Id<"calendarEvents"> });
                setSelectedDetailEvent(null);
            } else {
                // If it happens to be numeric mock data (which shouldn't exist anymore), just filtering UI
                const updatedEvents = events.filter(e => e.id !== id);
                setEvents(updatedEvents);
                setSelectedDetailEvent(null);
            }
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert("일정 삭제에 실패했습니다.");
        }
    };

    const handleExportToWord = async (event: Event) => {
        try {
            const children: any[] = [
                new Paragraph({
                    text: event.title,
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 400 },
                }),
            ];

            if (event.imageContent) {
                const base64Data = event.imageContent.split(",")[1];
                const binaryString = window.atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                children.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: bytes as any,
                                transformation: {
                                    width: 400,
                                    height: 300,
                                },
                            } as any),
                        ],
                        spacing: { after: 400 },
                    })
                );
            }

            if (event.content) {
                const paragraphs = event.content.split("\n").map(line =>
                    new Paragraph({
                        children: [new TextRun(line)],
                        spacing: { after: 200 },
                    })
                );
                children.push(...paragraphs);
            }

            const doc = new Document({
                sections: [
                    {
                        properties: {},
                        children: children,
                    },
                ],
            });

            const blob = await Packer.toBlob(doc);
            saveAs(blob, `${event.title}.docx`);
        } catch (error) {
            console.error("Failed to export to Word", error);
            alert("Word 파일 생성 중 오류가 발생했습니다.");
        }
    };

    const handlePrev = () => {
        if (!date) return;
        if (viewMode === 'day') {
            setDate(subDays(date, 1));
        } else {
            setDate(subMonths(date, 1));
        }
    };

    const handleNext = () => {
        if (!date) return;
        if (viewMode === 'day') {
            setDate(addDays(date, 1));
        } else {
            setDate(addMonths(date, 1));
        }
    };

    if (!isMounted) {
        return <div className="flex items-center justify-center min-h-[500px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">배포 캘린더</h2>
                    <p className="text-muted-foreground">콘텐츠 배포 일정을 관리하세요.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-primary border-primary hover:bg-primary/5"
                    onClick={handleMigrateLocalData}
                    disabled={isMigrating}
                >
                    {isMigrating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    기존 로컬 데이터 불러오기 (마이그레이션)
                </Button>
            </div>

            <div className="grid md:grid-cols-7 gap-6">
                <div className="md:col-span-3">
                    <Card>
                        <CardContent className="p-4 flex justify-center">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                month={currentMonth}
                                onMonthChange={setCurrentMonth}
                                className="rounded-md border"
                                modifiers={{
                                    scheduled: scheduledDates,
                                    published: publishedDates,
                                }}
                                modifiersClassNames={{
                                    scheduled: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-yellow-400 after:rounded-full",
                                    published: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-blue-500 after:rounded-full",
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-4 space-y-4">
                    <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
                        <div className="flex bg-muted rounded-md p-1 gap-1">
                            <Button
                                variant={viewMode === 'day' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('day')}
                                className="h-7 text-xs"
                            >
                                일간 보기
                            </Button>
                            <Button
                                variant={viewMode === 'month' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('month')}
                                className="h-7 text-xs"
                            >
                                월간 보기
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <h3 className="text-xl font-semibold min-w-[140px] text-center">
                                {date ? format(date, viewMode === 'day' ? "yyyy년 MM월 dd일" : "yyyy년 MM월", { locale: ko }) : "날짜를 선택하세요"}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> 일정 추가</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>새 배포 일정 등록</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>제목</Label>
                                        <Input
                                            value={newEventTitle}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventTitle(e.target.value)}
                                            placeholder="예: 신기능 출시 공지"
                                        />
                                    </div>
                                    <Button onClick={handleCreateEvent} className="w-full">등록하기</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {viewMode === 'day' ? (
                        selectedDateEvents.length === 0 ? (
                            <div className="text-center py-12 border rounded-lg bg-muted/20 border-dashed">
                                <p className="text-muted-foreground">이 날짜에 예정된 일정이 없습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedDateEvents.map(event => (
                                    <Card
                                        key={event.id}
                                        className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setSelectedDetailEvent(event)}
                                    >
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base font-medium">{event.title}</CardTitle>
                                                <Badge
                                                    className={event.status === '배포됨' || event.date < today ? "bg-blue-500 hover:bg-blue-600" : "bg-yellow-400 text-black hover:bg-yellow-500"}
                                                >
                                                    {event.status === '배포됨' || event.date < today ? '배포됨' : '예정됨'}
                                                </Badge>
                                            </div>
                                            <CardDescription>{event.type}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        )
                    ) : (
                        selectedMonthEvents.length === 0 ? (
                            <div className="text-center py-12 border rounded-lg bg-muted/20 border-dashed">
                                <p className="text-muted-foreground">이번 달에 예정된 일정이 없습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedMonthEvents.map(event => (
                                    <Card
                                        key={event.id}
                                        className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setSelectedDetailEvent(event)}
                                    >
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-muted-foreground">
                                                        {format(event.date, "MM/dd (eee)", { locale: ko })}
                                                    </span>
                                                    <CardTitle className="text-base font-medium">{event.title}</CardTitle>
                                                </div>
                                                <Badge
                                                    className={event.status === '배포됨' || event.date < today ? "bg-blue-500 hover:bg-blue-600" : "bg-yellow-400 text-black hover:bg-yellow-500"}
                                                >
                                                    {event.status === '배포됨' || event.date < today ? '배포됨' : '예정됨'}
                                                </Badge>
                                            </div>
                                            <CardDescription>{event.type}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            <Dialog
                open={!!selectedDetailEvent}
                onOpenChange={(open: boolean) => {
                    if (!open) {
                        setSelectedDetailEvent(null);
                        setIsEditing(false);
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto text-foreground">
                    {selectedDetailEvent && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline">{selectedDetailEvent.type}</Badge>
                                        <Badge
                                            className={selectedDetailEvent.status === '배포됨' || selectedDetailEvent.date < today ? "bg-blue-500" : "bg-yellow-400 text-black"}
                                        >
                                            {selectedDetailEvent.status === '배포됨' || selectedDetailEvent.date < today ? '배포됨' : '예정됨'}
                                        </Badge>
                                    </div>
                                    {!isEditing && (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteEvent(selectedDetailEvent.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <div className="w-[1px] h-4 bg-border mx-1 self-center" />
                                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleExportToWord(selectedDetailEvent)}>
                                                <Download className="w-3.5 h-3.5" /> Word 추출
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleStartEdit(selectedDetailEvent)}>
                                                <Edit className="w-3.5 h-3.5" /> 생성/수정
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <DialogTitle className="text-2xl mt-1">{selectedDetailEvent.title}</DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-muted-foreground">배포 예정일:</span>
                                    <p className="text-sm font-medium">
                                        {format(selectedDetailEvent.date, "yyyy년 MM월 dd일", { locale: ko })}
                                    </p>
                                </div>
                            </DialogHeader>

                            <div className="space-y-6 pt-4">
                                {selectedDetailEvent.image && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-muted-foreground">첨부 이미지</Label>
                                            {!isEditing && selectedDetailEvent.imageContent && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1"
                                                    onClick={() => handleDownloadImage(selectedDetailEvent.image!, selectedDetailEvent.imageContent!)}
                                                >
                                                    <Download className="w-3 h-3" /> 다운로드
                                                </Button>
                                            )}
                                        </div>
                                        <div className="p-4 bg-muted/20 rounded-lg flex items-center justify-center border-dashed border-2">
                                            <div className="text-center">
                                                {selectedDetailEvent.imageContent ? (
                                                    <img src={selectedDetailEvent.imageContent} alt={selectedDetailEvent.image} className="max-h-48 rounded mb-2 shadow-sm" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2 text-muted-foreground">
                                                        <Upload className="w-6 h-6" />
                                                    </div>
                                                )}
                                                <p className="text-sm font-medium">{selectedDetailEvent.image}</p>
                                                <p className="text-xs text-muted-foreground">보도자료 메인 이미지</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-muted-foreground">보도자료 본문</Label>
                                        {selectedDetailEvent.content && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs gap-1"
                                                onClick={() => handleDownloadText(selectedDetailEvent.title, selectedDetailEvent.content!)}
                                            >
                                                <Download className="w-3 h-3" /> PR 파일(.txt) 저장
                                            </Button>
                                        )}
                                    </div>

                                    {selectedDetailEvent.content ? (
                                        <div
                                            className="whitespace-pre-wrap p-6 bg-white rounded-lg border leading-loose text-[15px] prose prose-sm max-w-none shadow-inner text-black [&_p]:!mb-6 [&_p]:!leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: selectedDetailEvent.content }}
                                        />
                                    ) : (
                                        <div className="p-6 bg-white rounded-lg border text-center text-muted-foreground shadow-inner text-black">
                                            아직 작성된 보도자료 내용이 없습니다. 상단의 '생성/수정' 버튼을 눌러 제작을 시작해보세요!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function CalendarPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <CalendarContent />
        </Suspense>
    );
}
