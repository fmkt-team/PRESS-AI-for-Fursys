import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 전체 캘린더 이벤트 조회 (최신순)
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("calendarEvents").order("desc").collect();
    },
});

export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

export const getStorageUrl = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    }
});

// 이벤트 생성
export const create = mutation({
    args: {
        title: v.string(),
        date: v.string(),
        status: v.string(),
        type: v.string(),
        content: v.optional(v.string()),
        image: v.optional(v.string()),
        imageContent: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        performanceFile: v.optional(v.string()),
        performanceFileName: v.optional(v.string()),
        performanceStorageId: v.optional(v.id("_storage")),
        articleCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let finalImageContent = args.imageContent;
        if (args.imageStorageId) {
            const url = await ctx.storage.getUrl(args.imageStorageId);
            if (url) finalImageContent = url;
        }

        let finalPerformanceFile = args.performanceFile;
        if (args.performanceStorageId) {
            const url = await ctx.storage.getUrl(args.performanceStorageId);
            if (url) finalPerformanceFile = url;
        }

        return await ctx.db.insert("calendarEvents", {
            title: args.title,
            date: args.date,
            status: args.status,
            type: args.type,
            content: args.content,
            image: args.image,
            imageContent: finalImageContent,
            performanceFile: finalPerformanceFile,
            performanceFileName: args.performanceFileName,
            articleCount: args.articleCount,
        });
    },
});

// 이벤트 수정 (보도자료 내용, 날짜, 제목, 이미지 등)
export const update = mutation({
    args: {
        id: v.id("calendarEvents"),
        title: v.optional(v.string()),
        date: v.optional(v.string()),
        status: v.optional(v.string()),
        content: v.optional(v.string()),
        image: v.optional(v.string()),
        imageContent: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
        articleCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, imageStorageId, ...fields } = args;
        const updates: Record<string, any> = {};
        for (const [key, val] of Object.entries(fields)) {
            if (val !== undefined) updates[key] = val;
        }

        if (imageStorageId) {
            const url = await ctx.storage.getUrl(imageStorageId);
            if (url) updates.imageContent = url;
        }

        await ctx.db.patch(id, updates);
    },
});

// 성과 파일 및 기사 수 업데이트
export const updatePerformance = mutation({
    args: {
        id: v.id("calendarEvents"),
        articleCount: v.optional(v.number()),
        performanceFile: v.optional(v.string()),
        performanceFileName: v.optional(v.string()),
        performanceStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        const { id, performanceStorageId, ...fields } = args;
        const updates: Record<string, any> = {};
        for (const [key, val] of Object.entries(fields)) {
            if (val !== undefined) updates[key] = val;
        }

        if (performanceStorageId) {
            const url = await ctx.storage.getUrl(performanceStorageId);
            if (url) updates.performanceFile = url;
        }

        await ctx.db.patch(id, updates);
    },
});

// 이벤트 삭제
export const remove = mutation({
    args: { id: v.id("calendarEvents") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
