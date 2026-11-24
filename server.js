const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;

// ================= RENDER ENVIRONMENT VARIABLES =================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; // Layerbase Connection String
const JWT_SECRET = process.env.JWT_SECRET || "anime_rent_super_secret_2026";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ===============================================================
console.log("🔑 Keys Check:", {
  MONGO_URI: MONGO_URI ? "✅ Set" : "❌ Missing",
  CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "✅ Set" : "❌ Missing",
  API_KEY: process.env.CLOUDINARY_API_KEY ? "✅ Set" : "❌ Missing",
  API_SECRET: process.env.CLOUDINARY_API_SECRET ? "✅ Set" : "❌ Missing",
});

cloudinary.api
  .ping()
  .then(() => console.log("✅ Cloudinary Connected & Keys Working!"))
  .catch((err) => console.error("❌ Cloudinary Key Error:", err.message));
let db;
MongoClient.connect(MONGO_URI)
  .then((client) => {
    db = client.db("anime"); // Layerbase database name
    console.log("✅ Layerbase DocumentDB Connected!");
  })
  .catch((err) => console.error("❌ DB Error:", err.message));

// Helper: Password Hash (No extra library needed)
function hashPass(pass) {
  return crypto.createHash("sha256").update(pass).digest("hex");
}

// Helper: Read JSON Body (Limit 10MB for House Photo)
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Helper: Send JSON
function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

// Helper: Verify JWT Token
function verifyUser(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// Helper: Haversine Formula (Exact Distance in KM between 2 GPS points)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Number(
    (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
  );
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // ---------------- SERVE FRONTEND FILES ----------------
  if (method === "GET" && !pathname.startsWith("/api/")) {
    let filePath = "." + (pathname === "/" ? "/index.html" : pathname);
    const ext = path.extname(filePath);
    const mime = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
    };
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not Found");
      }
      res.writeHead(200, { "Content-Type": mime[ext] || "text/plain" });
      res.end(content);
    });
    return;
  }

  // ---------------- 1. POST: SIGNUP & LOGIN (JWT) ----------------
  if (method === "POST" && pathname === "/api/signup") {
    const { name, email, phone, password, role } = await getBody(req);
    const exists = await db.collection("users").findOne({ email });
    if (exists)
      return sendJSON(res, 400, {
        success: false,
        message: "Ye email pehle se bana hai!",
      });

    const newUser = {
      name,
      email,
      phone,
      password: hashPass(password),
      role,
      createdAt: new Date(),
    };
    const result = await db.collection("users").insertOne(newUser);
    const token = jwt.sign(
      { id: result.insertedId, email, name, phone, role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    return sendJSON(res, 201, {
      success: true,
      token,
      user: { name, email, phone, role },
    });
  }

  if (method === "POST" && pathname === "/api/login") {
    const { email, password } = await getBody(req);
    const user = await db
      .collection("users")
      .findOne({ email, password: hashPass(password) });
    if (!user)
      return sendJSON(res, 401, {
        success: false,
        message: "Email ya Password galat hai!",
      });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    return sendJSON(res, 200, {
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  }

  // ---------------- 2. POST: ADD HOUSE (OWNER + CLOUDINARY) ----------------
  if (method === "POST" && pathname === "/api/houses") {
    const user = verifyUser(req);
    if (!user || user.role !== "owner") {
      return sendJSON(res, 403, {
        success: false,
        message: "Sirf Owner hi ghar post kar sakta hai!",
      });
    }

    try {
      const {
        title,
        rent,
        deposit,
        roomType,
        city,
        area,
        lat,
        lng,
        imageBase64,
      } = await getBody(req);
      let imageUrl = "https://placeholder.com";

      if (imageBase64) {
        const uploadRes = await cloudinary.uploader.upload(imageBase64, {
          folder: "rent_houses",
        });
        imageUrl = uploadRes.secure_url;
      }

      const house = {
        ownerEmail: user.email,
        ownerName: user.name,
        ownerPhone: user.phone,
        title,
        rent: Number(rent),
        deposit: Number(deposit),
        roomType,
        city: city.trim(),
        area: area.trim(),
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        imageUrl,
        status: "Available",
        createdAt: new Date().toLocaleDateString("en-IN"),
      };

      await db.collection("houses").insertOne(house);
      return sendJSON(res, 201, {
        success: true,
        message: "🏠 Ghar live ho gaya!",
      });
    } catch (err) {
      console.error("❌ House Upload Error:", err);
      return sendJSON(res, 500, {
        success: false,
        message: "Upload Error: " + err.message,
      });
    }
  }

  // ---------------- 3. GET: SMART SEARCH + NEARBY DISTANCE FILTER ----------------
  if (method === "GET" && pathname === "/api/houses") {
    const { search, roomType, maxRent, maxKm, userLat, userLng, ownerEmail } =
      parsedUrl.query;
    let query = {};

    if (ownerEmail) {
      query.ownerEmail = ownerEmail;
    } else {
      if (search) {
        query.$or = [
          { city: { $regex: search, $options: "i" } },
          { area: { $regex: search, $options: "i" } },
          { title: { $regex: search, $options: "i" } },
        ];
      }
      if (roomType && roomType !== "All") query.roomType = roomType;
      if (maxRent) query.rent = { $lte: Number(maxRent) };
    }

    let houses = await db
      .collection("houses")
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    // Calculate Distance in KM from User's Current GPS
    if (userLat && userLng) {
      houses = houses.map((h) => ({
        ...h,
        distanceKm: getDistanceKm(
          Number(userLat),
          Number(userLng),
          h.lat,
          h.lng
        ),
      }));

      if (maxKm && maxKm !== "All") {
        houses = houses.filter(
          (h) => h.distanceKm !== null && h.distanceKm <= Number(maxKm)
        );
      }
    }

    return sendJSON(res, 200, { success: true, houses });
  }

  // ---------------- 4. PUT: TOGGLE AVAILABLE / RENTED STATUS ----------------
  if (method === "PUT" && pathname === "/api/houses") {
    const user = verifyUser(req);
    if (!user)
      return sendJSON(res, 401, {
        success: false,
        message: "Login zaroori hai!",
      });

    const { id, status } = await getBody(req);
    await db
      .collection("houses")
      .updateOne(
        { _id: new ObjectId(id), ownerEmail: user.email },
        { $set: { status } }
      );
    return sendJSON(res, 200, {
      success: true,
      message: `Status ab "${status}" ho gaya!`,
    });
  }

  // ---------------- 5. DELETE: REMOVE HOUSE FROM DB ----------------
  if (method === "DELETE" && pathname === "/api/houses") {
    const user = verifyUser(req);
    if (!user)
      return sendJSON(res, 401, {
        success: false,
        message: "Login zaroori hai!",
      });

    const id = parsedUrl.query.id;
    await db
      .collection("houses")
      .deleteOne({ _id: new ObjectId(id), ownerEmail: user.email });
    return sendJSON(res, 200, {
      success: true,
      message: "🗑️ Ghar delete ho gaya!",
    });
  }

  sendJSON(res, 404, { message: "Route Not Found" });
});

server.listen(PORT, () =>
  console.log(`🚀 Rent App Server running on port ${PORT}`)
);
