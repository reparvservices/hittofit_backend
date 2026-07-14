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
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getTrainerServices,
  createTrainerService,
  updateTrainerService,
  deleteTrainerService,
  getMemberships,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getClients,
  addClient,
  removeClient,
  getPartnerGymOptions,
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
router.get("/memberships", getMemberships);

router.get("/trainer-profile", getTrainerProfile);
router.post("/trainer-profile", createTrainerProfile);
router.put("/trainer-profile", updateTrainerProfile);
router.get("/gym-options", getPartnerGymOptions);

router.get("/services", getTrainerServices);
router.post("/services", createTrainerService);
router.put("/services/:id", updateTrainerService);
router.delete("/services/:id", deleteTrainerService);

router.get("/clients", getClients);
router.post("/clients", addClient);
router.delete("/clients/:customerId", removeClient);

router.get("/products", getProducts);
router.get("/products/:id", getProduct);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
router.patch("/orders/:id/status", updateOrderStatus);

export default router;
