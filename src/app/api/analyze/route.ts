import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import Groq from "groq-sdk";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * [Vercel 최적화 통합 분석 API - 고도화 버전]
 * 1. 9초 타임아웃 제어 (Vercel 10초 제한 대응)
 * 2. 실패 시 '프리뷰 모드' 자동 전환 (에러 차단)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log(`[Analyze] URL Start: ${url}`);

        // 타임아웃 제어 (9초면 자가 종료하여 Vercel 크래시 방지)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Analysis timeout")), 9000)
        );

        try {
            const analysisResult = await Promise.race([
                performAnalysis(url),
                timeoutPromise
            ]);
            return NextResponse.json({ success: true, data: analysisResult });
        } catch (e: any) {
            console.warn(`[Analyze] Analysis failed or timed out: ${e.message}. Using Preview Mode.`);
            
            // 실패 시 사용자 차단 대신 '프리뷰 데이터' 반환
            return NextResponse.json({
                success: true,
                isPreview: true,
                data: getMockData(url),
                message: "실시간 분석이 지연되어 프리뷰 데이터를 로드했습니다. 직접 수정이 가능합니다."
            });
        }

    } catch (error: any) {
        console.error("Analysis Fatal Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * 실제 분석 로직
 */
async function performAnalysis(url: string) {
    // 1. FIRECRAWL 시도
    if (FIRECRAWL_API_KEY && FIRECRAWL_API_KEY !== "firecrawl_api_key_placeholder") {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({ url, formats: ["markdown"], timeout: 8000 }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.markdown) {
                return await extractWithGroq(result.data.markdown, result.data.metadata?.title || "");
            }
        }
    }

    // 2. APIFY 시도
    if (APIFY_TOKEN && APIFY_TOKEN !== "apify_api_token_placeholder") {
        const client = new ApifyClient({ token: APIFY_TOKEN });
        const run = await client.actor("apify/website-content-crawler").call({
            startUrls: [{ url }],
            maxCrawlDepth: 0,
            maxCrawlPages: 1,
        });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        const crawlResult = items[0] as any;
        if (crawlResult?.text) {
            return await extractWithGroq(crawlResult.text, crawlResult.metadata?.title || "");
        }
    }

    throw new Error("No analysis engine available or failed");
}

/**
 * AI 추출 로직
 */
async function extractWithGroq(text: string, title: string) {
    if (!GROQ_API_KEY) return { brandName: "퍼시스(FURSYS)", productName: title, markdown: text };

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const prompt = `Extract product info as JSON: {"brandName":"${text.includes("FURSYS") ? "퍼시스(FURSYS)" : "브랜드명"}","productName":"제품명","definition":"슬로건","features":["특징1"],"coreMessages":["가치1"]}\n\nContent: ${text.substring(0, 5000)}`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return { ...data, markdown: text };
}

/**
 * 실패 시 제공할 기본 퍼시스 데이터
 */
function getMockData(url: string) {
    return {
        brandName: "퍼시스(FURSYS)",
        productName: url.includes("aeris") ? "에어리스(AERIS)" : "퍼시스 주력 제품",
        definition: "사용자의 움직임과 업무 방식을 고려한 인체공학적 오피스 솔루션",
        features: ["최첨단 인체공학 설계", "프리미엄 소재 사용", "공간 효율성 극대화"],
        coreMessages: ["일의 본질에 집중하는 사무 환경", "지속 가능한 디자인 가치"],
        markdown: "정보를 실시간으로 가져오지 못했습니다. 본문의 상세 내용을 직접 확인해 주세요."
    };
}
