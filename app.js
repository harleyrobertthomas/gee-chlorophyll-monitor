
// ------------------------------
// CONFIG — update these values
// ------------------------------
const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const REDIRECT_URI = "https://harleybrotherthomas.github.io/gee-chlorophyll-monitor/oauth2callback";

// Scopes required by Earth Engine + basic profile
const SCOPES = [
  "https://www.googleapis.com/auth/earthengine",
  "openid",
  "email",
  "profile"
];

// ------------------------------
// Helpers
// ------------------------------
const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");
const signinBtn = document.getElementById("signinBtn");
const signoutBtn = document.getElementById("signoutBtn");

function log(msg, obj) {
  const t = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  logEl.textContent += `${t}\n`;
  if (obj) logEl.textContent += `${JSON.stringify(obj, null, 2)}\n`;
}

function setStatus(text, ok = false, err = false) {
  statusEl.innerHTML = `Status: <strong>${text}</strong>`;
  statusEl.className = ok ? "ok" : err ? "err" : "";
}

function enableSignedInUI(isSignedIn) {
  signinBtn.disabled = isSignedIn;
  signoutBtn.disabled = !isSignedIn;
}

// ------------------------------
// OAuth + Earth Engine
// ------------------------------
/**
 * Starts the OAuth flow and initializes Earth Engine.
 * Uses ee.data.authenticateViaOauth with implicit-type redirect on GitHub Pages.
 */
function authenticateAndInit() {
  setStatus("Starting OAuth…");
  log("OAuth starting…");

  // Authenticate the user via OAuth
  ee.data.authenticateViaOauth(
    CLIENT_ID,
    REDIRECT_URI,
    // Success callback
    () => {
      setStatus("OAuth success. Initializing Earth Engine…");
      log("OAuth success — calling ee.initialize()");

      ee.initialize(
        // Success
        () => {
          setStatus("Earth Engine initialized", true);
          enableSignedInUI(true);
          log("EE initialized ✅");

          // Run a tiny test to confirm auth works
          runSmokeTest();
        },
        // Failure
        (err) => {
          setStatus("Earth Engine init failed", false, true);
          log("EE initialize error:", err);
          console.error(err);
        }
      );
    },
    // Failure callback
    (err) => {
      setStatus("OAuth failed", false, true);
      log("OAuth error:", err);
      console.error(err);
    },
    // Optional scopes (defaults to earthengine scope)
    SCOPES
  );
}

/**
 * Signs the user out of the Earth Engine session.
 */
function signOut() {
  setStatus("Signing out…");
  ee.data.authenticateViaOauthClear(() => {
    enableSignedInUI(false);
    setStatus("Signed out");
    log("Signed out. Session cleared.");
  });
}

// ------------------------------
// Example: Smoke test query
// ------------------------------
function runSmokeTest() {
  log("Running smoke test: fetching user projects and a simple computation…");

  // 1) List the user's projects (if any)
  ee.data.getAssetRoots(
    (roots) => log("Asset roots (projects):", roots),
    (err) => log("Failed to fetch asset roots:", err)
  );

  // 2) A tiny computation to verify server calls
  const img = ee.Image.random().clip(ee.Geometry.Rectangle([-122.6, 37.0, -122.3, 37.3]));
  const mean = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: ee.Geometry.Point([-122.45, 37.15]),
    scale: 1000,
    maxPixels: 1e7
  });

  mean.evaluate(
    (val) => log("Random image mean (example):", val),
    (err) => log("ReduceRegion evaluate error:", err)
  );
}

// ------------------------------
// Wire up buttons
// ------------------------------
signinBtn.addEventListener("click", authenticateAndInit);
signoutBtn.addEventListener("click", signOut);

// Optional: auto-detect if coming back from oauth2callback redirect
(function detectRedirectAfterOAuth() {
  if (window.location.pathname.endsWith("/oauth2callback")) {
    // Show a small message and offer to go back to app root
    setStatus("OAuth callback reached. You can close this tab or click to return.");
    log("Reached redirect URI. If the popup closed, EE init should proceed in the opener.");
    // If your flow opens in the same window, you can redirect:
    // window.location.replace("https://harleybrotherthomas.github.io/gee-chlorophyll-monitor/");
   }
})();