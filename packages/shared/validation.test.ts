import type { Request, Response } from "express";
import { z } from "zod";
import { validateBody } from "./validation";

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function buildRes(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it("chama next() e substitui req.body pelo dado parseado quando válido", () => {
    const req = { body: { name: "Ana", age: 30 } } as Request;
    const res = buildRes();
    const next = jest.fn();

    validateBody(schema)(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: "Ana", age: 30 });
  });

  it("aplica defaults do schema no body parseado", () => {
    const withDefault = z.object({ currency: z.literal("BRL").default("BRL") });
    const req = { body: {} } as Request;
    const res = buildRes();
    const next = jest.fn();

    validateBody(withDefault)(req, res as unknown as Response, next);

    expect(req.body).toEqual({ currency: "BRL" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("responde 400 e não chama next() quando o payload é inválido", () => {
    const req = { body: { name: "", age: -1 } } as Request;
    const res = buildRes();
    const next = jest.fn();

    validateBody(schema)(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed",
        errors: expect.objectContaining({
          fieldErrors: expect.objectContaining({
            name: expect.any(Array),
            age: expect.any(Array),
          }),
        }),
      }),
    );
  });

  it("responde 400 quando campos obrigatórios estão ausentes", () => {
    const req = { body: {} } as Request;
    const res = buildRes();
    const next = jest.fn();

    validateBody(schema)(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
