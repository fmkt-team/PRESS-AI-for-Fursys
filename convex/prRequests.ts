import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        const requests = await ctx.db.query("prRequests").order("desc").collect();
        // 이미지와 첨부파일의 다운로드 URL을 함께 반환
        return Promise.all(
            requests.map(async (req) => {
                const imageUrl = req.imageStorageId ? await ctx.storage.getUrl(req.imageStorageId) : null;
                const attachmentUrl = req.attachmentStorageId ? await ctx.storage.getUrl(req.attachmentStorageId) : null;
                return { ...req, imageUrl, attachmentUrl };
            })
        );
    },
});

export const create = mutation({
    args: {
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
        llmQuestions: v.optional(v.array(v.string())),
        llmAnswers: v.optional(v.array(v.string())),
        desiredDate: v.optional(v.string()), // 배포 희망일 (ISO string)
        imageFileName: v.optional(v.string()), // 업로드 이미지 원본 파일명
        attachmentFileName: v.optional(v.string()), // 업로드 첨부 파일 원본 파일명
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("prRequests", {
            ...args,
            status: "대기", // 초기 상태는 항상 '대기'
        });
        return id;
    },
});

export const updateStatus = mutation({
    args: { id: v.id("prRequests"), status: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status });
    },
});

export const remove = mutation({
    args: { id: v.id("prRequests") },
    handler: async (ctx, args) => {
        // 관련된 스토리지 파일도 삭제 로직에 포함
        const request = await ctx.db.get(args.id);
        if (request) {
            if (request.imageStorageId) await ctx.storage.delete(request.imageStorageId);
            if (request.attachmentStorageId) await ctx.storage.delete(request.attachmentStorageId);
            await ctx.db.delete(args.id);
        }
    },
});

// 파일 업로드를 위한 URL 생성
export const generateUploadUrl = mutation({
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});
