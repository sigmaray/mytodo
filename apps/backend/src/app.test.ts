import { getRequestListener } from "@hono/node-server";
import { createServer, type Server } from "node:http";
import request from "supertest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "@todoist-clone/domain";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { hashPassword } from "./auth";
import { createMemoryTaskRepository } from "./repository";
import { createMemoryUserRepository } from "./users";

const activeServers = new Set<Server>();
const temporaryDirectories = new Set<string>();

const createTestServer = async (app: ReturnType<typeof createApp>) => {
  const server = createServer(getRequestListener(app.fetch));
  activeServers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
};

const createTestAgent = async (options: Readonly<{ projectArchivingEnabled?: boolean }> = Object.freeze({})) => {
  const userRepository = createMemoryUserRepository([Object.freeze({
    id: "test-admin",
    username: "test-admin",
    passwordHash: await hashPassword("test-admin-password"),
    isAdmin: true,
    confirmDelete: true,
    inboxDescription: ""
  })]);
  const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository, ...options }));
  const agent = request.agent(server);
  await agent.post("/auth/login").send({ username: "test-admin", password: "test-admin-password" }).expect(200);
  return agent;
};

afterEach(async () => {
  const servers = [...activeServers];
  activeServers.clear();
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.clear();
});

describe("comment attachments", () => {
  it("keeps attachments disabled unless a storage directory is configured", async () => {
    const agent = await createTestAgent();
    await agent.get("/features").expect(200).expect(({ body }) => expect(body.attachmentsEnabled).toBe(false));
    const task = (await agent.post("/tasks").send({ title: "Attachment task" }).expect(201)).body.task;
    await agent.post(`/tasks/${task.id}/comments`).field("body", "A note").expect(503);
  });

  it("keeps attachment APIs disabled when the environment feature flag is off even if storage is configured", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mytodo-attachments-disabled-"));
    temporaryDirectories.add(directory);
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "test-admin", username: "test-admin", passwordHash: await hashPassword("test-admin-password"), isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository, attachmentsDir: directory, attachmentsEnabled: false }));
    const agent = request.agent(server);
    await agent.post("/auth/login").send({ username: "test-admin", password: "test-admin-password" }).expect(200);
    await agent.get("/features").expect(200).expect(({ body }) => expect(body.attachmentsEnabled).toBe(false));
    await agent.post("/tasks/task-1/comments").field("body", "A note").expect(503);
    await agent.get("/attachments/00000000-0000-0000-0000-000000000000").expect(503);
  });

  it("stores confirmed comment files privately and serves them only through the authenticated API", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mytodo-attachments-"));
    temporaryDirectories.add(directory);
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "test-admin", username: "test-admin", passwordHash: await hashPassword("test-admin-password"), isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository, attachmentsDir: directory, attachmentsEnabled: true }));
    const agent = request.agent(server);
    await agent.post("/auth/login").send({ username: "test-admin", password: "test-admin-password" }).expect(200);
    const task = (await agent.post("/tasks").send({ title: "Attachment task" }).expect(201)).body.task;
    await agent.post(`/tasks/${task.id}/comments`).field("body", "").expect(400);
    const response = await agent.post(`/tasks/${task.id}/comments`).field("body", "").attach("files", Buffer.from("sample text"), { filename: "notes.txt", contentType: "text/plain" }).expect(201);
    expect(response.body.comment.body).toBe("");
    const attachment = response.body.comment.attachments[0];
    expect(attachment).toMatchObject({ name: "notes.txt", mimeType: "text/plain", size: 11 });
    expect(await readFile(join(directory, attachment.id), "utf8")).toBe("sample text");
    await agent.get(`/attachments/${attachment.id}`).expect(200).expect("Content-Disposition", /attachment; filename="notes.txt"/).expect("X-Content-Type-Options", "nosniff");
    const listed = await agent.get("/tasks").expect(200);
    expect(JSON.stringify(listed.body)).toContain(attachment.id);
  });

  it("allows editing and deleting comments with PostgreSQL-ordered attachment metadata", async () => {
    const createdAt = "2026-11-08T15:00:31.010Z";
    const attachment = Object.freeze({ id: "attachment-1", name: "image.png", size: 7754, mimeType: "image/png" });
    const initialTask: Task = Object.freeze({
      id: "task-with-attachment",
      title: "Task with attachment",
      description: "",
      dueDate: null,
      labels: Object.freeze([]),
      comments: Object.freeze([Object.freeze({ id: "comment-with-attachment", body: "", createdAt, attachments: Object.freeze([attachment]) })]),
      completed: false,
      parentId: null,
      projectId: null,
      sectionId: null,
      lexicalOrder: "a",
      createdAt,
      updatedAt: createdAt
    });
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "test-admin", username: "test-admin", passwordHash: await hashPassword("test-admin-password"), isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository([initialTask]), { userRepository }));
    const agent = request.agent(server);
    await agent.post("/auth/login").send({ username: "test-admin", password: "test-admin-password" }).expect(200);

    const edited = await agent.patch(`/tasks/${initialTask.id}`).send({ comments: [{ id: "comment-with-attachment", body: "Edited text", createdAt, attachments: [{ id: attachment.id, name: attachment.name, mimeType: attachment.mimeType, size: attachment.size }] }] }).expect(200);
    expect(edited.body.task.comments[0]).toMatchObject({ id: "comment-with-attachment", body: "Edited text", attachments: [attachment] });
    await agent.patch(`/tasks/${initialTask.id}`).send({ comments: [{ id: "comment-with-attachment", body: "Edited text", createdAt, attachments: [{ ...attachment, size: attachment.size + 1 }] }] }).expect(400);
    const deleted = await agent.patch(`/tasks/${initialTask.id}`).send({ comments: [] }).expect(200);
    expect(deleted.body.task.comments).toEqual([]);
  });
});

describe("POST /tasks", () => {
  it("creates a task", async () => {
    const response = await (await createTestAgent())
      .post("/tasks")
      .send({ title: "Ship MVP" })
      .expect(201);

    expect(response.body.task).toMatchObject({
      title: "Ship MVP",
      completed: false,
      parentId: null
    });
    expect(response.body.task.id).toEqual(expect.any(String));
    expect(response.body.task.lexicalOrder).toEqual(expect.any(String));
  });

  it("updates and deletes a task", async () => {
    const agent = await createTestAgent();
    const createResponse = await agent.post("/tasks").send({ title: "Draft title" }).expect(201);
    const id = createResponse.body.task.id;

    await agent.patch(`/tasks/${id}`).send({ title: "Final title" }).expect(200);
    const listResponse = await agent.get("/tasks").expect(200);

    expect(listResponse.body.tasks[0].title).toBe("Final title");

    await agent.delete(`/tasks/${id}`).expect(200);
    const emptyResponse = await agent.get("/tasks").expect(200);

    expect(emptyResponse.body.tasks).toEqual([]);
  });

  it("creates projects, inbox sections, and moves tasks between them", async () => {
    const agent = await createTestAgent();
    const projectResponse = await agent.post("/projects").send({ title: "Roadmap" }).expect(201);
    const sectionResponse = await agent.post("/sections").send({ title: "Later" }).expect(201);
    const taskResponse = await agent.post("/tasks").send({ title: "Sort inbox" }).expect(201);

    await agent
      .put(`/tasks/${taskResponse.body.task.id}/move`)
      .send({
        parentId: null,
        projectId: projectResponse.body.project.id,
        sectionId: null,
        beforeId: null,
        afterId: null
      })
      .expect(200);

    const projectTasks = await agent.get("/tasks").expect(200);

    expect(projectTasks.body.tasks[0]).toMatchObject({
      title: "Sort inbox",
      projectId: projectResponse.body.project.id,
      sectionId: null
    });

    await agent
      .put(`/tasks/${taskResponse.body.task.id}/move`)
      .send({
        parentId: null,
        projectId: null,
        sectionId: sectionResponse.body.section.id,
        beforeId: null,
        afterId: null
      })
      .expect(200);

    const sectionTasks = await agent.get("/tasks").expect(200);

    expect(sectionTasks.body.tasks[0]).toMatchObject({
      projectId: null,
      sectionId: sectionResponse.body.section.id
    });
  });

  it("updates and deletes sections without deleting tasks", async () => {
    const agent = await createTestAgent();
    const sectionResponse = await agent.post("/sections").send({ title: "Later" }).expect(201);
    const taskResponse = await agent
      .post("/tasks")
      .send({ title: "Keep me", sectionId: sectionResponse.body.section.id })
      .expect(201);

    await agent.patch(`/sections/${sectionResponse.body.section.id}`).send({ title: "Soon" }).expect(200);

    const sections = await agent.get("/sections").expect(200);

    expect(sections.body.sections[0]).toMatchObject({ title: "Soon" });

    await agent.delete(`/sections/${sectionResponse.body.section.id}`).expect(200);

    const tasks = await agent.get("/tasks").expect(200);

    expect(tasks.body.tasks[0]).toMatchObject({
      id: taskResponse.body.task.id,
      title: "Keep me",
      sectionId: null,
      parentId: null
    });
  });

  it("updates and deletes projects, cascading to their sections and tasks", async () => {
    const agent = await createTestAgent();
    const projectResponse = await agent.post("/projects").send({ title: "Roadmap" }).expect(201);
    const projectId = projectResponse.body.project.id;
    const sectionResponse = await agent.post("/sections").send({ title: "Later", projectId }).expect(201);
    const sectionTaskResponse = await agent
      .post("/tasks")
      .send({ title: "In section", sectionId: sectionResponse.body.section.id })
      .expect(201);
    await agent
      .post("/tasks")
      .send({ title: "Subtask", parentId: sectionTaskResponse.body.task.id, sectionId: sectionResponse.body.section.id })
      .expect(201);

    await agent.patch(`/projects/${projectId}`).send({ title: "Roadmap 2", description: "Project notes" }).expect(200);

    const renamed = await agent.get("/projects").expect(200);

    expect(renamed.body.projects[0]).toMatchObject({ id: projectId, title: "Roadmap 2", description: "Project notes" });

    await agent.delete(`/projects/${projectId}`).expect(200);

    const projects = await agent.get("/projects").expect(200);
    const sections = await agent.get("/sections").expect(200);
    const tasks = await agent.get("/tasks").expect(200);

    expect(projects.body.projects).toEqual([]);
    expect(sections.body.sections).toEqual([]);
    expect(tasks.body.tasks).toEqual([]);
    expect(tasks.body.tree).toEqual([]);
  });

  it("duplicates project descriptions independently and remaps sections and task hierarchy", async () => {
    const agent = await createTestAgent();
    const source = (await agent.post("/projects").send({ title: "Source" }).expect(201)).body.project;
    await agent.patch(`/projects/${source.id}`).send({ description: "Original notes" }).expect(200);
    const section = (await agent.post("/sections").send({ title: "Milestone", projectId: source.id }).expect(201)).body.section;
    const parent = (await agent.post("/tasks").send({ title: "Parent", projectId: source.id, sectionId: section.id }).expect(201)).body.task;
    await agent.post("/tasks").send({ title: "Child", projectId: source.id, sectionId: section.id, parentId: parent.id }).expect(201);

    const copy = (await agent.post(`/projects/${source.id}/duplicate`).expect(201)).body.project;
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ description: "Original notes", archived: false });
    const projectsAfterCopy = await agent.get("/projects").expect(200);
    expect(projectsAfterCopy.body.projects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: source.id, description: "Original notes" }),
      expect.objectContaining({ id: copy.id, description: "Original notes" })
    ]));

    await agent.patch(`/projects/${copy.id}`).send({ description: "Copy notes only" }).expect(200);
    const projectsAfterEdit = await agent.get("/projects").expect(200);
    expect(projectsAfterEdit.body.projects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: source.id, description: "Original notes" }),
      expect.objectContaining({ id: copy.id, description: "Copy notes only" })
    ]));

    const sections = await agent.get("/sections").expect(200);
    const copiedSection = sections.body.sections.find((item: { projectId: string }) => item.projectId === copy.id);
    expect(copiedSection).toMatchObject({ title: "Milestone" });
    expect(copiedSection.id).not.toBe(section.id);
    const tasks = await agent.get("/tasks").expect(200);
    const copiedParent = tasks.body.tasks.find((item: { projectId: string; parentId: string | null }) => item.projectId === copy.id && item.parentId === null);
    const copiedChild = tasks.body.tasks.find((item: { projectId: string; parentId: string | null }) => item.projectId === copy.id && item.parentId !== null);
    expect(copiedParent).toMatchObject({ title: "Parent", sectionId: copiedSection.id });
    expect(copiedChild).toMatchObject({ title: "Child", sectionId: copiedSection.id, parentId: copiedParent.id });
    expect(copiedParent.id).not.toBe(parent.id);
  });

  it("returns 404 for unknown projects", async () => {
    const agent = await createTestAgent();

    await agent.patch("/projects/missing").send({ title: "Nope" }).expect(404);
    await agent.delete("/projects/missing").expect(404);
  });

  it("disables project archiving by default in features and the API", async () => {
    const agent = await createTestAgent();
    const project = (await agent.post("/projects").send({ title: "Plan" }).expect(201)).body.project as { id: string };
    await agent.get("/features").expect(200).expect(({ body }) => expect(body.projectArchivingEnabled).toBe(false));
    await agent.patch(`/projects/${project.id}/archive`).send({ archived: true }).expect(503);
  });

  it("persists task details and supports archiving and duplicating projects", async () => {
    const agent = await createTestAgent({ projectArchivingEnabled: true });
    const project = (await agent.post("/projects").send({ title: "Plan" }).expect(201)).body.project as { id: string };
    const task = (await agent.post("/tasks").send({ title: "Draft", projectId: project.id }).expect(201)).body.task as { id: string };
    await agent.patch(`/tasks/${task.id}`).send({ description: "Details", dueDate: "2026-11-01", labels: ["work"], comments: [{ id: "c1", body: "First comment", createdAt: new Date().toISOString() }] }).expect(200);
    await agent.patch(`/projects/${project.id}/archive`).send({ archived: true }).expect(200);
    const duplicate = await agent.post(`/projects/${project.id}/duplicate`).expect(201);
    const projects = await agent.get("/projects").expect(200);
    const tasks = await agent.get("/tasks").expect(200);
    expect(projects.body.projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id, archived: true }), expect.objectContaining({ id: duplicate.body.project.id, title: "Plan copy" })]));
    expect(tasks.body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ description: "Details", dueDate: "2026-11-01", labels: ["work"], comments: [expect.objectContaining({ body: "First comment" })] })]));
  });

  it("reorders tasks with beforeId and afterId", async () => {
    const agent = await createTestAgent();
    const create = async (title: string) => (await agent.post("/tasks").send({ title }).expect(201)).body.task as { id: string };

    const first = await create("First");
    const second = await create("Second");
    const third = await create("Third");

    await agent
      .put(`/tasks/${third.id}/move`)
      .send({ parentId: null, projectId: null, sectionId: null, beforeId: first.id, afterId: null })
      .expect(200);

    const reordered = await agent.get("/tasks").expect(200);

    expect(reordered.body.tree.map((task: { id: string }) => task.id)).toEqual([third.id, first.id, second.id]);

    await agent
      .put(`/tasks/${third.id}/move`)
      .send({ parentId: null, projectId: null, sectionId: null, beforeId: null, afterId: second.id })
      .expect(200);

    const finalOrder = await agent.get("/tasks").expect(200);

    expect(finalOrder.body.tree.map((task: { id: string }) => task.id)).toEqual([first.id, second.id, third.id]);
  });
});

describe("PATCH /projects/:id/order", () => {
  it("persists the requested project order", async () => {
    const agent = await createTestAgent();
    const created = await Promise.all(["First", "Second", "Third"].map((title) => agent.post("/projects").send({ title }).expect(201)));
    const [first, second, third] = created.map((response) => response.body.project);

    await agent.patch(`/projects/${third.id}/order`).send({ beforeId: first.id, afterId: null }).expect(200);
    const listed = await agent.get("/projects").expect(200);

    expect(listed.body.projects.map((project: { id: string }) => project.id)).toEqual([third.id, first.id, second.id]);
  });
});

describe("project hierarchy", () => {
  it("creates subprojects, moves projects across levels, and rejects cycles", async () => {
    const agent = await createTestAgent();
    const root = (await agent.post("/projects").send({ title: "Root" }).expect(201)).body.project;
    const child = (await agent.post("/projects").send({ title: "Child", parentId: root.id }).expect(201)).body.project;
    const secondChild = (await agent.post("/projects").send({ title: "Second child", parentId: root.id }).expect(201)).body.project;
    const grandchild = (await agent.post("/projects").send({ title: "Grandchild", parentId: child.id }).expect(201)).body.project;
    expect(child.parentId).toBe(root.id);
    await agent.patch(`/projects/${secondChild.id}/order`).send({ beforeId: child.id, afterId: null }).expect(200);
    const orderedChildren = (await agent.get("/projects").expect(200)).body.projects.filter((project: { parentId: string | null }) => project.parentId === root.id).sort((left: { lexicalOrder: string }, right: { lexicalOrder: string }) => left.lexicalOrder.localeCompare(right.lexicalOrder));
    expect(orderedChildren.map((project: { id: string }) => project.id)).toEqual([secondChild.id, child.id]);
    await agent.patch(`/projects/${grandchild.id}/parent`).send({ parentId: null }).expect(200);
    await agent.patch(`/projects/${root.id}/parent`).send({ parentId: child.id }).expect(404);
    await agent.delete(`/projects/${root.id}`).expect(200);
    const listed = await agent.get("/projects").expect(200);
    expect(listed.body.projects.find((project: { id: string }) => project.id === grandchild.id).parentId).toBeNull();
    expect(listed.body.projects.find((project: { id: string }) => project.id === child.id).parentId).toBeNull();
  });
});

describe("PATCH /sections/:id/order", () => {
  it("persists the requested section order within its scope", async () => {
    const agent = await createTestAgent();
    const created = await Promise.all(["First", "Second", "Third"].map((title) => agent.post("/sections").send({ title }).expect(201)));
    const [first, second, third] = created.map((response) => response.body.section);
    await agent.patch(`/sections/${third.id}/order`).send({ beforeId: first.id, afterId: null }).expect(200);
    const listed = await agent.get("/sections").expect(200);
    expect(listed.body.sections.map((section: { id: string }) => section.id)).toEqual([third.id, first.id, second.id]);
  });
});

describe("settings and session authentication", () => {
  it("blocks API access until the administrator configures a password", async () => {
    const server = await createTestServer(createApp());
    const agent = request(server);

    await agent.get("/auth/status").expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ accessMode: "password", authenticated: false });
    });
    await agent.get("/tasks").expect(503).expect(({ body }) => {
      expect(body.error).toMatch(/password must be configured/i);
    });
    await agent.post("/tasks").send({ title: "Anonymous task" }).expect(503);
  });

  it("defaults to delete confirmations and allows updating that preference", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent.get("/settings").expect(200).expect(({ body }) => {
      expect(body.settings).toEqual({ confirmDelete: true, accessMode: "password", username: "admin" });
    });
    await agent.put("/settings").send({ confirmDelete: false }).expect(200);
    await agent.get("/settings").expect(200).expect(({ body }) => expect(body.settings.confirmDelete).toBe(false));
  });

  it("persists the Inbox description", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent.get("/inbox/description").expect(200).expect(({ body }) => expect(body.description).toBe(""));
    await agent.put("/inbox/description").send({ description: "Inbox notes" }).expect(200);
    await agent.get("/inbox/description").expect(200).expect(({ body }) => expect(body.description).toBe("Inbox notes"));
  });

  it("protects app routes with a user-specific HttpOnly session cookie", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.get("/tasks").expect(401);
    await agent.post("/auth/login").send({ username: "admin", password: "wrong-password" }).expect(401);

    const login = await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(login.headers["set-cookie"][0]).toMatch(/SameSite=Lax/i);
    await agent.get("/tasks").expect(200);
    await agent.get("/settings").expect(200);
    await agent.post("/auth/logout").expect(200);
    await agent.get("/tasks").expect(401);
  });

  it("allows users to update their own username and password with unique usernames", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" }),
      Object.freeze({ id: "other-user", username: "other", passwordHash, isAdmin: false, confirmDelete: true, inboxDescription: "" })
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.patch("/auth/account").send({ username: "anonymous" }).expect(401);
    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent.patch("/auth/account").send({ username: "OTHER" }).expect(409);
    await agent.get("/settings").expect(200).expect(({ body }) => expect(body.settings.username).toBe("admin"));
    await agent.patch("/auth/account").send({ username: "NewAdmin" }).expect(200).expect(({ body }) => {
      expect(body.user).toMatchObject({ id: "legacy-admin", username: "newadmin", isAdmin: true });
    });

    await agent.patch("/auth/account").send({ password: "" }).expect(400);
    await agent.patch("/auth/account").send({ password: "x" }).expect(200);
    await agent.get("/tasks").expect(401);

    const updatedLogin = request.agent(server);
    await updatedLogin.post("/auth/login").send({ username: "newadmin", password: "x" }).expect(200);
    await updatedLogin.patch("/auth/account").send({}).expect(400);
    await updatedLogin.get("/settings").expect(200).expect(({ body }) => expect(body.settings.username).toBe("newadmin"));
  });

  it("allows only administrators to manage accounts and preserves an administrator", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);
    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    const created = await agent.post("/users").send({ username: "sam", password: "another-long-test-pass", isAdmin: false }).expect(201);
    const userId = created.body.user.id as string;
    await agent.patch(`/users/${userId}`).send({ isAdmin: true }).expect(200);
    await agent.patch(`/users/${userId}`).send({ isAdmin: false }).expect(200);
    await agent.delete(`/users/${userId}`).expect(200);
    await agent.delete("/users/legacy-admin").expect(409);
  });

  it("accepts any non-empty password when creating users, updating passwords, and logging in", async () => {
    const passwordHash = await hashPassword("administrator-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const admin = request.agent(server);
    await admin.post("/auth/login").send({ username: "admin", password: "administrator-password" }).expect(200);

    await admin.post("/users").send({ username: "empty", password: "" }).expect(400);
    const created = await admin.post("/users").send({ username: "sam", password: "x" }).expect(201);
    const sam = request.agent(server);
    await sam.post("/auth/login").send({ username: "sam", password: "x" }).expect(200);
    await admin.patch(`/users/${created.body.user.id}`).send({ password: "" }).expect(400);
    await sam.get("/tasks").expect(200);
    await admin.patch(`/users/${created.body.user.id}`).send({ password: "y" }).expect(200);
    await sam.get("/tasks").expect(401);

    const updatedPasswordLogin = request.agent(server);
    await updatedPasswordLogin.post("/auth/login").send({ username: "sam", password: "y" }).expect(200);
    await updatedPasswordLogin.get("/tasks").expect(200);
  });

  it("keeps task data isolated by user", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([Object.freeze({ id: "legacy-admin", username: "admin", passwordHash, isAdmin: true, confirmDelete: true, inboxDescription: "" })]);
    let repositories = Object.freeze({} as Readonly<Record<string, ReturnType<typeof createMemoryTaskRepository>>>);
    const repositoryFor = (userId: string) => {
      const existing = repositories[userId];
      if (existing !== undefined) return existing;
      const created = createMemoryTaskRepository();
      repositories = Object.freeze({ ...repositories, [userId]: created });
      return created;
    };
    const server = await createTestServer(createApp(repositoryFor, { userRepository }));
    const admin = request.agent(server);
    await admin.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    const createdUser = await admin.post("/users").send({ username: "sam", password: "another-long-test-pass" }).expect(201);
    const sam = request.agent(server);
    await sam.post("/auth/login").send({ username: "sam", password: "another-long-test-pass" }).expect(200);

    await admin.post("/tasks").send({ title: "Admin task" }).expect(201);
    await sam.post("/tasks").send({ title: "Sam task" }).expect(201);
    await admin.get("/tasks").expect(200).expect(({ body }) => expect(body.tasks.map((task: { title: string }) => task.title)).toEqual(["Admin task"]));
    await sam.get("/tasks").expect(200).expect(({ body }) => expect(body.tasks.map((task: { title: string }) => task.title)).toEqual(["Sam task"]));
    await sam.get("/users").expect(403);
    expect(createdUser.body.user.isAdmin).toBe(false);
  });
});
