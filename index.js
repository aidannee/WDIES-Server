import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import OpenAI from "openai";

import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("user-prompt", (msg) => {
    streamListResponse(msg, io);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(process.env.PORT);

const streamListResponse = async (prompt, io) => {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
          You are a JSON AI Assistant which generates content for a todo-list application. 
          If the user asks for anything other than the topic of travel or relocation, please tell them this is an invalid request for this application.
          if the is_travel_related score is less than 80%, respond with "sorry this app is only for travel"
          only respond with JSON formatted responses (array of steps related to user's input). 
          Please use only the following URL-like format:

            CURRENT LOCATION/description: before we go anywhere, we need to prep at home\n
            CURRENT LOCATION/substeps/0: Do this\n
            CURRENT LOCATION/substeps/1: Do this\n
            TRANSIT/description: Do this\n
            TRANSIT/substeps/0: Do this\n
            TRANSIT/substeps/1: Do this\n
            DESTINATION/description: Do this\n
            DESTINATION/substeps/0: Do this\n
            DESTINATION/substeps/1: Do this\n

            (where the first section represents a category, the second section represents a subcategory, and the third section represents an index if applicable)
            (notice that ":" is a reserved special character for key:value separation, and "/" is a reserved special character for heirarchical separation)

            If the user asks for the topic of travel or relocation, please only respond with the following:

            ERROR/description: I'm sorry, but I can only assist with travel related requests!\n
        `,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "gpt-4",
    stream: true,
  });

  for await (const chunk of completion) {
    io.emit("ai-streaming-response", chunk.choices[0].delta.content);

    if (chunk.choices[0].finish_reason === "stop") {
      io.emit("ai-streaming-response-finished", null);
      break;
    }
  }
};
