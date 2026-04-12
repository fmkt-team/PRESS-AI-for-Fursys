import { mutation, action, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const insert = mutation({
    args: {
        subject: v.string(),
        type: v.string(),
        content: v.string(),
        embedding: v.array(v.float64()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("pressReleases", {
            subject: args.subject,
            type: args.type,
            content: args.content,
            embedding: args.embedding,
        });
    },
});

export const remove = mutation({
    args: { id: v.id("pressReleases") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

export const searchSimilar = action({
    args: {
        embedding: v.array(v.float64()),
        type: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<any[]> => {
        const results = await ctx.vectorSearch("pressReleases", "by_embedding", {
            vector: args.embedding,
            limit: 3,
            filter: args.type ? (q) => q.eq("type", args.type as string) : undefined,
        });

        // Convert array of ids to documents
        const docIds = results.map((r) => r._id);
        const docs: any[] = await ctx.runQuery(internal.pressReleases.getByIds, { ids: docIds });
        return docs;
    },
});

export const getByIds = internalQuery({
    args: { ids: v.array(v.id("pressReleases")) },
    handler: async (ctx, args) => {
        const results: any[] = [];
        for (const id of args.ids) {
            const doc = await ctx.db.get(id);
            if (doc) results.push(doc);
        }
        return results;
    }
});

export const getList = query({
    args: {},
    handler: async (ctx) => {
        // Return everything, omitting the large embedding to save bandwidth
        const allDocs = await ctx.db.query("pressReleases").order("desc").collect();
        return allDocs.map(doc => ({
            _id: doc._id,
            subject: doc.subject,
            type: doc.type,
            _creationTime: doc._creationTime
        }));
    }
});
