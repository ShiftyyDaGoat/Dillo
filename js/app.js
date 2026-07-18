const CONFIG = {
  WEBHOOK_URL: "https://discord.com/api/webhooks/1528167752190398717/DUIcyKQzRBGxKA00VE7ETaYCTRu3lDYZu1v19B5jSY-Sk7lIcHw0IEhNNC-Lgwg3f23G",
  DISCORD_INVITE: "https://discord.gg/hYCcvPgsdB",

  MAP_EMBED_URL: "https://map.democracycraft.net/#reveille:0:0:0:1500:0:0:0:1:flat",
  SITE_NAME: "Dillo"
};

const STORAGE_KEYS = {
  session: "dillo_session",
  adminUnlocked: "dillo_admin_unlocked",
  overrides: "dillo_listing_overrides",
  featured: "dillo_featured_slots"
};

const FEATURE_PRICE = 5000;
const FEATURE_DAYS = 3;
const FEATURE_SLOT_COUNT = 3;

const BUILD_TAG_V2 = "TUotMjAyNg==";

function checkBuildTag(input) {
  try {
    return atob(BUILD_TAG_V2) === input.trim();
  } catch (e) {
    return false;
  }
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  } catch (e) {
    return null;
  }
}

function setSession(mcUsername, discordUsername) {
  localStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify({ mcUsername, discordUsername })
  );
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function isAdmin() {
  return sessionStorage.getItem(STORAGE_KEYS.adminUnlocked) === "true";
}

function getOverrides() {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEYS.overrides) || "null") || {
        added: [],
        removedIds: []
      }
    );
  } catch (e) {
    return { added: [], removedIds: [] };
  }
}

function saveOverrides(overrides) {
  localStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(overrides));
}

async function loadListings() {
  let base = [];
  try {
    const res = await fetch("data/listings.json", { cache: "no-store" });
    base = await res.json();
  } catch (e) {
    console.warn("Could not load data/listings.json — serve this site over http(s), not as a local file.", e);
    base = [];
  }
  const overrides = getOverrides();
  const combined = [...base, ...overrides.added];
  return combined.filter((l) => !overrides.removedIds.includes(l.id));
}

function addListing(listing) {
  const overrides = getOverrides();
  overrides.added.push(listing);
  saveOverrides(overrides);
}

function removeListingById(id) {
  const overrides = getOverrides();
  if (!overrides.removedIds.includes(id)) {
    overrides.removedIds.push(id);
  }
  overrides.added = overrides.added.filter((l) => l.id !== id);
  saveOverrides(overrides);
}

function emptySlots() {
  return Array.from({ length: FEATURE_SLOT_COUNT }, () => ({ listingId: null, expiresAt: null }));
}

function getFeaturedSlots() {
  let slots;
  try {
    slots = JSON.parse(localStorage.getItem(STORAGE_KEYS.featured) || "null");
  } catch (e) {
    slots = null;
  }
  if (!Array.isArray(slots) || slots.length !== FEATURE_SLOT_COUNT) {
    slots = emptySlots();
  }
  const now = Date.now();
  let changed = false;
  slots = slots.map((s) => {
    if (s && s.expiresAt && new Date(s.expiresAt).getTime() < now) {
      changed = true;
      return { listingId: null, expiresAt: null };
    }
    return s || { listingId: null, expiresAt: null };
  });
  if (changed) saveFeaturedSlots(slots);
  return slots;
}

function saveFeaturedSlots(slots) {
  localStorage.setItem(STORAGE_KEYS.featured, JSON.stringify(slots));
}

function setFeaturedSlot(index, listingId) {
  const slots = getFeaturedSlots();
  const expiresAt = new Date(Date.now() + FEATURE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  slots[index] = { listingId, expiresAt };
  saveFeaturedSlots(slots);
}

function clearFeaturedSlot(index) {
  const slots = getFeaturedSlots();
  slots[index] = { listingId: null, expiresAt: null };
  saveFeaturedSlots(slots);
}

function daysLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatPrice(n) {
  return `D$${Number(n).toLocaleString()}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

async function sendPurchaseWebhook({ listing, buyerMc, buyerDiscord }) {
  const embed = {
    title: "New buy request",
    color: 0x3fb86d,
    fields: [
      { name: "Listing", value: listing.title, inline: false },
      { name: "Price", value: formatPrice(listing.price), inline: true },
      { name: "Coords", value: listing.coords, inline: true },
      { name: "Seller (MC)", value: listing.sellerUsername || "—", inline: true },
      { name: "Seller (Discord)", value: listing.sellerDiscord || "—", inline: true },
      { name: "Buyer (MC)", value: buyerMc || "—", inline: true },
      { name: "Buyer (Discord)", value: buyerDiscord || "—", inline: true }
    ],
    timestamp: new Date().toISOString()
  };

  const body = {
    content: `📥 **${buyerMc}** wants to buy **${listing.title}**`,
    embeds: [embed]
  };

  const res = await fetch(CONFIG.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error("Webhook request failed with status " + res.status);
  }
}

function buildBuyModal() {
  if (document.getElementById("buyModal")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "buyModal";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" data-close-buy>&times;</button>
      <h3 id="buyModalTitle">Request this listing</h3>
      <p id="buyModalSub"></p>
      <div class="field">
        <label for="buyDiscord">Your Discord username</label>
        <input id="buyDiscord" type="text" placeholder="e.g. brinebark" />
        <div class="hint">We'll send this to the Dillo team so they can reach you and start your join request.</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-buy>Cancel</button>
        <button class="btn btn-primary btn-block" id="buyConfirmBtn">Send request</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const success = document.createElement("div");
  success.className = "modal-overlay";
  success.id = "buySuccessModal";
  success.hidden = true;
  success.innerHTML = `
    <div class="modal">
      <button class="modal-close" data-close-success>&times;</button>
      <div class="status-icon">✓</div>
      <h3>Request sent</h3>
      <p>The Dillo team has your Minecraft and Discord username. Join the server Discord below — a staff member will message you there to finish the handoff.</p>
      <div class="modal-actions">
        <a class="btn btn-primary btn-block" href="https://discord.gg/hYCcvPgsdB" target="_blank" rel="noopener">Join the Discord</a>
      </div>
    </div>
  `;
  document.body.appendChild(success);

  overlay.querySelectorAll("[data-close-buy]").forEach((el) => el.addEventListener("click", closeBuyModal));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeBuyModal();
  });
  success.querySelectorAll("[data-close-success]").forEach((el) =>
    el.addEventListener("click", () => (success.hidden = true))
  );
  success.addEventListener("click", (e) => {
    if (e.target === success) success.hidden = true;
  });

  document.getElementById("buyConfirmBtn").addEventListener("click", onBuyConfirm);
}

let pendingListing = null;

function openBuyFlow(listing) {
  buildBuyModal();
  const session = getSession();
  if (!session) {
    showToast("Sign in first.");
    openSignInModal();
    return;
  }
  pendingListing = listing;
  document.getElementById("buyModalTitle").textContent = `Request ${listing.title}`;
  document.getElementById("buyModalSub").textContent =
    `${formatPrice(listing.price)} · ${listing.coords}. Confirming sends your Minecraft and Discord username to the Dillo team, who'll ask you to join the server for the handoff.`;
  document.getElementById("buyDiscord").value = session.discordUsername || "";
  document.getElementById("buyModal").hidden = false;
}

function closeBuyModal() {
  const overlay = document.getElementById("buyModal");
  if (overlay) overlay.hidden = true;
}

async function onBuyConfirm() {
  const discord = document.getElementById("buyDiscord").value.trim();
  if (!discord) {
    showToast("Enter your Discord username.");
    return;
  }
  const session = getSession();
  const btn = document.getElementById("buyConfirmBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    await sendPurchaseWebhook({
      listing: pendingListing,
      buyerMc: session.mcUsername,
      buyerDiscord: discord
    });
    closeBuyModal();
    document.getElementById("buySuccessModal").hidden = false;
  } catch (e) {
    console.error(e);
    showToast("Couldn't send the request. Try again in a moment.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send request";
  }
}

function buildFeaturePickerModal() {
  if (document.getElementById("featureModal")) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "featureModal";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <button class="modal-close" data-close-feature>&times;</button>
      <h3>Fill this slot</h3>
      <p>D$${FEATURE_PRICE.toLocaleString()} for ${FEATURE_DAYS} days once payment is confirmed. Pick which listing goes here.</p>
      <div id="featurePickerList" style="max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll("[data-close-feature]").forEach((el) =>
    el.addEventListener("click", () => (overlay.hidden = true))
  );
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
}

function openFeaturePicker(slotIndex, listings, onPicked) {
  buildFeaturePickerModal();
  const overlay = document.getElementById("featureModal");
  const list = document.getElementById("featurePickerList");

  if (!listings.length) {
    list.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">No listings to feature yet.</p>`;
  } else {
    list.innerHTML = listings
      .map(
        (l) => `
        <button class="btn btn-outline" style="justify-content:space-between; width:100%;" data-pick="${l.id}">
          <span>${escapeHtml(l.title)}</span>
          <span style="color:var(--text-faint); font-weight:400;">${formatPrice(l.price)}</span>
        </button>
      `
      )
      .join("");
    list.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setFeaturedSlot(slotIndex, btn.dataset.pick);
        overlay.hidden = true;
        onPicked();
      });
    });
  }
  overlay.hidden = false;
}

function ensureToast() {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  return toast;
}

function showToast(message, duration = 3200) {
  const toast = ensureToast();
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), duration);
}

function renderUserChip() {
  const slot = document.getElementById("navUserSlot");
  if (!slot) return;
  const session = getSession();

  if (!session) {
    slot.innerHTML = `<button class="btn btn-primary" id="signInBtn">Sign in</button>`;
    document.getElementById("signInBtn").addEventListener("click", openSignInModal);
    return;
  }

  const initial = session.mcUsername ? session.mcUsername[0].toUpperCase() : "?";
  slot.innerHTML = `
    <div class="user-chip" id="userChip" title="Click to sign out">
      <span class="dot">${initial}</span>
      <span><strong>${escapeHtml(session.mcUsername)}</strong> · @${escapeHtml(session.discordUsername)}</span>
    </div>
  `;
  document.getElementById("userChip").addEventListener("click", () => {
    if (confirm("Sign out of Dillo on this device?")) {
      clearSession();
      renderUserChip();
      showToast("Signed out.");
    }
  });
}

function markActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.dataset.page === page) a.classList.add("active");
  });
}

function buildSignInModal() {
  if (document.getElementById("signInModal")) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "signInModal";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" data-close>&times;</button>
      <h3>Sign in to Dillo</h3>
      <p>We only use this to tag your listings and buy requests — no password needed.</p>
      <div class="field">
        <label for="siMc">Minecraft username</label>
        <input id="siMc" type="text" placeholder="e.g. Brinebark" autocomplete="off" />
      </div>
      <div class="field">
        <label for="siDc">Discord username</label>
        <input id="siDc" type="text" placeholder="e.g. brinebark" autocomplete="off" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="siSubmit">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", closeSignInModal)
  );
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSignInModal();
  });
  overlay.querySelector("#siSubmit").addEventListener("click", () => {
    const mc = overlay.querySelector("#siMc").value.trim();
    const dc = overlay.querySelector("#siDc").value.trim();
    if (!mc || !dc) {
      showToast("Enter both your Minecraft and Discord username.");
      return;
    }
    setSession(mc, dc);
    closeSignInModal();
    renderUserChip();
    showToast(`Welcome, ${mc}.`);
    document.dispatchEvent(new CustomEvent("dillo:signedin"));
  });
}

function openSignInModal() {
  buildSignInModal();
  const overlay = document.getElementById("signInModal");
  const session = getSession();
  if (session) {
    overlay.querySelector("#siMc").value = session.mcUsername;
    overlay.querySelector("#siDc").value = session.discordUsername;
  }
  overlay.hidden = false;
}

function closeSignInModal() {
  const overlay = document.getElementById("signInModal");
  if (overlay) overlay.hidden = true;
}

function wireAdminTrigger() {
  const trigger = document.getElementById("adminTrigger");
  const panel = document.getElementById("adminInline");
  if (!trigger || !panel) return;

  trigger.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) panel.querySelector("input").focus();
  });

  const go = panel.querySelector(".go");
  const input = panel.querySelector("input");
  const attempt = () => {
    if (checkBuildTag(input.value)) {
      sessionStorage.setItem(STORAGE_KEYS.adminUnlocked, "true");
      showToast("Admin tools unlocked on this device.");
      panel.classList.remove("open");
      input.value = "";
      document.dispatchEvent(new CustomEvent("dillo:adminunlocked"));
    } else {
      showToast("That code didn't match.");
    }
  };
  go.addEventListener("click", attempt);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attempt();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  buildSignInModal();
  renderUserChip();
  markActiveNav();
  wireAdminTrigger();
});
