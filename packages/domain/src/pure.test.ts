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

/**
 * Creates a test task with defaults for optional fields.
 *
 * @param {Partial<Task> & Pick<Task, "id" | "title" | "lexicalOrder">} values
 * @returns {Task}
 */
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
  /** Verify that the root task and its children are sorted when building the tree. */
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
  /** The new key must sort strictly between the two supplied keys. */
  it("creates sortable values between neighbors", () => {
    const middle = generateLexicalOrder("A", "C");

    expect(middle > "A").toBe(true);
    expect(middle < "C").toBe(true);
  });

  /** Boundary cases cover inserting at the beginning, at the end, and into an empty list. */
  it("creates values for empty ranges", () => {
    expect(generateLexicalOrder(null, null)).toBeTruthy();
    expect(generateLexicalOrder(null, "1") < "1").toBe(true);
    expect(generateLexicalOrder("z", null) > "z").toBe(true);
  });
});

describe("computeDropPlacement", () => {
  /** Use three neighboring tasks to verify placement relative to the target. */
  const siblings = [
    task({ id: "a", title: "A", lexicalOrder: "a" }),
    task({ id: "b", title: "B", lexicalOrder: "b" }),
    task({ id: "c", title: "C", lexicalOrder: "c" }),
  ];

  /** The placement must indicate the correct side of the target task. */
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

  /** If the order is already correct, moving again must not create an update. */
  it("returns null for no-op drops next to the current position", () => {
    expect(computeDropPlacement(siblings, siblings[0] as Task, siblings[1] as Task, "before")).toBeNull();
    expect(computeDropPlacement(siblings, siblings[1] as Task, siblings[0] as Task, "after")).toBeNull();
    expect(computeDropPlacement(siblings, siblings[1] as Task, siblings[1] as Task, "before")).toBeNull();
  });

  /** Moving an ancestor into its own subtree would create a cycle. */
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
  /** Indenting makes the previous task at the same level the parent. */
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

  /** The first task in a list has no previous sibling to become its parent. */
  it("returns null for the first sibling", () => {
    const tasks = [task({ id: "a", title: "A", lexicalOrder: "a" })];

    expect(computeIndentPlacement(tasks, tasks[0] as Task)).toBeNull();
  });
});

describe("computeOutdentPlacement", () => {
  /** After outdenting, the task should become the parent's next sibling. */
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

  /** A root task has no parent, so it cannot be outdented. */
  it("returns null for root tasks", () => {
    const tasks = [task({ id: "a", title: "A", lexicalOrder: "a" })];

    expect(computeOutdentPlacement(tasks, tasks[0] as Task)).toBeNull();
  });
});

describe("renderTaskMarkdownDocument", () => {
  /** Represent tree nesting with indentation and completion with a checked box. */
  it("renders nested tasks as a markdown checklist", () => {
    const tree = buildTaskTree([
      task({ id: "root", title: "Plan release", lexicalOrder: "a", completed: true }),
      task({ id: "child", title: "Write notes", parentId: "root", lexicalOrder: "a" }),
    ]);

    expect(renderTaskMarkdownDocument("Inbox", tree)).toBe(
      ["# Inbox", "", "- [x] Plan release", "  - [ ] Write notes", ""].join("\n"),
    );
  });

  /** A project export should have one overall heading and separate section headings. */
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
  /** The extended export preserves task, section, and project details. */
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
