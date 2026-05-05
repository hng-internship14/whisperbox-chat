# WhisperBox Backend Contract

This frontend now expects the backend/signaling service to support the events and endpoints below for WhatsApp/Signal-style behavior.

## HTTP Endpoints

### Existing

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/search?q=...`
- `GET /users/:id/public-key`
- `GET /conversations`
- `GET /conversations/:userId/messages?before=<iso>&limit=50`
- `POST /messages`

### Recommended new endpoints

#### Push subscription

- `POST /push/subscribe`
  - request:
```json
{
  "endpoint": "https://push.example/...",
  "keys": {
    "p256dh": "base64url",
    "auth": "base64url"
  },
  "user_agent": "browser info"
}
```

#### Media upload

- `POST /media/upload`
  - accepts multipart file upload or encrypted blob upload
  - response:
```json
{
  "id": "media_123",
  "url": "https://cdn.example/media_123",
  "content_type": "image/jpeg",
  "size": 183742
}
```

## Conversation Payload

`GET /conversations` should ideally return:

```json
[
  {
    "user_id": "user_b",
    "display_name": "Bob",
    "username": "bob",
    "avatar": null,
    "last_message_at": "2026-05-05T18:42:10.000Z",
    "unread_count": 2,
    "online": true,
    "last_seen_at": "2026-05-05T18:41:45.000Z"
  }
]
```

## Message Model

Messages should preserve `payload` as encrypted JSON or encrypted legacy text. Suggested server-side fields:

```json
{
  "id": "msg_123",
  "from_user_id": "user_a",
  "to_user_id": "user_b",
  "payload": {
    "ciphertext": "...",
    "iv": "...",
    "encryptedKey": "...",
    "encryptedKeyForSelf": "..."
  },
  "created_at": "2026-05-05T18:42:10.000Z",
  "delivered_at": "2026-05-05T18:42:14.000Z",
  "read_at": null,
  "status": "sent"
}
```

## WebSocket Events

### Client -> Server

- `message.send`
```json
{
  "type": "message.send",
  "to": "user_b",
  "payload": {}
}
```

- `message.delivered`
```json
{
  "type": "message.delivered",
  "message_id": "msg_123",
  "from_user_id": "user_b",
  "to_user_id": "user_a"
}
```

- `message.read`
```json
{
  "type": "message.read",
  "message_id": "msg_123",
  "from_user_id": "user_b",
  "to_user_id": "user_a"
}
```

- `typing.start`
- `typing.stop`

- `presence.subscribe`
```json
{
  "type": "presence.subscribe",
  "user_id": "user_a"
}
```

- `presence.ping`
```json
{
  "type": "presence.ping",
  "user_id": "user_a",
  "status": "online"
}
```

- `call.offer`
- `call.answer`
- `call.ice-candidate`
- `call.ended`

### Server -> Client

- `message.receive` or `message.incoming`
- `message.sent`
- `message.delivered`
- `message.read`
- `typing.start`
- `typing.stop`
- `presence.update`
```json
{
  "type": "presence.update",
  "user_id": "user_b",
  "online": true,
  "last_seen_at": "2026-05-05T18:41:45.000Z"
}
```

- `call.offer`
- `call.answer`
- `call.ice-candidate`
- `call.ended`
- `call.rejected`

## Push Notifications

For true WhatsApp-like push while the web app is backgrounded or closed:

1. Store web push subscriptions per user/device.
2. When a message arrives and the recipient has no active websocket, send a push.
3. Payload example:

```json
{
  "title": "Alice",
  "body": "New message",
  "tag": "message:user_a",
  "data": {
    "conversationId": "user_a"
  }
}
```

4. Avoid sending plaintext in push payloads if privacy is a priority. Prefer generic bodies like `New message`.

## TURN / Calling

To make calls reliable across NATs and mobile networks:

1. Provision a TURN server such as Coturn.
2. Set:
   - `VITE_TURN_URL`
   - `VITE_TURN_USERNAME`
   - `VITE_TURN_CREDENTIAL`
3. Rotate TURN credentials if possible.

## Notes

- The current frontend can already consume `presence.update`, `message.delivered`, TURN env vars, and push-capable service worker registration.
- Full WhatsApp/Signal-grade behavior still requires backend support for presence state, durable receipts, push fanout, and media storage.
