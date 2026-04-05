import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ─────────────────────────────── FIREBASE CONFIG ─────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyDbrxXpL6XNtV35w_s14vbz_xv3c3rBjV4",
  authDomain: "joseline-5b910.firebaseapp.com",
  projectId: "joseline-5b910",
  storageBucket: "joseline-5b910.firebasestorage.app",
  messagingSenderId: "1000887672996",
  appId: "1:1000887672996:web:506c830b9d1f1b15950631"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ─────────────────────────────── STATE ─────────────────────────────── */
let allInquiries = [];
let filteredInquiries = [];
let activityLog = [];
let unsubscribeInquiries = null;
let notifReadIds = new Set(JSON.parse(localStorage.getItem("jimc_notif_read") || "[]"));

function saveNotifRead() {
  localStorage.setItem("jimc_notif_read", JSON.stringify([...notifReadIds]));
}

/* ─────────────────────────────── AUTH ─────────────────────────────── */
window.handleLogin = async function () {
  const email = document.getElementById("login-user")?.value.trim() || "";
  const password = document.getElementById("login-pass")?.value || "";
  const err = document.getElementById("login-error");

  if (!email || !password) {
    if (err) {
      err.textContent = "Enter your admin email and password.";
      err.classList.add("show");
      setTimeout(() => err.classList.remove("show"), 4000);
    }
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    if (err) err.classList.remove("show");
  } catch (error) {
    console.error("Login error:", error);
    if (err) {
      err.textContent = "Invalid login credentials.";
      err.classList.add("show");
      setTimeout(() => err.classList.remove("show"), 4000);
    }
    const passInput = document.getElementById("login-pass");
    if (passInput) passInput.value = "";
  }
};

window.handleLogout = async function () {
  try {
    if (unsubscribeInquiries) {
      unsubscribeInquiries();
      unsubscribeInquiries = null;
    }
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed", "error");
  }
};

document.getElementById("login-pass")?.addEventListener("keypress", e => {
  if (e.key === "Enter") window.handleLogin();
});

/* ─────────────────────────────── SIDEBAR ─────────────────────────────── */
window.openSidebar = function () {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-overlay")?.classList.add("show");
};

window.closeSidebar = function () {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("show");
};

/* ─────────────────────────────── DATE ─────────────────────────────── */
function updateDate() {
  const d = new Date();
  const el = document.getElementById("current-date");
  if (el) {
    el.textContent = d.toLocaleDateString("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
}
updateDate();
setInterval(updateDate, 60000);

/* ─────────────────────────────── TOAST ─────────────────────────────── */
window.showToast = function (msg, type = "success") {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !icon || !msgEl) return;

  msgEl.textContent = msg;

  if (type === "error") {
    toast.classList.add("toast-error");
    icon.innerHTML = '<svg width="16" height="16" fill="none" stroke="#f87171" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  } else {
    toast.classList.remove("toast-error");
    icon.innerHTML = '<svg width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
  }

  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3600);
};

/* ─────────────────────────────── TAB SWITCHING ─────────────────────────────── */
window.switchTab = function (tab) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => {
    if (n.getAttribute("onclick")?.includes(`'${tab}'`)) n.classList.add("active");
  });

  const titles = {
    overview: "Overview",
    inquiries: "All Inquiries",
    analytics: "Analytics",
    jobs: "Job Positions",
    notifications: "Notifications",
    settings: "Settings"
  };

  const subs = {
    overview: "Welcome back, Admin",
    inquiries: "Search, filter, and manage all applicant inquiries",
    analytics: "Performance insights and recruitment analytics",
    jobs: "Browse active job openings and applicant interest",
    notifications: "System alerts and important updates",
    settings: "Dashboard configuration and preferences"
  };

  const titleEl = document.getElementById("page-title");
  const subEl = document.getElementById("page-subtitle");
  const bcEl = document.getElementById("bc-current");

  if (titleEl) titleEl.textContent = titles[tab] || tab;
  if (subEl) subEl.textContent = subs[tab] || "";
  if (bcEl) bcEl.textContent = titles[tab] || tab;

  closeSidebar();

   if (tab === "analytics") renderAnalytics();
  if (tab === "jobs") renderJobs();
  if (tab === "notifications") renderNotifications();
};

/* ─────────────────────────────── INIT DASHBOARD ─────────────────────────────── */
function initDashboard() {
  if (unsubscribeInquiries) unsubscribeInquiries();

  try {
    const q = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
    unsubscribeInquiries = onSnapshot(
      q,
      snap => {
        allInquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        filteredInquiries = [...allInquiries];
        refreshAll();
      },
      error => {
        console.error("Firestore snapshot error:", error);
        showToast("Unable to load inquiries", "error");
        loadDemoData();
      }
    );
  } catch (error) {
    console.error("Init dashboard error:", error);
    loadDemoData();
  }
}

function loadDemoData() {
  allInquiries = [
    { id: "1", firstName: "Maria", lastName: "Santos", email: "maria.santos@example.com", phone: "+63 912 345 6789", position: "Nursing Specialist", message: "I am interested in the nursing position in Saudi Arabia. I have 3 years of hospital experience and RN licensure. I am NCLEX-ready and willing to start immediately.", status: "new", createdAt: { toDate: () => new Date(Date.now() - 1 * 3600000) } },
    { id: "2", firstName: "Jose", lastName: "Reyes", email: "jose.reyes@example.com", phone: "+63 917 234 5678", position: "Electrician", message: "I have 5 years of experience as a building electrician with TESDA NC II certification. I have worked on commercial and residential projects.", status: "reviewed", createdAt: { toDate: () => new Date(Date.now() - 1 * 86400000) } },
    { id: "3", firstName: "Ana", lastName: "Cruz", email: "ana.cruz@example.com", phone: "+63 920 123 4567", position: "IT Support", message: "Seeking the IT support technician role in Timor-Leste. I am CompTIA A+ certified with 4 years of help desk experience at a BPO company.", status: "contacted", createdAt: { toDate: () => new Date(Date.now() - 2 * 86400000) } },
    { id: "4", firstName: "Pedro", lastName: "Lim", email: "pedro.lim@example.com", phone: "+63 918 987 6543", position: "Tile Worker", message: "Experienced tile setter with 7 years in residential and commercial projects across Metro Manila. My portfolio includes hotel and mall installations.", status: "deployed", createdAt: { toDate: () => new Date(Date.now() - 3 * 86400000) } }
  ];
  filteredInquiries = [...allInquiries];
  refreshAll();
}

/* ─────────────────────────────── REFRESH ALL ─────────────────────────────── */
function refreshAll() {
  updateStats();
  updateSidebarStats();
  renderRecentTable();
  renderInquiriesTable();
  renderPositionChart();
  renderDonut();
  renderConversion();
  renderNotifications();

  const newBadge = document.getElementById("new-badge");
  if (newBadge) newBadge.textContent = allInquiries.filter(i => i.status === "new").length;
}

/* ─────────────────────────────── STATS ─────────────────────────────── */
function updateStats() {
  const total = allInquiries.length;
  const newC = allInquiries.filter(i => i.status === "new").length;
  const contacted = allInquiries.filter(i => i.status === "contacted").length;
  const deployed = allInquiries.filter(i => i.status === "deployed").length;
  const reviewed = allInquiries.filter(i => i.status === "reviewed").length;
  const rejected = allInquiries.filter(i => i.status === "rejected").length;
  const rate = total > 0 ? Math.round((deployed / total) * 100) : 0;

  animNum("stat-total", total);
  animNum("stat-new", newC);
  animNum("stat-contacted", contacted);
  animNum("stat-deployed", deployed);
  animNum("kpi-reviewed", reviewed);
  animNum("kpi-rejected", rejected);

  const rateEl = document.getElementById("kpi-rate");
  const positionsEl = document.getElementById("kpi-positions");

  if (rateEl) rateEl.textContent = rate + "%";
  if (positionsEl) positionsEl.textContent = "6";

  animNum("kpi-today", allInquiries.filter(i => {
    if (!i.createdAt?.toDate) return false;
    const d = i.createdAt.toDate();
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length);

  const vals = [1, 2, 3, 5, 4, 6, total];
  const maxV = Math.max(...vals, 1);
  const mini = document.getElementById("mini-chart-total");
  if (mini) {
    mini.innerHTML = vals
      .map(v => `<div class="mini-bar" style="height:${Math.max(4, (v / maxV) * 36)}px;"></div>`)
      .join("");
  }
}

function updateSidebarStats() {
  const total = allInquiries.length;
  const newC = allInquiries.filter(i => i.status === "new").length;
  const deployed = allInquiries.filter(i => i.status === "deployed").length;
  const rate = total > 0 ? Math.round((deployed / total) * 100) : 0;

  const sbTotal = document.getElementById("sb-total");
  const sbNew = document.getElementById("sb-new");
  const sbDeployed = document.getElementById("sb-deployed");
  const sbPct = document.getElementById("sb-pct");

  if (sbTotal) sbTotal.textContent = total;
  if (sbNew) sbNew.textContent = newC;
  if (sbDeployed) sbDeployed.textContent = deployed;
  if (sbPct) sbPct.textContent = rate + "%";
}

function animNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;

  let cur = 0;
  const step = Math.max(target / 30, 0.1);

  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = Math.floor(cur);
    if (cur >= target) {
      el.textContent = target;
      clearInterval(t);
    }
  }, 28);
}

/* ─────────────────────────────── CONVERSION RING ─────────────────────────────── */
function renderConversion() {
  const total = allInquiries.length || 1;
  const deployed = allInquiries.filter(i => i.status === "deployed").length;
  const reviewed = allInquiries.filter(i => i.status === "reviewed").length;
  const rejected = allInquiries.filter(i => i.status === "rejected").length;
  const pct = Math.round((deployed / total) * 100);
  const circ = 339.3;

  const ring = document.getElementById("conv-ring");
  const convPct = document.getElementById("conversion-pct");
  const cr = document.getElementById("conv-reviewed");
  const cd = document.getElementById("conv-deployed");
  const cj = document.getElementById("conv-rejected");

  if (ring) ring.style.strokeDashoffset = circ - (pct / 100) * circ;
  if (convPct) convPct.textContent = pct + "%";
  if (cr) cr.textContent = reviewed;
  if (cd) cd.textContent = deployed;
  if (cj) cj.textContent = rejected;
}

/* ─────────────────────────────── RECENT TABLE ─────────────────────────────── */
function renderRecentTable() {
  const recent = allInquiries.slice(0, 5);
  const container = document.getElementById("recent-table-container");
  if (!container) return;

  if (!recent.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-sub">No inquiries yet</div></div>';
    return;
  }

  container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="r-table">
          <thead><tr>
            <th style="padding-left:16px;">Applicant</th>
            <th>Position</th>
            <th>Status</th>
            <th style="padding-right:16px;">Date</th>
          </tr></thead>
          <tbody>
            ${recent.map(i => `
              <tr onclick="openDetail('${i.id}')">
                <td style="padding-left:16px;">
                  <div class="applicant-cell">
                    <div class="av av-sm">${(i.firstName || "?")[0]}${(i.lastName || "")[0]}</div>
                    <div>
                      <div class="applicant-name">${i.firstName || ""} ${i.lastName || ""}</div>
                      <div class="applicant-email">${i.email || ""}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:13px;font-weight:500;color:var(--text-secondary);">${i.position || "N/A"}</td>
                <td><span class="badge badge-${i.status || "new"}">${i.status || "new"}</span></td>
                <td style="font-size:12px;color:var(--text-muted);font-family:'DM Mono',monospace;padding-right:16px;">${formatDate(i.createdAt)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
}

/* ─────────────────────────────── INQUIRIES TABLE ─────────────────────────────── */
function renderInquiriesTable() {
  const list = filteredInquiries;
  const rc = document.getElementById("result-count");
  const tbody = document.getElementById("inquiries-tbody");

  if (rc) rc.textContent = `${list.length} result${list.length !== 1 ? "s" : ""}`;
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-icon"><svg width="22" height="22" fill="none" stroke="#d1d5db" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
            <div class="empty-title">No inquiries match</div>
            <div class="empty-sub">Try adjusting your search or filters</div>
          </div>
        </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((i, idx) => `
      <tr onclick="openDetail('${i.id}')">
        <td><span style="font-size:12px;color:var(--text-faint);font-family:'DM Mono',monospace;">${String(idx + 1).padStart(2, "0")}</span></td>
        <td>
          <div class="applicant-cell">
            <div class="av av-sm">${(i.firstName || "?")[0]}${(i.lastName || "")[0]}</div>
            <div class="applicant-name">${i.firstName || ""} ${i.lastName || ""}</div>
          </div>
        </td>
        <td class="hide-mob" style="font-size:13px;color:var(--text-secondary);">${i.email || "—"}</td>
        <td class="hide-mob" style="font-size:13px;color:var(--text-secondary);">${i.phone || "—"}</td>
        <td style="font-size:13px;font-weight:500;color:var(--navy-800);">${i.position || "N/A"}</td>
        <td><span class="badge badge-${i.status || "new"}">${i.status || "new"}</span></td>
        <td class="hide-mob" style="font-size:12px;color:var(--text-muted);font-family:'DM Mono',monospace;">${formatDate(i.createdAt)}</td>
        <td style="text-align:center;" onclick="event.stopPropagation()">
          <button onclick="openDetail('${i.id}')"
            style="padding:6px 14px;font-size:12px;font-weight:600;
                   background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);
                   border-radius:8px;color:var(--gold-600);cursor:pointer;
                   font-family:'DM Sans',sans-serif;transition:all 0.2s;"
            onmouseover="this.style.background='var(--gold-400)';this.style.color='white';this.style.borderColor='var(--gold-400)'"
            onmouseout="this.style.background='rgba(212,175,55,0.08)';this.style.color='var(--gold-600)';this.style.borderColor='rgba(212,175,55,0.2)'">
            View
          </button>
        </td>
      </tr>
    `).join("");
}

/* ─────────────────────────────── FILTERS ─────────────────────────────── */
window.filterInquiries = function () {
  const s = document.getElementById("search-input")?.value.toLowerCase() || "";
  const st = document.getElementById("status-filter")?.value || "";
  const pos = document.getElementById("position-filter")?.value || "";

  filteredInquiries = allInquiries.filter(i => {
    const name = `${i.firstName || ""} ${i.lastName || ""}`.toLowerCase();
    return (!s || name.includes(s) || (i.email || "").toLowerCase().includes(s) || (i.position || "").toLowerCase().includes(s))
      && (!st || i.status === st)
      && (!pos || i.position === pos);
  });

  renderInquiriesTable();
};

/* ─────────────────────────────── DETAIL MODAL ─────────────────────────────── */
window.openDetail = function (id) {
  const inq = allInquiries.find(i => i.id === id);
  if (!inq) return;

  const modalBody = document.getElementById("modal-body");
  const modalActions = document.getElementById("modal-actions");
  const modal = document.getElementById("detail-modal");

  if (!modalBody || !modalActions || !modal) return;

  modalBody.innerHTML = `
      <div class="modal-profile-banner">
        <div class="av av-lg">${(inq.firstName || "?")[0]}${(inq.lastName || "")[0]}</div>
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--navy-800);">${inq.firstName || ""} ${inq.lastName || ""}</div>
          <span class="badge badge-${inq.status || "new"}" style="margin-top:6px;display:inline-block;">${inq.status || "new"}</span>
        </div>
      </div>

      <div>
        <div class="detail-row">
          <span class="detail-label">Email Address</span>
          <span class="detail-value">${inq.email || "—"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone Number</span>
          <span class="detail-value">${inq.phone || "—"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Position Applied</span>
          <span class="detail-value highlight">${inq.position || "—"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date Submitted</span>
          <span class="detail-value">${formatDateLong(inq.createdAt)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Current Status</span>
          <span class="detail-value"><span class="badge badge-${inq.status || "new"}">${inq.status || "new"}</span></span>
        </div>
      </div>

      <div style="margin-top:14px;">
        <div class="detail-label" style="margin-bottom:8px;">Message / Cover Letter</div>
        <div class="message-box">${inq.message || "(No message provided)"}</div>
      </div>`;

  modalActions.innerHTML = `
      <div style="margin-bottom:14px;">
        <span class="status-update-label">Update Application Status</span>
        <select onchange="updateStatus('${inq.id}',this.value)" class="sel" style="width:100%;max-width:240px;">
          <option value="">Select new status…</option>
          <option value="new" ${inq.status === "new" ? "selected" : ""}>🔔 New</option>
          <option value="reviewed" ${inq.status === "reviewed" ? "selected" : ""}>👁 Reviewed</option>
          <option value="contacted" ${inq.status === "contacted" ? "selected" : ""}>💬 Contacted</option>
          <option value="deployed" ${inq.status === "deployed" ? "selected" : ""}>✅ Deployed</option>
          <option value="rejected" ${inq.status === "rejected" ? "selected" : ""}>❌ Rejected</option>
        </select>
      </div>
      <div class="modal-btn-row">
        <a href="mailto:${inq.email || ""}" class="btn btn-gold" style="text-decoration:none;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          Email Applicant
        </a>
        <a href="tel:${inq.phone || ""}" class="btn btn-outline" style="text-decoration:none;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          Call
        </a>
      </div>`;

  modal.classList.add("open");
};

window.closeModal = function () {
  document.getElementById("detail-modal")?.classList.remove("open");
};

/* ─────────────────────────────── UPDATE STATUS ─────────────────────────────── */
window.updateStatus = async function (id, status) {
  if (!status) return;

  const inq = allInquiries.find(i => i.id === id);
  const oldStatus = inq?.status || "";

  try {
    await updateDoc(doc(db, "inquiries", id), { status });
    addActivity(id, oldStatus, status);
    showToast(`Status updated to "${status}"`);
    closeModal();
  } catch (error) {
    console.error("Update status error:", error);
    showToast("Status update failed", "error");
  }
};

/* ─────────────────────────────── ACTIVITY LOG ─────────────────────────────── */
function addActivity(id, from, to) {
  const inq = allInquiries.find(i => i.id === id);
  const name = inq ? `${inq.firstName || ""} ${inq.lastName || ""}` : "Unknown";
  activityLog.unshift({ name, from, to, time: new Date() });
  if (activityLog.length > 12) activityLog = activityLog.slice(0, 12);
  renderActivity();
}

function renderActivity() {
  const el = document.getElementById("activity-log");
  if (!el || !activityLog.length) return;

  const colors = {
    new: "#D4AF37",
    reviewed: "#3b82f6",
    contacted: "#7c3aed",
    deployed: "#16a34a",
    rejected: "#dc2626"
  };

  el.innerHTML = activityLog.map(a => `
      <div class="activity-item">
        <div class="activity-avatar">${a.name[0] || "U"}</div>
        <div class="activity-text">
          <strong>${a.name}</strong>
          <span style="color:var(--text-muted);"> status changed: </span>
          <span style="color:${colors[a.from] || "#94a3b8"};font-weight:600;text-transform:capitalize;">${a.from || "—"}</span>
          <span style="color:var(--text-faint);"> → </span>
          <span style="color:${colors[a.to] || "#94a3b8"};font-weight:600;text-transform:capitalize;">${a.to || "—"}</span>
        </div>
        <div class="activity-time">${timeAgo(a.time)}</div>
      </div>
    `).join("");
}

function timeAgo(d) {
  const s = Math.floor((new Date() - d) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

/* ─────────────────────────────── POSITION CHART ─────────────────────────────── */
function renderPositionChart() {
  const positions = {};
  allInquiries.forEach(i => {
    const p = i.position || "Other";
    positions[p] = (positions[p] || 0) + 1;
  });

  const sorted = Object.entries(positions).sort((a, b) => b[1] - a[1]);
  const maxV = Math.max(...sorted.map(p => p[1]), 1);
  const el = document.getElementById("position-chart");
  if (!el) return;

  el.innerHTML = sorted.length === 0
    ? '<div class="empty-state" style="padding:30px;"><div class="empty-sub">No data yet</div></div>'
    : sorted.map(([pos, count]) => `
          <div class="pos-row">
            <div class="pos-row-head">
              <span class="pos-name">${pos}</span>
              <span class="pos-count">${count}</span>
            </div>
            <div class="pos-track">
              <div class="pos-fill" style="width:${(count / maxV) * 100}%;"></div>
            </div>
          </div>
        `).join("");
}

/* ─────────────────────────────── DONUT ─────────────────────────────── */
function renderDonut() {
  const total = allInquiries.length || 1;
  const counts = { new: 0, reviewed: 0, contacted: 0, deployed: 0, rejected: 0 };

  allInquiries.forEach(i => {
    if (counts[i.status] !== undefined) counts[i.status]++;
  });

  const center = document.getElementById("donut-center");
  if (center) center.textContent = allInquiries.length;

  const circ = 346;
  let offset = 0;

  ["new", "contacted", "deployed"].forEach(s => {
    const pct = counts[s] / total;
    const dash = pct * circ;
    const el = document.getElementById(`donut-${s}`);
    if (el) {
      el.style.strokeDasharray = `${dash} ${circ - dash}`;
      el.style.strokeDashoffset = -offset;
      offset += dash;
    }
  });

  const colors = { new: "#D4AF37", reviewed: "#3b82f6", contacted: "#7c3aed", deployed: "#16a34a", rejected: "#dc2626" };
  const bgs = { new: "rgba(212,175,55,0.06)", reviewed: "rgba(59,130,246,0.05)", contacted: "rgba(124,58,237,0.05)", deployed: "rgba(22,163,74,0.05)", rejected: "rgba(220,38,38,0.05)" };
  const legend = document.getElementById("donut-legend");

  if (legend) {
    legend.innerHTML = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([s, c]) => `
          <div class="donut-legend-item" style="background:${bgs[s]};">
            <div class="donut-legend-left">
              <div class="donut-dot" style="background:${colors[s]};"></div>
              <div class="donut-name">${s}</div>
            </div>
            <div class="donut-val" style="color:${colors[s]};">${c}</div>
          </div>
        `).join("");
  }
}

/* ─────────────────────────────── ANALYTICS ─────────────────────────────── */
function renderAnalytics() {
  const total = allInquiries.length;
  const deployed = allInquiries.filter(i => i.status === "deployed").length;
  const rate = total > 0 ? Math.round((deployed / total) * 100) : 0;

  const anTotal = document.getElementById("an-total");
  const anDeploy = document.getElementById("an-deployed");
  const anRate = document.getElementById("an-rate");
  const anAvg = document.getElementById("an-avg");

  if (anTotal) anTotal.textContent = total;
  if (anDeploy) anDeploy.textContent = deployed;
  if (anRate) anRate.textContent = rate + "%";
  if (anAvg) anAvg.textContent = "2.4d";

  const positions = {};
  allInquiries.forEach(i => {
    const p = i.position || "Other";
    positions[p] = (positions[p] || 0) + 1;
  });

  const sortedP = Object.entries(positions).sort((a, b) => b[1] - a[1]);
  const maxP = Math.max(...sortedP.map(p => p[1]), 1);
  const apEl = document.getElementById("analytics-position");

  if (apEl) {
    apEl.innerHTML = sortedP.map(([p, c]) => `
        <div class="analytics-progress">
          <div class="ap-head"><span class="ap-name">${p}</span><span class="ap-val">${c}</span></div>
          <div class="ap-track"><div class="ap-fill" style="width:${(c / maxP) * 100}%;"></div></div>
        </div>
      `).join("") || '<div class="empty-sub" style="text-align:center;padding:20px;">No data</div>';
  }

  const sCounts = {};
  allInquiries.forEach(i => {
    const s = i.status || "new";
    sCounts[s] = (sCounts[s] || 0) + 1;
  });

  const sortedS = Object.entries(sCounts).sort((a, b) => b[1] - a[1]);
  const maxS = Math.max(...sortedS.map(s => s[1]), 1);
  const sColors = { new: "#D4AF37", reviewed: "#3b82f6", contacted: "#7c3aed", deployed: "#16a34a", rejected: "#dc2626" };
  const asEl = document.getElementById("analytics-status");

  if (asEl) {
    asEl.innerHTML = sortedS.map(([s, c]) => `
        <div class="analytics-progress">
          <div class="ap-head">
            <span class="ap-name" style="text-transform:capitalize;">${s}</span>
            <span class="ap-val" style="color:${sColors[s] || "#D4AF37"};">${c}</span>
          </div>
          <div class="ap-track">
            <div class="ap-fill" style="width:${(c / maxS) * 100}%;background:${sColors[s] || "#D4AF37"};"></div>
          </div>
        </div>
      `).join("");
  }

  const days = [];
  const dayCounts = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    days.push(d.toLocaleDateString("en", { weekday: "short" }));
    dayCounts.push(allInquiries.filter(inq => {
      if (!inq.createdAt?.toDate) return false;
      const t = inq.createdAt.toDate();
      return t >= d && t < next;
    }).length);
  }

  const maxD = Math.max(...dayCounts, 1);
  const vcEl = document.getElementById("volume-chart");
  const vlEl = document.getElementById("volume-labels");

  if (vcEl) {
    vcEl.innerHTML = dayCounts.map(c => `
        <div class="vol-col">
          <div class="vol-count">${c > 0 ? c : ""}</div>
          <div class="vol-bar" style="height:${Math.max(6, (c / maxD) * 100)}px;"></div>
        </div>
      `).join("");
  }

  if (vlEl) {
    vlEl.innerHTML = days.map(d => `<div class="vol-lbl" style="flex:1;">${d}</div>`).join("");
  }
}

/* ─────────────────────────────── JOBS ─────────────────────────────── */
function renderJobs() {
  const jobs = [
    { title: "Female Nursing Specialist", cat: "Healthcare", loc: "Saudi Arabia", img: "https://nightingalenursingservices.com/wp-content/uploads/2021/05/GROUP_CLEAN.jpg", pos: "Nursing Specialist", desc: "ICU, Ward, or Home Care setting" },
    { title: "Tile Worker / Tile Setter", cat: "Construction", loc: "Saudi Arabia", img: "images/Tilesworkers.png", pos: "Tile Worker", desc: "Residential & commercial projects" },
    { title: "Building Electrician", cat: "Construction", loc: "Saudi Arabia", img: "images/electrician.jpg", pos: "Electrician", desc: "PRC licensed, TESDA preferred" },
    { title: "IT Support Technician", cat: "IT / Tech", loc: "Timor-Leste", img: "images/ITsupport.jpg", pos: "IT Support", desc: "CompTIA A+ or equivalent" },
    { title: "Architectural Draftsman", cat: "Professional", loc: "Timor-Leste", img: "images/draftsman.png", pos: "Draftsman", desc: "AutoCAD & Revit proficiency required" },
    { title: "Purchase Representative", cat: "Professional", loc: "Greece", img: "images/purchse.jpg", pos: "Purchase Rep", desc: "EU procurement regulations knowledge" }
  ];

  const maxApplicants = Math.max(...jobs.map(j => allInquiries.filter(i => i.position === j.pos).length), 1);
  const container = document.getElementById("jobs-container");
  if (!container) return;

  container.innerHTML = jobs.map(j => {
    const count = allInquiries.filter(i => i.position === j.pos).length;
    const pct = Math.round((count / maxApplicants) * 100);

    return `
        <div class="job-card">
          <div class="job-img">
            <img src="${j.img}" alt="${j.title}" loading="lazy">
            <div class="job-overlay"></div>
            <div class="job-loc">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${j.loc}
            </div>
          </div>
          <div class="job-body">
            <div class="job-cat">${j.cat}</div>
            <div class="job-title">${j.title}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${j.desc}</div>
            <div class="job-count-wrap">
              <div class="job-count">${count}</div>
              <div class="job-count-lbl">applicant${count !== 1 ? "s" : ""}</div>
            </div>
            <div class="job-progress-mini">
              <div class="job-progress-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        </div>`;
  }).join("");
}

/* ─────────────────────────────── NOTIFICATIONS ─────────────────────────────── */
function notifIconClass(status) {
  const m = { new: "si-gold", deployed: "si-green", reviewed: "si-blue", contacted: "si-purple", rejected: "si-red" };
  return m[status] || "si-gold";
}

function notifSvg(status) {
  const svgs = {
    new: '<svg width="18" height="18" fill="none" stroke="#C9A227" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>',
    deployed: '<svg width="18" height="18" fill="none" stroke="#16a34a" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    reviewed: '<svg width="18" height="18" fill="none" stroke="#2563eb" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    contacted: '<svg width="18" height="18" fill="none" stroke="#7c3aed" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
    rejected: '<svg width="18" height="18" fill="none" stroke="#dc2626" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  return svgs[status] || svgs.new;
}

function notifContent(inq) {
  const name = `${inq.firstName || ""} ${inq.lastName || ""}`.trim() || "Applicant";
  const pos = inq.position || "a position";
  const map = {
    new:       { title: "New inquiry received",     msg: `${name} submitted an application for ${pos}.` },
    deployed:  { title: "Applicant deployed",        msg: `${name} has been successfully deployed as a ${pos}.` },
    reviewed:  { title: "Inquiry reviewed",          msg: `${name}'s application for ${pos} has been reviewed.` },
    contacted: { title: "Follow-up reminder",        msg: `${name} was contacted regarding the ${pos} position.` },
    rejected:  { title: "Application declined",      msg: `${name}'s application for ${pos} was not pursued.` }
  };
  return map[inq.status] || map.new;
}

function notifTimeAgo(ts) {
  if (!ts) return "Just now";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((new Date() - d) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  } catch { return "—"; }
}

function renderNotifications() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;

  const items = allInquiries.slice(0, 20);

  if (!items.length) {
    listEl.innerHTML = '<div class="empty-state" style="padding:40px 20px;"><div class="empty-sub">No notifications yet</div></div>';
    updateNotifBadge();
    return;
  }

  listEl.innerHTML = items.map((inq, idx) => {
    const isUnread = !notifReadIds.has(inq.id);
    const { title, msg } = notifContent(inq);
    const iconCls = notifIconClass(inq.status);
    const svg = notifSvg(inq.status);
    const delay = `d${Math.min(idx + 1, 5)}`;

    return `
      <div class="notif-item anim ${delay}${isUnread ? " unread" : ""}" data-id="${inq.id}" onclick="openNotifDetail('${inq.id}')" style="cursor:pointer;">
        <div class="notif-icon-wrap ${iconCls}">${svg}</div>
        <div style="flex:1;">
          <div class="notif-title">${title}</div>
          <div class="notif-msg">${msg}</div>
          <div class="notif-time">${notifTimeAgo(inq.createdAt)}</div>
        </div>
        ${isUnread ? '<div class="unread-dot"></div>' : ""}
      </div>`;
  }).join("");

  updateNotifBadge();
}

window.openNotifDetail = function (id) {
  notifReadIds.add(id);
  saveNotifRead();
  renderNotifications();
  openDetail(id);
};

window.markAllRead = async function () {
  allInquiries.forEach(i => notifReadIds.add(i.id));
  saveNotifRead();
  renderNotifications();
  showToast("All notifications marked as read");
};

function updateNotifBadge() {
  const unread = allInquiries.filter(i => !notifReadIds.has(i.id)).length;
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.textContent = unread || "0";
    badge.style.display = unread > 0 ? "flex" : "none";
  }
}

/* ─────────────────────────────── EXPORT CSV ─────────────────────────────── */
window.exportData = function () {
  if (!allInquiries.length) {
    showToast("No data to export", "error");
    return;
  }

  const headers = ["#", "First Name", "Last Name", "Email", "Phone", "Position", "Message", "Status", "Date"];
  const rows = allInquiries.map((i, idx) => [
    idx + 1,
    i.firstName,
    i.lastName,
    i.email,
    i.phone,
    i.position,
    (i.message || "").replace(/,/g, "").replace(/\n/g, " "),
    i.status,
    formatDate(i.createdAt)
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${v || ""}"`).join(","))
    .join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `JIMC_Inquiries_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();

  showToast("CSV exported successfully");
};

/* ─────────────────────────────── DATE UTILS ─────────────────────────────── */
function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}

function formatDateLong(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }) + " " + d.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

/* ─────────────────────────────── AUTH STATE BOOT ─────────────────────────────── */
window.addEventListener("load", () => {
  onAuthStateChanged(auth, user => {
    const overlay = document.getElementById("loading-overlay");
    const dashboard = document.getElementById("dashboard");
    const loginScreen = document.getElementById("login-screen");

    if (overlay) {
      overlay.classList.add("hidden");
      setTimeout(() => {
        overlay.style.display = "none";
      }, 800);
    }

    if (user) {
      if (loginScreen) {
        loginScreen.classList.remove("show");
        loginScreen.style.display = "none";
      }
      if (dashboard) {
        dashboard.style.display = "block";
        dashboard.classList.add("show");
      }
      initDashboard();
    } else {
      if (unsubscribeInquiries) {
        unsubscribeInquiries();
        unsubscribeInquiries = null;
      }
      if (dashboard) {
        dashboard.classList.remove("show");
        dashboard.style.display = "none";
      }
      if (loginScreen) {
        loginScreen.style.display = "flex";
        loginScreen.classList.add("show");
      }
    }

    /* ── Admin profile dropdown — only init AFTER DOM is ready ── */
    initAdminProfile();
  });
});

/* ─────────────────────────────── MODAL EVENTS ─────────────────────────────── */
document.getElementById("detail-modal")?.addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

/* ─────────────────────────────── ADMIN PROFILE DROPDOWN ─────────────────────────────── */
function initAdminProfile() {
  const adminChip = document.getElementById("adminChip");
  const adminProfile = document.querySelector(".admin-profile");

  if (!adminChip || !adminProfile) return;

  adminChip.addEventListener("click", function (e) {
    e.stopPropagation();
    adminProfile.classList.toggle("active");
  });

  document.addEventListener("click", function (e) {
    if (!adminProfile.contains(e.target)) {
      adminProfile.classList.remove("active");
    }
  });
}