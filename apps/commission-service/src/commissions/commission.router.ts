import { Router } from "express";
import { validateBody } from "@bliss/shared/validation";
import {
    getCommissionByIdAndStatus,
    getCommissionById,
    reserveCommissionById,
    releaseCommissionById,
    CommissionNotFoundError,
    CommissionConflictError,
} from "./commission.controller";
import { CommissionStateError, ReserveCommissionRequestSchema } from "./commission.schema";

const commissionRouter = Router();
commissionRouter.get('/commissions?sellerId=:sellerId&status=:status', async (req: any, res: any) => {
    try {
        const { sellerId, status } = req.query;
        console.log(`Fetching commissions for sellerId: ${sellerId}, status: ${status}`);

        const commissions = await getCommissionByIdAndStatus(sellerId, status);

        return res.status(200).json({ message: 'Commissions fetched', commissions });

    }catch(error){
        //TODO: log error in a better way, maybe using a logger library
        console.error('Error fetching commissions:', error);
        return res.status(500).json({ message: 'Error fetching commissions' });
    }
});

commissionRouter.get('/commissions/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        console.log(`Fetching commission for ID: ${id}`);
        const commission = await getCommissionById(id); // Assuming 'active' is a valid status
        return res.status(200).json({ message: 'Commission fetched', commission });

    } catch (error) {
      console.error('Error fetching commission by ID:', error);
      return res.status(500).json({ message: 'Error fetching commission by ID' });
    }
    
});


commissionRouter.post(
    '/commissions/:id/reserve',
    validateBody(ReserveCommissionRequestSchema),
    async (req: any, res: any) => {
        const { id } = req.params;
        try {
            const commission = await reserveCommissionById(id, req.body);
            return res.status(200).json({ message: 'Commission reserved', commission });
        } catch (error) {
            if (error instanceof CommissionNotFoundError) {
                return res.status(404).json({ message: error.message });
            }
            if (error instanceof CommissionConflictError || error instanceof CommissionStateError) {
                return res.status(409).json({ message: error.message });
            }
            //TODO: log error in a better way, maybe using a logger library
            console.error('Error reserving commission:', error);
            return res.status(500).json({ message: 'Error reserving commission' });
        }
    },
);

commissionRouter.post('/commissions/:id/release', async (req: any, res: any) => {
    const { id } = req.params;
    try {
        const commission = await releaseCommissionById(id);
        return res.status(200).json({ message: 'Commission released', commission });
    } catch (error) {
        if (error instanceof CommissionNotFoundError) {
            return res.status(404).json({ message: error.message });
        }
        if (error instanceof CommissionConflictError || error instanceof CommissionStateError) {
            return res.status(409).json({ message: error.message });
        }
        console.error('Error releasing commission:', error);
        return res.status(500).json({ message: 'Error releasing commission' });
    }
});

export default commissionRouter;
export { commissionRouter };