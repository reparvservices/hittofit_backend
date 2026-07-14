import { Router } from "express";
import {
  getGyms,
  getGymById,
  getNearbyGyms,
  getSupplements,
  getSupplementById,
  getTrainers,
  getTrainerById,
  getTrainerServices,
} from "../controllers/publicController.js";

const router = Router();

router.get("/gyms", getGyms);
router.get("/gyms/nearby", getNearbyGyms);
router.get("/gyms/:id", getGymById);
router.get("/supplements", getSupplements);
router.get("/supplements/:id", getSupplementById);
router.get("/trainers", getTrainers);
router.get("/trainers/:id/services", getTrainerServices);
router.get("/trainers/:id", getTrainerById);

export default router;
