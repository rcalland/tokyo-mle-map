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
let subwayLayer = null;
let map = null;
let allCategories = [];
let subwayVisible = true;

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
    document.getElementById('subway-toggle').classList.add('active');
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
  markerLayer = L.layerGroup().addTo(map);
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

function renderMarkers() {
  markerLayer.clearLayers();
  
  geojsonData.features
    .slice()
    .sort((a, b) => a.geometry.coordinates[1] - b.geometry.coordinates[1])
    .forEach(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      const latlng = [coords[1], coords[0]];
      
      const marker = L.marker(latlng, {
        icon: createMarkerIcon(props.category, props.name)
      });
      marker.bindPopup(createPopupContent(props), { maxWidth: 320 });
      markerLayer.addLayer(marker);
    });
}

function setupEventListeners() {
  document.getElementById('subway-toggle').addEventListener('click', toggleSubway);
  document.getElementById('about-toggle').addEventListener('click', openAbout);
  document.getElementById('about-close').addEventListener('click', closeAbout);
  document.getElementById('about-modal').addEventListener('click', closeAbout);
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

document.addEventListener('DOMContentLoaded', init);
