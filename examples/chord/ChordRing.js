/**
 * ChordRing.js
 * Coordinates a circular Chord DHT network.
 * Handles node additions, node removals, finger table stabilization,
 * and key migration according to consistent hashing principles.
 */

import { ChordNode } from './ChordNode.js';

export class ChordRing {
  /**
   * @param {number} m - Bit width of identifier space (default m=6 => 64 slots)
   */
  constructor(m = 6) {
    this.m = m;
    this.ringSize = Math.pow(2, m);
    this.nodes = new Map(); // nodeId -> ChordNode
  }

  /**
   * Returns a sorted list of node IDs.
   */
  getNodeIds() {
    return Array.from(this.nodes.keys()).sort((a, b) => a - b);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Adds a new node to the ring.
   * Updates successor/predecessor pointers, recomputes finger tables,
   * and migrates relevant keys from its successor to the newly joined node.
   * @param {number} id
   * @returns {ChordNode}
   */
  addNode(id) {
    if (this.nodes.has(id)) {
      throw new Error(`Node ${id} already exists in the ring.`);
    }

    const newNode = new ChordNode(id, this.m);
    newNode.ring = this;
    this.nodes.set(id, newNode);

    this.stabilizeRing();

    // Key migration: find keys on the successor that now belong to the new node
    const succ = newNode.successor;
    if (succ && succ.id !== newNode.id) {
      const keysToMigrate = [];
      for (const [key, val] of succ.keys.entries()) {
        // If key belongs to newNode (lies in (newNode.predecessor, newNode])
        if (newNode.isInInterval(key, newNode.predecessor.id, newNode.id, true)) {
          keysToMigrate.push({ key, val });
        }
      }
      for (const { key, val } of keysToMigrate) {
        succ.delete(key);
        newNode.put(key, val);
      }
    }

    return newNode;
  }

  /**
   * Removes a node from the ring and transfers its keys to its successor.
   * @param {number} id
   */
  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;

    const succ = node.successor;
    if (succ && succ.id !== node.id) {
      for (const [key, val] of node.keys.entries()) {
        succ.put(key, val);
      }
    }

    this.nodes.delete(id);
    this.stabilizeRing();
  }

  /**
   * Recalculates predecessor, successor, and finger tables for all active nodes.
   */
  stabilizeRing() {
    const sortedIds = this.getNodeIds();
    const count = sortedIds.length;
    if (count === 0) return;

    for (let idx = 0; idx < count; idx++) {
      const currId = sortedIds[idx];
      const node = this.nodes.get(currId);
      const prevId = sortedIds[(idx - 1 + count) % count];
      const nextId = sortedIds[(idx + 1) % count];

      node.predecessor = this.nodes.get(prevId);
      node.successor = this.nodes.get(nextId);
      node.fingerTable.update(sortedIds);
    }
  }

  /**
   * Stores a key-value pair into the ring.
   * Routes from a specified startNode (or the first node) to find the responsible successor.
   * @param {number} key
   * @param {any} value
   * @param {number} startNodeId
   * @returns {{ responsibleNodeId: number, trace: Array }}
   */
  putKey(key, value, startNodeId = null) {
    const sortedIds = this.getNodeIds();
    if (sortedIds.length === 0) throw new Error('No nodes available in the ring.');

    const startNode = startNodeId !== null && this.nodes.has(startNodeId)
      ? this.nodes.get(startNodeId)
      : this.nodes.get(sortedIds[0]);

    const trace = [];
    const responsibleNode = startNode.findSuccessor(key, trace);
    responsibleNode.put(key, value);

    return {
      responsibleNodeId: responsibleNode.id,
      trace
    };
  }

  /**
   * Looks up a key starting from a given node.
   * @param {number} key
   * @param {number} startNodeId
   * @returns {{ value: any, responsibleNodeId: number, trace: Array }}
   */
  lookupKey(key, startNodeId = null) {
    const sortedIds = this.getNodeIds();
    if (sortedIds.length === 0) throw new Error('No nodes available in the ring.');

    const startNode = startNodeId !== null && this.nodes.has(startNodeId)
      ? this.nodes.get(startNodeId)
      : this.nodes.get(sortedIds[0]);

    const trace = [];
    const responsibleNode = startNode.findSuccessor(key, trace);
    const value = responsibleNode.get(key);

    return {
      value,
      responsibleNodeId: responsibleNode.id,
      trace
    };
  }

  /**
   * Returns a snapshot of the ring: all nodes, their successors, predecessors,
   * finger tables, and stored keys.
   */
  getSnapshot() {
    const snapshot = [];
    for (const id of this.getNodeIds()) {
      const n = this.nodes.get(id);
      snapshot.push({
        id: n.id,
        predecessor: n.predecessor ? n.predecessor.id : null,
        successor: n.successor ? n.successor.id : null,
        keys: Array.from(n.keys.keys()),
        fingerTable: n.fingerTable.getTable()
      });
    }
    return snapshot;
  }
}
