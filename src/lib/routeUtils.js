// Haversine formula: distance in kilometers between two lat/lng points
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest-neighbor TSP heuristic
// Takes array of boxes with latitude/longitude, returns ordered array
export function nearestNeighborTSP(boxes) {
  if (!boxes || boxes.length === 0) return [];
  if (boxes.length === 1) return [...boxes];

  const remaining = [...boxes];
  const route = [];

  // Start from the first box
  let current = remaining.shift();
  route.push(current);

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        parseFloat(current.latitude),
        parseFloat(current.longitude),
        parseFloat(remaining[i].latitude),
        parseFloat(remaining[i].longitude)
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    route.push(current);
  }

  return route;
}

// Calculate total route distance in km
export function calculateRouteDistance(route) {
  if (!route || route.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineDistance(
      parseFloat(route[i].latitude),
      parseFloat(route[i].longitude),
      parseFloat(route[i + 1].latitude),
      parseFloat(route[i + 1].longitude)
    );
  }
  return total;
}

// Build Google Maps directions URL
export function buildGoogleMapsUrl(route) {
  if (!route || route.length === 0) return '';
  if (route.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${route[0].latitude},${route[0].longitude}`;
  }

  const origin = `${route[0].latitude},${route[0].longitude}`;
  const destination = `${route[route.length - 1].latitude},${route[route.length - 1].longitude}`;
  const waypoints = route
    .slice(1, -1)
    .map((b) => `${b.latitude},${b.longitude}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  return url;
}

// Open Waze navigation for a single point
export function openWaze(latitude, longitude) {
  const url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
  window.open(url, '_blank');
}
