import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({
  error: z.object({
    status: z.number().openapi({ example: 404 }),
    code: z.string().openapi({ example: "DOCUMENT_NOT_FOUND" }),
    message: z.string().openapi({ example: "No document found with identifier /us/usc/t1/s999" }),
  }),
});
