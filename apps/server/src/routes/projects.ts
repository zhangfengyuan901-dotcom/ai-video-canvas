// =========================================================================
// Project API Routes
// =========================================================================

import { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { projects, scenes, storyboardPanels, videoClips } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createProjectSchema, updateSceneSchema, reorderScenesSchema } from "@ai-video-canvas/shared";
import type { Scene } from "@ai-video-canvas/shared";

export async function projectRoutes(app: FastifyInstance) {
  // ---- Create project --------------------------------------------------

  app.post("/projects", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const now = new Date().toISOString();
    const id = uuid();

    const project = {
      id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      aspectRatio: parsed.data.aspectRatio ?? "16:9",
      resolution: parsed.data.resolution ?? "1080p",
      defaultSceneDuration: 8,
      rootPath: `local-data/projects/project-${id}`,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(projects).values(project).run();

    return reply.status(201).send({ success: true, data: project });
  });

  // ---- List all projects -----------------------------------------------

  app.get("/projects", async () => {
    const rows = db.select().from(projects).all();
    return { success: true, data: rows };
  });

  // ---- Get single project -----------------------------------------------

  app.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const row = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!row) {
      return reply.status(404).send({ success: false, error: "Project not found" });
    }
    return { success: true, data: row };
  });

  // ---- Update project --------------------------------------------------

  app.patch<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const row = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!row) {
      return reply.status(404).send({ success: false, error: "Project not found" });
    }

    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.description === "string") updates.description = body.description;
    if (body.aspectRatio === "16:9" || body.aspectRatio === "9:16") updates.aspectRatio = body.aspectRatio;
    if (body.resolution === "720p" || body.resolution === "1080p" || body.resolution === "4k")
      updates.resolution = body.resolution;

    db.update(projects).set(updates).where(eq(projects.id, request.params.id)).run();

    const updated = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    return { success: true, data: updated };
  });

  // ---- List scenes for project -----------------------------------------

  app.get<{ Params: { projectId: string } }>("/projects/:projectId/scenes", async (request) => {
    const rows = db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, request.params.projectId))
      .orderBy(scenes.order)
      .all();

    const parsed: Scene[] = rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      order: r.order,
      title: r.title,
      summary: r.summary,
      scriptText: r.scriptText,
      visualDescription: r.visualDescription,
      characters: JSON.parse(r.charactersJson),
      location: r.location,
      shotSize: r.shotSize,
      cameraAngle: r.cameraAngle,
      cameraMovement: r.cameraMovement,
      motionPrompt: r.motionPrompt,
      dialogue: r.dialogue ?? undefined,
      audioEffects: r.audioEffects ?? undefined,
      duration: r.duration,
      status: r.status as Scene["status"],
      locked: !!r.locked,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return { success: true, data: parsed };
  });

  // ---- Update scene ----------------------------------------------------

  app.patch<{ Params: { id: string } }>("/scenes/:id", async (request, reply) => {
    const parsed = updateSceneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const existing = db.select().from(scenes).where(eq(scenes.id, request.params.id)).get();
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Scene not found" });
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (data.title !== undefined) updates.title = data.title;
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.scriptText !== undefined) updates.scriptText = data.scriptText;
    if (data.visualDescription !== undefined) updates.visualDescription = data.visualDescription;
    if (data.characters !== undefined) updates.charactersJson = JSON.stringify(data.characters);
    if (data.location !== undefined) updates.location = data.location;
    if (data.shotSize !== undefined) updates.shotSize = data.shotSize;
    if (data.cameraAngle !== undefined) updates.cameraAngle = data.cameraAngle;
    if (data.cameraMovement !== undefined) updates.cameraMovement = data.cameraMovement;
    if (data.motionPrompt !== undefined) updates.motionPrompt = data.motionPrompt;
    if (data.dialogue !== undefined) updates.dialogue = data.dialogue;
    if (data.audioEffects !== undefined) updates.audioEffects = data.audioEffects;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.locked !== undefined) updates.locked = data.locked ? 1 : 0;

    db.update(scenes).set(updates).where(eq(scenes.id, request.params.id)).run();

    const updated = db.select().from(scenes).where(eq(scenes.id, request.params.id)).get();
    return { success: true, data: updated };
  });

  
  // ---- Create empty scene ------------------------------------------------
  // POST /api/projects/:projectId/scenes

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/scenes",
    async (request, reply) => {
      const project = db.select().from(projects).where(eq(projects.id, request.params.projectId)).get();
      if (!project) return reply.status(404).send({ success: false, error: "Project not found" });

      const now = new Date().toISOString();
      const maxOrder = db.select().from(scenes).where(eq(scenes.projectId, request.params.projectId)).all().length;
      const id = uuid();

      db.insert(scenes).values({
        id, projectId: request.params.projectId, order: maxOrder + 1,
        title: "新段落", summary: "", scriptText: "", visualDescription: "",
        charactersJson: "[]", location: "", shotSize: "", cameraAngle: "",
        cameraMovement: "", motionPrompt: "", dialogue: null, audioEffects: null,
        duration: 8, status: "draft", locked: 0,
        createdAt: now, updatedAt: now,
      }).run();

      const created = db.select().from(scenes).where(eq(scenes.id, id)).get();
      return reply.status(201).send({ success: true, data: created });
    },
  );

  // ---- Delete scene -------------------------------------------------------
  // DELETE /api/scenes/:id

  app.delete<{ Params: { id: string } }>(
    "/scenes/:id",
    async (request, reply) => {
      const scene = db.select().from(scenes).where(eq(scenes.id, request.params.id)).get();
      if (!scene) return reply.status(404).send({ success: false, error: "Scene not found" });

      // Delete related data
      db.delete(storyboardPanels).where(eq(storyboardPanels.sceneId, request.params.id)).run();
      db.delete(videoClips).where(eq(videoClips.sceneId, request.params.id)).run();
      db.delete(scenes).where(eq(scenes.id, request.params.id)).run();

      // Reorder remaining scenes in the same project
      const remaining = db.select().from(scenes).where(eq(scenes.projectId, scene.projectId)).orderBy(scenes.order).all();
      const now = new Date().toISOString();
      for (let i = 0; i < remaining.length; i++) {
        db.update(scenes).set({ order: i + 1, updatedAt: now }).where(eq(scenes.id, remaining[i].id)).run();
      }

      return { success: true, data: { deleted: true } };
    },
  );

  // ---- Reorder scenes --------------------------------------------------

  app.post("/scenes/reorder", async (request, reply) => {
    // Legacy: 0-based reorder — deprecated, use GET /scenes/reorder?oneBased=true
    const parsed = reorderScenesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const now = new Date().toISOString();
    for (let i = 0; i < parsed.data.sceneIds.length; i++) {
      db.update(scenes)
        .set({ order: i + 1, updatedAt: now })
        .where(eq(scenes.id, parsed.data.sceneIds[i]))
        .run();
    }

    return { success: true };
  });
}
