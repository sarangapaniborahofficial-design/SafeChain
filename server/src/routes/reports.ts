import { Router } from 'express';
import { prisma } from '../db';
const router = Router();

router.post('/hazard', async (req, res) => {
  const { type, location, severity } = req.body;
  
  try {
    const hazard = await prisma.hazardReport.create({
      data: {
        type,
        lat: location.lat,
        lng: location.lng,
        severity,
        // Expire hazard automatically after 12 hours
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) 
      }
    });

    console.log(`[NEW HAZARD] ${type} reported at ${location.lat}, ${location.lng}`);
    res.json({ success: true, hazard });
  } catch (err) {
    res.status(500).json({ error: "Failed to report hazard" });
  }
});

router.get('/active', async (req, res) => {
  try {
    // Fetch only hazards that haven't expired
    const activeHazards = await prisma.hazardReport.findMany({
      where: {
        active: true,
        expiresAt: { gt: new Date() }
      }
    });

    // Map to frontend format
    const formatted = activeHazards.map(h => ({
      type: h.type,
      location: { lat: h.lat, lng: h.lng },
      severity: h.severity
    }));

    res.json({ hazards: formatted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

export default router;
