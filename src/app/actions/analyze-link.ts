"use server";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export interface AnalysisResult {
    success: boolean;
    data?: any;
    markdown?: string; // 원본 마크다운 데이터 추가
    message?: string;
}

/**
 * Firecrawl API의 extract 기능을 활용 (Gemini API Quota 제한 우회)
 * - Gemini API 직접 호출 시 발생하는 429(Quota Exceeded) 에러를 방지하기 위해
 *   Firecrawl 자체 LLM 기능을 사용하여 구조화된 데이터를 추출합니다.
 */
async function scrapeAndExtract(url: string): Promise<{
    extractedData: any | null;
    markdown: string;
    title: string;
}> {
    if (!FIRECRAWL_API_KEY) {
        throw new Error("Firecrawl API Key is missing");
    }

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
            url,
            formats: ["markdown", "extract"], // Markdown과 Extract 동시 요청
            extract: {
                prompt: `
너는 전문 보도자료 작성가이자 데이터 분석가야. 제공된 웹페이지 데이터에서 보도자료 생성에 필요한 핵심 정보를 추출해 JSON으로 반환해.

[추출 규칙]
1. 브랜드명/제품명: 메타데이터나 제목에서 정확히 추출.
2. 핵심 메시지(coreMessages): 단순 기능 나열이 아닌, 사용자가 얻는 '가치' 중심의 문장으로 변환 (예: '흔들림 없는 견고함으로 업무 몰입도 극대화').
3. 주요 특징(features): 기술적 강점, 차별화된 스펙, 인증 정보 위주로 3개를 요약.
4. 제품 스펙: 수치(사이즈, 무게, 소재)가 명시된 정보는 빠짐없이 파악하여 특징에 반영할 것.
5. 주의: 텍스트 정보가 부족하면 이미지 Alt 태그나 맥락을 통해 유추하고, 불확실하면 '사용자 확인 필요'로 표기.

정보가 없는 항목은 빈 문자열("")이나 "정보 없음"으로 채울 것.
`,
                schema: {
                    type: "object",
                    properties: {
                        brandName: { type: "string", description: "브랜드명" },
                        productName: { type: "string", description: "제품명" },
                        definition: { type: "string", description: "한 줄 정의 또는 슬로건" },
                        features: {
                            type: "array",
                            items: { type: "string" },
                            description: "주요 특징 3~5개 (기술적 강점 위주)"
                        },
                        coreMessages: {
                            type: "array",
                            items: { type: "string" },
                            description: "핵심 마케팅 메시지 2~3개 (고객 가치 중심)"
                        },
                        usageContext: { type: "string", description: "사용 맥락 또는 타겟" },
                        launchDate: { type: "string", description: "출시일" },
                        discountPromo: { type: "string", description: "프로모션/할인 정보" },
                        channels: { type: "string", description: "판매 채널" },
                        commentIntent: { type: "string", description: "코멘트 의도" }
                    },
                    required: ["brandName", "productName", "features"]
                }
            },
            waitFor: 3000, // 동적 로딩 대기
            excludeTags: ["nav", "footer", "script", "style", "noscript"],
            timeout: 40000,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Firecrawl API Error: ${response.status}`, errorText);
        throw new Error(`Firecrawl API 오류 (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(`Firecrawl 스크래핑 실패: ${result.error || "알 수 없는 오류"}`);
    }

    const data = result.data || {};
    return {
        extractedData: data.extract || null,
        markdown: data.markdown || "",
        title: data.metadata?.title || "",
    };
}

/**
 * Fallback Parser (Firecrawl extract 실패 시 사용)
 */
function parseTextFallback(rawText: string, metaTitle: string, url: string) {
    let brandName = "정보 없음";
    if (rawText.includes("데스커") || url.includes("desker")) brandName = "데스커(DESKER)";

    let productName = metaTitle.split("|")[0].trim();

    // 간단한 키워드 기반 특징 추출
    const lines = rawText.split("\n").filter(l => l.trim().length > 10);
    const features = lines.filter(l => l.includes("기능") || l.includes("소재") || l.includes("mm")).slice(0, 3);

    return {
        brandName,
        productName,
        definition: `${brandName} ${productName}`,
        features: features.length > 0 ? features : ["특징을 추출하지 못했습니다."],
        coreMessages: ["상세페이지 내용을 확인해주세요."],
        usageContext: "정보 없음",
        launchDate: "",
        discountPromo: "",
        channels: "",
        commentIntent: ""
    };
}

export async function analyzeLink(url: string): Promise<AnalysisResult> {
    if (!url) return { success: false, message: "URL is required" };

    console.log("[analyzeLink] 분석 시작 (Mode: Firecrawl Extract):", url);

    try {
        // Gemini API 호출 없이 Firecrawl 내장 LLM 사용
        const { extractedData, markdown, title } = await scrapeAndExtract(url);

        console.log(`[analyzeLink] 스크래핑 완료. (마크다운 길이: ${markdown.length})`);

        if (extractedData) {
            console.log("[analyzeLink] ✅ Firecrawl Extract 성공:", extractedData.productName);

            // 배열 안전 처리
            if (!Array.isArray(extractedData.features)) extractedData.features = [];
            if (!Array.isArray(extractedData.coreMessages)) extractedData.coreMessages = [];

            return { success: true, data: extractedData, markdown };
        }

        console.log("[analyzeLink] ⚠️ Extract 데이터 없음, Fallback 실행");
        const fallbackData = parseTextFallback(markdown, title, url);
        return { success: true, data: fallbackData, markdown };

    } catch (error: any) {
        console.error("[analyzeLink] 치명적 오류:", error);
        return { success: false, message: `분석 중 오류가 발생했습니다: ${error.message}` };
    }
}
