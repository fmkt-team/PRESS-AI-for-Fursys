import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Fursys Press AI | 퍼시스 보도자료 지능형 플랫폼",
  description: "AI-powered PR management platform for FURSYS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.className} antialiased selection:bg-red-200 selection:text-red-900`}>
        <ConvexClientProvider>
          <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
              <div className="p-4 border-b flex items-center gap-2">
                <SidebarTrigger />
                <span className="font-semibold">Fursys Press AI 워크스페이스</span>
              </div>
              <div className="p-8">
                {children}
              </div>
            </main>
          </SidebarProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
