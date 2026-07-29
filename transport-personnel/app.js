const STORAGE_KEY = "navetteops-prototype-v1";
const DEPOT = { name: "Mhamid — Départ principal", lat: 31.5623, lng: -8.0587 };
const ROUTE_COLORS = ["#1273eb", "#12b8a6", "#ff9f43", "#7a64f8", "#ee5d68", "#20a4b8"];

const DEFAULT_DATA = {
  points: [
    { id: "p1", name: "Mhamid 10", address: "Avenue Guemassa, Mhamid 10", lat: 31.5559, lng: -8.0671, operators: 8, time: "05:12", note: "Près de la pharmacie" },
    { id: "p2", name: "Mhamid Bouaakaz", address: "Route de Bouaakaz", lat: 31.5486, lng: -8.0738, operators: 6, time: "05:18", note: "" },
    { id: "p3", name: "Socoma", address: "Quartier industriel Socoma", lat: 31.5795, lng: -8.0541, operators: 5, time: "05:27", note: "Entrée principale" },
    { id: "p4", name: "Sidi Youssef", address: "Sidi Youssef Ben Ali", lat: 31.6110, lng: -7.9649, operators: 7, time: "05:36", note: "" },
    { id: "p5", name: "Afak", address: "Quartier Afak, Marrakech", lat: 31.5838, lng: -8.0758, operators: 4, time: "05:22", note: "" },
    { id: "p6", name: "Bab Doukkala", address: "Bab Doukkala, Marrakech", lat: 31.6362, lng: -7.9993, operators: 9, time: "05:38", note: "Arrêt devant la gare routière" },
    { id: "p7", name: "Massira 1", address: "Avenue Massira 1", lat: 31.6271, lng: -8.0363, operators: 7, time: "05:29", note: "" },
    { id: "p8", name: "Massira 2", address: "Quartier Massira 2", lat: 31.6240, lng: -8.0479, operators: 6, time: "05:25", note: "" },
    { id: "p9", name: "Massira 3", address: "Quartier Massira 3", lat: 31.6179, lng: -8.0560, operators: 5, time: "05:21", note: "" },
    { id: "p10", name: "Fakhara", address: "Hay Fakhara, Marrakech", lat: 31.6613, lng: -7.9894, operators: 3, time: "05:43", note: "Petit accès" },
    { id: "p11", name: "Dar Salam", address: "Douar Dar Salam", lat: 31.5903, lng: -8.0268, operators: 8, time: "05:31", note: "" }
  ],
  vehicles: [
    { id: "v1", name: "Bus 01", type: "Bus", capacity: 35, driver: "Youssef El Amrani", status: "Disponible" },
    { id: "v2", name: "Bus 02", type: "Bus", capacity: 35, driver: "Rachid Bennis", status: "Disponible" },
    { id: "v3", name: "Minibus 01", type: "Minibus", capacity: 19, driver: "Karim Alaoui", status: "Disponible" },
    { id: "v4", name: "Minibus 02", type: "Minibus", capacity: 19, driver: "Nabil Idrissi", status: "Maintenance" }
  ],
  assignments: [],
  routes: []
};

let state = loadState();
let map;
let mapLayers = [];
let toastTimer;

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
  renderAll();
  if (state.assignments.length) buildRoutesFromAssignments(false);
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.points) ? saved : structuredClone(DEFAULT_DATA);
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  document.querySelectorAll('[data-action="optimize"]').forEach(button => button.addEventListener("click", optimizeRoutes));
  document.querySelectorAll('[data-action="scenarios"]').forEach(button => button.addEventListener("click", calculateScenarios));
  document.getElementById("pointSearch").addEventListener("input", renderPoints);
  document.getElementById("addPoint").addEventListener("click", () => openPointDialog());
  document.getElementById("addVehicle").addEventListener("click", () => openVehicleDialog());
  document.getElementById("pointForm").addEventListener("submit", savePoint);
  document.getElementById("vehicleForm").addEventListener("submit", saveVehicle);
  document.getElementById("fitMap").addEventListener("click", fitMap);
  document.getElementById("exportAssignments").addEventListener("click", exportAssignments);
  document.getElementById("resetData").addEventListener("click", resetData);
  document.getElementById("mobileMenu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
    document.querySelector(".sidebar").classList.remove("open");
  }));
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView([31.60, -8.03], 12);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
}

function renderAll() {
  renderPoints();
  renderVehicles();
  renderAssignments();
  renderRoutes();
  renderMetrics();
  renderMap();
}

function renderPoints() {
  const query = document.getElementById("pointSearch")?.value.trim().toLowerCase() || "";
  const points = state.points.filter(point => `${point.name} ${point.address}`.toLowerCase().includes(query));
  document.getElementById("pointsTable").innerHTML = points.map((point, index) => `
    <tr>
      <td><span class="point-index">${String(index + 1).padStart(2, "0")}</span></td>
      <td><div class="point-name">${escapeHtml(point.name)}</div></td>
      <td title="${escapeHtml(point.address)}">${escapeHtml(point.address)}</td>
      <td><input class="operator-input" type="number" min="0" value="${point.operators}" aria-label="Opérateurs à ${escapeHtml(point.name)}" onchange="updateOperatorCount('${point.id}', this.value)"></td>
      <td>${escapeHtml(point.time)}</td>
      <td>${escapeHtml(point.note || "—")}</td>
      <td>
        <button class="row-action" onclick="openPointDialog('${point.id}')" title="Modifier">✎</button>
        <button class="row-action danger" onclick="deletePoint('${point.id}')" title="Supprimer">×</button>
      </td>
    </tr>`).join("");

  const total = totalOperators();
  document.getElementById("tableOperatorTotal").textContent = `${total} opérateur${total > 1 ? "s" : ""}`;
}

function renderVehicles() {
  document.getElementById("vehicleGrid").innerHTML = state.vehicles.map((vehicle, index) => {
    const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
    const statusClass = vehicle.status === "Disponible" ? "status-disponible" : vehicle.status === "En mission" ? "status-mission" : "status-maintenance";
    const route = state.routes.find(item => item.vehicleId === vehicle.id);
    return `
      <article class="vehicle-card" style="--vehicle-color:${color}">
        <div class="vehicle-top">
          <div class="vehicle-symbol">${vehicle.type === "Bus" ? "▰" : "▣"}</div>
          <span class="status-badge ${statusClass}">${escapeHtml(vehicle.status)}</span>
        </div>
        <h4>${escapeHtml(vehicle.name)}</h4>
        <span class="vehicle-type">${escapeHtml(vehicle.type)} · ${vehicle.capacity} places</span>
        <div class="vehicle-details">
          <div><span>Chauffeur</span><strong>${escapeHtml(vehicle.driver)}</strong></div>
          <div><span>Charge actuelle</span><strong>${route ? `${route.passengers} / ${vehicle.capacity}` : `0 / ${vehicle.capacity}`}</strong></div>
        </div>
        <div class="vehicle-actions">
          <button onclick="openVehicleDialog('${vehicle.id}')">Modifier</button>
          <button onclick="toggleVehicleStatus('${vehicle.id}')">${vehicle.status === "Maintenance" ? "Rendre disponible" : "Changer statut"}</button>
          <button onclick="deleteVehicle('${vehicle.id}')" title="Supprimer">×</button>
        </div>
      </article>`;
  }).join("");
}

function renderAssignments() {
  const tbody = document.getElementById("assignmentsTable");
  if (!state.assignments.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="table-empty">Lancez l’optimisation pour créer les affectations.</div></td></tr>';
    return;
  }

  const ordered = [...state.assignments].sort((a, b) => a.vehicleId.localeCompare(b.vehicleId) || a.order - b.order);
  tbody.innerHTML = ordered.map(assignment => {
    const point = state.points.find(item => item.id === assignment.pointId);
    const vehicle = state.vehicles.find(item => item.id === assignment.vehicleId);
    if (!point || !vehicle) return "";
    const vehicleIndex = state.vehicles.findIndex(item => item.id === vehicle.id);
    const options = state.vehicles.filter(item => item.status !== "Maintenance").map(item =>
      `<option value="${item.id}" ${item.id === vehicle.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    return `
      <tr>
        <td>
          <div class="assignment-vehicle" style="--vehicle-color:${ROUTE_COLORS[vehicleIndex % ROUTE_COLORS.length]}"><i></i>
            <select class="assignment-select" onchange="manualReassign('${assignment.id}', this.value)">${options}</select>
          </div>
        </td>
        <td><span class="point-index">${String(assignment.order).padStart(2, "0")}</span></td>
        <td><strong>${escapeHtml(point.name)}</strong></td>
        <td>${assignment.operators}</td>
        <td>${assignment.loadAfter} / ${vehicle.capacity}</td>
        <td>${assignment.distance.toFixed(1)} km</td>
        <td>${escapeHtml(point.time)}</td>
      </tr>`;
  }).join("");
}

function renderRoutes() {
  document.getElementById("routeCount").textContent = state.routes.length;
  const routeList = document.getElementById("routeList");
  if (!state.routes.length) {
    routeList.innerHTML = '<div class="empty-state"><span>⌁</span><h4>Aucun circuit calculé</h4><p>Lancez l’optimisation pour générer les itinéraires.</p></div>';
    document.getElementById("mapLegend").innerHTML = "";
    return;
  }

  routeList.innerHTML = state.routes.map(route => {
    const vehicle = state.vehicles.find(item => item.id === route.vehicleId);
    const path = route.stops.map(stop => state.points.find(point => point.id === stop.pointId)?.name).filter(Boolean);
    const fill = Math.min(100, Math.round(route.passengers / vehicle.capacity * 100));
    return `
      <article class="route-card" style="--route-color:${route.color}">
        <div class="route-title"><strong>${escapeHtml(vehicle.name)}</strong><span>${fill}% rempli</span></div>
        <div class="route-driver">Chauffeur · ${escapeHtml(vehicle.driver)}</div>
        <div class="route-stats">
          <div><span>Passagers</span><b>${route.passengers}</b></div>
          <div><span>Distance</span><b>${route.distance.toFixed(1)} km</b></div>
          <div><span>Durée</span><b>${route.duration} min</b></div>
        </div>
        <div class="route-path"><i></i><span>${path.map(escapeHtml).join(" → ")}</span></div>
        <div class="fill-bar"><span style="width:${fill}%"></span></div>
      </article>`;
  }).join("");

  document.getElementById("mapLegend").innerHTML = state.routes.map(route => {
    const vehicle = state.vehicles.find(item => item.id === route.vehicleId);
    return `<span class="legend-item"><i style="background:${route.color}"></i>${escapeHtml(vehicle.name)}</span>`;
  }).join("");
}

function renderMetrics() {
  const total = totalOperators();
  const available = state.vehicles.filter(vehicle => vehicle.status !== "Maintenance").length;
  const used = state.routes.length;
  const distance = state.routes.reduce((sum, route) => sum + route.distance, 0);
  const duration = state.routes.reduce((sum, route) => sum + route.duration, 0);
  const fills = state.routes.map(route => {
    const vehicle = state.vehicles.find(item => item.id === route.vehicleId);
    return vehicle ? route.passengers / vehicle.capacity * 100 : 0;
  });
  const averageFill = fills.length ? Math.round(fills.reduce((sum, value) => sum + value, 0) / fills.length) : 0;

  document.getElementById("totalOperators").textContent = total;
  document.getElementById("operatorTrend").textContent = `${state.points.filter(point => point.operators > 0).length} points actifs`;
  document.getElementById("usedVehicles").textContent = used;
  document.getElementById("fleetSummary").textContent = `sur ${available} disponible${available > 1 ? "s" : ""}`;
  document.getElementById("totalDistance").textContent = distance.toFixed(1);
  document.getElementById("totalDuration").textContent = duration;
  document.getElementById("distanceSaving").textContent = distance ? "Circuit global optimisé" : "À calculer";
  document.getElementById("averageFill").textContent = `Remplissage moyen ${averageFill || "—"}${averageFill ? "%" : ""}`;
  const vehiclePercentage = available ? Math.round(used / available * 100) : 0;
  const ring = document.getElementById("vehicleRing");
  ring.style.setProperty("--ring", `${Math.min(360, vehiclePercentage * 3.6)}deg`);
  ring.querySelector("b").textContent = `${vehiclePercentage}%`;
}

function renderMap() {
  mapLayers.forEach(layer => map.removeLayer(layer));
  mapLayers = [];

  const depotIcon = L.divIcon({ className: "depot-marker", html: "<span>⌂</span>", iconSize: [34, 34], iconAnchor: [17, 17] });
  addMapLayer(L.marker([DEPOT.lat, DEPOT.lng], { icon: depotIcon }).bindPopup(`<div class="map-popup"><strong>${DEPOT.name}</strong><span>Centre de départ des circuits</span></div>`));

  if (!state.routes.length) {
    state.points.forEach((point, index) => {
      const marker = createPointMarker(point, index + 1, "#1273eb");
      addMapLayer(marker);
    });
    fitMap();
    return;
  }

  state.routes.forEach(route => {
    const coordinates = [[DEPOT.lat, DEPOT.lng]];
    route.stops.forEach((stop, index) => {
      const point = state.points.find(item => item.id === stop.pointId);
      if (!point) return;
      coordinates.push([point.lat, point.lng]);
      addMapLayer(createPointMarker(point, index + 1, route.color, stop.operators));
    });
    coordinates.push([DEPOT.lat, DEPOT.lng]);
    addMapLayer(L.polyline(coordinates, { color: route.color, weight: 4, opacity: .82, dashArray: "1, 0" }));
    if (coordinates[1]) {
      const mid = coordinates[Math.max(1, Math.floor((coordinates.length - 1) / 2))];
      const vehicle = state.vehicles.find(item => item.id === route.vehicleId);
      const icon = L.divIcon({ className: "vehicle-marker", html: "<span>▰</span>", iconSize: [29, 29], iconAnchor: [15, 15] });
      addMapLayer(L.marker(mid, { icon }).bindPopup(`<div class="map-popup"><strong>${escapeHtml(vehicle.name)}</strong><span>${route.passengers} passagers · ${route.distance.toFixed(1)} km</span></div>`));
    }
  });
  fitMap();
}

function addMapLayer(layer) {
  layer.addTo(map);
  mapLayers.push(layer);
}

function createPointMarker(point, number, color, assignedOperators) {
  const icon = L.divIcon({
    className: "number-marker",
    html: `<span style="background:${color}"><b>${number}</b></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26]
  });
  return L.marker([point.lat, point.lng], { icon }).bindPopup(`
    <div class="map-popup">
      <strong>${escapeHtml(point.name)}</strong>
      <span>${escapeHtml(point.address)}</span>
      <span>${assignedOperators ?? point.operators} opérateurs · Passage ${escapeHtml(point.time)}</span>
    </div>`);
}

function fitMap() {
  const coordinates = [[DEPOT.lat, DEPOT.lng], ...state.points.map(point => [point.lat, point.lng])];
  if (coordinates.length) map.fitBounds(coordinates, { padding: [28, 28], maxZoom: 13 });
}

function totalOperators() {
  return state.points.reduce((sum, point) => sum + Math.max(0, Number(point.operators) || 0), 0);
}

function updateOperatorCount(pointId, value) {
  const point = state.points.find(item => item.id === pointId);
  if (!point) return;
  point.operators = Math.max(0, Number(value) || 0);
  state.assignments = [];
  state.routes = [];
  saveState();
  renderAll();
  showToast("Effectif mis à jour. Relancez l’optimisation.");
}

function optimizeRoutes() {
  const availableVehicles = state.vehicles
    .filter(vehicle => vehicle.status === "Disponible")
    .sort((a, b) => b.capacity - a.capacity);
  const activePoints = state.points.filter(point => point.operators > 0);
  const total = totalOperators();
  if (!activePoints.length) return showToast("Ajoutez au moins un opérateur.");
  if (!availableVehicles.length) return showToast("Aucun véhicule disponible.");
  if (availableVehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0) < total) {
    showToast("Capacité insuffisante : ajoutez ou rendez disponible un véhicule.");
    return;
  }

  const selectedVehicles = selectVehicles(availableVehicles, total);
  const clusters = selectedVehicles.map(vehicle => ({ vehicle, remaining: vehicle.capacity, stops: [] }));
  const sortedPoints = [...activePoints].sort((a, b) => distanceKm(DEPOT, b) - distanceKm(DEPOT, a));

  sortedPoints.forEach(point => {
    let remainingOperators = point.operators;
    while (remainingOperators > 0) {
      const candidates = clusters
        .filter(cluster => cluster.remaining > 0)
        .sort((a, b) => clusterScore(a, point) - clusterScore(b, point));
      if (!candidates.length) break;
      const target = candidates[0];
      const assigned = Math.min(target.remaining, remainingOperators);
      target.stops.push({ pointId: point.id, operators: assigned });
      target.remaining -= assigned;
      remainingOperators -= assigned;
    }
  });

  state.assignments = [];
  clusters.forEach(cluster => {
    cluster.stops = nearestNeighbor(cluster.stops);
    let load = 0;
    let previous = DEPOT;
    cluster.stops.forEach((stop, index) => {
      const point = state.points.find(item => item.id === stop.pointId);
      load += stop.operators;
      state.assignments.push({
        id: uid("a"),
        vehicleId: cluster.vehicle.id,
        pointId: stop.pointId,
        operators: stop.operators,
        order: index + 1,
        loadAfter: load,
        distance: distanceKm(previous, point) * 1.25
      });
      previous = point;
    });
  });
  buildRoutesFromAssignments(true);
  calculateScenarios(false);
  showToast(`${state.routes.length} circuit${state.routes.length > 1 ? "s" : ""} optimisé${state.routes.length > 1 ? "s" : ""}.`);
  document.getElementById("map-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectVehicles(vehicles, passengers) {
  const combinations = [];
  const maxMask = 1 << vehicles.length;
  for (let mask = 1; mask < maxMask; mask += 1) {
    const selection = vehicles.filter((_, index) => mask & (1 << index));
    const capacity = selection.reduce((sum, vehicle) => sum + vehicle.capacity, 0);
    if (capacity >= passengers) combinations.push({ selection, capacity, waste: capacity - passengers });
  }
  combinations.sort((a, b) => a.selection.length - b.selection.length || a.waste - b.waste);
  return combinations[0]?.selection || vehicles;
}

function clusterScore(cluster, point) {
  if (!cluster.stops.length) return distanceKm(DEPOT, point) - cluster.remaining * .01;
  const lastPoint = state.points.find(item => item.id === cluster.stops.at(-1).pointId);
  return distanceKm(lastPoint, point) + (cluster.remaining < point.operators ? 5 : 0);
}

function nearestNeighbor(stops) {
  if (stops.length < 2) return stops;
  const remaining = [...stops];
  const ordered = [];
  let current = DEPOT;
  while (remaining.length) {
    remaining.sort((a, b) => {
      const pointA = state.points.find(point => point.id === a.pointId);
      const pointB = state.points.find(point => point.id === b.pointId);
      return distanceKm(current, pointA) - distanceKm(current, pointB);
    });
    const next = remaining.shift();
    ordered.push(next);
    current = state.points.find(point => point.id === next.pointId);
  }
  return ordered;
}

function buildRoutesFromAssignments(persist = true) {
  const grouped = Object.groupBy
    ? Object.groupBy(state.assignments, assignment => assignment.vehicleId)
    : state.assignments.reduce((result, assignment) => {
        (result[assignment.vehicleId] ||= []).push(assignment);
        return result;
      }, {});

  state.routes = Object.entries(grouped).map(([vehicleId, assignments], routeIndex) => {
    const ordered = assignments.sort((a, b) => a.order - b.order);
    let previous = DEPOT;
    let distance = 0;
    ordered.forEach(assignment => {
      const point = state.points.find(item => item.id === assignment.pointId);
      distance += distanceKm(previous, point) * 1.25;
      previous = point;
    });
    distance += distanceKm(previous, DEPOT) * 1.25;
    const passengers = ordered.reduce((sum, assignment) => sum + assignment.operators, 0);
    return {
      vehicleId,
      color: ROUTE_COLORS[state.vehicles.findIndex(vehicle => vehicle.id === vehicleId) % ROUTE_COLORS.length] || ROUTE_COLORS[routeIndex],
      passengers,
      distance,
      duration: Math.round(distance / 26 * 60 + ordered.length * 3),
      stops: ordered.map(assignment => ({ pointId: assignment.pointId, operators: assignment.operators }))
    };
  });
  if (persist) saveState();
  renderAll();
}

function manualReassign(assignmentId, newVehicleId) {
  const assignment = state.assignments.find(item => item.id === assignmentId);
  const vehicle = state.vehicles.find(item => item.id === newVehicleId);
  if (!assignment || !vehicle) return;
  const existingLoad = state.assignments
    .filter(item => item.vehicleId === newVehicleId && item.id !== assignmentId)
    .reduce((sum, item) => sum + item.operators, 0);
  if (existingLoad + assignment.operators > vehicle.capacity) {
    renderAssignments();
    return showToast(`Capacité de ${vehicle.name} dépassée.`);
  }
  assignment.vehicleId = newVehicleId;
  reorderAssignments();
  buildRoutesFromAssignments(true);
  showToast("Affectation manuelle enregistrée.");
}

function reorderAssignments() {
  const vehicleIds = [...new Set(state.assignments.map(item => item.vehicleId))];
  vehicleIds.forEach(vehicleId => {
    let load = 0;
    let previous = DEPOT;
    const assignments = state.assignments.filter(item => item.vehicleId === vehicleId);
    const orderedStops = nearestNeighbor(assignments.map(item => ({ pointId: item.pointId, operators: item.operators, assignment: item })));
    orderedStops.forEach((stop, index) => {
      const assignment = stop.assignment;
      const point = state.points.find(item => item.id === assignment.pointId);
      load += assignment.operators;
      assignment.order = index + 1;
      assignment.loadAfter = load;
      assignment.distance = distanceKm(previous, point) * 1.25;
      previous = point;
    });
  });
}

function calculateScenarios(showMessage = true) {
  const total = totalOperators();
  const buses = state.vehicles.filter(vehicle => vehicle.type === "Bus" && vehicle.status === "Disponible");
  const minibuses = state.vehicles.filter(vehicle => vehicle.type === "Minibus" && vehicle.status === "Disponible");
  const available = [...buses, ...minibuses];
  const scenarios = [];

  if (total < 20 && minibuses.length) {
    scenarios.push({ title: "Minibus unique", description: "Un seul minibus couvre tous les points avec un coût d'exploitation minimal.", vehicles: 1, capacity: minibuses[0].capacity, score: 94 });
  } else if (total <= 35 && buses.length) {
    scenarios.push({ title: "Bus unique", description: "Un bus dessert la totalité des points avec un circuit compact.", vehicles: 1, capacity: buses[0].capacity, score: 92 });
  } else if (total <= 50 && buses.length && minibuses.length) {
    scenarios.push({ title: "Bus + minibus", description: "Répartition équilibrée entre les zones proches et les points périphériques.", vehicles: 2, capacity: buses[0].capacity + minibuses[0].capacity, score: 96 });
  } else {
    const chosen = selectVehicles(available, total);
    scenarios.push({ title: "Flotte multi-véhicules", description: "Combinaison minimale de véhicules couvrant l'ensemble des opérateurs.", vehicles: chosen.length, capacity: chosen.reduce((sum, vehicle) => sum + vehicle.capacity, 0), score: 93 });
  }

  const capacityFirst = [...available].sort((a, b) => b.capacity - a.capacity);
  const compactSelection = selectVehicles(capacityFirst, total);
  const proximityGroups = geographicGroups(state.points.filter(point => point.operators > 0), 3.5);
  scenarios.push(
    {
      title: "Priorité au remplissage",
      description: "Maximise le taux de remplissage et limite le nombre de véhicules engagés.",
      vehicles: compactSelection.length,
      capacity: compactSelection.reduce((sum, vehicle) => sum + vehicle.capacity, 0),
      score: 88
    },
    {
      title: "Regroupement géographique",
      description: `${proximityGroups} zones proches sont regroupées pour réduire les détours entre arrêts.`,
      vehicles: Math.min(available.length, Math.max(1, proximityGroups)),
      capacity: available.reduce((sum, vehicle) => sum + vehicle.capacity, 0),
      score: 90
    }
  );

  if (state.vehicles.some(vehicle => vehicle.status === "Maintenance")) {
    scenarios.push({
      title: "Continuité en cas de panne",
      description: "Les passagers du véhicule indisponible sont absorbés par la flotte opérationnelle.",
      vehicles: compactSelection.length,
      capacity: compactSelection.reduce((sum, vehicle) => sum + vehicle.capacity, 0),
      score: compactSelection.reduce((sum, vehicle) => sum + vehicle.capacity, 0) >= total ? 84 : 45
    });
  }

  document.getElementById("scenarioGrid").innerHTML = scenarios.map((scenario, index) => {
    const fill = scenario.capacity ? Math.round(total / scenario.capacity * 100) : 0;
    return `
      <article class="scenario-card ${index === 0 ? "recommended" : ""}">
        ${index === 0 ? '<span class="recommend-badge">Recommandé</span>' : ""}
        <span class="scenario-number">Scénario ${index + 1}</span>
        <h4>${escapeHtml(scenario.title)}</h4>
        <p>${escapeHtml(scenario.description)}</p>
        <div class="scenario-metrics">
          <div><span>Véhicules</span><strong>${scenario.vehicles}</strong></div>
          <div><span>Remplissage</span><strong>${Math.min(100, fill)}%</strong></div>
          <div><span>Score</span><strong>${scenario.score}/100</strong></div>
        </div>
      </article>`;
  }).join("");
  if (showMessage) {
    showToast(`${scenarios.length} scénarios comparés.`);
    document.getElementById("scenarios-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function geographicGroups(points, thresholdKm) {
  const unvisited = new Set(points.map(point => point.id));
  let groups = 0;
  while (unvisited.size) {
    groups += 1;
    const firstId = unvisited.values().next().value;
    const queue = [state.points.find(point => point.id === firstId)];
    unvisited.delete(firstId);
    while (queue.length) {
      const current = queue.shift();
      [...unvisited].forEach(id => {
        const candidate = state.points.find(point => point.id === id);
        if (distanceKm(current, candidate) <= thresholdKm) {
          unvisited.delete(id);
          queue.push(candidate);
        }
      });
    }
  }
  return groups;
}

function distanceKm(a, b) {
  const earthRadius = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function openPointDialog(pointId) {
  const point = state.points.find(item => item.id === pointId);
  document.getElementById("pointDialogTitle").textContent = point ? "Modifier le point" : "Ajouter un point";
  document.getElementById("pointId").value = point?.id || "";
  document.getElementById("pointName").value = point?.name || "";
  document.getElementById("pointAddress").value = point?.address || "";
  document.getElementById("pointLat").value = point?.lat || 31.58;
  document.getElementById("pointLng").value = point?.lng || -8.03;
  document.getElementById("pointOperators").value = point?.operators ?? 0;
  document.getElementById("pointTime").value = point?.time || "05:30";
  document.getElementById("pointNote").value = point?.note || "";
  document.getElementById("pointDialog").showModal();
}

function savePoint(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const id = document.getElementById("pointId").value || uid("p");
  const point = {
    id,
    name: document.getElementById("pointName").value.trim(),
    address: document.getElementById("pointAddress").value.trim(),
    lat: Number(document.getElementById("pointLat").value),
    lng: Number(document.getElementById("pointLng").value),
    operators: Math.max(0, Number(document.getElementById("pointOperators").value)),
    time: document.getElementById("pointTime").value,
    note: document.getElementById("pointNote").value.trim()
  };
  const index = state.points.findIndex(item => item.id === id);
  if (index >= 0) state.points[index] = point;
  else state.points.push(point);
  state.assignments = [];
  state.routes = [];
  saveState();
  document.getElementById("pointDialog").close();
  renderAll();
  showToast("Point de ramassage enregistré.");
}

function deletePoint(pointId) {
  const point = state.points.find(item => item.id === pointId);
  if (!point || !confirm(`Supprimer ${point.name} ?`)) return;
  state.points = state.points.filter(item => item.id !== pointId);
  state.assignments = [];
  state.routes = [];
  saveState();
  renderAll();
  showToast("Point supprimé.");
}

function openVehicleDialog(vehicleId) {
  const vehicle = state.vehicles.find(item => item.id === vehicleId);
  document.getElementById("vehicleDialogTitle").textContent = vehicle ? "Modifier le véhicule" : "Ajouter un véhicule";
  document.getElementById("vehicleId").value = vehicle?.id || "";
  document.getElementById("vehicleName").value = vehicle?.name || "";
  document.getElementById("vehicleType").value = vehicle?.type || "Bus";
  document.getElementById("vehicleCapacity").value = vehicle?.capacity || 35;
  document.getElementById("vehicleDriver").value = vehicle?.driver || "";
  document.getElementById("vehicleStatus").value = vehicle?.status || "Disponible";
  document.getElementById("vehicleDialog").showModal();
}

function saveVehicle(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const id = document.getElementById("vehicleId").value || uid("v");
  const vehicle = {
    id,
    name: document.getElementById("vehicleName").value.trim(),
    type: document.getElementById("vehicleType").value,
    capacity: Math.max(1, Number(document.getElementById("vehicleCapacity").value)),
    driver: document.getElementById("vehicleDriver").value.trim(),
    status: document.getElementById("vehicleStatus").value
  };
  const index = state.vehicles.findIndex(item => item.id === id);
  if (index >= 0) state.vehicles[index] = vehicle;
  else state.vehicles.push(vehicle);
  state.assignments = [];
  state.routes = [];
  saveState();
  document.getElementById("vehicleDialog").close();
  renderAll();
  showToast("Véhicule enregistré.");
}

function toggleVehicleStatus(vehicleId) {
  const vehicle = state.vehicles.find(item => item.id === vehicleId);
  if (!vehicle) return;
  const statuses = ["Disponible", "En mission", "Maintenance"];
  vehicle.status = statuses[(statuses.indexOf(vehicle.status) + 1) % statuses.length];
  state.assignments = [];
  state.routes = [];
  saveState();
  renderAll();
  showToast(`${vehicle.name} : ${vehicle.status}.`);
}

function deleteVehicle(vehicleId) {
  const vehicle = state.vehicles.find(item => item.id === vehicleId);
  if (!vehicle || !confirm(`Supprimer ${vehicle.name} ?`)) return;
  state.vehicles = state.vehicles.filter(item => item.id !== vehicleId);
  state.assignments = [];
  state.routes = [];
  saveState();
  renderAll();
  showToast("Véhicule supprimé.");
}

function exportAssignments() {
  if (!state.assignments.length) return showToast("Aucune affectation à exporter.");
  const header = ["Véhicule", "Ordre", "Point", "Opérateurs", "Charge", "Distance km", "Passage"];
  const rows = state.assignments.map(assignment => {
    const vehicle = state.vehicles.find(item => item.id === assignment.vehicleId);
    const point = state.points.find(item => item.id === assignment.pointId);
    return [vehicle.name, assignment.order, point.name, assignment.operators, assignment.loadAfter, assignment.distance.toFixed(1), point.time];
  });
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "affectations-navetteops.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Export CSV généré.");
}

function resetData() {
  if (!confirm("Réinitialiser toutes les données du prototype ?")) return;
  state = structuredClone(DEFAULT_DATA);
  saveState();
  renderAll();
  document.getElementById("scenarioGrid").innerHTML = '<article class="scenario-placeholder"><span>✦</span><p>Calculez les scénarios pour afficher les recommandations.</p></article>';
  showToast("Données initiales restaurées.");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

window.updateOperatorCount = updateOperatorCount;
window.openPointDialog = openPointDialog;
window.deletePoint = deletePoint;
window.openVehicleDialog = openVehicleDialog;
window.toggleVehicleStatus = toggleVehicleStatus;
window.deleteVehicle = deleteVehicle;
window.manualReassign = manualReassign;
