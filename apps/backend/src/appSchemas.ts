import { z } from "zod";

/** Проверяет данные создания задачи и подставляет пустой контекст по умолчанию. */
export const createTaskSchema = z.object({
  /** Название новой задачи после удаления пробелов по краям. */
  title: z.string().trim().min(1),
  /** ID родительской задачи или корневое значение по умолчанию. */
  parentId: z.string().nullable().default(null),
  /** ID проекта или Входящие по умолчанию. */
  projectId: z.string().nullable().default(null),
  /** ID секции или корень проекта по умолчанию. */
  sectionId: z.string().nullable().default(null),
});

/** Проверяет данные проекта или подпроекта перед созданием. */
export const createProjectSchema = z.object({
  /** Непустое название нового проекта. */
  title: z.string().trim().min(1),
  /** Родительский проект либо `null` для корня. */
  parentId: z.string().nullable().default(null),
});
/** Проверяет название новой секции и её проект. */
export const createSectionSchema = z.object({
  /** Непустое название секции. */
  title: z.string().trim().min(1),
  /** Проект-владелец или Входящие по умолчанию. */
  projectId: z.string().nullable().default(null),
});

/** Проверяет имя и пароль, полученные при входе пользователя. */
export const loginSchema = z.object({
  /** Имя входа без пробелов по краям. */
  username: z.string().trim().min(1).max(64),
  /** Пароль в исходном виде для проверки хеша. */
  password: z.string().min(1),
});

/** Проверяет параметры пользовательских настроек. */
export const updateSettingsSchema = z.object({
  /** Требовать ли подтверждение перед удалением. */
  confirmDelete: z.boolean(),
});
/** Проверяет изменение имени или пароля и запрещает пустое обновление. */
export const updateAccountSchema = z
  .object({ username: z.string().trim().min(1).max(64).optional(), password: z.string().min(1).optional() })
  /** Требуем хотя бы одно поле, иначе запрос не изменил бы аккаунт. */
  .refine((patch) => Object.keys(patch).length > 0);
/** Проверяет новую учётную запись, которую создаёт администратор. */
export const createUserSchema = z.object({
  /** Уникальное имя новой учётной записи. */
  username: z.string().trim().min(1).max(64),
  /** Исходный пароль, который backend захеширует перед записью. */
  password: z.string().min(1),
  /** Нужно ли выдать новой учётной записи административные права. */
  isAdmin: z.boolean().default(false),
});
/** Проверяет набор изменений существующей учётной записи. */
export const updateUserSchema = z
  .object({
    /** Новое имя пользователя, если оно меняется. */
    username: z.string().trim().min(1).max(64).optional(),
    /** Новый пароль до серверного хеширования. */
    password: z.string().min(1).optional(),
    /** Новая роль пользователя, если администратор её меняет. */
    isAdmin: z.boolean().optional(),
  })
  /** Запрещаем пустой PATCH, чтобы каждый принятый запрос менял хотя бы одно поле. */
  .refine((patch) => Object.keys(patch).length > 0);
/** Проверяет описание Входящих и ограничивает объём хранимого текста. */
export const inboxDescriptionSchema = z.object({
  /** Текст описания, ограниченный 20 000 символами. */
  description: z.string().max(20000),
});

/**
 * Читает JSON-тело запроса, а при другом типе содержимого возвращает пустой объект.
 *
 * @param {Request} request
 * @returns Результат выполнения функции.
 */
export const parseJson = async (request: Request) => {
  /** Маршруты могут принимать запросы без тела, поэтому сначала проверяем заголовок. */
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};
