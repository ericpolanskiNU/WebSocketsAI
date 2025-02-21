# WebSockets Realtime

This project uses WebSockets to interact with OpenAI's API in real-time. It records audio, transcribes it using OpenAI's Whisper API, and sends the transcribed text to OpenAI's GPT model for processing. The response is then played back using a speaker.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Sox (Sound eXchange) installed on your system (this can be done via pip install sox)

## Getting Started

1. Clone the repository:

    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. Install the dependencies:

    ```sh
    npm install ws dotenv speaker node-record-lpcm16 fs openai
    ```

3. Create a `.env` file in the root directory and add your OpenAI API key:

    ```plaintext
    OPENAI_API_KEY=your_openai_api_key
    ```

4. Run the application:

    ```sh
    node index.js
    ```

## How It Works

1. **Recording Audio**: When the application starts, it prompts you to speak and press Enter when done. It records your audio using the `node-record-lpcm16` library.

2. **Transcribing Audio**: The recorded audio is saved to a file (`audio.wav`) and sent to OpenAI's Whisper API for transcription. The transcribed text is then printed to the console.

3. **Moderation**: The transcribed text is checked using OpenAI's moderation model to ensure it meets content guidelines.

4. **Sending Message**: The transcribed text is sent to OpenAI's GPT model via a WebSocket connection. The model processes the text and sends back a response.

5. **Handling Response**: The response from the GPT model can include text and audio. The audio response is played back using the `speaker` library. If the response includes a function call, the specified function is executed, and the result is sent back to the model.

## Project Structure

- `index.js`: Main application file that contains the logic for recording audio, transcribing it, sending it to OpenAI, and handling the response.
- `.env`: Environment file to store the OpenAI API key.
- `package.json`: Contains the project metadata and dependencies.

## Dependencies

- `ws`: WebSocket library for real-time communication.
- `dotenv`: Loads environment variables from a `.env` file.
- `speaker`: Plays audio data.
- `node-record-lpcm16`: Records audio in PCM16 format.
- `fs`: File system operations.
- `openai`: OpenAI API client.

## License

This project is licensed under the ISC License.