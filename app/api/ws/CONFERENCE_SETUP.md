# Twilio Conference with AI Bot Setup

## Overview
This setup allows you to create a Twilio conference call where an AI bot (Thalia from Zeus Packaging) automatically joins when the moderator starts the conference.

## Architecture
There are three different approaches provided:

### Option 1: Integrated Server (twilio-conference.js)
- Single server running on port 3000
- Attempts to use WebSocket streaming directly in conference
- **Note:** This approach may have limitations with Twilio's conference streaming

### Option 2: Two-Server Setup (Recommended)
- **twilio-conference-with-ai.js** - Conference manager (port 3000)
- **ai-server-for-conference.js** - AI bot server (port 3001)
- AI bot joins as a separate participant via outbound call

### Option 3: Original 1-on-1 Setup
- **OLD-server.js** - Original implementation for direct calls

## Setup Instructions

### 1. Environment Variables
Ensure your `.env` file contains:
```
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Using the Two-Server Setup (Recommended)

#### Terminal 1: Start the Conference Server
```bash
node app/api/ws/twilio-conference-with-ai.js
```
This runs on port 3000 and manages the conference.

#### Terminal 2: Start the AI Bot Server
```bash
node app/api/ws/ai-server-for-conference.js
```
This runs on port 3001 and handles the AI bot functionality.

### 4. Configure Ngrok (for local testing)
You'll need to expose both ports if using the two-server setup:

```bash
# Terminal 3: Expose port 3000
ngrok http 3000

# Terminal 4: Expose port 3001 (if using two-server setup)
ngrok http 3001
```

### 5. Configure Twilio
1. Go to your Twilio Console
2. Find your phone number
3. Set the webhook URL to: `https://YOUR_NGROK_URL.ngrok-free.app/voice`
4. Set the method to: POST

## How It Works

### Conference Flow:
1. When the moderator (+353861790710) calls, the conference starts
2. The conference server automatically initiates an outbound call to add the AI bot
3. The AI bot connects through the AI server and joins the conference
4. The AI bot (Thalia) introduces herself to the conference
5. All participants can interact with the AI bot naturally
6. When the moderator leaves, the conference ends and the AI bot disconnects

### Key Features:
- **Automatic AI Join**: AI bot automatically joins when conference starts
- **Natural Interruptions**: AI stops speaking when interrupted
- **Conference Awareness**: AI knows it's in a multi-party call
- **Persistent Personality**: Uses instructions.txt for Thalia's personality

## Testing

### Basic Test:
1. Start both servers
2. Call your Twilio number from the moderator phone
3. The AI should join automatically and introduce herself
4. Have other participants call in to test multi-party interaction

### Manual AI Addition (for testing):
If automatic joining fails, you can manually trigger the AI:
```bash
curl -X POST http://localhost:3000/add-ai-to-conference
```

## Troubleshooting

### AI Bot Not Joining:
- Check that both servers are running
- Verify ngrok URLs are correct
- Check Twilio credentials in .env
- Look at console logs for errors

### Audio Issues:
- Ensure audio format is g711_ulaw (required by Twilio)
- Check network connectivity
- Verify OpenAI API key is valid

### Conference Issues:
- Ensure moderator number matches configuration
- Check Twilio webhook is configured correctly
- Verify conference name is consistent

## Notes
- The AI bot appears as a separate participant in the conference
- Multiple people can speak and interact with the AI
- The AI is configured to be helpful but not dominate the conversation
- Modify `instructions.txt` to change the AI's personality or behavior