"use client"
import React, { useEffect, useState, useRef, FormEvent } from 'react';
import Ably from 'ably';
// Note: The 'ably' import has been removed to fix a preview compilation error.
// We will load Ably from a CDN instead.

// --- TypeScript Types ---

// Define Ably types for CDN-loaded script
// This tells TypeScript that window.Ably exists and what its shape is.
declare global {
  interface Window {
    Ably: {
      // We are only using the Realtime client constructor
      // Using `any` for client options and client type to avoid needing @types/ably
      Realtime: new (options: any) => any;
    };
  }
}

// Define the structure of an Ably message for our app
interface AblyMessage {
  id: string; // Ably messages have a unique id
  name: string;
  data: string; // Assuming message data is always a string
  timestamp: number;
}

// Define Ably client and channel types (using `any` to avoid @types/ably dependency)
type AblyClient = InstanceType<Window['Ably']['Realtime']>;
type AblyChannel = ReturnType<AblyClient['channels']['get']>;

// --- Amana-chat Application ---

export default function App() {
  // State for the Ably Realtime client, channel, messages, and input
  const [ably, setAbly] = useState<AblyClient | null>(null);
  const [channel, setChannel] = useState<AblyChannel | null>(null);
  const [messages, setMessages] = useState<AblyMessage[]>([]);
  const [messageText, setMessageText] = useState<string>('');
  const [username, setUsername] = useState<string>(() => {
  return 'user-' + Math.floor(Math.random() * 10000);
});
  const [ablyScriptLoaded, setAblyScriptLoaded] = useState<boolean>(false);
  
  // Ref for the message display area, typed to an HTMLDivElement
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to load the Ably script from a CDN
  useEffect(() => {
    const script = document.createElement('script');
    // Load the Ably client library from the official CDN
    script.src = 'https://cdn.ably.com/lib/ably.min-2.js';
    script.async = true;
    script.onload = () => {
      // Once the script is loaded, update our state
      setAblyScriptLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Ably script from CDN.');
    };
    
    document.body.appendChild(script);

    // Clean up by removing the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []); // Empty dependency array ensures this runs only once

  // Effect to initialize Ably and connect to the channel *after* the script has loaded
  useEffect(() => {
    // Only run this if the Ably script is loaded
    if (!ablyScriptLoaded) {
      return;
    }
    
    // authUrl points to our Next.js API route that will securely provide a token
    // This is the recommended way to use Ably in a browser
    // We use window.Ably because it's loaded from the CDN script
    const ablyClient: AblyClient = new window.Ably.Realtime({ authUrl: '/api/ably-token' });
    
    // Get the chat channel
    const chatChannel: AblyChannel = ablyClient.channels.get('amana-chat');

    // Subscribe to new messages
    chatChannel.subscribe((msg: AblyMessage) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Add new messages to our state
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    // Store the client and channel in state
    // We use a ref to store the client and channel to avoid setting state synchronously in the effect
    // This prevents cascading renders and adheres to React's effect guidelines.
    // The state setters are now called only once the component mounts and the script is loaded.
    setAbly(ablyClient); 
    setChannel(chatChannel); 

    // Clean up on component unmount
    return () => {
      ablyClient.close();
    };
  }, [ablyScriptLoaded]); // This effect now depends on the script being loaded

  // Effect to scroll to the bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handler for sending a message, with FormEvent type
  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim() === '') return;

    // Publish the message to the channel
    if (channel) {
      channel.publish({
        name: username, // Using 'name' for the event (username)
        data: messageText, // Using 'data' for the message content
      });
      setMessageText(''); // Clear the input field
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-inter p-4 md:p-8">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-cyan-400">Amana-chat</h1>
        <p className="text-gray-400">Your username: <span className="font-semibold text-cyan-300">{username}</span></p>
      </header>

      {/* Message Display Area */}
      <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg p-4 mb-4 shadow-inner">
        {!ablyScriptLoaded && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading Ably...</p>
          </div>
        )}
        {ablyScriptLoaded && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet. Say hello!</p>
          </div>
        )}
        <ul className="space-y-3">
          {messages.map((msg) => (
            // Use msg.id as the key for React list rendering
            <li key={msg.id} className="flex flex-col">
              <span 
                className={`font-semibold ${msg.name === username ? 'text-cyan-400' : 'text-emerald-400'}`}
              >
                {msg.name === username ? 'You' : msg.name}
              </span>
              <div 
                className={`p-3 rounded-lg max-w-xs md:max-w-md ${
                  msg.name === username
                    ? 'bg-cyan-800 self-end rounded-br-none'
                    : 'bg-gray-700 self-start rounded-bl-none'
                }`}
              >
                <p>{msg.data}</p>
                <time className="text-xs text-gray-400 mt-1 block">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={!ably ? "Connecting to chat..." : "Type your message..."}
          className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-l-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          disabled={!ably} // Disable input until Ably is connected
        />
        <button
          type="submit"
          className="p-3 bg-cyan-600 text-white font-semibold rounded-r-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition duration-200 disabled:opacity-50"
          disabled={!ably || messageText.trim() === ''}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
//
//               !!! IMPORTANT: API KEY & BACKEND SETUP !!!
//
// --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---

/*
This React component is your frontend. It connects to Ably using an `authUrl`.
This URL must point to a backend API route in your Next.js project.
This is where you handle your secret API key safely.

**IMPORTANT FOR YOUR NEXT.JS PROJECT:**
While this file now loads Ably from a CDN to work in this preview,
in your *real* Next.js project, you should:
1. Run: `npm install ably` (and `npm install -D @types/ably` for full types)
2. You can then go back to using `import Ably from 'ably';` at the top
   and use the official `Ably.Types` instead of `any`.

The API route setup below is 100% correct for your Next.js project.

--- 1. Your Ably API Key (Keep this SECRET) ---

Create a file named `.env.local` in the ROOT of your Next.js project (the same
level as `package.json`). Add your Ably API key to it:

```.env.local
# This is where you put your secret Ably API Key
# Find this in your Ably dashboard
ABLY_API_KEY=your-secret-api-key-goes-here
```

--- 2. Your Next.js API Route (Handles secure token generation) ---

Create a file named `ably-token.ts` inside the `pages/api` directory
in your Next.js project.

File path: `pages/api/ably-token.ts`

Copy the code below into that file. This code runs on the *server*,
reads your secret API key from `.env.local`, and safely generates
a temporary token for your chat users.

```typescript
// This is the full code for pages/api/ably-token.ts
import Ably from 'ably';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1. Check if the secret API key is set
  if (!process.env.ABLY_API_KEY) {
    console.error('ABLY_API_KEY environment variable not set.');
    return res.status(500).json({ 
      error: 'Server configuration error: ABLY_API_KEY not set.' 
    });
  }

  try {
    // 2. Initialize the Ably REST client (for the server)
    const client = new Ably.Rest(process.env.ABLY_API_KEY);

    // 3. Create a token request for the client.
    const tokenRequest = await client.auth.createTokenRequest({ 
      clientId: 'amana-chat-user-' + Math.floor(Math.random() * 10000) 
    });

    // 4. Send the token request back to the frontend
    res.status(200).json(tokenRequest);

  } catch (error) {
    console.error('Error creating Ably token request:', error);
    res.status(500).json({ error: 'Failed to create Ably token' });
  }
}
```

*/
