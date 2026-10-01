exports.getRoutes = async (req, res) => {
    const { start, end, waypoints } = req.query;
    
    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end coordinates are required in the format lng,lat' });
    }

    try {
        // Construct the OSRM URL
        // Format: {start};{waypoints};{end}
        const coords = waypoints ? `${start};${waypoints};${end}` : `${start};${end}`;
        
        // We use the public OSRM walking profile
        const osrmApiUrl = `https://router.project-osrm.org/route/v1/walking/${coords}?overview=full&geometries=geojson`;
        
        console.log(`[API] Fetching route for coordinates: ${coords}`);
        
        const response = await fetch(osrmApiUrl, {
            headers: {
                'User-Agent': 'NavShield-Backend/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`OSRM API responded with status ${response.status}`);
        }

        const data = await response.json();
        
        // Return the exact same JSON format so the frontend doesn't need to change its parsing logic
        return res.status(200).json(data);

    } catch (error) {
        console.error('[API] Error fetching routes:', error.message);
        return res.status(500).json({ 
            error: 'Failed to calculate route from external provider',
            details: error.message 
        });
    }
};
