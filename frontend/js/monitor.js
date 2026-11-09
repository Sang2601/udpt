const SERVICES = [
    { name: "API Gateway", port: 8088, url: "http://localhost:8088/actuator/health", category: "Gateway" },
    { name: "Auth Service", port: 8080, url: "http://localhost:8080/actuator/health", category: "Core" },
    { name: "User Service", port: 8081, url: "http://localhost:8081/actuator/health", category: "Core" },
    { name: "Room Service (Inst 1)", port: 8083, url: "http://localhost:8083/actuator/health", category: "App (Active)" },
    { name: "Room Service (Inst 2)", port: 8085, url: "http://localhost:8085/actuator/health", category: "App (Scaled)" },
    { name: "Booking Service (Inst 1)", port: 8082, url: "http://localhost:8082/actuator/health", category: "App (Active)" },
    { name: "Booking Service (Inst 2)", port: 8086, url: "http://localhost:8086/actuator/health", category: "App (Scaled)" },
    { name: "Payment Service", port: 8084, url: "http://localhost:8084/actuator/health", category: "App (Active)" }
];

let testCount8083 = 0;
let testCount8085 = 0;

async function checkSingleService(svc) {
    const start = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(svc.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - start);

        if (resp.ok) {
            const data = await resp.json().catch(() => ({ status: "UP" }));
            return { online: true, latency: elapsed, status: data.status || "UP" };
        } else {
            return { online: false, latency: elapsed, status: `HTTP ${resp.status}` };
        }
    } catch (e) {
        return { online: false, latency: 0, status: "DOWN" };
    }
}

async function renderServices() {
    const grid = document.getElementById("servicesGrid");
    grid.innerHTML = "";

    for (const svc of SERVICES) {
        const card = document.createElement("div");
        card.className = "card";
        card.id = `svc-${svc.port}`;
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="service-name">${svc.name}</div>
                    <div class="service-port">Port: ${svc.port} • ${svc.category}</div>
                </div>
                <span class="status-dot status-starting" id="dot-${svc.port}"></span>
            </div>
            <div class="metric-row">
                <span>Trạng thái:</span>
                <span class="metric-val" id="stat-${svc.port}">Checking...</span>
            </div>
            <div class="metric-row">
                <span>Độ trễ (Ping):</span>
                <span class="metric-val" id="lat-${svc.port}">-</span>
            </div>
        `;
        grid.appendChild(card);
    }

    refreshAllHealth();
}

async function refreshAllHealth() {
    for (const svc of SERVICES) {
        const res = await checkSingleService(svc);
        const dot = document.getElementById(`dot-${svc.port}`);
        const stat = document.getElementById(`stat-${svc.port}`);
        const lat = document.getElementById(`lat-${svc.port}`);

        if (dot && stat && lat) {
            if (res.online) {
                dot.className = "status-dot status-online";
                stat.textContent = res.status;
                stat.style.color = "var(--success)";
                lat.textContent = `${res.latency} ms`;
            } else {
                dot.className = "status-dot status-down";
                stat.textContent = res.status;
                stat.style.color = "var(--danger)";
                lat.textContent = "-";
            }
        }
    }
}

async function refreshLbStatus() {
    try {
        const resp = await fetch("http://localhost:8088/api/lb/status");
        if (resp.ok) {
            const data = await resp.json();
            const roomInstances = data.services["room-service"] || [];
            for (const inst of roomInstances) {
                if (inst.url.includes("8083")) {
                    testCount8083 = inst.servedRequests;
                } else if (inst.url.includes("8085")) {
                    testCount8085 = inst.servedRequests;
                }
            }
            updateLbBar();
        }
    } catch (e) {
        console.warn("Could not fetch LB status:", e);
    }
}

function updateLbBar() {
    const total = testCount8083 + testCount8085;
    const count8083El = document.getElementById("count8083");
    const count8085El = document.getElementById("count8085");
    const pct8083El = document.getElementById("pct8083");
    const pct8085El = document.getElementById("pct8085");
    const bar8083 = document.getElementById("bar8083");
    const bar8085 = document.getElementById("bar8085");

    count8083El.textContent = testCount8083;
    count8085El.textContent = testCount8085;

    if (total === 0) {
        pct8083El.textContent = "50%";
        pct8085El.textContent = "50%";
        bar8083.style.width = "50%";
        bar8085.style.width = "50%";
    } else {
        const pct1 = Math.round((testCount8083 / total) * 100);
        const pct2 = 100 - pct1;
        pct8083El.textContent = `${pct1}%`;
        pct8085El.textContent = `${pct2}%`;
        bar8083.style.width = `${pct1}%`;
        bar8085.style.width = `${pct2}%`;
    }
}

async function sendTestBatch(count = 10) {
    const btn = document.getElementById("btnTestBatch");
    btn.disabled = true;
    const logEl = document.getElementById("testLog");
    logEl.innerHTML = "";

    for (let i = 1; i <= count; i++) {
        const start = performance.now();
        try {
            const resp = await fetch("http://localhost:8088/api/rooms");
            const servedBy = resp.headers.get("X-Served-By") || "Unknown";
            const elapsed = Math.round(performance.now() - start);

            const line = document.createElement("div");
            line.className = "test-log-line success";
            line.textContent = `[Req #${i}] 200 OK (${elapsed}ms) -> Served by: ${servedBy}`;
            logEl.appendChild(line);
            logEl.scrollTop = logEl.scrollHeight;
        } catch (e) {
            const line = document.createElement("div");
            line.className = "test-log-line";
            line.style.color = "var(--danger)";
            line.textContent = `[Req #${i}] FAILED: ${e.message}`;
            logEl.appendChild(line);
        }
        await new Promise(r => setTimeout(r, 60));
    }

    await refreshLbStatus();
    btn.disabled = false;
}

// Init & periodic refresh
window.addEventListener("DOMContentLoaded", () => {
    renderServices();
    refreshLbStatus();
    setInterval(refreshAllHealth, 3500);
    setInterval(refreshLbStatus, 4000);
});
