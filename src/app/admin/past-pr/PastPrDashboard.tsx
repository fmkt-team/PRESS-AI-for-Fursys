"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Trash2 } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
    product: "신제품/제품 소개",
    campaign: "브랜드 캠페인 소개",
    activity: "브랜드 활동 소개",
    other: "기타",
};

export default function PastPrDashboard() {
    const pressReleases = useQuery(api.pressReleases.getList);
    const removePr = useMutation(api.pressReleases.remove);

    const handleDelete = async (id: string, subject: string) => {
        if (window.confirm(`'${subject}' 보도자료를 정말 삭제하시겠습니까?`)) {
            try {
                await removePr({ id: id as Id<"pressReleases"> });
            } catch (err) {
                alert("삭제 중 오류가 발생했습니다.");
                console.error(err);
            }
        }
    };

    if (pressReleases === undefined) {
        return <div className="p-4 text-center text-gray-500">데이터를 불러오는 중입니다...</div>;
    }

    if (pressReleases.length === 0) {
        return (
            <div className="p-6 bg-gray-50 rounded-lg text-center border">
                <p className="text-gray-500">아직 학습된 보도자료가 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">파일을 업로드하여 첫 번째 데이터를 학습시켜보세요.</p>
            </div>
        );
    }

    // 그룹화 로직
    const grouped = pressReleases.reduce((acc: Record<string, typeof pressReleases>, pr: typeof pressReleases[0]) => {
        const type = pr.type || "other";
        if (!acc[type]) acc[type] = [];
        acc[type].push(pr);
        return acc;
    }, {});

    return (
        <div className="mt-12">
            <h2 className="text-xl font-bold mb-6 border-b pb-2 flex items-center justify-between">
                <span>📚 분류별 학습된 보도자료 현황</span>
                <span className="text-sm font-normal bg-black text-white px-3 py-1 rounded-full">
                    총 {pressReleases.length}개 학습 완료
                </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(TYPE_LABELS).map((typeKey) => {
                    const items = grouped[typeKey] || [];
                    if (items.length === 0) return null;

                    return (
                        <div key={typeKey} className="bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col">
                            <div className="bg-gray-50 border-b px-4 py-3 font-semibold flex justify-between items-center">
                                <span>{TYPE_LABELS[typeKey]}</span>
                                <span className="bg-white text-xs px-2 py-1 rounded border shadow-sm">
                                    {items.length}개
                                </span>
                            </div>
                            <ul className="divide-y max-h-64 overflow-y-auto">
                                {items.map((item: typeof pressReleases[0]) => (
                                    <li key={item._id} className="p-3 hover:bg-gray-50 transition-colors text-sm flex justify-between items-center group">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="truncate font-medium text-gray-800" title={item.subject}>
                                                {item.subject}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {new Date(item._creationTime).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(item._id, item.subject)}
                                                className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 p-1"
                                                title="삭제하기"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
