"use server";

import OpenAI from "openai";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 과거 보도자료를 벡터 DB에 저장하는 함수
 * (보도자료 생성 시 톤앤매너 모방용 레퍼런스로 활용됩니다)
 */
export async function insertPastPressRelease(subject: string, type: string, content: string) {
    try {
        if (!content || content.length < 10) {
            throw new Error("보도자료 본문이 너무 짧습니다.");
        }

        console.log(`[insertPastPR] 임베딩 생성 시작...`);
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: content,
        });

        const embedding = embeddingResponse.data[0].embedding;

        console.log(`[insertPastPR] Convex DB 저장 시작...`);
        await fetchMutation(api.pressReleases.insert, {
            subject,
            type,
            content,
            embedding,
        });

        console.log(`[insertPastPR] ✅ 성공적으로 저장되었습니다!`);
        return { success: true };
    } catch (error: any) {
        console.error(`[insertPastPR] ❌ 등록 실패:`, error.message);
        return { success: false, message: error.message };
    }
}
