import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import Groq from "groq-sdk";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log("Analyze Request for:", url);

        // MOCK FALLBACK: If token is missing, return strict mock data
        if (!APIFY_TOKEN || APIFY_TOKEN === "apify_api_token_placeholder") {
            console.log("No APIFY_TOKEN found. Using Strict Mock Data.");
            // Allow time to simulate scraping
            await new Promise(r => setTimeout(r, 2000));

            if (url.includes("612")) {
                return NextResponse.json({
                    success: true,
                    data: {
                        title: "1인용 컴퓨터 데스크 (DSAD612)",
                        description: "기본에 충실한 저소음 1인용 컴퓨터 책상",
                        h1: "컴퓨터 데스크 1200",
                        ogTitle: "데스커 컴퓨터 데스크 1200",
                        ogDesc: "28mm 고밀도 상판과 빌트인 멀티탭이 적용된 데스커의 베스트셀러",
                        jsonLd: null,
                        brand: "Desker",
                        productName: "컴퓨터 데스크 1200",
                        oneLineDef: "기본에 충실한 저소음 1인용 컴퓨터 책상",
                        context: "재택근무, 홈오피스",
                        keyMessages: ["몰입하는 환경 조성", "깔끔한 배선 정리"],
                        features: ["28mm 고밀도 상판", "빌트인 멀티탭", "친환경 자재 E0 등급"],
                        specs: ["규격: W1200 * D700 * H720", "소재: 목재, 스틸"],
                        releaseDate: "2023-01-01",
                        channel: "공식 홈페이지",
                        promotion: "신규 가입 5% 할인"
                    }
                });
            } else {
                return NextResponse.json({
                    success: true,
                    data: {
                        title: "정보 없음 (원문 확인 필요)",
                        description: "정보 없음 (원문 확인 필요)",
                        h1: "정보 없음",
                        ogTitle: "정보 없음",
                        ogDesc: "정보 없음",
                        jsonLd: null,
                        brand: "정보 없음",
                        productName: "정보 없음",
                        oneLineDef: "정보 없음",
                        context: "정보 없음",
                        keyMessages: [],
                        features: [],
                        specs: [],
                        releaseDate: "",
                        channel: "",
                        promotion: ""
                    }
                });
            }
        }

        // REAL APIFY CALL (website-content-crawler)
        const client = new ApifyClient({ token: APIFY_TOKEN });

        const input = {
            startUrls: [{ url }],
            maxCrawlDepth: 0,
            maxCrawlPages: 1,
            initialConcurrency: 1,
            maxConcurrency: 1,
            // Use browser to render dynamic content
            crawlerType: "playwright:firefox",
        };

        // Run the Actor
        console.log("Starting Apify crawl...");
        const run = await client.actor("apify/website-content-crawler").call(input);
        console.log("Crawl finished, fetching results...");

        // Fetch results from the dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // Define interface for the expected result structure from website-content-crawler
        interface ApifyResult {
            text?: string;
            markdown?: string;
            metadata?: {
                title?: string;
                description?: string;
            };
            [key: string]: any;
        }

        const crawlResult = (items[0] || {}) as ApifyResult;

        // Extract raw text content
        const rawText = crawlResult.text || crawlResult.markdown || "";
        const metaTitle = crawlResult.metadata?.title || "";
        const metaDesc = crawlResult.metadata?.description || "";

        console.log(`Extracted text length: ${rawText.length}`);
        console.log(`Meta Title: ${metaTitle}`);
        console.log(`GROQ_API_KEY present: ${!!GROQ_API_KEY}`);

        if (!rawText && !metaTitle) {
            console.error("Content extraction failed: No text or title found.");
            throw new Error("No content extracted from the URL.");
        }

        // GEMINI PROCESSING
        let processedData = {
            title: metaTitle,
            description: metaDesc,
            h1: metaTitle,
            ogTitle: metaTitle,
            ogDesc: metaDesc,
            brand: "정보 없음",
            productName: "정보 없음",
            oneLineDef: "정보 없음",
            context: "정보 없음",
            keyMessages: [],
            features: [],
            specs: [],
            releaseDate: "YYYY년 MM월 DD일",
            channel: "판매처 또는 홈페이지",
            promotion: "내용 입력 (비워두면 생략)"
        };

        if (GROQ_API_KEY && rawText.length > 100) {
            try {
                console.log("Starting Groq processing...");
                const groq = new Groq({ apiKey: GROQ_API_KEY });

                const prompt = `아래 제품 페이지 콘텐츠에서 JSON만 추출하세요. 순수 JSON만 출력.
{"brand":"브랜드명","productName":"제품명","oneLineDef":"한 줄 슬로건","context":"타겟/맥락","keyMessages":["메시지1","메시지2"],"features":["특징1","특징2","특징3"],"specs":["스펙1","스펙2"],"releaseDate":"YYYY년 MM월 DD일","channel":"판매채널","promotion":"할인정보"}

콘텐츠:
${rawText.substring(0, 12000)}`;

                const response = await groq.chat.completions.create({
                    model: GROQ_MODEL,
                    messages: [
                        { role: "system", content: "당신은 제품 정보 추출 전문가입니다. 반드시 JSON만 출력합니다." },
                        { role: "user", content: prompt },
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.2,
                    max_tokens: 1024,
                });

                const groqData = JSON.parse(response.choices[0].message.content || "{}");
                processedData = { ...processedData, ...groqData };
                if (!Array.isArray(processedData.features)) processedData.features = [];
                if (!Array.isArray(processedData.specs)) processedData.specs = [];
                if (!Array.isArray(processedData.keyMessages)) processedData.keyMessages = [];
                console.log("Groq processing complete.");

            } catch (aiError) {
                console.error("Groq Error:", aiError);
            }
        }

        // Return combined result
        return NextResponse.json({ success: true, data: processedData });

    } catch (error: any) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

