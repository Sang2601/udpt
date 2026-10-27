import express from 'express';
import cors from 'cors';
import http from 'http';

const GATEWAY_PORT = process.env.GATEWAY_PORT || 5000;

// Cấu hình cụm các Node Backend phân tán
const CLUSTER_NODES = [
  {
    id: 'Node-1',
    port: 5001,
    url: 'http://127.0.0.1:5001',
    status: 'UNKNOWN',
    requestsCount: 0,
    failuresCount: 0,
    lastLatencyMs: 0,
    lastChecked: null,
    pid: null
  },
  {
    id: 'Node-2',
    port: 5002,
    url: 'http://127.0.0.1:5002',
    status: 'UNKNOWN',
    requestsCount: 0,
    failuresCount: 0,
    lastLatencyMs: 0,
    lastChecked: null,
    pid: null
  },
  {
    id: 'Node-3',
    port: 5003,
    url: 'http://127.0.0.1:5003',
    status: 'UNKNOWN',
    requestsCount: 0,
    failuresCount: 0,
    lastLatencyMs: 0,
    lastChecked: null,
    pid: null
  }
];

let roundRobinIndex = 0;
let totalFailoversCount = 0;
let totalRequestsHandled = 0;

const app = express();
app.use(cors());

// Middleware phân tích body dạng raw buffer để proxy chính xác mọi loại payload (JSON, form, v.v.)
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// ----------------------------------------------------------------------------
// 1. HEALTH CHECK & HEARTBEAT MONITOR CHO CÁC NODE
// ----------------------------------------------------------------------------
async function checkNodeHealth(node) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${node.url}/api/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    node.lastLatencyMs = latency;
    node.lastChecked = new Date().toISOString();

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const prevStatus = node.status;
      node.status = 'ONLINE';
      node.pid = data.pid || node.pid;

      if (prevStatus === 'OFFLINE' || prevStatus === 'UNKNOWN') {
        console.log(`[CLUSTER] 🟢 ${node.id} (Port ${node.port}) đã KẾT NỐI / KHÔI PHỤC! (Latency: ${latency}ms)`);
      }
    } else {
      markNodeOffline(node, `HTTP ${res.status}`);
    }
  } catch (err) {
    markNodeOffline(node, err.message);
  }
}

function markNodeOffline(node, reason) {
  const prevStatus = node.status;
  node.status = 'OFFLINE';
  node.lastChecked = new Date().toISOString();
  if (prevStatus !== 'OFFLINE') {
    node.failuresCount++;
    console.log(`[CLUSTER ALERT] 🔴 ${node.id} (Port ${node.port}) NGẮT KẾT NỐI / SẬP! Lý do: ${reason}`);
    console.log(`[CLUSTER STATUS] Số Node đang hoạt động: ${getActiveNodes().length}/${CLUSTER_NODES.length}`);
  }
}

function getActiveNodes() {
  return CLUSTER_NODES.filter(n => n.status === 'ONLINE');
}

// Khởi chạy vòng lặp kiểm tra nhịp tim (Heartbeat) định kỳ 1.5 giây
setInterval(() => {
  CLUSTER_NODES.forEach(checkNodeHealth);
}, 1500);

// Chạy kiểm tra ngay khi khởi động
CLUSTER_NODES.forEach(checkNodeHealth);

// ----------------------------------------------------------------------------
// 2. CLUSTER DASHBOARD & MONITOR REST API
// ----------------------------------------------------------------------------
app.get('/api/cluster/status', (req, res) => {
  const activeNodes = getActiveNodes();
  res.json({
    success: true,
    gateway: {
      port: GATEWAY_PORT,
      algorithm: 'Round-Robin with Automatic Instant Failover',
      totalRequests: totalRequestsHandled,
      totalFailovers: totalFailoversCount,
      activeNodesCount: activeNodes.length,
      totalNodesCount: CLUSTER_NODES.length,
      systemHealth: activeNodes.length > 0 ? (activeNodes.length === CLUSTER_NODES.length ? 'HEALTHY' : 'DEGRADED') : 'CRITICAL'
    },
    nodes: CLUSTER_NODES.map(n => ({
      id: n.id,
      port: n.port,
      url: n.url,
      status: n.status,
      requestsCount: n.requestsCount,
      failuresCount: n.failuresCount,
      lastLatencyMs: n.lastLatencyMs,
      lastChecked: n.lastChecked,
      pid: n.pid
    }))
  });
});

// Endpoint mô phỏng sập/bật lại Node thông qua Gateway
app.post('/api/cluster/simulate-toggle/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  const node = CLUSTER_NODES.find(n => n.id.toLowerCase() === nodeId.toLowerCase() || String(n.port) === nodeId);
  if (!node) {
    return res.status(404).json({ error: 'Không tìm thấy Node' });
  }

  try {
    const r = await fetch(`${node.url}/api/node/toggle-fail`, { method: 'POST' });
    const data = await r.json();
    await checkNodeHealth(node);
    res.json({ success: true, node: node.id, port: node.port, result: data });
  } catch (err) {
    res.status(500).json({ error: 'Không thể kết nối đến node: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// 3. LOAD BALANCER & REVERSE PROXY VỚI ZERO-DOWNTIME FAILOVER
// ----------------------------------------------------------------------------
function pickNextNode() {
  const active = getActiveNodes();
  if (active.length === 0) return null;
  roundRobinIndex = (roundRobinIndex + 1) % active.length;
  return active[roundRobinIndex];
}

async function forwardRequest(targetNode, req, res) {
  const targetUrl = `${targetNode.url}${req.originalUrl}`;
  const headers = {};

  // Sao chép toàn bộ headers trừ host
  for (const [key, val] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host') {
      headers[key] = val;
    }
  }

  const options = {
    method: req.method,
    headers,
    redirect: 'manual'
  };

  // Nếu có body (POST, PUT, PATCH, DELETE)
  if (req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
    options.body = req.body;
  }

  const resNode = await fetch(targetUrl, options);
  targetNode.requestsCount++;

  // Forward response headers từ backend node
  res.status(resNode.status);
  resNode.headers.forEach((value, name) => {
    // Tránh duplicate transfer-encoding
    if (name.toLowerCase() !== 'transfer-encoding') {
      res.setHeader(name, value);
    }
  });

  // Gắn các Header minh chứng hệ thống phân tán
  const activeCount = getActiveNodes().length;
  res.setHeader('X-Cluster-Gateway', `Port-${GATEWAY_PORT}`);
  res.setHeader('X-Served-By', targetNode.id);
  res.setHeader('X-Node-Port', String(targetNode.port));
  res.setHeader('X-Cluster-Active-Nodes', `${activeCount}/${CLUSTER_NODES.length}`);

  const buffer = await resNode.arrayBuffer();
  res.send(Buffer.from(buffer));
}

// Bắt mọi request tới /api để cân bằng tải và chịu lỗi (tương thích Express 5)
app.use('/api', async (req, res, next) => {
  // Bỏ qua nếu là endpoint cluster nội bộ
  if (req.originalUrl.startsWith('/api/cluster')) {
    return next();
  }

  totalRequestsHandled++;
  const active = getActiveNodes();

  if (active.length === 0) {
    return res.status(503).json({
      error: 'Tất cả các Node trong Cụm phân tán đều đang ngoại tuyến! Vui lòng khởi động lại ít nhất 1 Node backend.',
      totalNodes: CLUSTER_NODES.length,
      activeNodes: 0
    });
  }

  // Lập danh sách các node thử nghiệm (bắt đầu bằng node theo Round-Robin, tiếp theo là các node dự phòng)
  const primaryNode = pickNextNode();
  const candidateNodes = [primaryNode, ...active.filter(n => n.id !== primaryNode.id)];

  let lastError = null;
  let attemptCount = 0;

  for (const node of candidateNodes) {
    attemptCount++;
    try {
      const startTime = Date.now();
      await forwardRequest(node, req, res);
      
      if (attemptCount > 1) {
        totalFailoversCount++;
        console.log(`⚡ [FAILOVER THÀNH CÔNG] Request [${req.method} ${req.url}] đã tự động chuyển đổi dự phòng sang ${node.id} (${Date.now() - startTime}ms)! Người dùng không bị gián đoạn.`);
      }
      return; // Request thành công hoàn toàn
    } catch (err) {
      lastError = err;
      markNodeOffline(node, err.message);
      console.warn(`⚠️ [FAILOVER TRIGGER] Node ${node.id} gặp sự cố (${err.message})! Đang tự động chuyển tiếp request sang Node kế tiếp...`);
    }
  }

  // Nếu tất cả các node trong danh sách đều thất bại
  res.status(502).json({
    error: 'Không thể kết nối tới các Node trong cụm phân tán.',
    details: lastError ? lastError.message : 'Unknown error',
    totalFailovers: totalFailoversCount
  });
});

// Khởi chạy Gateway
const server = app.listen(GATEWAY_PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🌐 [HỆ THỐNG PHÂN TÁN] API Gateway & Load Balancer`);
  console.log(`📡 Đang lắng nghe tại: http://localhost:${GATEWAY_PORT}`);
  console.log(`🎯 Cụm Backend Workers (Cân bằng tải Round-Robin & Failover tự động):`);
  CLUSTER_NODES.forEach(n => {
    console.log(`   - ${n.id}: ${n.url} (Port ${n.port})`);
  });
  console.log(`⚙️  Cơ chế chịu lỗi: Khi 1 Node sập, Gateway tự động chuyển request sang Node khác < 50ms`);
  console.log(`================================================================\n`);
});
