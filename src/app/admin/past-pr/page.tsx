"use client";

import { useState } from "react";
import { insertPastPressRelease } from "../../actions/insert-past-pr";
import { extractTextFromFile } from "@/lib/file-parser";
import PastPrDashboard from "./PastPrDashboard";

export default function PastPrAdminPage() {
    const [type, setType] = useState("product");
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<{ name: string, status: string, error?: string }[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
            setMessages([]); // Reset messages on new file selection
        }
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (files.length === 0) {
            alert("학습할 파일을 선택해주세요.");
            return;
        }

        setLoading(true);
        setMessages([]);

        const results = [];
        for (const file of files) {
            try {
                // 1. 파일에서 텍스트 추출
                const content = await extractTextFromFile(file);

                // 2. 파일 확장자를 제외한 이름을 주제(subject)로 사용
                const subject = file.name.replace(/\.[^/.]+$/, "");

                // 3. 벡터 DB에 저장 (RAG 학습)
                const result = await insertPastPressRelease(subject, type, content);

                if (result.success) {
                    results.push({ name: file.name, status: 'success' });
                } else {
                    results.push({ name: file.name, status: 'error', error: result.message });
                }
            } catch (error: any) {
                results.push({ name: file.name, status: 'error', error: error.message });
            }

            // 실시간 상태 업데이트를 위해
            setMessages([...results]);
        }

        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto p-8 font-sans">
            <h1 className="text-2xl font-bold mb-6">💡 과거 보도자료 일괄 학습 시스템 (Admin)</h1>
            <p className="mb-6 text-gray-600">
                여러 개의 과거 보도자료 파일(PDF, Word, TXT)을 한꺼번에 업로드하여 AI(RAG)에게 톤앤매너를 학습시킵니다.
            </p>

            <PastPrDashboard />

            <h2 className="text-xl font-bold mt-12 mb-6 border-b pb-2">새로운 자료 학습하기</h2>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">분류 (일괄 적용)</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full border p-2.5 rounded bg-gray-50 focus:bg-white transition-colors"
                    >
                        <option value="product">신제품/제품 소개</option>
                        <option value="campaign">브랜드 캠페인 소개</option>
                        <option value="activity">브랜드 활동 소개</option>
                        <option value="other">기타</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">파일 선택 (다중 선택 가능, 누적 추가 지원)</label>
                    <input
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={handleFileChange}
                        className="w-full border p-2.5 rounded bg-gray-50 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-black transition-all"
                    />

                    {files.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                                📚 현재 {files.length}개의 파일이 대기 중입니다:
                            </p>
                            <ul className="space-y-2">
                                {files.map((file, idx) => (
                                    <li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                                        <span className="truncate flex-1 max-w-[80%] pr-2 text-gray-800" title={file.name}>
                                            📄 {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(idx)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                        >
                                            삭제
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {files.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            지원 포맷: .pdf, .docx, .doc, .txt
                        </p>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <button
                        type="submit"
                        disabled={loading || files.length === 0}
                        className="w-full bg-black text-white font-bold py-3 px-6 rounded hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        {loading ? "전체 파일 텍스트 추출 및 AI 임베딩 학습 중..." : `대기 중인 ${files.length}개 보도자료 일괄 학습하기`}
                    </button>
                </div>
            </form>

            {messages.length > 0 && (
                <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">처리 결과 ({messages.filter(m => m.status === 'success').length}/{files.length} 성공)</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`p-4 rounded border flex justify-between items-center ${msg.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center">
                                    <span className="mr-3 text-lg">
                                        {msg.status === 'success' ? '✅' : '❌'}
                                    </span>
                                    <span className="font-medium text-gray-800">{msg.name}</span>
                                </div>
                                {msg.status === 'error' && (
                                    <span className="text-sm text-red-600 font-medium bg-white px-2 py-1 rounded border border-red-100">
                                        오류: {msg.error}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
