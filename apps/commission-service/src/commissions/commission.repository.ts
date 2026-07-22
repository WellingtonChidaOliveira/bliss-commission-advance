import { Commission } from "./commission.schema";
import IRepository from "@bliss/shared/repository";

export class CommissionRepository implements IRepository<Commission> {
    private commissions: Commission[] = [];

    async getAll(): Promise<Commission[]> {
        return this.commissions;
    }

    async getById(id: string): Promise<Commission | null> {
        const commission = this.commissions.find(c => c.id === id);
        return commission || null;
    }

    //TODO: validate id filter can be passed in get by id
    async getByIdAndStatus(id: string, status: string): Promise<Commission | null> {
        const commission = this.commissions.find(c => c.id === id && c.status === status);
        return commission || null;
    }

    async create(item: Commission): Promise<Commission> {
        this.commissions.push(item);
        return item;
    }

    async update(id: string, item: Commission): Promise<Commission | null> {
        const index = this.commissions.findIndex(c => c.id === id);
        if (index !== -1) {
            this.commissions[index] = item;
            return item;
        }
        return null;
    }

    /**
     * Compare-and-swap: só escreve se a `version` armazenada ainda bater com
     * `expectedVersion` (a version lida antes de calcular `item`). Se outra
     * chamada já escreveu no meio do caminho, retorna `null` — quem chamou
     * decide o que fazer (normalmente responder 409). Simula o
     * ConditionExpression que isso vira no DynamoDB (Dia 4).
     */
    async updateIfVersionMatches(
        id: string,
        expectedVersion: number,
        item: Commission,
    ): Promise<Commission | null> {
        const index = this.commissions.findIndex(c => c.id === id);
        if (index === -1) return null;
        if (this.commissions[index].version !== expectedVersion) return null;
        this.commissions[index] = item;
        return item;
    }

    async delete(id: string): Promise<boolean> {
        const index = this.commissions.findIndex(c => c.id === id);
        if (index !== -1) {
            this.commissions.splice(index, 1);
            return true;
        }
        return false;
    }

    async sendNotification(message: string): Promise<void> {
        // Implementation for sending notification
        console.log(`Notification sent: ${message}`);
    }
}

// Instância única do processo — necessário para o estado in-memory persistir
// entre requests enquanto não há DynamoDB (Dia 4).
export const commissionRepository = new CommissionRepository();