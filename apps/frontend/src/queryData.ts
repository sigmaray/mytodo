/**
 * Adds a record to a list after removing any existing record with the same ID.
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
 * Returns the list without the record with the specified ID.
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
 * Replaces the record with the same ID while preserving list order.
 *
 * @param {Array<TItem> | undefined} items
 * @param {TItem} item
 * @returns {Array<TItem>}
 */
export const replaceById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => (items ?? []).map((existing) => (existing.id === item.id ? item : existing));
