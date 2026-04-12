"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// ✅ SSR을 완전히 비활성화하여 Hydration 오류 방지
// ReportsPageClient를 별도 파일로 분리하여 올바른 dynamic import 패턴 적용
const ReportsPageClient = dynamic(() => import("./ReportsPageClient"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[500px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    ),
});

export default function ReportsPage() {
    return <ReportsPageClient />;
}
