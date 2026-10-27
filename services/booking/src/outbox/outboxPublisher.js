/**
 * services/booking/src/outbox/outboxPublisher.js
 * Transactional Outbox Publisher for Booking Service (Bài 3 - Trao đổi thông tin).
 * Ensures zero message loss between local CockroachDB transaction and RabbitMQ broker.
 * Employs publisher confirms and automatic reconnection.
 */

import amqp from 'amqplib';

export class OutboxPublisher {
  /**
   * @param {Object} db - BookingDatabase instance
   * @param {string} rabbitUrl - AMQP connection string
   */
  constructor(db, rabbitUrl = process.env.RABBITMQ_URL || 'amqp://hotel_rabbit:rabbit_secure_pass_2026@localhost:5672') {
    this.db = db;
    this.rabbitUrl = rabbitUrl;
    this.connection = null;
    this.channel = null;
    this.timer = null;
    this.isStopping = false;
    this.exchangeName = 'hotel.events';
  }

  async start() {
    await this._connectRabbit();
    this.timer = setInterval(() => this._pollAndPublish(), 2000);
  }

  async _connectRabbit() {
    try {
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createConfirmChannel();

      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      this.connection.on('error', (err) => {
        console.warn(`[OutboxPublisher] RabbitMQ connection error: ${err.message}. Retrying...`);
        this._reconnect();
      });

      this.connection.on('close', () => {
        if (!this.isStopping) {
          console.warn('[OutboxPublisher] RabbitMQ connection closed. Retrying in 3s...');
          setTimeout(() => this._reconnect(), 3000);
        }
      });

      console.log(`[OutboxPublisher] Connected to RabbitMQ at ${this.rabbitUrl.replace(/:[^:]*@/, ':****@')}`);
    } catch (err) {
      console.warn(`[OutboxPublisher] Initial RabbitMQ connection failed (${err.message}). Outbox events will queue safely in database until broker is online.`);
      setTimeout(() => this._reconnect(), 5000);
    }
  }

  async _reconnect() {
    if (this.isStopping) return;
    try {
      if (this.channel) await this.channel.close().catch(() => {});
      if (this.connection) await this.connection.close().catch(() => {});
    } catch { /* ignore */ }
    this.channel = null;
    this.connection = null;
    await this._connectRabbit();
  }

  async _pollAndPublish() {
    if (!this.channel || this.isStopping) return;

    try {
      const events = await this.db.getUnpublishedOutboxEvents(10);
      for (const ev of events) {
        const payloadObj = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
        const content = Buffer.from(JSON.stringify(payloadObj));
        const routingKey = ev.event_type; // 'booking.created' or 'booking.cancelled'

        // Publish with publisher confirm and persistent deliveryMode: 2
        await new Promise((resolve, reject) => {
          this.channel.publish(
            this.exchangeName,
            routingKey,
            content,
            {
              persistent: true,
              messageId: ev.id,
              contentType: 'application/json',
              timestamp: Date.now()
            },
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        await this.db.markOutboxEventPublished(ev.id);
        console.log(`[OutboxPublisher] Successfully published event "${routingKey}" (EventId: ${ev.id}) to RabbitMQ`);
      }
    } catch (err) {
      console.warn(`[OutboxPublisher] Error during outbox publishing: ${err.message}`);
    }
  }

  async stop() {
    this.isStopping = true;
    if (this.timer) clearInterval(this.timer);
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch { /* ignore */ }
  }
}
