import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, z } from "zod";

/**
 * Middleware Zod reutilizável: valida `req.body` contra o schema e substitui
 * `req.body` pelo dado já parseado (com defaults/coerções aplicados).
 * Payload inválido responde 400 antes de chegar no handler da rota.
 */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten(),
      });
      return;
    }

    req.body = result.data as z.infer<S>;
    next();
  };
}
