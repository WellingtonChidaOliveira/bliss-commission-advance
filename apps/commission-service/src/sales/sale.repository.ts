import { Sale } from "./sale.schema";
import IRepository from "@bliss/shared/repository";

export class SaleRepository implements IRepository<Sale> {
    private sales: Sale[] = [];

    async getAll(): Promise<Sale[]> {
        return this.sales;
    }

    async getById(id: string): Promise<Sale | null> {
        const sale = this.sales.find((s) => s.id === id);
        return sale || null;
    }

    async create(item: Sale): Promise<Sale> {
        this.sales.push(item);
        return item;
    }

    async update(id: string, item: Sale): Promise<Sale | null> {
        const index = this.sales.findIndex((s) => s.id === id);
        if (index !== -1) {
            this.sales[index] = item;
            return item;
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        const index = this.sales.findIndex((s) => s.id === id);
        if (index !== -1) {
            this.sales.splice(index, 1);
            return true;
        }
        return false;
    }
}

// Instância única do processo — mesmo motivo do CommissionRepository.
export const saleRepository = new SaleRepository();
