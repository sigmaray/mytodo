export const appendById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => [...(items ?? []).filter((existing) => existing.id !== item.id), item];

export const removeById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  id: string,
): Array<TItem> => (items ?? []).filter((existing) => existing.id !== id);

export const replaceById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => (items ?? []).map((existing) => (existing.id === item.id ? item : existing));
