# Twilio Conference Call with AI Bot - Setup Instructions

## Overview
This system allows you to call your Twilio number and be connected to an AI bot in a conference call. The AI bot uses OpenAI's Realtime API for voice interaction.

## Prerequisites
1. Twilio account with a phone number
2. OpenAI API key with Realtime API access
3. Node.js installed
4. ngrok installed (for local development)

## Setup Steps

### 1. Environment Configuration
Create a `.env` file with:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
OPENAI_API_KEY=your_openai_api_key
```

### 2. Start the Conference Server
```bash
cd app/api/ws
node conference-server.js
```
The server will start on port 8080.

### 3. Start ngrok
In a new terminal:
```bash
ngrok http 8080
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 4. Configure Twilio Webhook

You have two options for connecting to the AI:

#### Option A: Direct Connection (RECOMMENDED - Simpler & More Reliable)
1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers > Manage > Active Numbers
3. Click on your Twilio number
4. In the "Voice Configuration" section:
   - Set "A call comes in" to: Webhook
   - URL: `https://[your-ngrok-id].ngrok-free.app/incoming-call`
   - Method: HTTP POST
5. Save the configuration

#### Option B: Conference Mode (More Complex)
Use the same steps as above but with URL: `https://[your-ngrok-id].ngrok-free.app/conference-join`
- The system will automatically create an AI leg when you join the conference
- May have audio routing issues

### 5. Test the System

#### Option A: Direct Call (Recommended)
Simply call your Twilio number from your phone. You'll be connected to the AI bot in a conference.

#### Option B: Programmatic Testing
1. Update the ngrok URL in `conferenceCall.js` or `makeCall.js`
2. Run: `node conferenceCall.js` or `node makeCall.js`

## How It Works

### Direct Connection Mode (Recommended):
1. **You call your Twilio number** → Twilio receives the call
2. **Twilio hits your webhook** → `/incoming-call`
3. **Server responds with TwiML** using `<Connect>` and `<Stream>`
4. **Direct bi-directional audio stream** established between you and the AI
5. **WebSocket connection** carries audio between Twilio and OpenAI Realtime API
6. **You can talk directly to the AI** → Simple and reliable

### Conference Mode (Alternative):
1. **You call your Twilio number** → Twilio receives the call
2. **Twilio hits your webhook** → `/conference-join`
3. **Server responds with TwiML** that joins you into conference "zeus_sales_demo"
4. **Server automatically creates AI leg** → Dials your Twilio number again with AI parameters
5. **AI leg joins conference** with WebSocket stream to `/media`
6. **Both you and AI are now in the same conference** → Can have audio issues

## File Structure

- `conference-server.js` - Main server handling conference and WebSocket
- `conferenceCall.js` - Script to programmatically start conference calls
- `makeCall.js` - Simple test script for making calls
- `instructions.txt` - AI bot personality and instructions
- `OLD-server.js` - Archived old server implementation

## Troubleshooting

### "Cannot connect to conference"
- Ensure conference-server.js is running on port 8080
- Check ngrok is running and forwarding to port 8080
- Verify Twilio webhook URL is correct

### "No AI response"
- Check OpenAI API key is valid
- Verify instructions.txt exists and is readable
- Check console logs for WebSocket connection errors

### "Call drops immediately"
- Ensure ngrok URL in Twilio console is current
- Check server logs for errors
- Verify all environment variables are set

## Important Notes

- The conference name "zeus_sales_demo" must match across all files
- Only the AI leg should have `ai=true` parameter
- The WebSocket URL is dynamically generated based on request host
- Conference auto-ends after 2 minutes (configurable)
- AI uses "sage" voice model (can be changed in conference-server.js)

## Testing Workflow

1. Start server: `node conference-server.js`
2. Start ngrok: `ngrok http 8080`
3. Update Twilio webhook with ngrok URL
4. Call your Twilio number
5. Talk to the AI bot!

## Support

For issues or questions:
1. Check server console logs
2. Verify all URLs are updated with current ngrok address
3. Ensure all services are running (server, ngrok)
4. Test with the manual scripts (conferenceCall.js or makeCall.js)