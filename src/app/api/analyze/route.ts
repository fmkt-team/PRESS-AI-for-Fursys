import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import Groq from "groq-sdk";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * [Vercel 최적화 통합 분석 API - 디버깅 강화 버전]
 */
export async function POST(req: NextRequest) {
    let lastError = "Unknown error";
    
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
        console.log(`[Analyze] --- Start Analysis for: ${url} ---`);

        // 1. FIRECRAWL 시도 (최우선)
        if (FIRECRAWL_API_KEY && FIRECRAWL_API_KEY !== "firecrawl_api_key_placeholder") {
            try {
                console.log("[Analyze] Trying Firecrawl (8s limit)...");
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃

                const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                    },
                    body: JSON.stringify({ url, formats: ["markdown"] }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data?.markdown) {
                        console.log("[Analyze] Firecrawl Success. Moving to Groq...");
                        const data = await extractWithGroq(result.data.markdown, result.data.metadata?.title || "");
                        return NextResponse.json({ success: true, data });
                    }
                } else {
                    const errorText = await response.text();
                    lastError = `Firecrawl API Error (${response.status}): ${errorText.substring(0, 100)}`;
                    console.error(`[Analyze] ${lastError}`);
                }
            } catch (fe: any) {
                lastError = `Firecrawl Request Failed: ${fe.message}`;
                console.error(`[Analyze] ${lastError}`);
            }
        } else {
            lastError = "FIRECRAWL_API_KEY is missing or placeholder";
            console.warn(`[Analyze] ${lastError}`);
        }

        // 2. APIFY 시도 (대체)
        if (APIFY_TOKEN && APIFY_TOKEN !== "apify_api_token_placeholder") {
            try {
                console.log("[Analyze] Trying Apify (Fallback)...");
                const client = new ApifyClient({ token: APIFY_TOKEN });
                const run = await client.actor("apify/website-content-crawler").call({
                    startUrls: [{ url }],
                    maxCrawlDepth: 0,
                    maxCrawlPages: 1,
                }, { waitSecs: 15 }); // Apify는 충분 시간을 주되, Vercel 타임아웃 주의

                const { items } = await client.dataset(run.defaultDatasetId).listItems();
                const text = (items[0] as any)?.text || "";
                
                if (text) {
                    console.log("[Analyze] Apify Success. Moving to Groq...");
                    const data = await extractWithGroq(text, (items[0] as any)?.metadata?.title || "");
                    return NextResponse.json({ success: true, data });
                }
            } catch (ae: any) {
                lastError = `Apify Request Failed: ${ae.message}`;
                console.error(`[Analyze] ${lastError}`);
            }
        }

        // 실패 시: Mock 데이터와 함께 실제 에러 원인을 전달
        console.warn("[Analyze] All real analysis failed. Returning Preview Mode.");
        return NextResponse.json({
            success: true,
            isPreview: true,
            data: getMockData(url),
            debugMessage: lastError // 프론트엔드에서 볼 수 있도록 전송
        });

    } catch (error: any) {
        console.error("[Analyze] Fatal Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

async function extractWithGroq(text: string, title: string) {
    if (!GROQ_API_KEY) return { brandName: "퍼시스(FURSYS)", productName: title, markdown: text };
    
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{
            role: "user",
            content: `Extract as JSON: {"brandName":"${text.includes('FURSYS') ? '퍼시스(FURSYS)' : ''}","productName":"","definition":"","features":[],"coreMessages":[]}\n\nContent: ${text.substring(0, 5000)}`
        }],
        response_format: { type: "json_object" },
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return { ...data, markdown: text.substring(0, 1000) };
}

function getMockData(url: string) {
    return {
        brandName: "퍼시스(FURSYS)",
        productName: url.includes("aeris") ? "에어리스(AERIS)" : "퍼시스 제품",
        definition: "사용자의 움직임을 고려한 오피스 솔루션 (실시간 분석 지연)",
        features: ["인체공학적 설계", "프리미엄 소재", "공간 최적화"],
        coreMessages: ["일의 본질에 집중", "지속 가능한 디자인"],
        markdown: "URL 분석이 지연되어 기본 데이터를 로드했습니다."
    };
}
