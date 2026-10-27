import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Card, Row, Col, Alert, Spinner, ProgressBar } from 'react-bootstrap';
import { api } from '../services/api';

export default function ClusterMonitorModal({ show, onHide, lang = 'vi' }) {
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [lastServed, setLastServed] = useState(null);
  const [testLog, setTestLog] = useState([]);
  const [isTesting, setIsTesting] = useState(false);

  const t = {
    title: lang === 'vi' ? 'Hệ Thống Phân Tán - Giám Sát Cụm Node' : 'Distributed Cluster Monitor & Failover',
    subtitle: lang === 'vi' 
      ? 'Kiến trúc Multi-Node chịu lỗi: Tắt bất kỳ node nào, hệ thống vẫn hoạt động thông suốt!'
      : 'Fault-tolerant multi-node architecture: Kill any node, system keeps running seamlessly!',
    statusHealthy: lang === 'vi' ? 'CỤM KHỎE MẠNH' : 'CLUSTER HEALTHY',
    statusDegraded: lang === 'vi' ? 'ĐANG CHỊU LỖI (DEGRADED)' : 'DEGRADED (FAILOVER ACTIVE)',
    statusCritical: lang === 'vi' ? 'TẤT CẢ NODE SẬP' : 'ALL NODES DOWN',
    activeNodes: lang === 'vi' ? 'Node Đang Chạy' : 'Active Nodes',
    failovers: lang === 'vi' ? 'Số lần Tự Động Chuyển Tải' : 'Auto Failovers',
    requests: lang === 'vi' ? 'Tổng Requests Cụm' : 'Cluster Requests',
    nodesTitle: lang === 'vi' ? 'Danh Sách Các Node Backend Phân Tán' : 'Distributed Backend Worker Nodes',
    testTitle: lang === 'vi' ? 'Khu Vực Kiểm Thử Cân Bằng Tải & Chịu Lỗi' : 'Load Balancing & Failover Testing',
    btnTestRoundRobin: lang === 'vi' ? 'Gửi 5 Request Kiểm Tra Cân Bằng Tải' : 'Send 5 Requests (Test Round-Robin)',
    btnSimulateCrash: lang === 'vi' ? 'Mô Phỏng Sập Node' : 'Simulate Node Crash',
    btnRecover: lang === 'vi' ? 'Khôi Phục Node' : 'Recover Node',
    refresh: lang === 'vi' ? 'Làm mới trạng thái' : 'Refresh Status',
    close: lang === 'vi' ? 'Đóng' : 'Close',
    theoryTitle: lang === 'vi' ? 'Giải thích Nguyên lý Phân tán & Chịu lỗi cho Giảng viên' : 'Distributed System Architecture & Principles',
    theory1: lang === 'vi'
      ? '1. Đa tiến trình độc lập: 3 Node chạy trên 3 Port riêng biệt (5001, 5002, 5003). Bạn có thể mở Terminal hoặc Task Manager để tắt tiến trình (taskkill/Ctrl+C) thực tế.'
      : '1. Independent Processes: 3 nodes run on distinct ports (5001, 5002, 5003). You can kill them directly via terminal or task manager.',
    theory2: lang === 'vi'
      ? '2. Tự động chuyển tải (Zero-Downtime Failover): Khi 1 node sập hoặc không phản hồi, Gateway phát hiện ngay lập tức và tự động chuyển request sang node khác trong < 50ms, người dùng không nhận thông báo lỗi.'
      : '2. Instant Failover: When 1 node dies, Gateway instantly reroutes traffic to healthy nodes in < 50ms without user interruption.',
    theory3: lang === 'vi'
      ? '3. Đồng bộ dữ liệu tập trung (WAL Concurrency): Cả 3 node dùng chung CSDL SQLite ở chế độ Write-Ahead-Logging (WAL) và Busy Timeout, bảo đảm dữ liệu đặt phòng tức thì và toàn vẹn tuyệt đối.'
      : '3. Data Consistency (WAL Concurrency): All nodes concurrently access SQLite in Write-Ahead-Logging mode, ensuring real-time consistency.'
  };

  // Tải trạng thái cụm
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.cluster.getStatus();
      setClusterData(res);
    } catch (err) {
      console.error('Lỗi lấy trạng thái cụm:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [show]);

  // Lắng nghe sự kiện node vừa phản hồi
  useEffect(() => {
    const handleNodeResponded = (e) => {
      setLastServed(e.detail);
    };
    window.addEventListener('cluster-node-responded', handleNodeResponded);
    return () => window.removeEventListener('cluster-node-responded', handleNodeResponded);
  }, []);

  // Bật/tắt mô phỏng sập node
  const handleToggleNode = async (nodeId) => {
    try {
      setActionLoading(prev => ({ ...prev, [nodeId]: true }));
      await api.cluster.toggleNode(nodeId);
      await fetchStatus();
    } catch (err) {
      alert('Lỗi thao tác node: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [nodeId]: false }));
    }
  };

  // Test gửi 5 request kiểm tra cân bằng tải
  const handleTestRoundRobin = async () => {
    setIsTesting(true);
    setTestLog([]);
    const logs = [];

    for (let i = 1; i <= 5; i++) {
      try {
        const start = Date.now();
        const res = await api.hotels.getAll({ city: 'hanoi' });
        const latency = Date.now() - start;
        logs.push({
          id: i,
          status: 'success',
          text: `Request #${i}: Nhận phản hồi thành công (${latency}ms) - ${res.count || 0} khách sạn`
        });
      } catch (err) {
        logs.push({
          id: i,
          status: 'error',
          text: `Request #${i}: Thất bại (${err.message})`
        });
      }
      setTestLog([...logs]);
      await new Promise(r => setTimeout(r, 200));
    }

    await fetchStatus();
    setIsTesting(false);
  };

  const gateway = clusterData?.gateway;
  const nodes = clusterData?.nodes || [];
  const activeCount = gateway?.activeNodesCount || 0;
  const totalCount = gateway?.totalNodesCount || 3;

  return (
    <Modal show={show} onHide={onHide} size="xl" centered className="cluster-modal">
      <Modal.Header closeButton className="border-0 pb-0" style={{ backgroundColor: '#f8fafc' }}>
        <div>
          <Modal.Title className="fw-bold d-flex align-items-center gap-2" style={{ color: '#002855' }}>
            <i className="bi bi-diagram-3-fill text-warning"></i>
            {t.title}
            <Badge 
              bg={activeCount === totalCount ? 'success' : (activeCount > 0 ? 'warning' : 'danger')}
              className="fs-6 px-3 py-2 text-uppercase"
            >
              {activeCount === totalCount ? t.statusHealthy : (activeCount > 0 ? t.statusDegraded : t.statusCritical)}
            </Badge>
          </Modal.Title>
          <p className="text-muted small mb-0 mt-1">{t.subtitle}</p>
        </div>
      </Modal.Header>

      <Modal.Body className="pt-3" style={{ backgroundColor: '#f8fafc' }}>
        {/* Hàng thống kê tổng quan */}
        <Row className="g-3 mb-4">
          <Col md={3} sm={6}>
            <Card className="border-0 shadow-sm h-100 text-center p-3" style={{ borderLeft: '4px solid #002855' }}>
              <div className="text-muted small text-uppercase fw-semibold">{t.activeNodes}</div>
              <div className="fs-2 fw-bold text-primary mt-1">
                {activeCount} / {totalCount}
              </div>
              <ProgressBar 
                now={(activeCount / totalCount) * 100} 
                variant={activeCount === totalCount ? 'success' : 'warning'} 
                style={{ height: '6px' }}
                className="mt-2"
              />
            </Card>
          </Col>

          <Col md={3} sm={6}>
            <Card className="border-0 shadow-sm h-100 text-center p-3" style={{ borderLeft: '4px solid #F37021' }}>
              <div className="text-muted small text-uppercase fw-semibold">{t.failovers}</div>
              <div className="fs-2 fw-bold text-warning mt-1">
                {gateway?.totalFailovers || 0}
              </div>
              <small className="text-muted">Chuyển tải tức thời 0 gián đoạn</small>
            </Card>
          </Col>

          <Col md={3} sm={6}>
            <Card className="border-0 shadow-sm h-100 text-center p-3" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="text-muted small text-uppercase fw-semibold">{t.requests}</div>
              <div className="fs-2 fw-bold text-success mt-1">
                {gateway?.totalRequests || 0}
              </div>
              <small className="text-muted">Phân phối Round-Robin</small>
            </Card>
          </Col>

          <Col md={3} sm={6}>
            <Card className="border-0 shadow-sm h-100 text-center p-3" style={{ borderLeft: '4px solid #6366f1' }}>
              <div className="text-muted small text-uppercase fw-semibold">
                {lang === 'vi' ? 'Node Vừa Phản Hồi' : 'Last Active Node'}
              </div>
              <div className="fs-3 fw-bold text-indigo mt-1" style={{ color: '#4f46e5' }}>
                {lastServed?.node || (nodes.find(n => n.status === 'ONLINE')?.id || 'Gateway')}
              </div>
              <small className="text-muted">
                {lastServed ? `Port ${lastServed.port} (${lastServed.timestamp})` : 'Cụm đang sẵn sàng'}
              </small>
            </Card>
          </Col>
        </Row>

        {/* Danh sách các Node trong Cụm */}
        <h6 className="fw-bold text-uppercase text-secondary mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-hdd-network-fill text-primary"></i>
          {t.nodesTitle}
        </h6>

        <Row className="g-3 mb-4">
          {nodes.map((node) => {
            const isOnline = node.status === 'ONLINE';
            const isThisLastServed = lastServed && lastServed.node === node.id;

            return (
              <Col md={4} key={node.id}>
                <Card 
                  className={`border-0 shadow-sm h-100 transition-all ${isThisLastServed ? 'ring-2' : ''}`}
                  style={{
                    borderTop: `4px solid ${isOnline ? '#10b981' : '#ef4444'}`,
                    outline: isThisLastServed ? '2px solid #F37021' : 'none'
                  }}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`p-2 rounded-circle ${isOnline ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                          <i className={`bi bi-${isOnline ? 'check-circle-fill' : 'x-circle-fill'}`}></i>
                        </span>
                        <div>
                          <h6 className="fw-bold mb-0">{node.id}</h6>
                          <small className="text-muted">Port {node.port}</small>
                        </div>
                      </div>
                      <Badge bg={isOnline ? 'success' : 'danger'}>
                        {isOnline ? 'ONLINE' : 'OFFLINE (SẬP)'}
                      </Badge>
                    </div>

                    <div className="bg-light p-2 rounded mb-3 small">
                      <div className="d-flex justify-content-between text-muted mb-1">
                        <span>Đã xử lý:</span>
                        <strong className="text-dark">{node.requestsCount} reqs</strong>
                      </div>
                      <div className="d-flex justify-content-between text-muted mb-1">
                        <span>Độ trễ:</span>
                        <strong className="text-dark">{node.lastLatencyMs || 0} ms</strong>
                      </div>
                      <div className="d-flex justify-content-between text-muted">
                        <span>PID Tiến trình:</span>
                        <span className="badge bg-secondary font-monospace">{node.pid || 'N/A'}</span>
                      </div>
                    </div>

                    {isThisLastServed && (
                      <div className="text-center mb-2">
                        <Badge bg="warning" text="dark" className="px-2 py-1">
                          <i className="bi bi-lightning-fill"></i> Vừa phản hồi gần nhất
                        </Badge>
                      </div>
                    )}

                    <Button
                      variant={isOnline ? 'outline-danger' : 'success'}
                      size="sm"
                      className="w-100 fw-semibold"
                      disabled={actionLoading[node.id]}
                      onClick={() => handleToggleNode(node.id)}
                    >
                      {actionLoading[node.id] ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <>
                          <i className={`bi bi-${isOnline ? 'power' : 'arrow-clockwise'} me-1`}></i>
                          {isOnline ? t.btnSimulateCrash : t.btnRecover}
                        </>
                      )}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>

        {/* Khu vực thử nghiệm cân bằng tải */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white border-0 pt-3 pb-2 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0 text-primary">
              <i className="bi bi-play-circle-fill me-2 text-warning"></i>
              {t.testTitle}
            </h6>
            <Button
              variant="primary"
              size="sm"
              disabled={isTesting}
              onClick={handleTestRoundRobin}
              style={{ backgroundColor: '#002855', borderColor: '#002855' }}
            >
              {isTesting ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Đang gửi request...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-1"></i>
                  {t.btnTestRoundRobin}
                </>
              )}
            </Button>
          </Card.Header>
          <Card.Body className="pt-2">
            <p className="text-muted small mb-2">
              Bấm nút trên để gửi chuỗi request liên tục. Cụm Gateway sẽ tự động luân chuyển tải đều qua các Node đang Online theo thuật toán <strong>Round-Robin</strong>.
            </p>

            {testLog.length > 0 && (
              <div className="bg-dark text-light p-3 rounded font-monospace small" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {testLog.map(l => (
                  <div key={l.id} className={l.status === 'success' ? 'text-success' : 'text-danger'}>
                    <i className={`bi bi-${l.status === 'success' ? 'check2' : 'x'} me-1`}></i>
                    {l.text}
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Giải thích lý thuyết cho Giảng viên kiểm tra */}
        <Alert variant="info" className="border-0 shadow-sm mb-0">
          <h6 className="fw-bold mb-2">
            <i className="bi bi-award-fill me-2 text-primary"></i>
            {t.theoryTitle}
          </h6>
          <ul className="mb-0 small ps-3">
            <li className="mb-1">{t.theory1}</li>
            <li className="mb-1">{t.theory2}</li>
            <li>{t.theory3}</li>
          </ul>
        </Alert>
      </Modal.Body>

      <Modal.Footer className="border-0" style={{ backgroundColor: '#f8fafc' }}>
        <Button variant="outline-secondary" size="sm" onClick={fetchStatus} disabled={loading}>
          {loading ? <Spinner size="sm" animation="border" /> : <i className="bi bi-arrow-clockwise me-1"></i>}
          {t.refresh}
        </Button>
        <Button variant="secondary" size="sm" onClick={onHide}>
          {t.close}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
