/**
 * ChordNode.js
 * Represents a single node in the Chord Distributed Hash Table (DHT) ring.
 * Implements routing, key storage, and hop logging based on Lecture 4.
 */

import { FingerTable } from './FingerTable.js';

export class ChordNode {
  /**
   * @param {number} id - Node identifier (0 <= id < 2^m)
   * @param {number} m - Bit width of identifier space (default m=6)
   */
  constructor(id, m = 6) {
    this.id = id;
    this.m = m;
    this.ringSize = Math.pow(2, m);
    this.predecessor = null;
    this.successor = this;
    this.fingerTable = new FingerTable(id, m);
    this.keys = new Map(); // keyId -> value
    this.ring = null; // reference to enclosing ChordRing simulation
  }

  /**
   * Checks if id x is in the open/closed interval (start, end] in the circular ring.
   * If start == end, interval covers the entire ring except start.
   */
  isInInterval(x, start, end, inclusiveEnd = true) {
    if (start === end) {
      return inclusiveEnd ? true : x !== start;
    }
    if (start < end) {
      return inclusiveEnd ? (x > start && x <= end) : (x > start && x < end);
    } else {
      // Wraps around 0
      return inclusiveEnd ? (x > start || x <= end) : (x > start || x < end);
    }
  }

  /**
   * Finds the closest preceding node to identifier id from the finger table.
   * Scans fingers from m-1 down to 0.
   * @param {number} id
   * @returns {ChordNode}
   */
  closestPrecedingFinger(id) {
    for (let i = this.m - 1; i >= 0; i--) {
      const fingerNodeId = this.fingerTable.entries[i].node;
      // Is fingerNodeId strictly between this.id and id?
      if (this.isInInterval(fingerNodeId, this.id, id, false)) {
        if (this.ring) {
          const targetNode = this.ring.getNode(fingerNodeId);
          if (targetNode) return targetNode;
        }
      }
    }
    return this;
  }

  /**
   * Finds the successor node responsible for a given key or node id.
   * Records hops in trace array for educational demonstration.
   * @param {number} id - Key or node identifier to look up
   * @param {Array<{node: number, action: string}>} trace - Hop tracking
   * @returns {ChordNode}
   */
  findSuccessor(id, trace = []) {
    trace.push({
      fromNode: this.id,
      lookingFor: id,
      successor: this.successor ? this.successor.id : this.id
    });

    // If id lies in (this.id, this.successor.id], then successor is responsible
    if (this.successor && this.isInInterval(id, this.id, this.successor.id, true)) {
      return this.successor;
    }

    // Otherwise, forward request to the closest preceding finger
    const nextNode = this.closestPrecedingFinger(id);
    if (nextNode.id === this.id || !nextNode) {
      // Cannot jump further forward without overshooting; return successor
      return this.successor || this;
    }

    return nextNode.findSuccessor(id, trace);
  }

  /**
   * Stores a key-value pair on this node.
   */
  put(key, value) {
    this.keys.set(key, value);
  }

  /**
   * Retrieves a stored key from this node.
   */
  get(key) {
    return this.keys.get(key);
  }

  /**
   * Deletes a stored key from this node.
   */
  delete(key) {
    return this.keys.delete(key);
  }
}
