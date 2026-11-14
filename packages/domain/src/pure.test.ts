import { describe, expect, it } from "vitest";
import {
  buildTaskTree,
  computeDropPlacement,
  computeIndentPlacement,
  computeOutdentPlacement,
  generateLexicalOrder,
  renderAdvancedMarkdownDocument,
  renderTaskMarkdownDocument,
} from "./pure";
import type { Task } from "./types";

/** Создаёт задачу для тестов, подставляя значения по умолчанию для необязательных полей. */
const task = (values: Partial<Task> & Pick<Task, "id" | "title" | "lexicalOrder">): Task => ({
  description: "",
  dueDate: null,
  labels: [],
  comments: [],
  completed: false,
  parentId: null,
  projectId: null,
  sectionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...values,
});

describe("buildTaskTree", () => {
  // Проверяем сортировку корневой задачи и её детей при сборке дерева.
  it("builds a sorted task tree", () => {
    const tree = buildTaskTree([
      task({ id: "child-b", title: "Child B", parentId: "root", lexicalOrder: "b" }),
      task({ id: "root", title: "Root", lexicalOrder: "a" }),
      task({ id: "child-a", title: "Child A", parentId: "root", lexicalOrder: "a" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(["child-a", "child-b"]);
  });
});

describe("generateLexicalOrder", () => {
  // Новый ключ должен строго находиться между двумя переданными ключами.
  it("creates sortable values between neighbors", () => {
    const middle = generateLexicalOrder("A", "C");

    expect(middle > "A").toBe(true);
    expect(middle < "C").toBe(true);
  });

  // Граничные случаи проверяют добавление в начало, конец и пустой список.
  it("creates values for empty ranges", () => {
    expect(generateLexicalOrder(null, null)).toBeTruthy();
    expect(generateLexicalOrder(null, "1") < "1").toBe(true);
    expect(generateLexicalOrder("z", null) > "z").toBe(true);
  });
});

describe("computeDropPlacement", () => {
  // Используем три соседние задачи, чтобы проверить размещение относительно цели.
  const siblings = [
    task({ id: "a", title: "A", lexicalOrder: "a" }),
    task({ id: "b", title: "B", lexicalOrder: "b" }),
    task({ id: "c", title: "C", lexicalOrder: "c" }),
  ];

  // Размещение должно указывать на правильную сторону целевой задачи.
  it("places the moved task before or after the target", () => {
    expect(computeDropPlacement(siblings, siblings[1] as Task, siblings[0] as Task, "before")).toEqual({
      parentId: null,
      projectId: null,
      sectionId: null,
      beforeId: "a",
      afterId: null,
    });
    expect(computeDropPlacement(siblings, siblings[0] as Task, siblings[2] as Task, "after")).toEqual({
      parentId: null,
      projectId: null,
      sectionId: null,
      beforeId: null,
      afterId: "c",
    });
  });

  // Если порядок уже правильный, повторное перемещение не должно создавать обновление.
  it("returns null for no-op drops next to the current position", () => {
    expect(computeDropPlacement(siblings, siblings[0] as Task, siblings[1] as Task, "before")).toBeNull();
    expect(computeDropPlacement(siblings, siblings[1] as Task, siblings[0] as Task, "after")).toBeNull();
    expect(computeDropPlacement(siblings, siblings[1] as Task, siblings[1] as Task, "before")).toBeNull();
  });

  // Перемещение предка внутрь собственного поддерева создало бы цикл в дереве.
  it("returns null when the target is a descendant of the moved task", () => {
    const tree = [
      task({ id: "root", title: "Root", lexicalOrder: "a" }),
      task({ id: "child", title: "Child", parentId: "root", lexicalOrder: "a" }),
    ];

    expect(computeDropPlacement(tree, tree[0] as Task, tree[1] as Task, "before")).toBeNull();
    expect(computeDropPlacement(tree, tree[0] as Task, tree[1] as Task, "after")).toBeNull();
  });
});

describe("computeIndentPlacement", () => {
  // Отступ превращает предыдущую задачу того же уровня в родителя.
  it("makes the task a child of the sibling above it", () => {
    const tasks = [
      task({ id: "a", title: "A", lexicalOrder: "a" }),
      task({ id: "b", title: "B", lexicalOrder: "b" }),
    ];

    expect(computeIndentPlacement(tasks, tasks[1] as Task)).toEqual({
      parentId: "a",
      projectId: null,
      sectionId: null,
      beforeId: null,
      afterId: null,
    });
  });

  // Первая задача списка не имеет предыдущего соседа для назначения родителем.
  it("returns null for the first sibling", () => {
    const tasks = [task({ id: "a", title: "A", lexicalOrder: "a" })];

    expect(computeIndentPlacement(tasks, tasks[0] as Task)).toBeNull();
  });
});

describe("computeOutdentPlacement", () => {
  // После снятия отступа задача должна стать соседом родителя сразу под ним.
  it("moves the task below its parent as a sibling", () => {
    const tasks = [
      task({ id: "parent", title: "Parent", lexicalOrder: "a" }),
      task({
        id: "child",
        title: "Child",
        parentId: "parent",
        projectId: null,
        sectionId: null,
        lexicalOrder: "a",
      }),
    ];

    expect(computeOutdentPlacement(tasks, tasks[1] as Task)).toEqual({
      parentId: null,
      projectId: null,
      sectionId: null,
      beforeId: null,
      afterId: "parent",
    });
  });

  // У корневой задачи нет родителя, поэтому снять отступ невозможно.
  it("returns null for root tasks", () => {
    const tasks = [task({ id: "a", title: "A", lexicalOrder: "a" })];

    expect(computeOutdentPlacement(tasks, tasks[0] as Task)).toBeNull();
  });
});

describe("renderTaskMarkdownDocument", () => {
  // Вложенность дерева представляется отступами, а завершение — отмеченным чекбоксом.
  it("renders nested tasks as a markdown checklist", () => {
    const tree = buildTaskTree([
      task({ id: "root", title: "Plan release", lexicalOrder: "a", completed: true }),
      task({ id: "child", title: "Write notes", parentId: "root", lexicalOrder: "a" }),
    ]);

    expect(renderTaskMarkdownDocument("Inbox", tree)).toBe(
      ["# Inbox", "", "- [x] Plan release", "  - [ ] Write notes", ""].join("\n"),
    );
  });

  // Экспорт проекта должен иметь один общий заголовок и отдельные заголовки секций.
  it("renders sections under one document title", () => {
    const root = buildTaskTree([task({ id: "root", title: "Root task", lexicalOrder: "a" })]);
    const section = buildTaskTree([task({ id: "section-task", title: "Section task", lexicalOrder: "a" })]);

    const markdown = renderTaskMarkdownDocument("Project", root, [{ title: "Planning", tasks: section }]);
    expect(markdown).toBe(
      ["# Project", "", "- [ ] Root task", "", "## Planning", "", "- [ ] Section task", ""].join("\n"),
    );
    expect(markdown.match(/^# /gm)).toHaveLength(1);
  });
});

describe("renderAdvancedMarkdownDocument", () => {
  // Расширенный экспорт сохраняет подробности задачи, секции и самого проекта.
  it("includes task descriptions, dates, labels, comments, and scope descriptions", () => {
    const tree = buildTaskTree([
      task({
        id: "rich-task",
        title: "Write release notes",
        lexicalOrder: "a",
        description: "Mention the new search\nand export formats",
        dueDate: "2026-11-12",
        labels: ["release", "writing"],
        comments: [
          {
            id: "comment-1",
            body: "Include screenshots",
            createdAt: "2026-11-01T12:00:00.000Z",
          },
        ],
      }),
    ]);

    expect(renderAdvancedMarkdownDocument("Inbox", tree, [], "Personal notes")).toContain(
      [
        "# Inbox",
        "",
        "> **Description:** Personal notes",
        "- [ ] Write release notes",
        "  > **Description:** Mention the new search",
        "  > and export formats",
        "  > **Due date:** 2026-11-12",
        "  > **Labels:** `release`, `writing`",
        "  > **Comments:**",
        "  > - 2026-11-01T12:00:00.000Z — Include screenshots",
      ].join("\n"),
    );
  });
});
