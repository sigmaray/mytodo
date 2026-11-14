import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { cleanupTestResources, createTestAgent, createTestServer } from "./appTestUtils";
import { hashPassword } from "./auth";
import { createMemoryTaskRepository } from "./repository";
import { createMemoryUserRepository } from "./users";

afterEach(cleanupTestResources);

describe("settings and session authentication", () => {
  // Защищённый флаг cookie включён в production-среде, но может быть отключён локально.
  // Cookie сессии использует флаг Secure в production-среде и позволяет отключить его для локального HTTP.
  it("keeps production session cookies secure unless explicitly disabled for local HTTP", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "production-admin",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const secureServer = await createTestServer(
      createApp(createMemoryTaskRepository(), { mode: "production", userRepository }),
    );
    const secureLogin = await request(secureServer)
      .post("/auth/login")
      .send({ username: "admin", password: "a-long-test-password" })
      .expect(200);
    expect(secureLogin.headers["set-cookie"][0]).toMatch(/; Secure/i);

    const httpServer = await createTestServer(
      createApp(createMemoryTaskRepository(), {
        mode: "production",
        secureCookies: false,
        userRepository,
      }),
    );
    const httpLogin = await request(httpServer)
      .post("/auth/login")
      .send({ username: "admin", password: "a-long-test-password" })
      .expect(200);
    expect(httpLogin.headers["set-cookie"][0]).not.toMatch(/; Secure/i);
  });

  // Тестовый reset API закрыт вне явно разрешённой non-production конфигурации.
  // Тестовый API сброса доступен только при явном разрешении вне production.
  it("keeps the Playwright reset API unavailable unless explicitly enabled outside production", async () => {
    const agent = await createTestAgent();
    await agent.post("/api/playwright/reset").expect(404);
    expect(() =>
      createApp(createMemoryTaskRepository(), {
        databaseUrl: "postgres://unused",
        mode: "production",
        playwrightApiEnabled: true,
      }),
    ).toThrow(/cannot be enabled in production/i);
    expect(() => createApp(createMemoryTaskRepository(), { playwrightApiEnabled: true })).toThrow(
      /requires a database url/i,
    );
  });

  // API ожидает, что пароль администратора будет настроен до обычной работы.
  // Приложение закрывает защищённые маршруты, пока администратор не задаст пароль.
  it("blocks API access until the administrator configures a password", async () => {
    const server = await createTestServer(createApp());
    const agent = request(server);

    await agent
      .get("/auth/status")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ accessMode: "password", authenticated: false });
      });
    await agent
      .get("/tasks")
      .expect(503)
      .expect(({ body }) => {
        expect(body.error).toMatch(/password must be configured/i);
      });
    await agent.post("/tasks").send({ title: "Anonymous task" }).expect(503);
  });

  // Проверяем значение настройки по умолчанию и её сохранение через API.
  // Подтверждение удаления включено по умолчанию и сохраняется в настройках пользователя.
  it("defaults to delete confirmations and allows updating that preference", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent
      .get("/settings")
      .expect(200)
      .expect(({ body }) => {
        expect(body.settings).toEqual({ confirmDelete: true, accessMode: "password", username: "admin" });
      });
    await agent.put("/settings").send({ confirmDelete: false }).expect(200);
    await agent
      .get("/settings")
      .expect(200)
      .expect(({ body }) => expect(body.settings.confirmDelete).toBe(false));
  });

  // Описание Входящих сохраняется отдельно для текущего пользователя.
  // Описание Входящих сохраняется между запросами.
  it("persists the Inbox description", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent
      .get("/inbox/description")
      .expect(200)
      .expect(({ body }) => expect(body.description).toBe(""));
    await agent.put("/inbox/description").send({ description: "Inbox notes" }).expect(200);
    await agent
      .get("/inbox/description")
      .expect(200)
      .expect(({ body }) => expect(body.description).toBe("Inbox notes"));
  });

  // Приватные маршруты доступны по HttpOnly cookie конкретного пользователя.
  // HttpOnly cookie даёт доступ только к данным владельца текущей сессии.
  it("protects app routes with a user-specific HttpOnly session cookie", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.get("/tasks").expect(401);
    await agent.post("/auth/login").send({ username: "admin", password: "wrong-password" }).expect(401);

    const login = await agent
      .post("/auth/login")
      .send({ username: "admin", password: "a-long-test-password" })
      .expect(200);
    expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(login.headers["set-cookie"][0]).toMatch(/SameSite=Lax/i);
    await agent.get("/tasks").expect(200);
    await agent.get("/settings").expect(200);
    await agent.post("/auth/logout").expect(200);
    await agent.get("/tasks").expect(401);
  });

  // Пользователь может изменить свои данные, но имя входа остаётся уникальным.
  // Пользователь может изменить собственное имя и пароль при соблюдении уникальности.
  it("allows users to update their own username and password with unique usernames", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
      {
        id: "other-user",
        username: "other",
        passwordHash,
        isAdmin: false,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);

    await agent.patch("/auth/account").send({ username: "anonymous" }).expect(401);
    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    await agent.patch("/auth/account").send({ username: "OTHER" }).expect(409);
    await agent
      .get("/settings")
      .expect(200)
      .expect(({ body }) => expect(body.settings.username).toBe("admin"));
    await agent
      .patch("/auth/account")
      .send({ username: "NewAdmin" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.user).toMatchObject({
          id: "00000000-0000-4000-8000-000000000001",
          username: "newadmin",
          isAdmin: true,
        });
      });

    await agent.patch("/auth/account").send({ password: "" }).expect(400);
    await agent.patch("/auth/account").send({ password: "x" }).expect(200);
    await agent.get("/tasks").expect(401);

    const updatedLogin = request.agent(server);
    await updatedLogin.post("/auth/login").send({ username: "newadmin", password: "x" }).expect(200);
    await updatedLogin.patch("/auth/account").send({}).expect(400);
    await updatedLogin
      .get("/settings")
      .expect(200)
      .expect(({ body }) => expect(body.settings.username).toBe("newadmin"));
  });

  // Управление аккаунтами разрешено администраторам, и последний администратор защищён от удаления.
  // Управление аккаунтами доступно администраторам и не позволяет удалить последнего.
  it("allows only administrators to manage accounts and preserves an administrator", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const agent = request.agent(server);
    await agent.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    const created = await agent
      .post("/users")
      .send({ username: "sam", password: "another-long-test-pass", isAdmin: false })
      .expect(201);
    const userId = created.body.user.id as string;
    await agent.patch(`/users/${userId}`).send({ isAdmin: true }).expect(200);
    await agent.patch(`/users/${userId}`).send({ isAdmin: false }).expect(200);
    await agent.delete(`/users/${userId}`).expect(200);
    await agent.delete("/users/00000000-0000-4000-8000-000000000001").expect(409);
  });

  // Проверяем приём непустого пароля во всех операциях с аккаунтом и при входе.
  // Создание пользователя, смена пароля и вход принимают любой непустой пароль.
  it("accepts any non-empty password when creating users, updating passwords, and logging in", async () => {
    const passwordHash = await hashPassword("administrator-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    const server = await createTestServer(createApp(createMemoryTaskRepository(), { userRepository }));
    const admin = request.agent(server);
    await admin
      .post("/auth/login")
      .send({ username: "admin", password: "administrator-password" })
      .expect(200);

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

  // Задачи одного аккаунта не должны быть видны другому.
  // Запросы одного пользователя не раскрывают и не изменяют задачи другого.
  it("keeps task data isolated by user", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    const userRepository = createMemoryUserRepository([
      {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        passwordHash,
        isAdmin: true,
        confirmDelete: true,
        inboxDescription: "",
      },
    ]);
    let repositories = {} as Record<string, ReturnType<typeof createMemoryTaskRepository>>;
    const repositoryFor = (userId: string) => {
      const existing = repositories[userId];
      if (existing !== undefined) return existing;
      const created = createMemoryTaskRepository();
      repositories = { ...repositories, [userId]: created };
      return created;
    };
    const server = await createTestServer(createApp(repositoryFor, { userRepository }));
    const admin = request.agent(server);
    await admin.post("/auth/login").send({ username: "admin", password: "a-long-test-password" }).expect(200);
    const createdUser = await admin
      .post("/users")
      .send({ username: "sam", password: "another-long-test-pass" })
      .expect(201);
    const sam = request.agent(server);
    await sam.post("/auth/login").send({ username: "sam", password: "another-long-test-pass" }).expect(200);

    await admin.post("/tasks").send({ title: "Admin task" }).expect(201);
    await sam.post("/tasks").send({ title: "Sam task" }).expect(201);
    await admin
      .get("/tasks")
      .expect(200)
      .expect(({ body }) =>
        expect(body.tasks.map((task: { title: string }) => task.title)).toEqual(["Admin task"]),
      );
    await sam
      .get("/tasks")
      .expect(200)
      .expect(({ body }) =>
        expect(body.tasks.map((task: { title: string }) => task.title)).toEqual(["Sam task"]),
      );
    await sam.get("/users").expect(403);
    expect(createdUser.body.user.isAdmin).toBe(false);
  });
});
