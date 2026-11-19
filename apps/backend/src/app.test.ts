import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestResources, createTestAgent } from "./appTestUtils";

afterEach(cleanupTestResources);

describe("POST /tasks", () => {
  /** Cover task creation, updates, moves, and cascading API operations. */
  /** Successful creation returns a new task with the accepted fields. */
  /** Task creation returns server-generated values and persists the task in the repository. */
  it("creates a task", async () => {
    const response = await (await createTestAgent()).post("/tasks").send({ title: "Ship MVP" }).expect(201);

    expect(response.body.task).toMatchObject({
      title: "Ship MVP",
      completed: false,
      parentId: null,
    });
    expect(response.body.task.id).toEqual(expect.any(String));
    expect(response.body.task.lexicalOrder).toEqual(expect.any(String));
  });

  /** PATCH updates a task, and DELETE removes it from the repository. */
  /** Task updates persist, and deletion removes the task from the list. */
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

  /** Cover project and section creation and moving tasks between lists. */
  /** Projects and sections can be created, and tasks can move between the Inbox and a project. */
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
        afterId: null,
      })
      .expect(200);

    const projectTasks = await agent.get("/tasks").expect(200);

    expect(projectTasks.body.tasks[0]).toMatchObject({
      title: "Sort inbox",
      projectId: projectResponse.body.project.id,
      sectionId: null,
    });

    await agent
      .put(`/tasks/${taskResponse.body.task.id}/move`)
      .send({
        parentId: null,
        projectId: null,
        sectionId: sectionResponse.body.section.id,
        beforeId: null,
        afterId: null,
      })
      .expect(200);

    const sectionTasks = await agent.get("/tasks").expect(200);

    expect(sectionTasks.body.tasks[0]).toMatchObject({
      projectId: null,
      sectionId: sectionResponse.body.section.id,
    });
  });

  /** A task must not reference a section from another project. */
  /** The API rejects a section that belongs to a different project. */
  it("rejects assigning a task to a section from a different project", async () => {
    const agent = await createTestAgent();
    const projectA = (await agent.post("/projects").send({ title: "A" }).expect(201)).body.project;
    const projectB = (await agent.post("/projects").send({ title: "B" }).expect(201)).body.project;
    const section = (
      await agent.post("/sections").send({ title: "Section", projectId: projectA.id }).expect(201)
    ).body.section;
    await agent
      .post("/tasks")
      .send({ title: "Mismatch", projectId: projectB.id, sectionId: section.id })
      .expect(400);

    const task = (
      await agent
        .post("/tasks")
        .send({ title: "Task", projectId: projectA.id, sectionId: section.id })
        .expect(201)
    ).body.task;
    await agent
      .put(`/tasks/${task.id}/move`)
      .send({ parentId: null, projectId: projectB.id, sectionId: section.id, beforeId: null, afterId: null })
      .expect(400);
  });

  /** Moving a task under itself or a descendant must not create a cycle. */
  /** Move validation rejects cyclic task hierarchies. */
  it("rejects moving a task into itself or one of its descendants", async () => {
    const agent = await createTestAgent();
    const parent = (await agent.post("/tasks").send({ title: "Parent" }).expect(201)).body.task;
    const child = (await agent.post("/tasks").send({ title: "Child", parentId: parent.id }).expect(201)).body
      .task;
    const payload = { parentId: child.id, projectId: null, sectionId: null, beforeId: null, afterId: null };

    await agent.put(`/tasks/${parent.id}/move`).send(payload).expect(404);
    await agent
      .put(`/tasks/${parent.id}/move`)
      .send({ ...payload, parentId: parent.id })
      .expect(404);
    const listed = await agent.get("/tasks").expect(200);
    expect(listed.body.tasks[0]).toMatchObject({ id: parent.id, parentId: null });
    expect(listed.body.tree[0].children[0]).toMatchObject({ id: child.id, parentId: parent.id });
  });

  /** Deleting a section returns its tasks to the root list without deleting them. */
  /** Section deletion preserves the tasks and unlinks them from the section. */
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
      parentId: null,
    });
  });

  /** Deleting a project clears its sections and tasks according to the cascade policy. */
  /** Project deletion cascades to its sections and tasks. */
  it("updates and deletes projects, cascading to their sections and tasks", async () => {
    const agent = await createTestAgent();
    const projectResponse = await agent.post("/projects").send({ title: "Roadmap" }).expect(201);
    const projectId = projectResponse.body.project.id;
    const sectionResponse = await agent.post("/sections").send({ title: "Later", projectId }).expect(201);
    const sectionTaskResponse = await agent
      .post("/tasks")
      .send({ title: "In section", projectId, sectionId: sectionResponse.body.section.id })
      .expect(201);
    await agent
      .post("/tasks")
      .send({
        title: "Subtask",
        parentId: sectionTaskResponse.body.task.id,
        projectId,
        sectionId: sectionResponse.body.section.id,
      })
      .expect(201);

    await agent
      .patch(`/projects/${projectId}`)
      .send({ title: "Roadmap 2", description: "Project notes" })
      .expect(200);

    const renamed = await agent.get("/projects").expect(200);

    expect(renamed.body.projects[0]).toMatchObject({
      id: projectId,
      title: "Roadmap 2",
      description: "Project notes",
    });

    await agent.delete(`/projects/${projectId}`).expect(200);

    const projects = await agent.get("/projects").expect(200);
    const sections = await agent.get("/sections").expect(200);
    const tasks = await agent.get("/tasks").expect(200);

    expect(projects.body.projects).toEqual([]);
    expect(sections.body.sections).toEqual([]);
    expect(tasks.body.tasks).toEqual([]);
    expect(tasks.body.tree).toEqual([]);
  });

  /** A project copy gets an independent description and remapped internal IDs. */
  /** The duplicate has its own description and new section and task tree relationships. */
  it("duplicates project descriptions independently and remaps sections and task hierarchy", async () => {
    const agent = await createTestAgent();
    const source = (await agent.post("/projects").send({ title: "Source" }).expect(201)).body.project;
    await agent.patch(`/projects/${source.id}`).send({ description: "Original notes" }).expect(200);
    const section = (
      await agent.post("/sections").send({ title: "Milestone", projectId: source.id }).expect(201)
    ).body.section;
    const parent = (
      await agent
        .post("/tasks")
        .send({ title: "Parent", projectId: source.id, sectionId: section.id })
        .expect(201)
    ).body.task;
    await agent
      .post("/tasks")
      .send({ title: "Child", projectId: source.id, sectionId: section.id, parentId: parent.id })
      .expect(201);

    const copy = (await agent.post(`/projects/${source.id}/duplicate`).expect(201)).body.project;
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ description: "Original notes", archived: false });
    const projectsAfterCopy = await agent.get("/projects").expect(200);
    expect(projectsAfterCopy.body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: source.id, description: "Original notes" }),
        expect.objectContaining({ id: copy.id, description: "Original notes" }),
      ]),
    );

    await agent.patch(`/projects/${copy.id}`).send({ description: "Copy notes only" }).expect(200);
    const projectsAfterEdit = await agent.get("/projects").expect(200);
    expect(projectsAfterEdit.body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: source.id, description: "Original notes" }),
        expect.objectContaining({ id: copy.id, description: "Copy notes only" }),
      ]),
    );

    const sections = await agent.get("/sections").expect(200);
    const copiedSection = sections.body.sections.find(
      (item: { projectId: string }) => item.projectId === copy.id,
    );
    expect(copiedSection).toMatchObject({ title: "Milestone" });
    expect(copiedSection.id).not.toBe(section.id);
    const tasks = await agent.get("/tasks").expect(200);
    const copiedParent = tasks.body.tasks.find(
      (item: { projectId: string; parentId: string | null }) =>
        item.projectId === copy.id && item.parentId === null,
    );
    const copiedChild = tasks.body.tasks.find(
      (item: { projectId: string; parentId: string | null }) =>
        item.projectId === copy.id && item.parentId !== null,
    );
    expect(copiedParent).toMatchObject({ title: "Parent", sectionId: copiedSection.id });
    expect(copiedChild).toMatchObject({
      title: "Child",
      sectionId: copiedSection.id,
      parentId: copiedParent.id,
    });
    expect(copiedParent.id).not.toBe(parent.id);
  });

  /** A missing project should return status 404. */
  /** An unknown project returns HTTP 404. */
  it("returns 404 for unknown projects", async () => {
    const agent = await createTestAgent();

    await agent.patch("/projects/missing").send({ title: "Nope" }).expect(404);
    await agent.delete("/projects/missing").expect(404);
  });

  /** Archiving remains disabled until its feature flag is enabled. */
  /** Archiving is disabled by default in both capabilities and API routes. */
  it("disables project archiving by default in features and the API", async () => {
    const agent = await createTestAgent();
    const project = (await agent.post("/projects").send({ title: "Plan" }).expect(201)).body.project as {
      id: string;
    };
    await agent
      .get("/features")
      .expect(200)
      .expect(({ body }) => expect(body.projectArchivingEnabled).toBe(false));
    await agent.patch(`/projects/${project.id}/archive`).send({ archived: true }).expect(503);
  });

  /** Cover saving task details, archiving, and duplicating projects. */
  /** The API saves task details and supports project archiving and duplication. */
  it("persists task details and supports archiving and duplicating projects", async () => {
    const agent = await createTestAgent({ projectArchivingEnabled: true });
    const project = (await agent.post("/projects").send({ title: "Plan" }).expect(201)).body.project as {
      id: string;
    };
    const task = (await agent.post("/tasks").send({ title: "Draft", projectId: project.id }).expect(201)).body
      .task as { id: string };
    await agent
      .patch(`/tasks/${task.id}`)
      .send({
        description: "Details",
        dueDate: "2026-11-01",
        labels: ["work"],
        comments: [{ id: "c1", body: "First comment", createdAt: new Date().toISOString() }],
      })
      .expect(200);
    await agent.patch(`/projects/${project.id}/archive`).send({ archived: true }).expect(200);
    const duplicate = await agent.post(`/projects/${project.id}/duplicate`).expect(201);
    const projects = await agent.get("/projects").expect(200);
    const tasks = await agent.get("/tasks").expect(200);
    expect(projects.body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: project.id, archived: true }),
        expect.objectContaining({ id: duplicate.body.project.id, title: "Plan copy" }),
      ]),
    );
    expect(tasks.body.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Details",
          dueDate: "2026-11-01",
          labels: ["work"],
          comments: [expect.objectContaining({ body: "First comment" })],
        }),
      ]),
    );
  });

  /** The server assigns IDs and timestamps to new comments while preserving existing IDs. */
  /** New comments receive server-generated IDs and timestamps; existing IDs remain unchanged. */
  it("assigns comment IDs and creation times on the server while preserving existing IDs", async () => {
    const agent = await createTestAgent();
    const task = (await agent.post("/tasks").send({ title: "Comment IDs" }).expect(201)).body.task;
    const created = await agent
      .patch(`/tasks/${task.id}`)
      .send({ comments: [{ id: "client-generated-id", body: "First" }] })
      .expect(200);
    const firstComment = created.body.task.comments[0];
    expect(firstComment.id).not.toBe("client-generated-id");
    expect(firstComment.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(firstComment.createdAt).toEqual(expect.any(String));

    const edited = await agent
      .patch(`/tasks/${task.id}`)
      .send({ comments: [{ id: firstComment.id, body: "Edited", createdAt: "2000-01-01T00:00:00.000Z" }] })
      .expect(200);
    expect(edited.body.task.comments[0]).toMatchObject({
      id: firstComment.id,
      body: "Edited",
      createdAt: firstComment.createdAt,
    });
  });

  /** Neighbor order in the request determines the new task order. */
  /** Neighbor IDs define and persist the new task order. */
  it("reorders tasks with beforeId and afterId", async () => {
    const agent = await createTestAgent();
    const create = async (title: string) =>
      (await agent.post("/tasks").send({ title }).expect(201)).body.task as { id: string };

    const first = await create("First");
    const second = await create("Second");
    const third = await create("Third");

    await agent
      .put(`/tasks/${third.id}/move`)
      .send({ parentId: null, projectId: null, sectionId: null, beforeId: first.id, afterId: null })
      .expect(200);

    const reordered = await agent.get("/tasks").expect(200);

    expect(reordered.body.tree.map((task: { id: string }) => task.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);

    await agent
      .put(`/tasks/${third.id}/move`)
      .send({ parentId: null, projectId: null, sectionId: null, beforeId: null, afterId: second.id })
      .expect(200);

    const finalOrder = await agent.get("/tasks").expect(200);

    expect(finalOrder.body.tree.map((task: { id: string }) => task.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });
});

describe("PATCH /projects/:id/order", () => {
  /** The requested project position must persist when read back through the API. */
  /** Project order after reordering persists across reloads. */
  it("persists the requested project order", async () => {
    const agent = await createTestAgent();
    const created = await Promise.all(
      ["First", "Second", "Third"].map((title) => agent.post("/projects").send({ title }).expect(201)),
    );
    const [first, second, third] = created.map((response) => response.body.project);

    await agent.patch(`/projects/${third.id}/order`).send({ beforeId: first.id, afterId: null }).expect(200);
    const listed = await agent.get("/projects").expect(200);

    expect(listed.body.projects.map((project: { id: string }) => project.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });
});

describe("project hierarchy", () => {
  /** Cover subproject creation, moving between levels, and cycle prevention. */
  /** Project nesting and moves work, while cycles in the project tree are rejected. */
  it("creates subprojects, moves projects across levels, and rejects cycles", async () => {
    const agent = await createTestAgent();
    const root = (await agent.post("/projects").send({ title: "Root" }).expect(201)).body.project;
    const child = (await agent.post("/projects").send({ title: "Child", parentId: root.id }).expect(201)).body
      .project;
    const secondChild = (
      await agent.post("/projects").send({ title: "Second child", parentId: root.id }).expect(201)
    ).body.project;
    const grandchild = (
      await agent.post("/projects").send({ title: "Grandchild", parentId: child.id }).expect(201)
    ).body.project;
    expect(child.parentId).toBe(root.id);
    await agent
      .patch(`/projects/${secondChild.id}/order`)
      .send({ beforeId: child.id, afterId: null })
      .expect(200);
    const orderedChildren = (await agent.get("/projects").expect(200)).body.projects
      .filter((project: { parentId: string | null }) => project.parentId === root.id)
      .sort((left: { lexicalOrder: string }, right: { lexicalOrder: string }) =>
        left.lexicalOrder.localeCompare(right.lexicalOrder),
      );
    expect(orderedChildren.map((project: { id: string }) => project.id)).toEqual([secondChild.id, child.id]);
    await agent.patch(`/projects/${grandchild.id}/parent`).send({ parentId: null }).expect(200);
    await agent.patch(`/projects/${root.id}/parent`).send({ parentId: child.id }).expect(404);
    await agent.delete(`/projects/${root.id}`).expect(200);
    const listed = await agent.get("/projects").expect(200);
    expect(
      listed.body.projects.find((project: { id: string }) => project.id === grandchild.id).parentId,
    ).toBeNull();
    expect(
      listed.body.projects.find((project: { id: string }) => project.id === child.id).parentId,
    ).toBeNull();
  });
});

describe("PATCH /sections/:id/order", () => {
  /** Section reordering is scoped to its project and persists when read back. */
  /** Section order persists within the selected project or the Inbox. */
  it("persists the requested section order within its scope", async () => {
    const agent = await createTestAgent();
    const created = await Promise.all(
      ["First", "Second", "Third"].map((title) => agent.post("/sections").send({ title }).expect(201)),
    );
    const [first, second, third] = created.map((response) => response.body.section);
    await agent.patch(`/sections/${third.id}/order`).send({ beforeId: first.id, afterId: null }).expect(200);
    const listed = await agent.get("/sections").expect(200);
    expect(listed.body.sections.map((section: { id: string }) => section.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });
});
