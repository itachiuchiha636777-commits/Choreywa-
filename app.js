const API_BASE = "";
let token = localStorage.getItem("rentToken") || null;
let user = JSON.parse(localStorage.getItem("rentUser")) || null;
let userCoords = { lat: null, lng: null };
let houseCoords = { lat: null, lng: null };

function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
}

window.onload = () => {
  if (token && user) initApp();
};

function switchTab(tab, btn) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".form")
    .forEach((f) => f.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(tab + "Form").classList.add("active");
}

async function handleSignup(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById("signName").value,
    email: document.getElementById("signEmail").value,
    phone: document.getElementById("signPhone").value,
    password: document.getElementById("signPass").value,
    role: document.getElementById("signRole").value,
  };
  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("rentToken", data.token);
    localStorage.setItem("rentUser", JSON.stringify(data.user));
    token = data.token;
    user = data.user;
    initApp();
  } else showToast(data.message);
}

async function handleLogin(e) {
  e.preventDefault();
  const body = {
    email: document.getElementById("loginEmail").value,
    password: document.getElementById("loginPass").value,
  };
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("rentToken", data.token);
    localStorage.setItem("rentUser", JSON.stringify(data.user));
    token = data.token;
    user = data.user;
    initApp();
  } else showToast(data.message);
}

function initApp() {
  document.getElementById("authSection").classList.remove("active");
  document.getElementById("appSection").classList.add("active");
  document.getElementById("userName").innerText = user.name;
  document.getElementById("userRoleBadge").innerText = user.role.toUpperCase();

  // Hide Owner buttons if Tenant
  if (user.role !== "owner") {
    document.getElementById("navAddHouse").style.display = "none";
    document.getElementById("navMyHouses").style.display = "none";
  }
  detectUserLocation();
}

function logout() {
  localStorage.clear();
  location.reload();
}

function toggleMenu(open) {
  document.getElementById("drawer").classList.toggle("open", open);
  document.getElementById("overlay").classList.toggle("open", open);
}

function openView(id) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Detect Current GPS Location (For 2km/5km/10km Filter)
function detectUserLocation() {
  if (!navigator.geolocation) return loadHouses();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById("gpsBtn").innerText = "📍 GPS ON";
      loadHouses();
    },
    () => loadHouses()
  );
}

// Pin Owner House GPS
function pinHouseLocation() {
  if (!navigator.geolocation) return showToast("GPS supported nahi hai");
  document.getElementById("gpsStatus").innerText = "Location le rahe hain...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      houseCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById(
        "gpsStatus"
      ).innerText = `✅ GPS Saved (${houseCoords.lat.toFixed(
        4
      )}, ${houseCoords.lng.toFixed(4)})`;
    },
    () => showToast("GPS Permission allow karein!")
  );
}

// Submit New House (Owner + Cloudinary)
async function submitHouse(e) {
  e.preventDefault();
  const btn = document.getElementById("postBtn");
  btn.disabled = true;
  btn.innerText = "Uploading Photo...";

  const file = document.getElementById("hPhoto").files;
  const reader = new FileReader();
  reader.onload = async () => {
    const body = {
      title: document.getElementById("hTitle").value,
      rent: document.getElementById("hRent").value,
      deposit: document.getElementById("hDeposit").value,
      roomType: document.getElementById("hType").value,
      city: document.getElementById("hCity").value,
      area: document.getElementById("hArea").value,
      lat: houseCoords.lat,
      lng: houseCoords.lng,
      imageBase64: reader.result,
    };

    const res = await fetch("/api/houses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    showToast(data.message);
    btn.disabled = false;
    btn.innerText = "🚀 Ghar Live Karein";
    if (data.success) {
      openView("feedView");
      loadHouses();
    }
  };
  reader.readAsDataURL(file);
}

// Load Houses with Smart Search + Distance Filter
async function loadHouses() {
  const search = document.getElementById("searchInput").value;
  const roomType = document.getElementById("typeFilter").value;
  const maxKm = document.getElementById("kmFilter").value;
  const maxRent = document.getElementById("maxRentFilter").value;

  const params = new URLSearchParams({
    search,
    roomType,
    maxKm,
    maxRent,
    userLat: userCoords.lat || "",
    userLng: userCoords.lng || "",
  });

  const res = await fetch(`/api/houses?${params.toString()}`);
  const data = await res.json();
  const feed = document.getElementById("houseFeed");

  if (!data.houses.length) {
    feed.innerHTML =
      '<p style="text-align:center;color:#64748b;">Koi ghar nahi mila.</p>';
    return;
  }

  feed.innerHTML = data.houses
    .map(
      (h) => `
                                                                                                                                                                                                                                                                                                                                                                                                      <div class="house-card">
                                                                                                                                                                                                                                                                                                                                                                                                            <img src="${
                                                                                                                                                                                                                                                                                                                                                                                                              h.imageUrl
                                                                                                                                                                                                                                                                                                                                                                                                            }" />
                                                                                                                                                                                                                                                                                                                                                                                                                  <div class="card-body">
                                                                                                                                                                                                                                                                                                                                                                                                                          <div class="badge-row">
                                                                                                                                                                                                                                                                                                                                                                                                                                    <span class="type-tag">${
                                                                                                                                                                                                                                                                                                                                                                                                                                      h.roomType
                                                                                                                                                                                                                                                                                                                                                                                                                                    }</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                              <span class="status-tag status-${
                                                                                                                                                                                                                                                                                                                                                                                                                                                h.status
                                                                                                                                                                                                                                                                                                                                                                                                                                              }">${
        h.status
      }</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                              <h3>${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                h.title
                                                                                                                                                                                                                                                                                                                                                                                                                                                              }</h3>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <div class="rent-price">₹${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                        h.rent
                                                                                                                                                                                                                                                                                                                                                                                                                                                                      }/month <small style="font-weight:400;font-size:12px;">(Deposit: ₹${
        h.deposit
      })</small></div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <div class="meta-info">📍 ${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                h.area
                                                                                                                                                                                                                                                                                                                                                                                                                                                                              }, ${
        h.city
      } ${h.distanceKm !== null ? `• <b>${h.distanceKm} km door</b>` : ""}</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <div class="action-btns">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <a href="tel:${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  h.ownerPhone
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                }" class="btn-call">📞 Call</a>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <a href="https://wa.me{h.ownerPhone}?text=Hi, mujhe aapka ${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            h.title
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          } (${
        h.area
      }) kiraye par chahiye" target="_blank" class="btn-wa">💬 WhatsApp</a>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      h.lat
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ? `<a href="https://google.com{h.lat},${h.lng}" target="_blank" class="btn-map">🗺️ Map</a>`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        : ""
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        `
    )
    .join("");
}

// Owner Dashboard (PUT & DELETE)
async function loadMyHouses() {
  const res = await fetch(
    `/api/houses?ownerEmail=${encodeURIComponent(user.email)}`
  );
  const data = await res.json();
  const list = document.getElementById("myHouseList");

  list.innerHTML = data.houses
    .map(
      (h) => `
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <div class="house-card">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <div class="card-body">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <div class="badge-row">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <strong>${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              h.title
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            } (₹${
        h.rent
      })</strong>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <span class="status-tag status-${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        h.status
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      }">${
        h.status
      }</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <div class="action-btns">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <button class="btn-wa" onclick="toggleStatus('${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  h._id
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                }', '${
        h.status === "Available" ? "Rented" : "Available"
      }')">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            🔄 Mark ${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              h.status ===
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              "Available"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ? "Rented"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                : "Available"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <button class="btn-del" onclick="deleteHouse('${
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  h._id
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                }')">🗑️ Delete</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    `
    )
    .join("");
}

async function toggleStatus(id, newStatus) {
  const res = await fetch("/api/houses", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, status: newStatus }),
  });
  const data = await res.json();
  showToast(data.message);
  loadMyHouses();
}

async function deleteHouse(id) {
  if (!confirm("Ghar delete karein?")) return;
  const res = await fetch(`/api/houses?id=${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  showToast(data.message);
  loadMyHouses();
}
