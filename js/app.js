const categoryColors = {
  'Foreign Big Tech': '#3b82f6',
  'Autonomous Driving': '#f59e0b',
  'Local AI Research': '#10b981',
  'Local Tech Giant': '#8b5cf6',
  'Autonomous Driving / Physical AI': '#ef4444',
};

let currentLang = 'en';
let geojsonData = null;
let subwayData = null;
let markerLayer = null;
let clusterLayer = null;
let subwayLayer = null;
let map = null;
let allCategories = [];
let subwayVisible = true;
let clusteringEnabled = true;
let individualMarkers = [];
let displacementDots = [];
let highZoomActive = false;
let collisionAnimating = false;

async function init() {
  try {
    const [companiesRes, subwayRes] = await Promise.all([
      fetch('data/companies.json'),
      fetch('data/subway-lines.json')
    ]);
    geojsonData = await companiesRes.json();
    subwayData = await subwayRes.json();
    allCategories = [...new Set(geojsonData.features.map(f => f.properties.category))];
    initMap();
    renderMarkers();
    renderSubwayLines();
    clusterLayer.addTo(map);
    document.getElementById('subway-toggle').classList.add('active');
    document.getElementById('cluster-toggle').classList.add('active');
    setupEventListeners();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

function initMap() {
  map = L.map('map', {
    center: [35.6812, 139.7671],
    zoom: 13,
    zoomControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);
  markerLayer = L.layerGroup();
  clusterLayer = L.markerClusterGroup({
    maxClusterRadius: 60,
    disableClusteringAtZoom: 14,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      var childCount = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="
          width: 36px; height: 36px;
          background: rgba(96, 165, 250, 0.85);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">${childCount}</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
    }
  });
}

function getMarkerColor(category) {
  return categoryColors[category] || '#3b82f6';
}

function createMarkerIcon(category, name) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-label">${name}</div>`,
    iconAnchor: [0, 0]
  });
}

function createPopupContent(props) {
  return `
    <div class="popup-content">
      <h3>${props.name}</h3>
      <span class="popup-category" style="background: ${getMarkerColor(props.category)}20; color: ${getMarkerColor(props.category)};">
        ${props.category}
      </span>
      <p class="popup-address">📍 ${props.address}</p>
      <div class="popup-section">
        <strong>ML Focus:</strong> ${props.ml_focus}
      </div>
      <div class="popup-section">
        <strong>Tech Stack:</strong> ${props.tech_stack}
      </div>
      <div class="popup-section">
        <strong>Salary:</strong> ${props.salary_tier}
      </div>
      <div class="popup-section">
        <strong>Recruitment:</strong> ${props.recruitment}
      </div>
    </div>
  `;
}

function createMarker(props, latlng) {
  const marker = L.marker(latlng, {
    icon: createMarkerIcon(props.category, props.name)
  });
  marker.bindPopup(createPopupContent(props), { maxWidth: 320 });
  return marker;
}

function renderMarkers() {
  markerLayer.clearLayers();
  clusterLayer.clearLayers();
  individualMarkers = [];

  geojsonData.features
    .slice()
    .sort((a, b) => a.geometry.coordinates[1] - b.geometry.coordinates[1])
    .forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      const latlng = [coords[1], coords[0]];

      const marker = createMarker(props, latlng);
      marker.originalLatLng = latlng;
      marker.category = props.category;
      markerLayer.addLayer(marker);
      individualMarkers.push(marker);

      const clusterMarker = createMarker(props, latlng);
      clusterLayer.addLayer(clusterMarker);
    });
}

function setupEventListeners() {
  document.getElementById('subway-toggle').addEventListener('click', toggleSubway);
  document.getElementById('cluster-toggle').addEventListener('click', toggleClustering);
  document.getElementById('about-toggle').addEventListener('click', openAbout);
  document.getElementById('about-close').addEventListener('click', closeAbout);
  document.getElementById('about-modal').addEventListener('click', closeAbout);
  map.on('zoomend moveend', checkCollisions);
}

const COLLISION_PADDING = 8;
const MAX_DISPLACEMENT = 25;
const MAX_ITERATIONS = 5;
const MARKER_WIDTH = 60;
const MARKER_HEIGHT = 32;

function getMarkerBounds(marker) {
  const point = map.latLngToContainerPoint(marker.getLatLng());
  return {
    x: point.x - MARKER_WIDTH / 2,
    y: point.y - MARKER_HEIGHT / 2,
    w: MARKER_WIDTH,
    h: MARKER_HEIGHT
  };
}

function boxesOverlap(a, b) {
  const pad = COLLISION_PADDING;
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

const DISABLE_CLUSTERING_ZOOM = 14;
const ANIMATION_DURATION = 300;

function hasAnyCollisions() {
  for (let i = 0; i < individualMarkers.length; i++) {
    for (let j = i + 1; j < individualMarkers.length; j++) {
      const boundsA = getMarkerBounds(individualMarkers[i]);
      const boundsB = getMarkerBounds(individualMarkers[j]);
      if (boxesOverlap(boundsA, boundsB)) return true;
    }
  }
  return false;
}

function resolveCollisions() {
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let hasCollision = false;

    for (let i = 0; i < individualMarkers.length; i++) {
      for (let j = i + 1; j < individualMarkers.length; j++) {
        const a = individualMarkers[i];
        const b = individualMarkers[j];
        const boundsA = getMarkerBounds(a);
        const boundsB = getMarkerBounds(b);

        if (!boxesOverlap(boundsA, boundsB)) continue;

        hasCollision = true;

        const centerA = map.latLngToContainerPoint(a.getLatLng());
        const centerB = map.latLngToContainerPoint(b.getLatLng());
        let dx = centerB.x - centerA.x;
        let dy = centerB.y - centerA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= dist;
        dy /= dist;

        const overlapW = Math.min(boundsA.x + boundsA.w, boundsB.x + boundsB.w) - Math.max(boundsA.x, boundsB.x);
        const overlapH = Math.min(boundsA.y + boundsA.h, boundsB.y + boundsB.h) - Math.max(boundsA.y, boundsB.y);
        const pushDist = Math.max(overlapW, overlapH) / 2 + COLLISION_PADDING;
        const clampedDist = Math.min(pushDist, MAX_DISPLACEMENT) / 2;

        const newLatLngA = map.containerPointToLatLng([
          centerA.x - dx * clampedDist,
          centerA.y - dy * clampedDist
        ]);
        const newLatLngB = map.containerPointToLatLng([
          centerB.x + dx * clampedDist,
          centerB.y + dy * clampedDist
        ]);
        a.setLatLng(newLatLngA);
        b.setLatLng(newLatLngB);
      }
    }

    if (!hasCollision) break;
  }
}

function updateDisplacementDots() {
  displacementDots.forEach(dot => markerLayer.removeLayer(dot));
  displacementDots = [];

  individualMarkers.forEach(m => {
    const current = m.getLatLng();
    const original = m.originalLatLng;
    if (current.lat !== original[0] || current.lng !== original[1]) {
      const dot = L.circleMarker(original, {
        radius: 3,
        fillColor: getMarkerColor(m.category),
        fillOpacity: 0.5,
        weight: 0
      });
      markerLayer.addLayer(dot);
      displacementDots.push(dot);
    }
  });
}

function checkCollisions() {
  if (collisionAnimating) return;

  const zoom = map.getZoom();

  if (clusteringEnabled && zoom >= DISABLE_CLUSTERING_ZOOM && !highZoomActive) {
    map.removeLayer(clusterLayer);
    markerLayer.addTo(map);
    highZoomActive = true;
    individualMarkers.forEach(m => m.setLatLng(m.originalLatLng));
  }

  if (clusteringEnabled && highZoomActive && zoom < DISABLE_CLUSTERING_ZOOM) {
    map.removeLayer(markerLayer);
    displacementDots.forEach(dot => markerLayer.removeLayer(dot));
    displacementDots = [];
    clusterLayer.addTo(map);
    highZoomActive = false;
    return;
  }

  if (clusteringEnabled && !highZoomActive) return;

  if (!hasAnyCollisions()) return;

  const startPositions = individualMarkers.map(m => m.getLatLng());
  resolveCollisions();
  const endPositions = individualMarkers.map(m => m.getLatLng());
  animateMarkers(startPositions, endPositions);
  updateDisplacementDots();
}

function animateMarkers(startPositions, endPositions) {
  const hasDisplacement = startPositions.some((s, i) =>
    s.lat !== endPositions[i].lat || s.lng !== endPositions[i].lng
  );
  if (!hasDisplacement) return;

  collisionAnimating = true;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    const eased = easeOutCubic(progress);

    individualMarkers.forEach((m, i) => {
      const start = startPositions[i];
      const end = endPositions[i];
      const lat = start.lat + (end.lat - start.lat) * eased;
      const lng = start.lng + (end.lng - start.lng) * eased;
      m.setLatLng([lat, lng]);
    });

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      collisionAnimating = false;
    }
  }

  requestAnimationFrame(step);
}

function openAbout() {
  document.getElementById('about-modal').classList.add('modal--active');
}

function closeAbout() {
  document.getElementById('about-modal').classList.remove('modal--active');
}

function renderSubwayLines() {
  if (subwayLayer) map.removeLayer(subwayLayer);
  
  subwayLayer = L.layerGroup();
  
  subwayData.lines.forEach(line => {
    const sections = line.coordinates;
    sections.forEach(section => {
      const latlngs = section.map(c => [c[1], c[0]]);
      const polyline = L.polyline(latlngs, {
        color: line.color,
        weight: 4,
        opacity: 0.35,
        smoothFactor: 1
      });
      subwayLayer.addLayer(polyline);
    });
  });
  
  subwayLayer.addTo(map);
}

function toggleSubway() {
  subwayVisible = !subwayVisible;
  const btn = document.getElementById('subway-toggle');
  
  if (subwayVisible) {
    renderSubwayLines();
    btn.classList.add('active');
  } else if (subwayLayer) {
    map.removeLayer(subwayLayer);
    subwayLayer = null;
    btn.classList.remove('active');
  }
}

function toggleClustering() {
  clusteringEnabled = !clusteringEnabled;
  const btn = document.getElementById('cluster-toggle');
  highZoomActive = false;

  map.removeLayer(markerLayer);
  map.removeLayer(clusterLayer);

  if (clusteringEnabled) {
    displacementDots.forEach(dot => markerLayer.removeLayer(dot));
    displacementDots = [];
    clusterLayer.addTo(map);
    btn.classList.add('active');
  } else {
    markerLayer.addTo(map);
    btn.classList.remove('active');
    setTimeout(() => checkCollisions(), 50);
  }
}

document.addEventListener('DOMContentLoaded', init);
