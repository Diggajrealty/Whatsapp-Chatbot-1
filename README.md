# WhatsApp Gemini Bot

A WhatsApp automation bot that uses `whatsapp-web.js` and the Google Gemini API (`gemini-2.0-flash` model) to reply to private messages.

## Features
- Connects via QR code displayed in the terminal.
- Only responds to private/direct messages (ignores group chats).
- Maintains per-user conversation history so chats feel continuous and contextual.
- Shows a "typing..." indicator before sending a reply.

## Setup Instructions

1. **Install Dependencies:**
   Make sure you have Node.js installed. Open your terminal in the project directory and run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment file to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows, you can just rename the file or copy its contents into a new `.env` file)*.
   Edit the `.env` file and replace `your_gemini_api_key_here` with your actual Google Gemini API key.

3. **Run the Bot:**
   Start the application:
   ```bash
   npm start
   ```
   A QR code will appear in your terminal. Scan it using the WhatsApp app on your phone (Linked Devices -> Link a Device).

## Usage
Once connected, any private message sent to your WhatsApp account will be processed by the Gemini API, and the bot will reply automatically based on the conversation history.
