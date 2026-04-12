import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "PressCraft AI",
  description: "AI-powered PR management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.className} antialiased selection:bg-blue-200 selection:text-blue-900`}>
        <ConvexClientProvider>
          <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
              <div className="p-4 border-b flex items-center gap-2">
                <SidebarTrigger />
                <span className="font-semibold">PressCraft AI 워크스페이스</span>
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
