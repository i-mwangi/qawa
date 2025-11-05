// Grove Tracker - Satellite Imagery and Environmental Data
// Mapbox Configuration
import { CoffeeTreeAPI } from './api.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaGVucnlidXRub3RkYW5nZXIiLCJhIjoiY21ncHVmeGx1MjJvdzJrcXc4cXE2YTZpdyJ9.dwV49MrvgHcN9KGbFShVeg';

// Grove Data - Coffee farms across East Africa
// Hardcoded groves that are always available
const HARDCODED_GROVES = [
    { id: 1, title: "Bensa", description: "Sidamo region sublocation", country: "Ethiopia", coordinates: [38.8333, 6.5] },
    { id: 2, title: "Dale", description: "Sidamo region sublocation", country: "Ethiopia", coordinates: [38.3333, 6.75] },
    { id: 3, title: "Aleta Wendo", description: "Sidamo region sublocation", country: "Ethiopia", coordinates: [38.4167, 6.6] },
    { id: 4, title: "Chire", description: "Sidamo region sublocation", country: "Ethiopia", coordinates: [39.0919, 6.5334] },
    { id: 5, title: "Hula", description: "Sidamo region sublocation", country: "Ethiopia", coordinates: [38.5833, 6.5833] },
    { id: 6, title: "Kochere", description: "Yirgacheffe region sublocation", country: "Ethiopia", coordinates: [38.25, 6.0] },
    { id: 7, title: "Wenago", description: "Yirgacheffe region sublocation", country: "Ethiopia", coordinates: [38.3333, 6.3333] },
    { id: 8, title: "Gedeb", description: "Yirgacheffe region sublocation", country: "Ethiopia", coordinates: [39.1667, 7.1667] },
    { id: 9, title: "Dilla", description: "Yirgacheffe region sublocation", country: "Ethiopia", coordinates: [38.30833, 6.40833] },
    { id: 10, title: "Shakiso", description: "Guji region sublocation", country: "Ethiopia", coordinates: [38.9167, 5.75] },
    { id: 11, title: "Hambela Wamena", description: "Guji region sublocation", country: "Ethiopia", coordinates: [38.42, 6.0167] },
    { id: 12, title: "Uraga", description: "Guji region sublocation", country: "Ethiopia", coordinates: [38.5833, 6.1667] },
    { id: 13, title: "Babile", description: "Harrar region sublocation", country: "Ethiopia", coordinates: [42.333, 9.217] },
    { id: 14, title: "Deder", description: "Harrar region sublocation", country: "Ethiopia", coordinates: [41.446256, 9.321887] },
    { id: 15, title: "Gursum", description: "Harrar region sublocation", country: "Ethiopia", coordinates: [42.398986, 9.352358] },
    { id: 16, title: "Bedeno", description: "Harrar region sublocation", country: "Ethiopia", coordinates: [41.633611, 9.114345] },
    { id: 17, title: "Gomma", description: "Jimma region sublocation", country: "Ethiopia", coordinates: [36.66667, 7.83333] },
    { id: 18, title: "Mana", description: "Jimma region sublocation", country: "Ethiopia", coordinates: [36.75, 7.75] },
    { id: 19, title: "Limu Kosa", description: "Jimma region sublocation", country: "Ethiopia", coordinates: [37.1667, 8.1667] },
    { id: 20, title: "Agaro", description: "Jimma region sublocation", country: "Ethiopia", coordinates: [36.65, 7.85] },
    { id: 21, title: "Limu Seka", description: "Limu region sublocation", country: "Ethiopia", coordinates: [36.7254, 7.6016] },
    { id: 22, title: "Mizan Teferi", description: "Bench Maji region sublocation", country: "Ethiopia", coordinates: [35.5895, 6.9967] },
    { id: 23, title: "Wanale Ridge", description: "Mbale, Uganda", country: "Uganda", coordinates: [34.2, 1.0833] },
    { id: 24, title: "Bushika", description: "Mbale, Uganda", country: "Uganda", coordinates: [34.35, 1.0] },
    { id: 25, title: "Budadiri", description: "Mbale, Uganda", country: "Uganda", coordinates: [34.3333, 1.0833] },
    { id: 26, title: "Bufumbo", description: "Mbale, Uganda", country: "Uganda", coordinates: [34.2833, 1.0667] },
    { id: 27, title: "Sipi", description: "Bugisu, Uganda", country: "Uganda", coordinates: [34.3833, 1.3667] },
    { id: 28, title: "Kapchorwa", description: "Bugisu, Uganda", country: "Uganda", coordinates: [34.45, 1.3833] },
    { id: 29, title: "Buginyanya", description: "Bugisu, Uganda", country: "Uganda", coordinates: [34.4, 1.3667] },
    { id: 30, title: "Chema", description: "Bugisu, Uganda", country: "Uganda", coordinates: [34.4667, 1.3667] },
    { id: 31, title: "Teryet", description: "Bugisu, Uganda", country: "Uganda", coordinates: [34.4333, 1.4] },
    { id: 32, title: "Kasese", description: "Rwenzori, Uganda", country: "Uganda", coordinates: [30.0833, 0.1833] },
    { id: 33, title: "Bundibugyo", description: "Rwenzori, Uganda", country: "Uganda", coordinates: [30.0667, 0.7167] },
    { id: 34, title: "Kyarumba", description: "Rwenzori, Uganda", country: "Uganda", coordinates: [30.0333, 0.2333] },
    { id: 35, title: "Bwera", description: "Rwenzori, Uganda", country: "Uganda", coordinates: [29.9833, 0.0333] },
    { id: 36, title: "Nyamwamba", description: "Rwenzori, Uganda", country: "Uganda", coordinates: [30.0833, 0.2] },
    { id: 37, title: "Okoro", description: "West Nile, Uganda", country: "Uganda", coordinates: [30.9, 2.55] },
    { id: 38, title: "Nebbi", description: "West Nile, Uganda", country: "Uganda", coordinates: [31.09, 2.48] },
    { id: 39, title: "Paidha", description: "West Nile, Uganda", country: "Uganda", coordinates: [30.9833, 2.4167] },
    { id: 40, title: "Zombo", description: "West Nile, Uganda", country: "Uganda", coordinates: [30.9, 2.5167] },
    { id: 41, title: "Mukono", description: "Central, Uganda", country: "Uganda", coordinates: [32.7667, 0.35] },
    { id: 42, title: "Masaka", description: "Central, Uganda", country: "Uganda", coordinates: [31.7341, -0.3337] },
    { id: 43, title: "Jinja", description: "Central, Uganda", country: "Uganda", coordinates: [33.2034, 0.4344] },
    { id: 44, title: "Kangema", description: "Murang'a, Kenya", country: "Kenya", coordinates: [36.9667, 0.6833] },
    { id: 45, title: "Mathioya", description: "Murang'a, Kenya", country: "Kenya", coordinates: [37.25, -0.7167] },
    { id: 46, title: "Kigumo", description: "Murang'a, Kenya", country: "Kenya", coordinates: [36.962066, -0.801968] },
    { id: 47, title: "Kanyenyaini", description: "Murang'a, Kenya", country: "Kenya", coordinates: [36.892285, -0.688109] },
    { id: 48, title: "Gacharage", description: "Murang'a, Kenya", country: "Kenya", coordinates: [36.76054, -0.93141] },
    { id: 49, title: "Kianyaga", description: "Kirinyaga, Kenya", country: "Kenya", coordinates: [37.35027, -0.49546] },
    { id: 50, title: "Kabare", description: "Kirinyaga, Kenya", country: "Kenya", coordinates: [37.316666, -0.516667] },
    { id: 51, title: "Ngariama", description: "Kirinyaga, Kenya", country: "Kenya", coordinates: [37.4167, -0.5333] },
    { id: 52, title: "Baragwi", description: "Kirinyaga, Kenya", country: "Kenya", coordinates: [37.3333, -0.5] },
    { id: 53, title: "Karumandi", description: "Kirinyaga, Kenya", country: "Kenya", coordinates: [37.35, -0.45] },
    { id: 54, title: "Othaya", description: "Nyeri, Kenya", country: "Kenya", coordinates: [36.9609, 0.56515] },
    { id: 55, title: "Tetu", description: "Nyeri, Kenya", country: "Kenya", coordinates: [36.91681, -0.43419] },
    { id: 56, title: "Mukurwe-ini", description: "Nyeri, Kenya", country: "Kenya", coordinates: [37.04876, -0.56094] },
    { id: 57, title: "Karatina", description: "Nyeri, Kenya", country: "Kenya", coordinates: [37.1251, 0.4828] },
    { id: 58, title: "Githunguri", description: "Kiambu, Kenya", country: "Kenya", coordinates: [36.77485, -1.04458] },
    { id: 59, title: "Ruiru", description: "Kiambu, Kenya", country: "Kenya", coordinates: [36.9542, -1.1427] },
    { id: 60, title: "Thika", description: "Kiambu, Kenya", country: "Kenya", coordinates: [37.0693, -1.0333] },
    { id: 61, title: "Limuru", description: "Kiambu, Kenya", country: "Kenya", coordinates: [36.65, -1.1] },
    { id: 62, title: "Kabete", description: "Kiambu, Kenya", country: "Kenya", coordinates: [36.7167, -1.2667] },
    { id: 63, title: "Manyatta", description: "Embu, Kenya", country: "Kenya", coordinates: [37.47795, -0.43146] },
    { id: 64, title: "Runyenjes", description: "Embu, Kenya", country: "Kenya", coordinates: [37.57051, -0.42204] },
    { id: 65, title: "Igembe", description: "Meru, Kenya", country: "Kenya", coordinates: [37.96101, 0.18661] },
    { id: 66, title: "Tigania", description: "Meru, Kenya", country: "Kenya", coordinates: [37.79039, 0.19765] },
    { id: 67, title: "Buuri", description: "Meru, Kenya", country: "Kenya", coordinates: [37.645604, 0.051472] },
    { id: 68, title: "Nkubu", description: "Meru, Kenya", country: "Kenya", coordinates: [37.66618, -0.06929] },
    { id: 69, title: "Kangundo", description: "Machakos, Kenya", country: "Kenya", coordinates: [37.3471, -1.2979] },
    { id: 70, title: "Kathiani", description: "Machakos, Kenya", country: "Kenya", coordinates: [37.3323, -1.4121] },
    { id: 71, title: "Mwala", description: "Machakos, Kenya", country: "Kenya", coordinates: [37.45482, -1.35255] },
    { id: 72, title: "Nyamache", description: "Kisii, Kenya", country: "Kenya", coordinates: [34.82852, -0.85508] },
    { id: 73, title: "Masimba", description: "Kisii, Kenya", country: "Kenya", coordinates: [34.94006, -0.86079] },
    { id: 74, title: "Sameta", description: "Kisii, Kenya", country: "Kenya", coordinates: [34.75728, -0.78175] },
    { id: 75, title: "Gucha", description: "Kisii, Kenya", country: "Kenya", coordinates: [34.753, -0.845] },
    { id: 76, title: "Chepkube", description: "Bungoma, Kenya", country: "Kenya", coordinates: [34.43333, 0.85] },
    { id: 77, title: "Mt Elgon slopes", description: "Bungoma, Kenya", country: "Kenya", coordinates: [34.56028, 1.13778] },
    { id: 78, title: "Likuyani", description: "Kakamega, Kenya", country: "Kenya", coordinates: [35.13539, 0.75669] },
    { id: 79, title: "Malava", description: "Kakamega, Kenya", country: "Kenya", coordinates: [34.85414, 0.44504] },
    { id: 80, title: "Shinyalu", description: "Kakamega, Kenya", country: "Kenya", coordinates: [34.80807, 0.22396] },
    { id: 81, title: "Kongoni", description: "Kakamega, Kenya", country: "Kenya", coordinates: [35.10929, 0.75288] },
    { id: 82, title: "Solai", description: "Nakuru, Kenya", country: "Kenya", coordinates: [36.15291, 0.01698] },
    { id: 83, title: "Bahati", description: "Nakuru, Kenya", country: "Kenya", coordinates: [36.14634, -0.15407] },
    { id: 84, title: "Rongai", description: "Nakuru, Kenya", country: "Kenya", coordinates: [35.86382, 0.17333] },
    { id: 85, title: "Njoro", description: "Nakuru, Kenya", country: "Kenya", coordinates: [35.94445, -0.33024] },
    { id: 86, title: "Eldama Ravine", description: "Baringo, Kenya", country: "Kenya", coordinates: [35.717, 0.05] },
    { id: 87, title: "Mogotio", description: "Baringo, Kenya", country: "Kenya", coordinates: [35.97, -0.02] }
];

// State
let groves = [];
let map = null;
let markers = [];
let selectedGrove = null;
let filteredGroves = [];
let selectedCountry = 'all';
let selectedLayer = 'satellite';

// Country colors
const countryColors = {
    'Kenya': '#ef4444',
    'Uganda': '#3b82f6',
    'Ethiopia': '#10b981'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Grove Tracker...');
    console.log('Mapbox GL JS loaded:', typeof mapboxgl !== 'undefined');

    // Load hardcoded groves first
    loadHardcodedGroves();

    // Initialize map
    initializeMap();

    // Fetch API groves and merge
    fetchAndMergeAPIGroves();

    // Setup event listeners
    setupEventListeners();
});

// Load hardcoded groves immediately
function loadHardcodedGroves() {
    console.log('Loading hardcoded groves...');
    groves = [...HARDCODED_GROVES];
    filteredGroves = [...groves];
    renderGroveList();
    addMarkers();
    console.log('Loaded', groves.length, 'hardcoded groves');
}

// Fetch groves from API and merge with hardcoded data
async function fetchAndMergeAPIGroves() {
    try {
        console.log('Fetching groves from API...');
        const api = new CoffeeTreeAPI();
        const data = await api.request('/api/groves');

        if (data.success && data.groves && data.groves.length > 0) {
            console.log('Received', data.groves.length, 'groves from API');

            // Transform API data to match expected format
            const apiGroves = data.groves.map(grove => {
                // Handle different coordinate formats
                let coordinates = null;

                if (grove.coordinates) {
                    // Format from mock data: { lat: ..., lng: ... }
                    if (typeof grove.coordinates === 'object' && grove.coordinates.lat !== undefined) {
                        coordinates = [grove.coordinates.lng || 0, grove.coordinates.lat || 0];
                    }
                    // Format from some other sources: [lng, lat]
                    else if (Array.isArray(grove.coordinates)) {
                        coordinates = grove.coordinates;
                    }
                } else if (grove.latitude !== undefined && grove.longitude !== undefined) {
                    // Format from registration: latitude and longitude as separate fields
                    coordinates = [grove.longitude || 0, grove.latitude || 0];
                }

                // Skip groves without valid coordinates
                if (!coordinates || (coordinates[0] === 0 && coordinates[1] === 0)) {
                    console.warn('Grove without valid coordinates:', grove.groveName || grove.grove_name);
                    return null;
                }

                return {
                    id: `api-${grove.id}`, // Prefix to avoid ID conflicts
                    title: grove.groveName || grove.grove_name || 'Unnamed Grove',
                    description: grove.location || 'Unknown location',
                    country: grove.country || getCountryFromLocation(grove.location) || 'Unknown',
                    coordinates: coordinates,
                    source: 'api' // Mark as API grove
                };
            }).filter(grove => grove !== null); // Remove null entries

            // Merge API groves with hardcoded groves
            // API groves are added after hardcoded ones
            const mergedGroves = [...HARDCODED_GROVES, ...apiGroves];

            console.log('Merged groves:', mergedGroves.length, '(', HARDCODED_GROVES.length, 'hardcoded +', apiGroves.length, 'from API)');

            groves = mergedGroves;
            filteredGroves = [...groves];
            renderGroveList();
            addMarkers();
        } else {
            console.log('No additional groves from API, using hardcoded data only');
        }
    } catch (error) {
        console.error('Error fetching groves from API:', error);
        console.log('Continuing with hardcoded groves only');
    }
}

// Initialize Mapbox
function initializeMap() {
    console.log('Initializing map...');
    console.log('Access token:', mapboxgl.accessToken ? 'Set' : 'Not set');

    // Try custom style first, fallback to standard satellite if it fails
    const customStyle = 'mapbox://styles/henrybutnotdanger/cmgqmt1ga001c01sbcdaven4t';
    const fallbackStyle = 'mapbox://styles/mapbox/satellite-streets-v12';

    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: fallbackStyle, // Use fallback style for reliability
            center: [36, 2],
            zoom: 2, // Start more zoomed out to see globe effect
            projection: 'globe' // Globe projection for 3D Earth view
        });

        console.log('Map instance created with globe projection');

        map.on('load', () => {
            console.log('Map loaded successfully!');

            // Add atmospheric fog effect for globe
            map.setFog({
                color: 'rgb(186, 210, 235)', // Light blue
                'high-color': 'rgb(36, 92, 223)', // Dark blue
                'horizon-blend': 0.02, // Atmosphere thickness
                'space-color': 'rgb(11, 11, 25)', // Space color
                'star-intensity': 0.6 // Star brightness
            });
        });

        map.on('error', (e) => {
            console.error('Map error:', e);
            console.log('Reloading map...');

            // If there's an error, try reloading
            if (map) {
                map.remove();
            }

            map = new mapboxgl.Map({
                container: 'map',
                style: fallbackStyle,
                center: [36, 2],
                zoom: 2,
                projection: 'globe'
            });

            map.on('load', () => {
                console.log('Map reloaded with globe projection');
                map.setFog({
                    color: 'rgb(186, 210, 235)',
                    'high-color': 'rgb(36, 92, 223)',
                    'horizon-blend': 0.02,
                    'space-color': 'rgb(11, 11, 25)',
                    'star-intensity': 0.6
                });
            });
        });

    } catch (error) {
        console.error('Error initializing map:', error);
        console.log('Trying fallback with globe projection...');

        // Last resort: use standard Mapbox satellite style with globe
        try {
            map = new mapboxgl.Map({
                container: 'map',
                style: fallbackStyle,
                center: [36, 2],
                zoom: 2,
                projection: 'globe'
            });

            map.on('load', () => {
                console.log('Map loaded with globe projection (catch block)');
                map.setFog({
                    color: 'rgb(186, 210, 235)',
                    'high-color': 'rgb(36, 92, 223)',
                    'horizon-blend': 0.02,
                    'space-color': 'rgb(11, 11, 25)',
                    'star-intensity': 0.6
                });
            });
        } catch (fallbackError) {
            console.error('Failed to load map even with fallback:', fallbackError);
        }
    }
}

// Add markers to map
function addMarkers() {
    // Wait for map to be ready
    if (!map || !map.loaded()) {
        console.log('Map not ready, waiting...');
        if (map) {
            map.once('load', addMarkers);
        }
        return;
    }

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    let validMarkers = 0;
    let skippedMarkers = 0;

    filteredGroves.forEach(grove => {
        // Skip groves without valid coordinates
        if (!grove.coordinates || grove.coordinates.length !== 2) {
            skippedMarkers++;
            return;
        }

        const [lng, lat] = grove.coordinates;

        // Skip invalid coordinates
        if ((lng === 0 && lat === 0) ||
            lng < -180 || lng > 180 ||
            lat < -90 || lat > 90) {
            skippedMarkers++;
            return;
        }

        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.backgroundColor = countryColors[grove.country] || '#888888';

        // Add a subtle border for API groves
        if (grove.source === 'api') {
            el.style.border = '2px solid white';
        }

        const marker = new mapboxgl.Marker(el)
            .setLngLat(grove.coordinates)
            .addTo(map);

        el.addEventListener('click', () => selectGrove(grove));
        markers.push(marker);
        validMarkers++;
    });

    console.log(`Added ${validMarkers} markers to map (skipped ${skippedMarkers} invalid)`);
}

// Render grove list
function renderGroveList() {
    const container = document.getElementById('groveItems');

    if (filteredGroves.length === 0) {
        container.innerHTML = '<div class="no-results">No groves found</div>';
        return;
    }

    container.innerHTML = filteredGroves.map(grove => `
        <div class="grove-item ${selectedGrove?.id === grove.id ? 'selected' : ''}" 
             data-grove-id="${grove.id}">
            <div class="grove-header">
                <div class="country-badge country-${(grove.country || 'unknown').toLowerCase()}">
                    ${(grove.country || 'U')[0]}
                </div>
                <div class="grove-info">
                    <div class="grove-title">${grove.title}</div>
                    <div class="grove-description">${grove.description}</div>
                </div>
            </div>
        </div>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.grove-item').forEach(item => {
        item.addEventListener('click', () => {
            const groveId = parseInt(item.dataset.groveId);
            const grove = groves.find(g => g.id === groveId);
            if (grove) {
                selectGrove(grove);
            }
        });
    });
}

// Select grove
function selectGrove(grove) {
    console.log('Selecting grove:', grove.title, 'at coordinates:', grove.coordinates);
    selectedGrove = grove;

    // Update UI
    renderGroveList();

    // Always fly to location if coordinates exist
    if (grove.coordinates && grove.coordinates.length === 2) {
        // Check if coordinates are valid (not 0,0 and within reasonable bounds)
        const [lng, lat] = grove.coordinates;
        const isValid = !(lng === 0 && lat === 0) &&
            lng >= -180 && lng <= 180 &&
            lat >= -90 && lat <= 90;

        if (isValid) {
            console.log('Flying to coordinates:', grove.coordinates);
            map.flyTo({
                center: grove.coordinates,
                zoom: 14, // Closer zoom for better view
                duration: 2000,
                essential: true // This animation is considered essential
            });
        } else {
            console.warn('Invalid coordinates for grove:', grove.title, grove.coordinates);
        }
    } else {
        console.warn('No coordinates available for grove:', grove.title);
    }

    // Show info card
    showInfoCard(grove);
}

// Show info card
function showInfoCard(grove) {
    const infoCard = document.getElementById('infoCard');
    const badge = document.getElementById('infoCountryBadge');
    const title = document.getElementById('infoTitle');
    const country = document.getElementById('infoCountry');
    const description = document.getElementById('infoDescription');

    badge.className = `country-badge country-${(grove.country || 'unknown').toLowerCase()}`;
    badge.textContent = (grove.country || 'U')[0];
    title.textContent = grove.title;
    country.textContent = grove.country || 'Unknown';

    // Show coordinates if available
    let descriptionText = grove.description || 'No description available';
    if (grove.coordinates && grove.coordinates.length === 2) {
        const [lng, lat] = grove.coordinates;
        descriptionText += ` (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
    }
    if (grove.source === 'api') {
        descriptionText += ' [From API]';
    }
    description.textContent = descriptionText;

    infoCard.classList.add('visible');
}

// Filter groves
function filterGroves() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();

    filteredGroves = groves.filter(grove => {
        const matchesSearch = (grove.title || '').toLowerCase().includes(searchQuery) ||
            (grove.description || '').toLowerCase().includes(searchQuery) ||
            (grove.country || '').toLowerCase().includes(searchQuery);

        const matchesCountry = selectedCountry === 'all' || grove.country === selectedCountry;

        return matchesSearch && matchesCountry;
    });

    renderGroveList();
    addMarkers();
}

// Setup event listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', filterGroves);

    // Country filters
    document.querySelectorAll('#countryFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#countryFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCountry = btn.dataset.country;
            filterGroves();
        });
    });

    // Layer filters
    document.querySelectorAll('#layerFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#layerFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedLayer = btn.dataset.layer;

            // Change map style based on layer
            try {
                if (selectedLayer === 'terrain') {
                    map.setStyle('mapbox://styles/mapbox/outdoors-v12');
                } else {
                    // Use fallback satellite style for reliability
                    map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
                }

                // Re-add markers after style change
                map.once('style.load', () => {
                    addMarkers();
                    console.log('Style changed and markers re-added');
                });
            } catch (error) {
                console.error('Error changing map style:', error);
            }
        });
    });

    // Toggle sidebar
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');

        // Update icon
        if (sidebar.classList.contains('collapsed')) {
            toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
        } else {
            toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>';
        }
    });
}

// Helper function to extract country from location string
function getCountryFromLocation(location) {
    if (!location) return 'Unknown';

    const locationStr = location.toLowerCase();
    if (locationStr.includes('kenya')) return 'Kenya';
    if (locationStr.includes('uganda')) return 'Uganda';
    if (locationStr.includes('ethiopia')) return 'Ethiopia';
    if (locationStr.includes('mukurweini')) return 'Kenya'; // Mukurweini is in Kenya

    return 'Unknown';
}
