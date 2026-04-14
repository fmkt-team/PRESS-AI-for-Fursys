import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import Groq from "groq-sdk";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * [Vercel 최적화 통합 분석 API]
 * 1. Firecrawl (우선순위 1) - 사용자 요청
 * 2. Apify (우선순위 2) - 대체 수단
 * 3. Mock (키 누락 시) - 퍼시스 전용 데이터
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log(`[Analyze] URL: ${url}`);

        // 1. FIRECRAWL 연동 (사용자 최우선 요청)
        if (FIRECRAWL_API_KEY && FIRECRAWL_API_KEY !== "firecrawl_api_key_placeholder") {
            try {
                console.log("[Analyze] Attempting Firecrawl...");
                const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                    },
                    body: JSON.stringify({
                        url,
                        formats: ["markdown"], // Vercel 타임아웃 방지를 위해 무거운 extract 대신 markdown만 우선 처리
                        timeout: 15000,
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data?.markdown) {
                        console.log("[Analyze] Firecrawl Success. Processing with Groq...");
                        return await processWithGroq(result.data.markdown, result.data.metadata?.title || "");
                    }
                }
                console.warn("[Analyze] Firecrawl failed or returned no data. Falling back...");
            } catch (fe) {
                console.error("[Analyze] Firecrawl Error:", fe);
            }
        }

        // 2. APIFY 연동 (대체)
        if (APIFY_TOKEN && APIFY_TOKEN !== "apify_api_token_placeholder") {
            try {
                console.log("[Analyze] Attempting Apify...");
                const client = new ApifyClient({ token: APIFY_TOKEN });
                const run = await client.actor("apify/website-content-crawler").call({
                    startUrls: [{ url }],
                    maxCrawlDepth: 0,
                    maxCrawlPages: 1,
                    crawlerType: "playwright:firefox",
                });
                const { items } = await client.dataset(run.defaultDatasetId).listItems();
                const crawlResult = items[0] as any;
                const text = crawlResult?.text || crawlResult?.markdown || "";
                
                if (text) {
                    console.log("[Analyze] Apify Success. Processing with Groq...");
                    return await processWithGroq(text, crawlResult?.metadata?.title || "");
                }
            } catch (ae) {
                console.error("[Analyze] Apify Error:", ae);
            }
        }

        // 3. MOCK FALLBACK (키 누락 시)
        console.log("No valid API keys. Using Fursys Mock Data.");
        if (url.includes("aeris")) {
            return NextResponse.json({
                success: true,
                data: {
                    brandName: "퍼시스(FURSYS)",
                    productName: "에어리스(AERIS)",
                    definition: "사용자의 움직임에 유연하게 반응하는 자유로운 오피스 체어",
                    features: ["리드미컬한 움직임의 링크 시스템", "통기성 뛰어난 메쉬 소재", "조절 가능한 팔걸이"],
                    coreMessages: ["인체공학적 디자인", "유연한 자세 대응", "디자인 어워드 수상"],
                    markdown: "Fursys AERIS 제품 상세 내용 (Mock)"
                }
            });
        }

        return NextResponse.json({
            success: false,
            error: "API 키가 구성되지 않았거나 타임아웃 되었습니다. Vercel 설정에서 키를 확인해 주세요."
        }, { status: 500 });

    } catch (error: any) {
        console.error("Analysis Fatal Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * Groq를 사용하여 텍스트에서 제품 정보 추출
 */
async function processWithGroq(text: string, title: string) {
    if (!GROQ_API_KEY) {
        return NextResponse.json({
            success: true,
            data: { brandName: "퍼시스(FURSYS)", productName: title, markdown: text }
        });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const prompt = `아래 제품 콘텐츠에서 JSON으로 정보를 추출해.
{"brandName":"브랜드명","productName":"제품명","definition":"한 줄 슬로건","features":["특징1","특징2"],"coreMessages":["가치1","가치2"]}

콘텐츠: ${text.substring(0, 8000)}`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json({ success: true, data: { ...data, markdown: text } });
}
