// Import the web socket library
import WebSocket from "ws";
// Load the .env file into memory so the code has access to the key
import dotenv from "dotenv";
dotenv.config();
import Speaker from "speaker";
import record from "node-record-lpcm16";
import fs from "fs"; // Import fs for file system operations
import OpenAI from "openai"; // Import OpenAI module

const openai = new OpenAI();

// Function to start recording audio
function startRecording() {
  return new Promise((resolve, reject) => {
    console.log("Speak to send a message to the assistant. Press Enter when done.");
    // Create a buffer to hold the audio data
    const audioData = [];
    // Start recording in PCM16 format
    const recordingStream = record.record({
      sampleRate: 16000, // 16kHz sample rate (standard for speech recognition)
      threshold: 0, // Start recording immediately
      verbose: false,
      recordProgram: "sox", // Specify the program (arecord or sox)
    });
    // Capture audio data
    recordingStream.stream().on("data", (chunk) => {
      audioData.push(chunk); // Store the audio chunks
    });
    // Handle errors in the recording stream
    recordingStream.stream().on("error", (err) => {
      console.error("Error in recording stream:", err);
      reject(err);
    });
    // Set up standard input to listen for Enter key press
    process.stdin.resume(); // Start listening to stdin
    process.stdin.on("data", async () => {
      console.log("Recording stopped.");
      recordingStream.stop(); // Correctly stop the recording stream
      process.stdin.pause(); // Stop listening to stdin
      // Convert audio data to a single Buffer
      const audioBuffer = Buffer.concat(audioData);
      // Save the audio buffer to a file
      const audioFilePath = "./audio.wav";
      fs.writeFileSync(audioFilePath, audioBuffer);

      try {
        // Send the audio file to OpenAI's Whisper API
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
        });

        // Extract the transcribed text from the response
        const transcribedText = transcription.text;
        console.log("Transcribed Text:", transcribedText);

        // Use OpenAI's moderation model to check the transcribed text
        const moderation = await openai.moderations.create({
          model: "omni-moderation-latest",
          input: transcribedText,
        });

        console.log("Was Moderation Flagged?: ", moderation.results[0].flagged);
        // console.log("Moderation Category Scores:", moderation.results[0].category_scores);
        resolve(transcribedText);
      } catch (error) {
        console.error("Error in Whisper API request:", error);
        reject(error);
      }
    });
  });
}

const functions = {
  calculate_sum: (args) => args.a + args.b,
};

const sumTool = {
  type: "function",
  name: "calculate_sum",
  description: "Use this function when asked to add number together, for example when asked 'What's 4 + 6'?. Strictly only use the answer in the prompt.",
  parameters: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    required: ["a", "b"],
  },
};

function main() {
  // Connect to the API
  const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17";
  const ws = new WebSocket(url, {
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      "OpenAI-Beta": "realtime=v1",
    },
  });
  const speaker = new Speaker({
    channels: 2, // Mono or Stereo
    bitDepth: 16, // PCM16 (16-bit audio)
    sampleRate: 14000, // Common sample rate (44.1kHz)
  });

  async function handleOpen() {
    const transcribedText = await startRecording();
    // Define what happens when the connection is opened
    const createConversationEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: transcribedText,
          },
        ],
      },
    };
    console.log("Sending message to OpenAI:", createConversationEvent);
    ws.send(JSON.stringify(createConversationEvent));
    const createResponseEvent = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Please assist the user. Keep answers concise.", // This is where we make our money with prompt engineering
        tools: [sumTool],
        tool_choice: "auto",
      },
    };
    ws.send(JSON.stringify(createResponseEvent));
  }
  ws.on("open", handleOpen);

  function handleMessage(messageStr) {
    const message = JSON.parse(messageStr);
    // Define what happens when a message is received
    switch (message.type) {
      case "response.audio.delta":
        // We got a new audio chunk
        const base64AudioChunk = message.delta;
        const audioBuffer = Buffer.from(base64AudioChunk, "base64");
        speaker.write(audioBuffer);
        break;
      case "response.audio.done":
        speaker.end();
        ws.close();
        break;
      case "response.function_call_arguments.done":
        console.log(`Using function ${message.name} with arguments ${message.arguments}`);
        // 1. Get the function information and call the function.
        const function_name = message.name;
        const function_arguments = JSON.parse(message.arguments);
        const result = functions[function_name](function_arguments);
        // 2. Send the result of the function call
        const functionOutputEvent = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            role: "system",
            output: `${result}`,
          },
        };
        ws.send(JSON.stringify(functionOutputEvent));
        // 3. Request a response
        ws.send(JSON.stringify({ type: "response.create" }));
        break;
    }
  }
  ws.on("message", handleMessage);
}

main();