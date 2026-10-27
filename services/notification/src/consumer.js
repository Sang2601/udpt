/**
 * services/notification/src/consumer.js
 * RabbitMQ Consumer for Notification Service (Bài 3 - Trao đổi thông tin).
 * Subscribes to booking events with:
 * - Durable queue: 'notification.bookings.queue'
 * - Manual ACKs: channel.ack(msg) after successful database persistence
 * - Idempotency: Duplicate deliveries with same eventId are safely ignored
 */

import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

export class NotificationConsumer {
  constructor(db, rabbitUrl = process.env.RABBITMQ_URL || 'amqp://hotel_rabbit:rabbit_secure_pass_2026@localhost:5672') {
    this.db = db;
    this.rabbitUrl = rabbitUrl;
    this.connection = null;
    this.channel = null;
    this.exchangeName = 'hotel.events';
    this.queueName = 'notification.bookings.queue';
    this.isStopping = false;
  }

  async start() {
    await this._connect();
  }

  async _connect() {
    try {
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      const q = await this.channel.assertQueue(this.queueName, { durable: true });

      // Bind to booking events
      await this.channel.bindQueue(q.queue, this.exchangeName, 'booking.*');

      this.channel.prefetch(1);

      console.log(`[NotificationConsumer] Listening on RabbitMQ queue "${this.queueName}"...`);

      this.channel.consume(q.queue, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          const eventId = content.eventId || msg.properties.messageId || uuidv4();
          const userId = content.user_id || content.userId;

          console.log(`[NotificationConsumer] Received event "${routingKey}" (EventId: ${eventId}) for User: ${userId}`);

          let title = '';
          let message = '';
          let type = '';

          if (routingKey === 'booking.created') {
            type = 'booking_confirmed';
            title = 'Đặt phòng thành công';
            message = `Đơn đặt phòng ${content.booking_code || ''} tại ${content.hotel_name || 'khách sạn'} đã được xác nhận.`;
          } else if (routingKey === 'booking.cancelled') {
            type = 'booking_cancelled';
            title = 'Đơn đặt phòng đã bị hủy';
            message = `Đơn đặt phòng ${content.bookingId || ''} đã được hủy thành công.`;
          }

          if (userId) {
            await this.db.saveNotification({
              id: uuidv4(),
              eventId,
              userId,
              type,
              title,
              message,
              payload: content
            });
          }

          // Manual ACK
          this.channel.ack(msg);
        } catch (processErr) {
          console.error(`[NotificationConsumer] Error processing message: ${processErr.message}`);
          // Negative ACK with requeue=false to prevent infinite loops, or requeue if transient
          this.channel.nack(msg, false, false);
        }
      });

      this.connection.on('error', (err) => {
        console.warn(`[NotificationConsumer] Connection error: ${err.message}. Retrying...`);
        this._reconnect();
      });

      this.connection.on('close', () => {
        if (!this.isStopping) {
          console.warn('[NotificationConsumer] Connection closed. Retrying in 3s...');
          setTimeout(() => this._reconnect(), 3000);
        }
      });
    } catch (err) {
      console.warn(`[NotificationConsumer] RabbitMQ connection error: ${err.message}. Retrying in 5s...`);
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
    await this._connect();
  }

  async stop() {
    this.isStopping = true;
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch { /* ignore */ }
  }
}
