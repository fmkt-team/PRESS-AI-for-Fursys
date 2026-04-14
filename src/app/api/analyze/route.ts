import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import Groq from "groq-sdk";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * [Vercel 10초 제한 돌파를 위한 초고속 분석 API]
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

        console.log(`[Analyze] --- Start: ${url} ---`);

        // 9초 타임아웃 자가 제어
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout (9s)")), 9000)
        );

        try {
            const data = await Promise.race([
                performRealAnalysis(url),
                timeoutPromise
            ]);
            console.log("[Analyze] ✅ Real analysis success!");
            return NextResponse.json({ success: true, data });
        } catch (e: any) {
            console.error(`[Analyze] ❌ Real analysis failed: ${e.message}`);
            
            // 실제 분석이 실패했을 때만 최후의 수단으로 Mock 제공
            return NextResponse.json({
                success: true,
                isPreview: true,
                data: getMockData(url),
                error: e.message // 에러 내용을 전달하여 사용자에게 알림
            });
        }

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

async function performRealAnalysis(url: string) {
    // 1. FIRECRAWL (최우선: AI 추출 기능을 직접 호출하여 2단계 과정을 1단계로 단축)
    if (FIRECRAWL_API_KEY && FIRECRAWL_API_KEY !== "firecrawl_api_key_placeholder") {
        console.log("[Analyze] Step 1: Firecrawl Scrape & Extract...");
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
                url,
                formats: ["extract"], // 내장 AI 추출 사용 (속도 향상)
                extract: {
                    prompt: "브랜드명, 제품명, 한 줄 슬로건, 특징 3개, 핵심 메시지 2개를 한국어로 추출해.",
                    schema: {
                        type: "object",
                        properties: {
                            brandName: { type: "string" },
                            productName: { type: "string" },
                            definition: { type: "string" },
                            features: { type: "array", items: { type: "string" } },
                            coreMessages: { type: "array", items: { type: "string" } }
                        }
                    }
                },
                timeout: 7000, // 7초 내에 승부
            }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.extract) {
                console.log("[Analyze] Firecrawl Extract Success!");
                return { ...result.data.extract, markdown: result.data.markdown || "" };
            }
        }
        console.warn("[Analyze] Firecrawl failed, jumping to Apify...");
    }

    // 2. APIFY (대체: 텍스트만 긁어온 후 Groq로 아주 짧게 처리)
    if (APIFY_TOKEN && APIFY_TOKEN !== "apify_api_token_placeholder") {
        console.log("[Analyze] Step 2: Apify Scrape...");
        const client = new ApifyClient({ token: APIFY_TOKEN });
        const run = await client.actor("apify/website-content-crawler").call({
            startUrls: [{ url }],
            maxCrawlDepth: 0,
            maxCrawlPages: 1,
        });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        const text = (items[0] as any)?.text || "";
        
        if (text) {
            console.log("[Analyze] Apify Scrape Success. Quick AI extraction...");
            return await extractWithGroq(text);
        }
    }

    throw new Error("No API keys found or service unavailable");
}

async function extractWithGroq(text: string) {
    if (!GROQ_API_KEY) throw new Error("Missing Groq Key for fallback analysis");
    
    console.log("[Analyze] Step 3: Groq Post-Processing...");
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", // 가장 빠른 모델 선택
        messages: [{
            role: "user",
            content: `Extract as JSON: {"brandName":"${text.includes('FURSYS') ? '퍼시스(FURSYS)' : ''}","productName":"","definition":"","features":[],"coreMessages":[]}\n\nContent: ${text.substring(0, 4000)}`
        }],
        response_format: { type: "json_object" },
        temperature: 0.1,
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return { ...data, markdown: text.substring(0, 1000) };
}

function getMockData(url: string) {
    return {
        brandName: "퍼시스(FURSYS)",
        productName: url.includes("aeris") ? "에어리스(AERIS)" : "퍼시스 주력 제품",
        definition: "사용자의 움직임과 업무 방식을 고려한 오피스 솔루션 (실시간 분석 실패/타임아웃)",
        features: ["실시간 정보를 가져오지 못해 예시 데이터를 로드했습니다.", "Vercel 서버 타임아웃 또는 API 키 확인이 필요합니다.", "직접 내용을 수정하여 보도자료를 생성할 수 있습니다."],
        coreMessages: ["일의 본질에 집중하는 사무 환경", "지속 가능한 디자인 가비"],
        markdown: "분석 실패. 내용을 직접 입력해 주세요."
    };
}
