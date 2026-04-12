"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Download, FileText, ExternalLink, Calendar as CalendarIcon, Filter, Search, MoreVertical, X, XCircle, ChevronDown, CheckCircle2, ChevronRight, Copy, Link as LinkIcon, DownloadCloud, AlertCircle, Sparkles, Loader2, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// ————————————————————
// Word 다운로드 (라이브러리 없이 HTML → .doc)
// ————————————————————
function downloadAsWord(req: any) {
    const title = req.subject || "보도자료_의뢰서";

    // 단순 줄바꿈 텍스트를 문단으로 변환하는 함수
    const formatText = (text?: string) => {
        if (!text) return "";
        return text.split("\n").map(line => `<p style="margin: 0.2rem 0;">${line || "&nbsp;"}</p>`).join("");
    };

    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
      body { font-family: '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.6; margin: 3cm auto; width: 75%; max-width: 800px; }
      h1 { font-size: 18pt; font-weight: bold; margin-bottom: 24px; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; }
      h2 { font-size: 13pt; font-weight: bold; margin-top: 32px; margin-bottom: 12px; color: #1e40af; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
      th, td { border: 1px solid #cbd5e1; padding: 12px 16px; text-align: left; vertical-align: top; }
      th { background-color: #f1f5f9; font-weight: bold; width: 150px; }
      .box { border: 1px solid #cbd5e1; padding: 20px; background-color: #f8fafc; margin-bottom: 24px; outline: none; }
    </style>
    </head>
    <body>
      <h1>보도자료 배포 의뢰서</h1>
      
      <table>
        <tr><th>요청자</th><td>${req.requesterName} (${req.team})</td></tr>
        <tr><th>이메일</th><td>${req.email}</td></tr>
        <tr><th>요청일</th><td>${format(new Date(req._creationTime), "yyyy.MM.dd HH:mm")}</td></tr>
        <tr><th>배포 희망일</th><td>${req.desiredDate ? format(new Date(req.desiredDate), "yyyy.MM.dd") : "미지정"}</td></tr>
        <tr><th>유형</th><td>${req.type}</td></tr>
        <tr><th>주제</th><td><strong>${req.subject}</strong></td></tr>
      </table>

      <h2>1. 보도자료 개요</h2>
      <div class="box">
        ${formatText(req.summary) || "내용 없음"}
      </div>

      <h2>2. 참고 링크 및 파일 정보</h2>
      <ul>
        ${req.referenceUrl ? `<li><strong>참고 웹사이트:</strong> <a href="${req.referenceUrl}">${req.referenceUrl}</a></li>` : ""}
        ${req.insertionUrl ? `<li><strong>기사 삽입 희망 링크:</strong> ${req.insertionUrl}</li>` : ""}
        ${req.imageUrl ? `<li><strong>본문 첨부 이미지:</strong> (시스템에 파일 업로드 됨)</li>` : ""}
        ${req.attachmentUrl ? `<li><strong>기타 참고 문서:</strong> (시스템에 파일 업로드 됨)</li>` : ""}
      </ul>

      ${req.llmQuestions && req.llmQuestions.length > 0 ? `
        <h2>💡 LLM 전략 요청사항</h2>
        <div class="box">
          ${req.llmQuestions.map((q: string, idx: number) => `
            <div style="margin-bottom: 16px;">
              <div style="font-weight: bold; color: #3730a3; margin-bottom: 4px;">Q${idx + 1}. 예상 질문</div>
              <div style="margin-bottom: 8px;">${q}</div>
              <div style="font-weight: bold; color: #3730a3; margin-bottom: 4px;">A${idx + 1}. 핵심 답변</div>
              <div>${req.llmAnswers?.[idx] || ""}</div>
            </div>
          `).join('')}
        </div>
      ` : (req.llmQuestion || req.llmAnswerPoint) ? `
        <h2>💡 LLM 전략 요청사항</h2>
        <div class="box">
          <p><strong>Q. 예상 질문:</strong><br/>${req.llmQuestion || '없음'}</p>
          <p style="margin-top:15px;"><strong>A. 핵심 답변:</strong><br/>${req.llmAnswerPoint || '없음'}</p>
        </div>
      ` : ''}
    </body></html>`;

    const blob = new Blob(["\uFEFF" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}_업무의뢰.doc`;
    a.click();
    URL.revokeObjectURL(url);
    URL.revokeObjectURL(url);
}

// 강제 다운로드 유틸 (URL이 이미지 등 브라우저에서 열리는 파일일 때 강제 다운)
async function forceDownload(fileUrl: string | null | undefined, fileName: string) {
    if (!fileUrl) return;
    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        console.error("다운로드 실패:", err);
        // CORS 등 이슈로 fetch 실패 시 기본 동작으로 폴백
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = fileName;
        a.target = "_blank";
        a.click();
    }
}

export default function AdminRequestsPage() {
    const requests = useQuery(api.prRequests.getAll);
    const updateStatus = useMutation(api.prRequests.updateStatus);
    const removeRequest = useMutation(api.prRequests.remove);

    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isUpdating, setIsUpdating] = useState<Id<"prRequests"> | null>(null);

    const handleStatusChange = async (id: Id<"prRequests">, newStatus: string) => {
        setIsUpdating(id);
        try {
            await updateStatus({ id, status: newStatus });
        } catch (error) {
            console.error("Status update failed:", error);
            alert("상태 변경에 실패했습니다.");
        } finally {
            setIsUpdating(null);
        }
    };

    const handleDelete = async (id: Id<"prRequests">) => {
        if (confirm("이 의뢰건을 삭제하시겠습니까? 첨부된 파일도 함께 삭제됩니다.")) {
            try {
                await removeRequest({ id });
                if (selectedRequest?._id === id) {
                    setSelectedRequest(null);
                }
            } catch (error) {
                console.error("Deletion failed:", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    if (requests === undefined) {
        return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">의뢰 관리</h2>
                    <p className="text-muted-foreground">사내 직원들이 신청한 보도자료 의뢰를 관리합니다.</p>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border rounded-lg bg-muted/10 border-dashed text-muted-foreground text-center">
                    <FileText className="w-12 h-12 mb-4 text-muted-foreground/50" />
                    <p>접수된 보도자료 의뢰가 없습니다.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-950 rounded-md border text-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-3 font-medium whitespace-nowrap">상태</th>
                                    <th className="p-3 font-medium whitespace-nowrap">요청일</th>
                                    <th className="p-3 font-medium whitespace-nowrap">배포 희망일</th>
                                    <th className="p-3 font-medium whitespace-nowrap">요청자 (팀)</th>
                                    <th className="p-3 font-medium">유형</th>
                                    <th className="p-3 font-medium">주제</th>
                                    <th className="p-3 font-medium text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((req) => (
                                    <tr key={req._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="p-3 whitespace-nowrap">
                                            <Select
                                                value={req.status}
                                                onValueChange={(val) => handleStatusChange(req._id, val)}
                                                disabled={isUpdating === req._id}
                                            >
                                                <SelectTrigger className={`w-28 h-8 text-xs ${req.status === '대기' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    req.status === '진행중' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-green-50 text-green-700 border-green-200'
                                                    }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="대기">⏳ 대기</SelectItem>
                                                    <SelectItem value="진행중">🏃‍♂️ 진행중</SelectItem>
                                                    <SelectItem value="완료">✅ 완료</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                                            {format(new Date(req._creationTime), "yyyy.MM.dd HH:mm")}
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            {req.desiredDate ? (
                                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                                                    {format(new Date(req.desiredDate), "yyyy.MM.dd")}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">미지정</span>
                                            )}
                                        </td>
                                        <td className="p-3 whitespace-nowrap font-medium">
                                            {req.requesterName} <span className="text-muted-foreground font-normal">({req.team})</span>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <Badge variant="outline">{req.type}</Badge>
                                        </td>
                                        <td className="p-3 max-w-[200px] truncate font-medium">
                                            {req.subject}
                                        </td>
                                        <td className="p-3 text-center whitespace-nowrap space-x-2">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedRequest(req)}>상세 보기</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                                                    <DialogHeader className="p-6 pb-4 border-b">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Badge>{req.type}</Badge>
                                                                    <Badge variant={req.status === '완료' ? 'default' : 'outline'} className={req.status === '대기' ? 'text-yellow-600 border-yellow-300' : ''}>
                                                                        {req.status}
                                                                    </Badge>
                                                                </div>
                                                                <DialogTitle className="text-2xl">{req.subject}</DialogTitle>
                                                                <DialogDescription className="mt-2">
                                                                    요청자: {req.requesterName} ({req.team}) • 이메일: {req.email} • 요청일: {format(new Date(req._creationTime), "yyyy.MM.dd HH:mm")}
                                                                </DialogDescription>
                                                            </div>
                                                            <Button onClick={() => downloadAsWord(req)} variant="secondary" className="gap-2 flex-shrink-0">
                                                                <Download className="w-4 h-4" /> Word 다운로드
                                                            </Button>
                                                        </div>
                                                    </DialogHeader>

                                                    <div className="max-h-[60vh] overflow-y-auto p-6">
                                                        <div className="space-y-6">
                                                            {req.desiredDate && (
                                                                <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-md font-medium">
                                                                    <span>배포 희망일:</span>
                                                                    <span>{format(new Date(req.desiredDate), "yyyy년 MM월 dd일", { locale: ko })}</span>
                                                                </div>
                                                            )}
                                                            {req.summary && (
                                                                <div className="space-y-2">
                                                                    <h4 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> 보도자료 개요</h4>
                                                                    <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap leading-relaxed">
                                                                        {req.summary}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {req.llmQuestions && req.llmQuestions.length > 0 ? (
                                                                <div className="space-y-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                                                    <h4 className="font-semibold flex items-center gap-2 text-indigo-900"><Sparkles className="w-4 h-4 text-indigo-600" /> LLM 전략 요청사항</h4>
                                                                    <div className="space-y-4">
                                                                        {req.llmQuestions.map((q: string, idx: number) => (
                                                                            <div key={idx} className="bg-white p-4 rounded border border-indigo-50 space-y-3">
                                                                                <div className="flex items-start gap-2">
                                                                                    <span className="font-bold text-indigo-600">Q{idx + 1}.</span>
                                                                                    <div className="text-gray-700">{q}</div>
                                                                                </div>
                                                                                <div className="flex items-start gap-2">
                                                                                    <span className="font-bold text-indigo-600">A{idx + 1}.</span>
                                                                                    <div className="text-gray-700 whitespace-pre-wrap">{req.llmAnswers?.[idx] || ""}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                (req.llmQuestion || req.llmAnswerPoint) && (
                                                                    <div className="space-y-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                                                        <h4 className="font-semibold flex items-center gap-2 text-indigo-900"><Sparkles className="w-4 h-4 text-indigo-600" /> LLM 전략 요청사항</h4>
                                                                        <div className="bg-white p-4 rounded border border-indigo-50 space-y-4">
                                                                            <div>
                                                                                <div className="text-sm font-medium text-indigo-800 mb-1">Q. 예상 질문:</div>
                                                                                <div className="bg-indigo-50/30 p-3 rounded text-sm text-gray-700">
                                                                                    {req.llmQuestion || <span className="text-gray-400 italic">없음</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-medium text-indigo-800 mb-1">A. 핵심 답변:</div>
                                                                                <div className="bg-indigo-50/30 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                                                                                    {req.llmAnswerPoint || <span className="text-gray-400 italic">없음</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {req.referenceUrl && (
                                                                    <div className="space-y-2 col-span-2">
                                                                        <h4 className="font-semibold text-sm">참고 링크</h4>
                                                                        <a href={req.referenceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 bg-blue-50/50 p-2 rounded truncate transition-colors">
                                                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                                            {req.referenceUrl}
                                                                        </a>
                                                                    </div>
                                                                )}

                                                                {req.insertionUrl && (
                                                                    <div className="space-y-2 col-span-2">
                                                                        <h4 className="font-semibold text-sm">기사 삽입 희망 링크</h4>
                                                                        <a href={req.insertionUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 bg-blue-50/50 p-2 rounded truncate transition-colors">
                                                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                                            {req.insertionUrl}
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {(req.imageUrl || req.attachmentUrl) && (
                                                                <div className="pt-4 border-t space-y-4">
                                                                    <h4 className="font-semibold">첨부 파일</h4>
                                                                    <div className="flex flex-wrap gap-3">
                                                                        {req.imageUrl && (
                                                                            <button type="button" onClick={() => forceDownload(req.imageUrl, req.imageFileName || `${req.requesterName}_의뢰_첨부이미지`)} className="inline-flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors border">
                                                                                <ImageIcon className="w-4 h-4 text-primary" />
                                                                                이미지 다운로드
                                                                            </button>
                                                                        )}
                                                                        {req.attachmentUrl && (
                                                                            <button type="button" onClick={() => forceDownload(req.attachmentUrl, req.attachmentFileName || `${req.requesterName}_의뢰_첨부문서`)} className="inline-flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors border">
                                                                                <Download className="w-4 h-4 text-primary" />
                                                                                참고 문서 다운로드
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(req._id)} title="의뢰 삭제">
                                                <Trash2 className="w-4 h-4" />
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
    );
}
