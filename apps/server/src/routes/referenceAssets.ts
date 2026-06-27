// =========================================================================
// Reference Assets API Routes
// =========================================================================

import { FastifyInstance } from "fastify";
import { createReadStream, existsSync, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, referenceAssets } from "../db/schema.js";
import { updateReferenceAssetSchema } from "@ai-video-canvas/shared";
import { getReferenceImagePath } from "../services/storage/ReferenceAssetStorageService.js";

const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function referenceAssetRoutes(app: FastifyInstance) {
  // ---- 1. Upload reference asset ------------------------------------------
  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/reference-assets",
    async (request, reply) => {
      const project = db.select().from(projects).where(eq(projects.id, request.params.projectId)).get();
      if (!project) return reply.status(404).send({ success: false, error: "Project not found" });

      const data = await request.file();
      if (!data) return reply.status(400).send({ success: false, error: "File is required" });

      if (!ALLOWED_MIMES.includes(data.mimetype)) {
        return reply.status(400).send({ success: false, error: "Only PNG, JPEG, and WebP images are supported" });
      }

      const contentLength = request.headers["content-length"];
      if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
        return reply.status(400).send({ success: false, error: "File size exceeds 10MB limit" });
      }

      const typeField = (data.fields as any)?.type?.value ?? "other";
      const validTypes = ["character", "scene", "product", "first_frame", "style", "other"];
      const assetType = validTypes.includes(typeField) ? typeField : "other";
      const label = (data.fields as any)?.label?.value ?? null;
      const description = (data.fields as any)?.description?.value ?? null;

      const mimeType = data.mimetype as "image/png" | "image/jpeg" | "image/webp";
      const { localPath } = getReferenceImagePath(request.params.projectId, mimeType);
      await pipeline(data.file, createWriteStream(localPath));

      const stat = statSync(localPath);
      const now = new Date().toISOString();
      const assetId = uuid();

      let width = null, height = null;
      try {
        const sharp = (await import("sharp")).default;
        const metadata = await sharp(localPath).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch {}

      db.insert(referenceAssets).values({
        id: assetId, projectId: request.params.projectId, type: assetType,
        label, description, localPath, mimeType,
        originalFilename: data.filename ?? null, width, height,
        fileSize: stat.size, createdAt: now, updatedAt: now,
      }).run();

      const created = db.select().from(referenceAssets).where(eq(referenceAssets.id, assetId)).get();
      return { success: true, data: created };
    },
  );

  // ---- 2. List reference assets -------------------------------------------
  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/reference-assets",
    async (request) => {
      const query = request.query as { type?: string };
      // type filter removed for simplicity
      return { success: true, data: db.select().from(referenceAssets).where(eq(referenceAssets.projectId, request.params.projectId)).orderBy(referenceAssets.createdAt).all() };
    },
  );

  // ---- 3. Update reference asset ------------------------------------------
  app.patch<{ Params: { projectId: string; assetId: string } }>(
    "/projects/:projectId/reference-assets/:assetId",
    async (request, reply) => {
      const asset = db.select().from(referenceAssets).where(eq(referenceAssets.id, request.params.assetId)).get();
      if (!asset || asset.projectId !== request.params.projectId) return reply.status(404).send({ success: false, error: "Asset not found" });

      const parsed = updateReferenceAssetSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues.map((i) => i.message).join(", ") });

      const data = parsed.data;
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (data.type !== undefined) updates.type = data.type;
      if (data.label !== undefined) updates.label = data.label;
      if (data.description !== undefined) updates.description = data.description;

      db.update(referenceAssets).set(updates).where(eq(referenceAssets.id, request.params.assetId)).run();
      const updated = db.select().from(referenceAssets).where(eq(referenceAssets.id, request.params.assetId)).get();
      return { success: true, data: updated };
    },
  );

  // ---- 4. Delete reference asset ------------------------------------------
  app.delete<{ Params: { projectId: string; assetId: string } }>(
    "/projects/:projectId/reference-assets/:assetId",
    async (request, reply) => {
      const asset = db.select().from(referenceAssets).where(eq(referenceAssets.id, request.params.assetId)).get();
      if (!asset || asset.projectId !== request.params.projectId) return reply.status(404).send({ success: false, error: "Asset not found" });

      try { if (existsSync(asset.localPath)) unlinkSync(asset.localPath); } catch (e) { console.warn("[ReferenceAssets] Failed to delete file:", asset.localPath, e); }

      db.delete(referenceAssets).where(eq(referenceAssets.id, request.params.assetId)).run();
      return { success: true, data: { deleted: true } };
    },
  );

  // ---- 5. Serve asset image -----------------------------------------------
  app.get<{ Params: { projectId: string; assetId: string } }>(
    "/projects/:projectId/reference-assets/:assetId/image",
    async (request, reply) => {
      const asset = db.select().from(referenceAssets).where(eq(referenceAssets.id, request.params.assetId)).get();
      if (!asset || asset.projectId !== request.params.projectId) return reply.status(404).send({ success: false, error: "Asset not found" });
      if (!existsSync(asset.localPath)) return reply.status(404).send({ success: false, error: "Image file not found" });
      return reply.type(asset.mimeType).send(createReadStream(asset.localPath));
    },
  );
}