import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@todoist-clone/domain";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import {
  cleanupTestResources,
  createTestAgent,
  createTestServer,
  temporaryDirectories,
} from "./appTestUtils";
import { hashPassword } from "./auth";
import { createMemoryTaskRepository } from "./repository";
import { createMemoryUserRepository } from "./users";

afterEach(cleanupTestResources);

describe("comment attachments", () => {
  // Вложения недоступны без каталога хранения.
  // Без каталога хранения API не объявляет и не принимает вложения.
  it("keeps attachments disabled unless a storage directory is configured", async () => {
    const agent = await createTestAgent();
    await agent
      .get("/features")
      .expect(200)
      .expect(({ body }) => expect(body.attachmentsEnabled).toBe(false));
    const task = (await agent.post("/tasks").send({ title: "Attachment task" }).expect(201)).body.task;
    await agent.post(`/tasks/${task.id}/comments`).field("body", "A note").expect(503);
  });

  // Флаг функции может отключить загрузку даже при настроенной файловой системе.
  // Переключатель функции отключает API даже при заданном каталоге.
  it("keeps attachment APIs disabled when the environment feature flag is off even if storage is configured", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mytodo-attachments-disabled-"));
    temporaryDirectories.add(directory);
    const userRepository = createMemoryUserRepository([
      {
        id: "test-admin",
        username: "test-admin",
        passwordHash: await hashPassword("test-admin-password"),
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(
      createApp(createMemoryTaskRepository(), {
        userRepository,
        attachmentsDir: directory,
        attachmentsEnabled: false,
      }),
    );
    const agent = request.agent(server);
    await agent
      .post("/auth/login")
      .send({ username: "test-admin", password: "test-admin-password" })
      .expect(200);
    await agent
      .get("/features")
      .expect(200)
      .expect(({ body }) => expect(body.attachmentsEnabled).toBe(false));
    await agent.post("/tasks/task-1/comments").field("body", "A note").expect(503);
    await agent.get("/attachments/00000000-0000-0000-0000-000000000000").expect(503);
  });

  // Сохраняем файл приватно и выдаём его только по аутентифицированному API.
  // Вложения комментария хранятся приватно и выдаются только авторизованным запросам.
  it("stores confirmed comment files privately and serves them only through the authenticated API", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mytodo-attachments-"));
    temporaryDirectories.add(directory);
    const userRepository = createMemoryUserRepository([
      {
        id: "test-admin",
        username: "test-admin",
        passwordHash: await hashPassword("test-admin-password"),
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(
      createApp(createMemoryTaskRepository(), {
        userRepository,
        attachmentsDir: directory,
        attachmentsEnabled: true,
      }),
    );
    const agent = request.agent(server);
    await agent
      .post("/auth/login")
      .send({ username: "test-admin", password: "test-admin-password" })
      .expect(200);
    const task = (await agent.post("/tasks").send({ title: "Attachment task" }).expect(201)).body.task;
    await agent.post(`/tasks/${task.id}/comments`).field("body", "").expect(400);
    const response = await agent
      .post(`/tasks/${task.id}/comments`)
      .field("body", "")
      .attach("files", Buffer.from("sample text"), { filename: "notes.txt", contentType: "text/plain" })
      .expect(201);
    expect(response.body.comment.body).toBe("");
    const attachment = response.body.comment.attachments[0];
    expect(attachment).toMatchObject({ name: "notes.txt", mimeType: "text/plain", size: 11 });
    expect(await readFile(join(directory, attachment.id), "utf8")).toBe("sample text");
    await agent
      .get(`/attachments/${attachment.id}`)
      .expect(200)
      .expect("Content-Disposition", /attachment; filename="notes.txt"/)
      .expect("X-Content-Type-Options", "nosniff");
    const listed = await agent.get("/tasks").expect(200);
    expect(JSON.stringify(listed.body)).toContain(attachment.id);
  });

  // Одновременные запросы не должны терять комментарии или вложения друг друга.
  // Параллельные загрузки файлов не затирают комментарии друг друга.
  it("keeps comments from concurrent attachment uploads", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mytodo-attachments-concurrent-"));
    temporaryDirectories.add(directory);
    const userRepository = createMemoryUserRepository([
      {
        id: "test-admin",
        username: "test-admin",
        passwordHash: await hashPassword("test-admin-password"),
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(
      createApp(createMemoryTaskRepository(), {
        userRepository,
        attachmentsDir: directory,
        attachmentsEnabled: true,
      }),
    );
    const agent = request.agent(server);
    await agent
      .post("/auth/login")
      .send({ username: "test-admin", password: "test-admin-password" })
      .expect(200);
    const task = (await agent.post("/tasks").send({ title: "Concurrent comments" }).expect(201)).body.task;
    const [first, second] = await Promise.all([
      agent
        .post(`/tasks/${task.id}/comments`)
        .field("body", "First")
        .attach("files", Buffer.from("one"), { filename: "one.txt", contentType: "text/plain" }),
      agent
        .post(`/tasks/${task.id}/comments`)
        .field("body", "Second")
        .attach("files", Buffer.from("two"), { filename: "two.txt", contentType: "text/plain" }),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const listed = await agent.get("/tasks").expect(200);
    expect(listed.body.tasks[0].comments.map((comment: { body: string }) => comment.body).toSorted()).toEqual(
      ["First", "Second"],
    );
  });

  // Редактирование и удаление комментариев синхронизирует метаданные вложений в правильном порядке.
  // Комментарии можно редактировать и удалять, сохраняя порядок метаданных вложений.
  it("allows editing and deleting comments with PostgreSQL-ordered attachment metadata", async () => {
    const createdAt = "2026-11-08T15:00:31.010Z";
    const attachment = {
      id: "attachment-1",
      name: "image.png",
      size: 7754,
      mimeType: "image/png",
    };
    const initialTask: Task = {
      id: "task-with-attachment",
      title: "Task with attachment",
      description: "",
      dueDate: null,
      labels: [],
      comments: [
        {
          id: "comment-with-attachment",
          body: "",
          createdAt,
          attachments: [attachment],
        },
      ],
      completed: false,
      parentId: null,
      projectId: null,
      sectionId: null,
      lexicalOrder: "a",
      createdAt,
      updatedAt: createdAt,
    };
    const userRepository = createMemoryUserRepository([
      {
        id: "test-admin",
        username: "test-admin",
        passwordHash: await hashPassword("test-admin-password"),
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(
      createApp(createMemoryTaskRepository([initialTask]), { userRepository }),
    );
    const agent = request.agent(server);
    await agent
      .post("/auth/login")
      .send({ username: "test-admin", password: "test-admin-password" })
      .expect(200);

    const edited = await agent
      .patch(`/tasks/${initialTask.id}`)
      .send({
        comments: [
          {
            id: "comment-with-attachment",
            body: "Edited text",
            createdAt,
            attachments: [
              {
                id: attachment.id,
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
              },
            ],
          },
        ],
      })
      .expect(200);
    expect(edited.body.task.comments[0]).toMatchObject({
      id: "comment-with-attachment",
      body: "Edited text",
      attachments: [attachment],
    });
    await agent
      .patch(`/tasks/${initialTask.id}`)
      .send({
        comments: [
          {
            id: "comment-with-attachment",
            body: "Edited text",
            createdAt,
            attachments: [{ ...attachment, size: attachment.size + 1 }],
          },
        ],
      })
      .expect(400);
    const deleted = await agent.patch(`/tasks/${initialTask.id}`).send({ comments: [] }).expect(200);
    expect(deleted.body.task.comments).toEqual([]);
  });
});
