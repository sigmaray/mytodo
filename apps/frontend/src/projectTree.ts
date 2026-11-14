import type { Project, ProjectId } from "@todoist-clone/domain";

/**
 * Считает глубину проекта по цепочке родителей, ограничивая обход размером списка.
 *
 * @param {Array<Project>} projects
 * @param {Project} project
 * @returns {number}
 */
export const projectDepth = (projects: Array<Project>, project: Project): number => {
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

/**
 * Проверяет, входит ли проект в поддерево указанного предка.
 *
 * @param {Array<Project>} projects
 * @param {ProjectId | null} projectId
 * @param {ProjectId} ancestorId
 * @returns {boolean}
 */
export const isProjectWithinTree = (
  projects: Array<Project>,
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

/**
 * Возвращает проекты в порядке обхода дерева, сохраняя порядок соседей.
 *
 * @param {Array<Project>} projects
 * @returns {Array<Project>}
 */
export const projectTreeOrder = (projects: Array<Project>): Array<Project> => {
  /**
   * Проекты с отсутствующим родителем считаются корневыми, чтобы не потерять их из интерфейса.
   *
   * @param {ProjectId | null} parentId
   */
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
  /**
   * Добавляем каждого родителя перед рекурсивно отсортированными дочерними проектами.
   *
   * @param {ProjectId | null} parentId
   * @returns {Array<Project>}
   */
  const visit = (parentId: ProjectId | null): Array<Project> =>
    byParent(parentId).flatMap((project) => [project, ...visit(project.id)]);
  return visit(null);
};
