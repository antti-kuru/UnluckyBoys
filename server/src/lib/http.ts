import { HTTPException } from "hono/http-exception";
import { z } from "zod";

export function parsePagination(limit: string | undefined, offset: string | undefined, defaults = { limit: 10, max: 50 }) {
  const schema = z.object({
    limit: z.coerce.number().int().positive().max(defaults.max).default(defaults.limit),
    offset: z.coerce.number().int().min(0).default(0)
  });
  return schema.parse({ limit, offset });
}

export function notFound(message = "Not found") {
  throw new HTTPException(404, { message });
}

export function badRequest(message = "Bad request") {
  throw new HTTPException(400, { message });
}
