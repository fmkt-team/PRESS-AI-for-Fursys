"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, CheckCircle2, ChevronRight, Sparkles, Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function RequestPage() {
    const router = useRouter();
    const createRequest = useMutation(api.prRequests.create);
    const generateUploadUrl = useMutation(api.prRequests.generateUploadUrl);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [desiredDate, setDesiredDate] = useState<Date | undefined>(undefined);
    // const [showLlmSupport, setShowLlmSupport] = useState(false); // Removed

    // Form State
    const [formData, setFormData] = useState({
        requesterName: "",
        team: "",
        email: "",
        subject: "",
        type: "",
        summary: "",
        referenceUrl: "",
        insertionUrl: "",
        llmQuestions: [""],
        llmAnswers: [""],
    });

    const [files, setFiles] = useState<{
        image: File | null;
        attachment: File | null;
    }>({
        image: null,
        attachment: null
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSelectChange = (value: string) => {
        setFormData(prev => ({ ...prev, type: value }));
    };

    const updateLlmItem = (field: "llmQuestions" | "llmAnswers", idx: number, val: string) => {
        setFormData(prev => {
            const arr = [...prev[field]];
            arr[idx] = val;
            return { ...prev, [field]: arr };
        });
    };

    const addLlmRow = () => {
        setFormData(prev => ({
            ...prev,
            llmQuestions: [...prev.llmQuestions, ""],
            llmAnswers: [...prev.llmAnswers, ""],
        }));
    };

    const removeLlmRow = (idx: number) => {
        setFormData(prev => ({
            ...prev,
            llmQuestions: prev.llmQuestions.filter((_, i) => i !== idx),
            llmAnswers: prev.llmAnswers.filter((_, i) => i !== idx),
        }));
    };

    const handleFileChange = (type: 'image' | 'attachment', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const uploadFile = async (file: File): Promise<Id<"_storage"> | undefined> => {
        if (file.size > 20 * 1024 * 1024) {
            throw new Error("파일 크기는 20MB를 초과할 수 없습니다.");
        }
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
        });
        const { storageId } = await result.json();
        return storageId;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.requesterName || !formData.team || !formData.email || !formData.subject || !formData.type) {
            alert("필수 항목을 모두 입력해주세요.");
            return;
        }

        setIsSubmitting(true);

        try {
            let imageStorageId;
            let attachmentStorageId;

            if (files.image) {
                imageStorageId = await uploadFile(files.image);
            }
            if (files.attachment) {
                attachmentStorageId = await uploadFile(files.attachment);
            }

            // DB 저장
            await createRequest({
                ...formData,
                imageStorageId,
                attachmentStorageId,
                imageFileName: files.image?.name,
                attachmentFileName: files.attachment?.name,
                desiredDate: desiredDate ? desiredDate.toISOString() : undefined
            });

            // 관리자 메일 발송
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requesterName: formData.requesterName,
                    team: formData.team,
                    subject: formData.subject,
                    type: formData.type,
                    referenceUrl: formData.referenceUrl,
                })
            });

            setIsSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error: any) {
            console.error("의뢰 제출 실패:", error);
            alert(error.message || "의뢰 등록 중 오류가 발생했습니다. 다시 시도해 주세요.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4 md:px-6">
                <Card className="text-center py-16 px-6 border-dashed border-2">
                    <div className="flex justify-center mb-6">
                        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold mb-4">접수 완료</CardTitle>
                    <CardDescription className="text-lg">
                        보도자료 배포 의뢰가 성공적으로 접수되었습니다.<br />
                        담당자 확인 후 연락드리겠습니다.
                    </CardDescription>
                    <div className="mt-8 flex justify-center gap-4">
                        <Button variant="outline" onClick={() => window.location.reload()}>새로운 의뢰하기</Button>
                        <Button onClick={() => router.push('/')}>메인으로 가기</Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">보도자료 의뢰하기</h1>
                <p className="text-xl text-muted-foreground w-full md:w-2/3">
                    성공적인 보도자료 배포를 위해 아래 양식을 작성해주세요.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 pb-12">
                <Card>
                    <CardHeader className="bg-muted/40 pb-4 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-sm">1</div>
                            기본 정보 <span className="text-red-500 ml-1 text-sm">* 필수</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="requesterName">요청자 성함</Label>
                            <Input id="requesterName" name="requesterName" value={formData.requesterName} onChange={handleChange} required placeholder="홍길동 책임" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="team">팀/부서</Label>
                            <Input id="team" name="team" value={formData.team} onChange={handleChange} required placeholder="마케팅팀" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="email">이메일 (연락용)</Label>
                            <Input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="hong@example.com" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="subject">보도자료 핵심 주제</Label>
                            <Input id="subject" name="subject" value={formData.subject} onChange={handleChange} required placeholder="데스커 OOO 캠페인 오픈" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="type">보도자료 유형</Label>
                            <Select onValueChange={handleSelectChange} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="유형을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="제품">신제품 / 제품 소개</SelectItem>
                                    <SelectItem value="캠페인">캠페인 소개</SelectItem>
                                    <SelectItem value="활동">브랜드 활동 소개</SelectItem>
                                    <SelectItem value="기타">기타 안내사항</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>배포 희망 일정 (선택)</Label>
                            <div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !desiredDate && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {desiredDate ? format(desiredDate, "yyyy년 MM월 dd일", { locale: ko }) : <span>희망하는 배포 일정을 선택하세요</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={desiredDate}
                                            onSelect={setDesiredDate}
                                            initialFocus
                                            locale={ko}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="bg-muted/40 pb-4 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-muted-foreground text-primary-foreground flex items-center justify-center text-sm">2</div>
                            상세 내용
                        </CardTitle>
                        <CardDescription>의뢰하실 보도자료에 대한 상세 설명과 자료를 첨부해주세요. (선택)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="summary">보도자료 개요 및 요약 내용</Label>
                            <Textarea
                                id="summary"
                                name="summary"
                                value={formData.summary}
                                onChange={handleChange}
                                placeholder="작성되어야 할 핵심 포인트, 타겟 고객, 강조할 기능 등을 자유롭게 적어주세요."
                                className="min-h-[120px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="referenceUrl">참고 링크 (URL)</Label>
                            <Input id="referenceUrl" name="referenceUrl" value={formData.referenceUrl} onChange={handleChange} placeholder="https://..." />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold">이미지 첨부</Label>
                                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/50 transition-colors">
                                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                                    <Label htmlFor="image-upload" className="cursor-pointer text-sm font-medium text-primary hover:underline">
                                        PC에서 이미지 선택
                                    </Label>
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(e) => handleFileChange('image', e)}
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {files.image ? files.image.name : "JPEG, PNG, WebP (최대 20MB)"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-semibold">참고 문서 첨부</Label>
                                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/50 transition-colors">
                                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                                    <Label htmlFor="doc-upload" className="cursor-pointer text-sm font-medium text-primary hover:underline">
                                        PC에서 문서 선택
                                    </Label>
                                    <Input
                                        id="doc-upload"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                                        className="hidden"
                                        onChange={(e) => handleFileChange('attachment', e)}
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {files.attachment ? files.attachment.name : "PDF, Word, PPT, ZIP (최대 20MB)"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="insertionUrl">기사 내 삽입 희망 링크 🔗</Label>
                            <Input id="insertionUrl" name="insertionUrl" value={formData.insertionUrl} onChange={handleChange} placeholder="보도자료 하단에 삽입될 서비스 링크나 구매 링크" />
                        </div>
                    </CardContent>
                </Card>

                {/* 검색/결과 화면 노출 전략 */}
                <Card className="border-indigo-100 shadow-sm overflow-hidden transition-all duration-300">
                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-indigo-900 text-lg">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            LLM 전략 수립 <span className="text-sm font-normal text-muted-foreground ml-2">(선택)</span>
                        </CardTitle>
                        <CardDescription className="text-zinc-600">
                            생성형 AI 검색 결과에서 우리 브랜드가 유리하게 답변될 수 있도록 사전 정보를 제공합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {formData.llmQuestions.map((q, idx) => (
                            <div key={idx} className="p-5 border border-indigo-100 rounded-lg bg-white relative group">
                                <div className="absolute -left-3 -top-3 bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                                    {idx + 1}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-indigo-900 font-semibold flex items-center gap-1">
                                            <span className="text-indigo-500">Q.</span> 예상 질문 (검색어)
                                        </Label>
                                        <Input
                                            value={q}
                                            onChange={(e) => updateLlmItem('llmQuestions', idx, e.target.value)}
                                            placeholder="예: '허리 덜 아픈 모션데스크 브랜드 추천해줘'"
                                            className="border-indigo-100 focus-visible:ring-indigo-300"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-indigo-900 font-semibold flex items-center gap-1">
                                            <span className="text-indigo-500">A.</span> 핵심 답변 (장점/특징)
                                        </Label>
                                        <Textarea
                                            value={formData.llmAnswers[idx]}
                                            onChange={(e) => updateLlmItem('llmAnswers', idx, e.target.value)}
                                            placeholder="예: '데스커 모션데스크는 스마트폰 앱으로 높이 기억이 가능해서...'"
                                            className="min-h-[80px] border-indigo-100 focus-visible:ring-indigo-300"
                                        />
                                    </div>
                                </div>
                                {formData.llmQuestions.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLlmRow(idx)}
                                        className="absolute -right-2 -top-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ✕
                                    </Button>
                                )}
                            </div>
                        ))}
                        <div className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={addLlmRow}
                                className="w-full border-dashed border-indigo-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                            >
                                + 질문/답변 추가하기
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4 pt-4 sticky bottom-6 z-10 bg-background/80 backdrop-blur pb-4 border-t pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                        취소
                    </Button>
                    <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[140px]">
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 처리중...</> : '의뢰 제출하기'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
