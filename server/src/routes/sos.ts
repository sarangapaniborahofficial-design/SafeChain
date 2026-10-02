import { Router } from 'express';
import { prisma } from '../db';
import { verifyToken } from './auth';
const router = Router();

router.post('/dispatch', verifyToken, async (req: any, res: any) => {
  const { target, location } = req.body;
  const userId = req.userId; // Extracted from JWT
  const trackingId = `TRK-${Date.now()}`;
  
  console.log(`[SOS DISPATCH] Target: ${target}, User: ${userId}`);
  console.log(`[SOS DISPATCH] Location: Lat ${location.lat}, Lng ${location.lng}`);

  try {
    // If guest, ensure guest user exists in DB to prevent foreign key errors
    let dbUserId = userId;
    if (userId === 'guest_user') {
      let guestUser = await prisma.user.findFirst({ where: { phone: 'guest' } });
      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: { id: 'guest_user', name: "Guest User", phone: "guest", password: "N/A" }
        });
      }
      dbUserId = guestUser.id;
    }

    // 2. Create the SOS Session in the database
    const session = await prisma.sOSSession.create({
      data: {
        trackingId,
        userId: dbUserId,
        target
      }
    });

    // 3. Log the initial location
    await prisma.locationUpdate.create({
      data: {
        sessionId: session.id,
        lat: location.lat,
        lng: location.lng,
        battery: "42%",
        speed: "0 km/h"
      }
    });

    res.json({ success: true, message: "SOS Dispatched Successfully", trackingId });
  } catch (err) {
    console.error("Database error during SOS:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

export default router;
