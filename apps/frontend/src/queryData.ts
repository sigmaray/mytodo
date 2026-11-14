/**
 * Добавляет запись в список, предварительно убирая прежнюю версию с тем же ID.
 *
 * @param {Array<TItem> | undefined} items
 * @param {TItem} item
 * @returns {Array<TItem>}
 */
export const appendById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => [...(items ?? []).filter((existing) => existing.id !== item.id), item];

/**
 * Возвращает список без записи с указанным идентификатором.
 *
 * @param {Array<TItem> | undefined} items
 * @param {string} id
 * @returns {Array<TItem>}
 */
export const removeById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  id: string,
): Array<TItem> => (items ?? []).filter((existing) => existing.id !== id);

/**
 * Заменяет запись с тем же ID, сохраняя порядок элементов списка.
 *
 * @param {Array<TItem> | undefined} items
 * @param {TItem} item
 * @returns {Array<TItem>}
 */
export const replaceById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => (items ?? []).map((existing) => (existing.id === item.id ? item : existing));
