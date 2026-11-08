export const appendById = <TItem extends Readonly<{ id: string }>>(
  items: ReadonlyArray<TItem> | undefined,
  item: TItem,
): ReadonlyArray<TItem> =>
  Object.freeze([...(items ?? Object.freeze([])).filter((existing) => existing.id !== item.id), item]);

export const removeById = <TItem extends Readonly<{ id: string }>>(
  items: ReadonlyArray<TItem> | undefined,
  id: string,
): ReadonlyArray<TItem> =>
  Object.freeze((items ?? Object.freeze([])).filter((existing) => existing.id !== id));

export const replaceById = <TItem extends Readonly<{ id: string }>>(
  items: ReadonlyArray<TItem> | undefined,
  item: TItem,
): ReadonlyArray<TItem> =>
  Object.freeze((items ?? Object.freeze([])).map((existing) => (existing.id === item.id ? item : existing)));
