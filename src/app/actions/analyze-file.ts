"use server";

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

interface AnalysisResult {
    success: boolean;
    data?: any;
    message?: string;
}

export async function analyzeFileContent(
    text: string,
    fileName: string
): Promise<AnalysisResult> {
    if (!text || text.trim().length < 20) {
        return { success: false, message: "파일에서 충분한 텍스트를 추출하지 못했습니다." };
    }

    console.log(`[analyzeFile] 분석 시작: ${fileName}`);

    const prompt = `아래 문서에서 제품/브랜드 정보를 추출하여 JSON으로만 응답하세요. 다른 텍스트 없이 순수 JSON만.

{"brandName":"브랜드명","productName":"제품명","definition":"한 줄 정의","features":["특징1","특징2","특징3"],"coreMessages":["메시지1","메시지2"],"usageContext":"타겟/맥락","launchDate":"출시일","discountPromo":"프로모션","channels":"판매채널","commentIntent":"코멘트요약"}

문서:
---
${text.substring(0, 12000)}
---`;

    try {
        const response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: "당신은 보도자료 작성 전문가입니다. 반드시 JSON만 출력합니다." },
                { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 1024,
        });

        const rawText = response.choices[0].message.content || "";
        const parsed = JSON.parse(rawText);

        if (!Array.isArray(parsed.features)) parsed.features = [];
        if (!Array.isArray(parsed.coreMessages)) parsed.coreMessages = [];

        console.log(`[analyzeFile] ✅ 성공: ${parsed.productName}`);
        return { success: true, data: parsed };

    } catch (error: any) {
        console.error("[analyzeFile] ❌ 실패:", error.message);
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 5 && l.length < 150);
        return {
            success: true,
            data: {
                brandName: "정보 없음",
                productName: lines.find(l => l.length > 10) || fileName,
                definition: "AI 분석 실패 — 수동 입력 필요",
                features: lines.slice(0, 3),
                coreMessages: [],
                usageContext: "정보 없음",
                launchDate: "", discountPromo: "", channels: "", commentIntent: ""
            },
            message: "⚠️ AI 분석 실패. 내용을 직접 보완해주세요."
        };
    }
}
