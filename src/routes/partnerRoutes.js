import { Router } from "express";
import {
  getDashboard,
  getGym,
  createGym,
  updateGym,
  addGymPlan,
  updateGymPlan,
  deleteGymPlan,
  getTrainerProfile,
  createTrainerProfile,
  updateTrainerProfile,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/partnerController.js";
import { authMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();
const partnerRoles = [
  ROLES.GYM_OWNER,
  ROLES.TRAINER,
  ROLES.SUPPLEMENT_PROVIDER,
];

router.use(authMiddleware, roleMiddleware(partnerRoles));

router.get("/dashboard", getDashboard);

router.get("/gym", getGym);
router.post("/gym", createGym);
router.put("/gym", updateGym);
router.post("/gym/plans", addGymPlan);
router.put("/gym/plans/:planId", updateGymPlan);
router.delete("/gym/plans/:planId", deleteGymPlan);

router.get("/trainer-profile", getTrainerProfile);
router.post("/trainer-profile", createTrainerProfile);
router.put("/trainer-profile", updateTrainerProfile);

router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

export default router;
