/**
 * FingerTable.js
 * Implements Chord finger table calculation as specified in Lecture 4 (Định danh).
 * Formula: finger_p[i] = successor((p + 2^i) mod 2^m) for i = 0 .. m-1
 */

export class FingerTable {
  /**
   * @param {number} nodeId - ID of the owning node (p)
   * @param {number} m - Identifier space bit width (default m=6 => ring size 64)
   */
  constructor(nodeId, m = 6) {
    this.nodeId = nodeId;
    this.m = m;
    this.ringSize = Math.pow(2, m);
    // Array of { i, start: (nodeId + 2^i) mod 2^m, node: successorNodeId }
    this.entries = [];
    for (let i = 0; i < m; i++) {
      const start = (this.nodeId + Math.pow(2, i)) % this.ringSize;
      this.entries.push({ i, start, node: nodeId });
    }
  }

  /**
   * Updates the finger table entries given the current list of active nodes in the ring.
   * @param {number[]} activeNodeIds - Sorted array of active node IDs
   */
  update(activeNodeIds) {
    if (!activeNodeIds || activeNodeIds.length === 0) return;
    const sorted = [...activeNodeIds].sort((a, b) => a - b);

    for (let i = 0; i < this.m; i++) {
      const start = (this.nodeId + Math.pow(2, i)) % this.ringSize;
      // Successor of start: first node >= start; if none, wrap around to first node
      let succ = sorted.find((n) => n >= start);
      if (succ === undefined) {
        succ = sorted[0];
      }
      this.entries[i].node = succ;
    }
  }

  /**
   * Returns a printable table representation of the finger table.
   */
  getTable() {
    return this.entries.map((e) => ({
      i: e.i,
      start: e.start,
      successor: e.node
    }));
  }
}
