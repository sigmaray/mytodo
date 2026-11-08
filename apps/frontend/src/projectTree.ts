import type { Project, ProjectId } from "@todoist-clone/domain";

export const projectDepth = (projects: ReadonlyArray<Project>, project: Project): number => {
  let depth = 0;
  let parentId = project.parentId;
  while (parentId !== null && depth < projects.length) {
    const parent = projects.find((item) => item.id === parentId);
    if (parent === undefined) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
};

export const isProjectWithinTree = (
  projects: ReadonlyArray<Project>,
  projectId: ProjectId | null,
  ancestorId: ProjectId,
): boolean => {
  let currentId = projectId;
  let remaining = projects.length;
  while (currentId !== null && remaining > 0) {
    if (currentId === ancestorId) return true;
    currentId = projects.find((item) => item.id === currentId)?.parentId ?? null;
    remaining -= 1;
  }
  return false;
};

export const projectTreeOrder = (projects: ReadonlyArray<Project>): ReadonlyArray<Project> => {
  const byParent = (parentId: ProjectId | null) =>
    projects
      .filter(
        (item) =>
          item.parentId === parentId ||
          (parentId === null &&
            item.parentId !== null &&
            !projects.some((parent) => parent.id === item.parentId)),
      )
      .toSorted((a, b) => (a.lexicalOrder < b.lexicalOrder ? -1 : a.lexicalOrder > b.lexicalOrder ? 1 : 0));
  const visit = (parentId: ProjectId | null): ReadonlyArray<Project> =>
    byParent(parentId).flatMap((project) => [project, ...visit(project.id)]);
  return Object.freeze(visit(null));
};
