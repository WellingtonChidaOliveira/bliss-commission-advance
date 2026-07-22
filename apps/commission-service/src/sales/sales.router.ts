import { Router } from "express";
import { validateBody } from "@bliss/shared/validation";
import { CreateSaleSchema } from "./sale.schema";
import { createSale } from "./sales.controller";

export const salesRouter = Router();

salesRouter.post("/sales", validateBody(CreateSaleSchema), async (req, res) => {
  try {
    const result = await createSale(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

export default salesRouter;
