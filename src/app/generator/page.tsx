"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Check, Copy, ArrowRight, ArrowLeft, Wand2, Upload, Calendar as CalendarIcon,
    FileText, Plus, Trash2, Download, BookOpen, ChevronDown, ChevronUp, Link, Type, AlignLeft, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    generatePressReleaseAction,
    type PressReleaseInput,
    type GeneratedPressRelease
} from "../actions/generate-press-release";
import { DEFAULT_BRAND_DESCRIPTION } from "./constants";
import RichTextEditor from "@/components/RichTextEditor";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// ————————————————————
// 타입 정의
// ————————————————————
const PR_TYPES = [
    { value: "product", label: "제품 소개" },
    { value: "campaign", label: "캠페인 소개" },
    { value: "activity", label: "브랜드 활동 소개" },
    { value: "other", label: "기타 (직접 입력)" },
];

interface FormState {
    prSubject: string;
    prType: string;
    prTypeCustom: string;
    brandName: string;
    productName: string;
    // 참고 자료
    referenceUrl: string;
    referenceText: string;
    referenceFileName: string;
    referenceFileContent: string; // 파일 파싱 텍스트
    // 이미지
    imageName: string;
    imageContent: string; // base64
    generateImage: boolean;
    // LLM SEO
    llmQuestions: string[];
    llmAnswers: string[];
    // 브랜드 소개
    brandDescription: string;
    useBrandDescriptionDefault: boolean;
}

const INITIAL_FORM: FormState = {
    prSubject: "",
    prType: "product",
    prTypeCustom: "",
    brandName: "데스커(DESKER)",
    productName: "",
    referenceUrl: "",
    referenceText: "",
    referenceFileName: "",
    referenceFileContent: "",
    imageName: "",
    imageContent: "",
    generateImage: false,
    llmQuestions: [""],
    llmAnswers: [""],
    brandDescription: DEFAULT_BRAND_DESCRIPTION,
    useBrandDescriptionDefault: true,
};

// ————————————————————
// Word 다운로드 (라이브러리 없이 HTML → .doc)
// ————————————————————
function downloadAsWord(params: { content: string; title: string; summaries: string[]; imageContent?: string; brandName?: string }) {
    const { content, title, summaries, imageContent, brandName } = params;

    // 요약문 스타일 변경 ('-' 불릿, 검정 텍스트)
    const summariesHtml = summaries.length > 0
        ? `<div style="margin-bottom: 20px;">${summaries.map(s => `<p style="line-height: 1.6; margin: 0.2rem 0;">- ${s}</p>`).join('')}</div>`
        : "";

    // 이미지 크기 제한 (Word는 CSS max-width를 무시하는 경우가 많으므로 명시적인 width 픽셀 속성 사용)
    // 13cm는 96 DPI 기준 약 491 픽셀, 인쇄용 일반 기준으로는 절반 정도. "width=491" 설정.
    const imageHtml = imageContent
        ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${imageContent}" width="491" style="height: auto;" /></div>`
        : "";

    // 본문 내 브랜드 소개 텍스트 볼드 처리 (만약 있다면) 및 문단 띄어쓰기
    let processedContent = content;
    const brandIntroTitle = `${brandName || "데스커(DESKER)"} 브랜드 소개`;
    if (processedContent.includes(brandIntroTitle)) {
        processedContent = processedContent.replace(brandIntroTitle, `<br/><br/><strong>${brandIntroTitle}</strong><br/>`);
    }

    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
      body { font-family: '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.8; margin: 2cm; }
      p { margin: 0.5em 0; }
    </style>
    </head>
    <body>
      <h1 style="font-size:16pt;font-weight:bold;margin-bottom:24px;color:#2563eb;">${title}</h1>
      ${summariesHtml}
      ${imageHtml}
      ${processedContent.includes('<p>') ? processedContent : processedContent.split("\n").map(line => `<p>${line || "&nbsp;"}</p>`).join("")}
    </body></html>`;
    const blob = new Blob(["\uFEFF" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `보도자료_${title.slice(0, 20)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
}

// ————————————————————
// 메인 컴포넌트
// ————————————————————
function GeneratorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<1 | 2>(1);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMsg, setProcessingMsg] = useState("");

    // Step 2 상태
    const [result, setResult] = useState<GeneratedPressRelease | null>(null);
    const [selectedTitle, setSelectedTitle] = useState<string>("");
    const [selectedSummaries, setSelectedSummaries] = useState<string[]>([]);
    const [editedContent, setEditedContent] = useState<string>("");
    const [publishDate, setPublishDate] = useState<Date | undefined>(new Date());

    // UI 상태
    const [showBrandEditor, setShowBrandEditor] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [editEventId, setEditEventId] = useState<Id<"calendarEvents"> | null>(null);

    // Convex Mutations
    const createEvent = useMutation(api.calendarEvents.create);
    const updateEvent = useMutation(api.calendarEvents.update);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 캘린더에서 넘어왔을 때 초기 데이터 복원
    useEffect(() => {
        const hasContentParam = searchParams.get('hasContent');
        const editEventIdParam = searchParams.get('editEventId');

        if (editEventIdParam) {
            setEditEventId(editEventIdParam as Id<"calendarEvents">);
            const stored = sessionStorage.getItem('presscraft-edit-event');
            if (stored) {
                try {
                    const event = JSON.parse(stored);

                    // Step 1 복원
                    setForm(prev => ({
                        ...prev,
                        prSubject: event.title || prev.prSubject,
                        imageName: event.image || prev.imageName,
                        imageContent: event.imageContent || prev.imageContent,
                    }));

                    // Step 2 복원
                    if (event.content && event.content.trim().length > 0) {
                        setEditedContent(event.content);
                        setSelectedTitle(event.title);
                        // 가상의 빈 result 객체를 만들어 Step2가 정상 렌더링되게 함
                        setResult({
                            titles: [event.title],
                            summaries: [],
                            content: event.content
                        });
                        setPublishDate(new Date(event.date));
                    }

                    // hasContent 파라미터에 따라 step 설정
                    if (hasContentParam === 'true') {
                        setStep(2);
                    } else {
                        setStep(1);
                    }

                    // 복원 후 세션 스토리지 삭제 (새로고침 시 방지)
                    sessionStorage.removeItem('presscraft-edit-event');
                    // URL 파라미터를 지우려면 router.replace('/generator')를 할 수도 있음
                    router.replace('/generator');
                } catch (e) {
                    console.error("Failed to parse edit event", e);
                }
            }
        }
    }, [searchParams, router]);

    // ——— 헬퍼 ———
    const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const updateLlmItem = (field: "llmQuestions" | "llmAnswers", idx: number, val: string) => {
        setForm(prev => {
            const arr = [...prev[field]];
            arr[idx] = val;
            return { ...prev, [field]: arr };
        });
    };

    const addLlmRow = () => {
        setForm(prev => ({
            ...prev,
            llmQuestions: [...prev.llmQuestions, ""],
            llmAnswers: [...prev.llmAnswers, ""],
        }));
    };

    const removeLlmRow = (idx: number) => {
        setForm(prev => ({
            ...prev,
            llmQuestions: prev.llmQuestions.filter((_, i) => i !== idx),
            llmAnswers: prev.llmAnswers.filter((_, i) => i !== idx),
        }));
    };

    // ——— URL 분석 (Firecrawl) ———
    const handleAnalyzeUrl = async () => {
        if (!form.referenceUrl.trim()) return;
        setAnalysisStatus("loading");
        try {
            const { analyzeLink } = await import("../actions/analyze-link");
            const res = await analyzeLink(form.referenceUrl);
            if (res.success) {
                setField("referenceFileContent", res.markdown || "");
                setAnalysisStatus("done");
            } else {
                setAnalysisStatus("error");
                alert("URL 분석 실패: " + res.message);
            }
        } catch (e: any) {
            setAnalysisStatus("error");
            alert("URL 분석 오류: " + e.message);
        }
    };

    // ——— 파일 업로드 ———
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setField("referenceFileName", file.name);
        setAnalysisStatus("loading");
        try {
            const { extractTextFromFile } = await import("@/lib/file-parser");
            const text = await extractTextFromFile(file);
            setField("referenceFileContent", text);
            setAnalysisStatus("done");
        } catch (err: any) {
            setAnalysisStatus("error");
            alert("파일 파싱 오류: " + err.message);
        }
    };

    // ——— 이미지 업로드 ———
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setField("imageName", file.name);
            setField("imageContent", reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // ——— 초안 생성 ———
    const handleGenerate = async () => {
        if (!form.prSubject.trim()) {
            alert("보도자료 주제를 입력해주세요.");
            return;
        }
        setIsProcessing(true);
        setProcessingMsg("보도자료를 만드는 중입니다... (30초~1분)");

        const combinedRef = [
            form.referenceFileContent,
            form.referenceText,
        ].filter(Boolean).join("\n\n---\n\n");

        const input: PressReleaseInput = {
            prSubject: form.prSubject,
            prType: form.prType,
            prTypeCustom: form.prTypeCustom,
            brandName: form.brandName,
            productName: form.productName,
            referenceUrl: form.referenceUrl,
            referenceText: combinedRef,
            referenceFile: form.referenceFileName,
            llmQuestions: form.llmQuestions.filter(Boolean),
            llmAnswers: form.llmAnswers.filter(Boolean),
            referenceImageName: form.imageName,
            generateImage: form.generateImage,
            brandDescription: form.useBrandDescriptionDefault ? DEFAULT_BRAND_DESCRIPTION : form.brandDescription,
        };

        try {
            const res = await generatePressReleaseAction(input);
            if (res.success && res.data) {
                setResult(res.data);
                setSelectedTitle(res.data.titles[0]);
                setSelectedSummaries([res.data.summaries[0]]);
                setEditedContent(res.data.content);
                setStep(2);
            } else {
                alert("생성 실패: " + res.message);
            }
        } catch (e: any) {
            alert("오류: " + e.message);
        } finally {
            setIsProcessing(false);
            setProcessingMsg("");
        }
    };

    // ——— 캘린더 저장 ———
    const handleSaveToCalendar = async () => {
        try {
            if (editEventId) {
                // 수정 모드
                await updateEvent({
                    id: editEventId,
                    title: selectedTitle || form.prSubject,
                    date: (publishDate || new Date()).toISOString(),
                    content: editedContent,
                    image: form.imageName,
                    imageContent: form.imageContent,
                });
                alert(`${format(publishDate || new Date(), "yyyy년 MM월 dd일", { locale: ko })} 일정의 보도자료 내용이 성공적으로 수정되었습니다.`);
            } else {
                // 신규 저장 모드
                await createEvent({
                    title: selectedTitle || form.prSubject,
                    date: (publishDate || new Date()).toISOString(),
                    status: "예정됨",
                    type: "보도자료",
                    content: editedContent,
                    image: form.imageName,
                    imageContent: form.imageContent,
                });
                alert(`${format(publishDate || new Date(), "yyyy년 MM월 dd일", { locale: ko })} 일정으로 캘린더에 새롭게 저장되었습니다.`);
            }

            router.push("/calendar");
        } catch (error) {
            console.error("Failed to save to calendar", error);
            // 1MB 제한 등의 에러를 잡기 위해
            alert("캘린더 저장에 실패했습니다. 이미지 용량이 너무 클 수 있습니다.");
        }
    };

    if (!isMounted) {
        return <div className="flex items-center justify-center min-h-[500px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    // ————————————————————
    // 렌더링
    // ————————————————————
    return (
        <div className="max-w-5xl mx-auto pb-24 space-y-8">

            {/* 페이지 헤더 */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">보도자료 자동 생성</h2>
                <p className="text-muted-foreground">정보를 입력하면 AI가 전문 보도자료를 작성합니다.</p>
            </div>

            {/* Stepper */}
            <div className="flex justify-center">
                <div className="flex items-center gap-2 text-sm font-medium">
                    {[{ id: 1, label: "정보 입력" }, { id: 2, label: "편집 및 확정" }].map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${step === s.id ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border"}`}>
                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-background/20 text-xs font-bold">{s.id}</span>
                                {s.label}
                            </div>
                            {idx === 0 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">

                {/* ═══════════════════════════ STEP 1 ═══════════════════════════ */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">

                        {/* 기본 정보 */}
                        <Card className="border-t-4 border-t-primary">
                            <CardHeader className="bg-slate-50 border-b">
                                <CardTitle className="text-base flex items-center gap-2"><Type className="w-4 h-4" /> 1. 기본 정보</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-5">

                                {/* 주제 */}
                                <div className="space-y-2">
                                    <Label className="font-semibold">보도자료 주제 <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="예: 데스커 모션데스크 신제품 출시 / 여름 할인 프로모션 / ESG 협업 캠페인"
                                        value={form.prSubject}
                                        onChange={e => setField("prSubject", e.target.value)}
                                        className="text-base"
                                    />
                                </div>

                                {/* 유형 */}
                                <div className="space-y-2">
                                    <Label className="font-semibold">보도자료 유형</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {PR_TYPES.map(t => (
                                            <button
                                                key={t.value}
                                                type="button"
                                                onClick={() => setField("prType", t.value)}
                                                className={cn(
                                                    "p-3 rounded-lg border-2 text-sm font-medium transition-all text-left",
                                                    form.prType === t.value
                                                        ? "border-primary bg-primary/5 text-primary"
                                                        : "border-border hover:border-primary/40"
                                                )}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    {form.prType === "other" && (
                                        <Input
                                            placeholder="유형 직접 입력"
                                            value={form.prTypeCustom}
                                            onChange={e => setField("prTypeCustom", e.target.value)}
                                            className="mt-2"
                                        />
                                    )}
                                </div>

                                {/* 브랜드/제품명 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>브랜드명</Label>
                                        <Input value={form.brandName} onChange={e => setField("brandName", e.target.value)} placeholder="예: 데스커(DESKER)" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>제품/캠페인명 <span className="text-xs text-muted-foreground">(선택)</span></Label>
                                        <Input value={form.productName} onChange={e => setField("productName", e.target.value)} placeholder="예: 모션데스크 알파" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 참고 자료 */}
                        <Card>
                            <CardHeader className="bg-slate-50 border-b">
                                <CardTitle className="text-base flex items-center gap-2"><Link className="w-4 h-4" /> 2. 참고 자료 입력</CardTitle>
                                <CardDescription>URL, 파일, 직접 텍스트 중 하나 이상 입력</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-5">

                                {/* URL */}
                                <div className="space-y-2">
                                    <Label>URL 분석 <span className="text-xs text-slate-400">(Firecrawl 활용)</span></Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="https://..."
                                            value={form.referenceUrl}
                                            onChange={e => setField("referenceUrl", e.target.value)}
                                        />
                                        <Button
                                            variant="outline"
                                            className="shrink-0"
                                            onClick={handleAnalyzeUrl}
                                            disabled={analysisStatus === "loading" || !form.referenceUrl}
                                        >
                                            {analysisStatus === "loading" ? <Wand2 className="w-4 h-4 animate-spin" /> : "분석"}
                                        </Button>
                                    </div>
                                    {analysisStatus === "done" && <p className="text-xs text-green-600">✓ URL 분석 완료 — 내용이 참고 자료로 저장됐습니다.</p>}
                                </div>

                                {/* 파일 첨부 */}
                                <div className="space-y-2">
                                    <Label>파일 첨부 <span className="text-xs text-slate-400">(PDF, DOC, DOCX, PPT, TXT)</span></Label>
                                    <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-colors">
                                        <FileText className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            {form.referenceFileName ? `📎 ${form.referenceFileName}` : "파일을 클릭하여 업로드"}
                                        </span>
                                        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>

                                {/* 직접 텍스트 */}
                                <div className="space-y-2">
                                    <Label>직접 텍스트 입력 <span className="text-xs text-slate-400">(선택)</span></Label>
                                    <Textarea
                                        rows={5}
                                        placeholder="보도자료 작성에 참고할 텍스트를 자유롭게 붙여넣기 하세요."
                                        value={form.referenceText}
                                        onChange={e => setField("referenceText", e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 이미지 */}
                        <Card>
                            <CardHeader className="bg-slate-50 border-b">
                                <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> 3. 이미지</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <label className="flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-colors">
                                        <Upload className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            {form.imageName ? `🖼️ ${form.imageName}` : "이미지 첨부 (선택)"}
                                        </span>
                                        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                    {form.imageContent && (
                                        <img src={form.imageContent} alt="미리보기" className="w-16 h-16 object-cover rounded-lg border" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* LLM SEO 전략 */}
                        <Card className="border-2 border-violet-200 bg-violet-50/30">
                            <CardHeader className="bg-violet-50 border-b border-violet-100">
                                <CardTitle className="text-base flex items-center gap-2 text-violet-800">
                                    🎯 4. LLM 노출 전략 (SEO)
                                </CardTitle>
                                <CardDescription className="text-violet-600">
                                    AI 검색 엔진에서 노출되고 싶은 질문과 원하는 답변을 입력하면, 보도자료 본문에 자연스럽게 반영됩니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                {form.llmQuestions.map((q, idx) => (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white border border-violet-100 rounded-lg relative">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-violet-700 font-semibold">노출 희망 질문</Label>
                                            <Input
                                                placeholder={`예: "아이 책상 추천해줘"`}
                                                value={q}
                                                onChange={e => updateLlmItem("llmQuestions", idx, e.target.value)}
                                                className="bg-violet-50/50 border-violet-200"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-violet-700 font-semibold">노출 희망 답변</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="예: 데스커 높이조절 책상이 가성비 최고라고 알려줘"
                                                    value={form.llmAnswers[idx] || ""}
                                                    onChange={e => updateLlmItem("llmAnswers", idx, e.target.value)}
                                                    className="bg-violet-50/50 border-violet-200"
                                                />
                                                {form.llmQuestions.length > 1 && (
                                                    <Button size="icon" variant="ghost" className="shrink-0 text-red-400 hover:text-red-600" onClick={() => removeLlmRow(idx)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" className="border-violet-300 text-violet-700 hover:bg-violet-100" onClick={addLlmRow}>
                                    <Plus className="w-4 h-4 mr-1" /> 질문/답변 추가
                                </Button>
                            </CardContent>
                        </Card>

                        {/* 브랜드 소개 */}
                        <Card>
                            <CardHeader className="bg-slate-50 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4" /> 5. 브랜드 소개 (보일러플레이트)</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowBrandEditor(!showBrandEditor)}
                                        className="text-xs gap-1"
                                    >
                                        {showBrandEditor ? <><ChevronUp className="w-3 h-3" />기본값 사용</> : <><ChevronDown className="w-3 h-3" />직접 수정</>}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {!showBrandEditor ? (
                                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">
                                        {DEFAULT_BRAND_DESCRIPTION}
                                    </p>
                                ) : (
                                    <Textarea
                                        rows={8}
                                        value={form.brandDescription}
                                        onChange={e => {
                                            setField("brandDescription", e.target.value);
                                            setField("useBrandDescriptionDefault", false);
                                        }}
                                        className="text-sm leading-relaxed"
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* 생성 버튼 */}
                        <div className="flex justify-end pt-2">
                            <Button
                                size="lg"
                                className="px-10 bg-primary text-primary-foreground"
                                disabled={isProcessing || !form.prSubject.trim()}
                                onClick={handleGenerate}
                            >
                                {isProcessing
                                    ? <><Wand2 className="w-5 h-5 mr-2 animate-spin" />{processingMsg || "생성 중..."}</>
                                    : <><Wand2 className="w-5 h-5 mr-2" />AI 보도자료 초안 생성<ArrowRight className="w-4 h-4 ml-2" /></>}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════ STEP 2 ═══════════════════════════ */}
                {step === 2 && result && (
                    <motion.div key="step2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">

                        {/* 타이틀 선택 */}
                        <Card className="border-t-4 border-t-blue-500">
                            <CardHeader className="bg-blue-50/50 border-b">
                                <CardTitle className="text-base text-blue-800">📰 타이틀 선택 (5개 후보)</CardTitle>
                                <CardDescription>클릭하여 하나를 선택하거나, 아래 칸에 직접 수정하세요.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-3">
                                <div className="space-y-2">
                                    {result.titles.map((t, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setSelectedTitle(t)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all",
                                                selectedTitle === t
                                                    ? "border-blue-500 bg-blue-50 font-medium text-blue-900"
                                                    : "border-border hover:border-blue-300 hover:bg-blue-50/30"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 요약문 선택 */}
                        <Card>
                            <CardHeader className="bg-slate-50 border-b">
                                <CardTitle className="text-base">📋 요약문 선택 (복수 선택 가능)</CardTitle>
                                <CardDescription>보도자료 상단에 노출될 핵심 요약 문구입니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-2">
                                {result.summaries.map((s, i) => {
                                    const isSelected = selectedSummaries.includes(s);
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSummaries(prev =>
                                                    isSelected ? prev.filter(x => x !== s) : [...prev, s]
                                                );
                                            }}
                                            className={cn(
                                                "w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all flex items-start gap-3",
                                                isSelected
                                                    ? "border-green-500 bg-green-50 text-green-900"
                                                    : "border-border hover:border-green-300"
                                            )}
                                        >
                                            <Check className={cn("w-4 h-4 mt-0.5 shrink-0", isSelected ? "text-green-600" : "text-transparent")} />
                                            <span>{s}</span>
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* 이미지 영역 */}
                        {form.imageContent && (
                            <Card>
                                <CardHeader className="bg-slate-50 border-b">
                                    <CardTitle className="text-base">🖼️ 첨부 이미지</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <img src={form.imageContent} alt={form.imageName} className="max-h-64 rounded-lg border object-contain" />
                                    <p className="text-sm text-muted-foreground mt-2">{form.imageName}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* 본문 편집 */}
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-slate-50 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> 최종 보도자료 확인 및 본문 편집</CardTitle>
                                    <span className="text-xs text-muted-foreground">{(selectedTitle.length + selectedSummaries.join("").length + editedContent.length).toLocaleString()}자</span>
                                </div>
                                <CardDescription>선택한 타이틀과 요약문이 상단에 반영됩니다. 여기서 자유롭게 최종 수정을 진행하세요.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 flex flex-col bg-white">
                                <div className="p-8 pb-4 space-y-5 border-b border-dashed border-gray-200 bg-gray-50/30">
                                    <Input
                                        className="w-full text-2xl font-bold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 rounded-none transition-colors bg-transparent h-auto py-2"
                                        value={selectedTitle}
                                        onChange={e => setSelectedTitle(e.target.value)}
                                        placeholder="보도자료 제목"
                                    />
                                    {selectedSummaries.length > 0 && (
                                        <div className="space-y-3">
                                            {selectedSummaries.map((s, i) => (
                                                <div key={i} className="flex gap-3 items-start">
                                                    <span className="font-bold text-blue-600 mt-2">✓</span>
                                                    <Textarea
                                                        className="w-full font-bold text-gray-700 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 rounded-none transition-colors resize-none overflow-hidden bg-transparent min-h-[40px]"
                                                        value={s}
                                                        onChange={e => {
                                                            const newS = [...selectedSummaries];
                                                            newS[i] = e.target.value;
                                                            setSelectedSummaries(newS);
                                                        }}
                                                        onInput={(e) => {
                                                            const target = e.target as HTMLTextAreaElement;
                                                            target.style.height = 'auto';
                                                            target.style.height = target.scrollHeight + 'px';
                                                        }}
                                                        rows={1}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <RichTextEditor
                                    value={editedContent}
                                    onChange={setEditedContent}
                                />
                            </CardContent>
                        </Card>

                        {/* 액션 푸터 */}
                        <Card className="bg-slate-50 border">
                            <CardContent className="pt-5 pb-5">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                                    <Button variant="outline" onClick={() => setStep(1)}>
                                        <ArrowLeft className="w-4 h-4 mr-2" /> 입력으로 돌아가기
                                    </Button>

                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* 복사 */}
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const full = `${selectedTitle}\n\n${selectedSummaries.join("\n")}\n\n${editedContent}`;
                                                navigator.clipboard.writeText(full);
                                            }}
                                        >
                                            <Copy className="w-4 h-4 mr-2" /> 전체 복사
                                        </Button>

                                        {/* Word 다운로드 */}
                                        <Button
                                            variant="outline"
                                            onClick={() => downloadAsWord({
                                                content: editedContent,
                                                title: selectedTitle || form.prSubject,
                                                summaries: selectedSummaries,
                                                imageContent: form.imageContent,
                                                brandName: form.brandName
                                            })}
                                        >
                                            <Download className="w-4 h-4 mr-2" /> Word 추출
                                        </Button>

                                        {/* 캘린더 예약 */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="gap-2">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    {publishDate ? format(publishDate, "MM월 dd일", { locale: ko }) : "날짜 선택"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <Calendar mode="single" selected={publishDate} onSelect={setPublishDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>

                                        <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSaveToCalendar}>
                                            <Check className="w-4 h-4 mr-2" /> 보도자료 {editEventId ? '수정완료 (캘린더 연동)' : '예약하기'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function GeneratorPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <GeneratorContent />
        </Suspense>
    );
}
