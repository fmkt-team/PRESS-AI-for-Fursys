import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    pressReleases: defineTable({
        subject: v.string(),
        type: v.string(),
        content: v.string(),
        embedding: v.array(v.float64()),
    }).vectorIndex("by_embedding", {
        vectorField: "embedding",
        dimensions: 1536, // OpenAI text-embedding-3-small dimensions
        filterFields: ["type"],
    }),

    calendarEvents: defineTable({
        title: v.string(),
        date: v.string(),          // ISO 날짜 문자열
        status: v.string(),        // "예정됨" | "배포됨" | "배포 완료"
        type: v.string(),          // "보도자료" 등
        content: v.optional(v.string()),
        image: v.optional(v.string()),
        imageContent: v.optional(v.string()),   // base64 이미지
        performanceFile: v.optional(v.string()), // base64 성과 파일
        performanceFileName: v.optional(v.string()),
        articleCount: v.optional(v.number()),
    }),

    prRequests: defineTable({
        requesterName: v.string(),
        team: v.string(),
        email: v.string(),
        subject: v.string(),
        type: v.string(),
        summary: v.optional(v.string()),
        referenceUrl: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        attachmentStorageId: v.optional(v.id("_storage")),
        insertionUrl: v.optional(v.string()),
        llmQuestion: v.optional(v.string()), // 레거시 지원
        llmAnswerPoint: v.optional(v.string()), // 레거시 지원
        llmQuestions: v.optional(v.array(v.string())),
        llmAnswers: v.optional(v.array(v.string())),
        desiredDate: v.optional(v.string()), // 배포 희망일
        imageFileName: v.optional(v.string()), // 업로드 이미지 원본 파일명
        attachmentFileName: v.optional(v.string()), // 업로드 주서 파일 원본 파일명
        status: v.string(), // "대기" | "진행중" | "완료"
    }),
});
