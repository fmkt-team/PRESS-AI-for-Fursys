"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// 빌드(Vercel 등) 시 NEXT_PUBLIC_CONVEX_URL이 환경변수에 등록되지 않아 발생하는 에러 방지
const convexAddress = process.env.NEXT_PUBLIC_CONVEX_URL || "https://dummy.convex.cloud";
const convex = new ConvexReactClient(convexAddress);

export default function ConvexClientProvider({
    children,
}: {
    children: ReactNode;
}) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
