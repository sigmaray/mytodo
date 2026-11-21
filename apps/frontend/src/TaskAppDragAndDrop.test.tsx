import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Task } from "@todoist-clone/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi, dragTask, placePointer, renderApp, task, taskRow } from "./AppTestSupport";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("TaskApp drag and drop", () => {
  it("moves a task inside another task with drag and drop", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Child", projectId, sectionId, parentId }),
    );

    renderApp({
      ...baseApi([task({ id: "parent", title: "Parent task" }), task({ id: "child", title: "Child task" })]),
      moveTask,
    });

    await screen.findByText("Parent task");
    const dataTransfer = dragTask("Child task");
    const parentRow = taskRow("Parent task");

    placePointer(parentRow, -50);
    fireEvent.drop(parentRow, { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, "parent", null, null));
  });

  it("reorders sibling tasks with drag and drop insertion lines", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp({
      ...baseApi([
        task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
        task({ id: "b", title: "Beta", lexicalOrder: "b" }),
        task({ id: "c", title: "Gamma", lexicalOrder: "c" }),
      ]),
      moveTask,
    });

    await screen.findByText("Alpha");
    const dataTransfer = dragTask("Gamma");
    const alphaRow = taskRow("Alpha");

    placePointer(alphaRow, 0);
    fireEvent.dragEnter(alphaRow, { dataTransfer });

    expect(alphaRow).toHaveClass("drag-before");

    fireEvent.drop(alphaRow, { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("c", null, null, null, "a", null));
  });

  it("indents and outdents tasks with keyboard shortcuts", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp({
      ...baseApi([
        task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
        task({ id: "b", title: "Beta", lexicalOrder: "b" }),
        task({
          id: "parent",
          title: "Parent",
          lexicalOrder: "c",
          children: [task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" })],
        }),
      ]),
      moveTask,
    });

    await screen.findByText("Beta");
    fireEvent.keyDown(taskRow("Beta"), { key: "ArrowRight", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("b", null, null, "a", null, null));

    fireEvent.keyDown(taskRow("Child"), { key: "ArrowLeft", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });

  it("outdents a nested task by dragging it left", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp({
      ...baseApi([
        task({
          id: "parent",
          title: "Parent",
          lexicalOrder: "a",
          children: [task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" })],
        }),
      ]),
      moveTask,
    });

    await screen.findByText("Child");
    const dataTransfer = dragTask("Child");
    const childRow = taskRow("Child");

    placePointer(childRow, 0);
    Object.defineProperty(childRow, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 50,
        y: 0,
        top: 0,
        right: 450,
        bottom: 100,
        left: 50,
        width: 400,
        height: 100,
        toJSON: () => ({}),
      }),
    });
    fireEvent.drop(childRow, { dataTransfer, clientX: -24 });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });
});
