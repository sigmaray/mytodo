/** Добавляет запись в список, предварительно убирая прежнюю версию с тем же ID. */
export const appendById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => [...(items ?? []).filter((existing) => existing.id !== item.id), item];

/** Возвращает список без записи с указанным идентификатором. */
export const removeById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  id: string,
): Array<TItem> => (items ?? []).filter((existing) => existing.id !== id);

/** Заменяет запись с тем же ID, сохраняя порядок элементов списка. */
export const replaceById = <TItem extends { id: string }>(
  items: Array<TItem> | undefined,
  item: TItem,
): Array<TItem> => (items ?? []).map((existing) => (existing.id === item.id ? item : existing));
