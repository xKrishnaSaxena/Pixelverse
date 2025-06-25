# Pixelverse: 2D Metaverse with Real-Time Video and Chat Analysis

Welcome to **Pixelverse**, a dynamic 2D metaverse platform that brings people together through real-time communication, interactive spaces, and immersive virtual experiences. Whether you're chatting globally, engaging in private conversations, or connecting via video calls, Pixelverse offers a seamless and secure environment for multiplayer interaction. Built with a Turborepo monorepo structure, it integrates an HTTP server, WebSocket server, frontend client, and database.

---

## 📽️ Walkthrough

[walkthrough](https://github.com/user-attachments/assets/a9608006-a9ba-4eb3-bc72-df4bd6352522)

---

## 🚀 Features

### 🔐 User Authentication

- Register and log in securely to access the platform.
- Choose a custom avatar to represent yourself in the metaverse.

### 🧱 Space Creation & Joining

- Create your own virtual space with a unique **Space ID**.
- Share the Space ID with others so they can join your space.
- Join existing spaces by entering a valid Space ID.

### 🕹️ Real-Time Multiplayer Movement

- Move your avatar freely in a shared 2D environment using arrow keys.
- See other users' movements in real time, powered by WebSockets.

### 💬 Chat System

#### Global Chat

- Chat with everyone in the space through a shared group chat.

#### Private Proximity Chat

- Send private messages to users within **2 pixels** of your avatar.
- Encourages natural, location-based conversations.

#### Blocking Mechanism

- Block unwanted users in private chats to stop communication from them.

### 📹 Video Chat

- Start a **proximity-based video call** with another user when your avatars are close.
- Enjoy real-time video and audio powered by **WebRTC** for smooth peer-to-peer connections.
- Perfect for one-on-one interactions within the space.

### 🛡️ Real-Time Chat Moderation

- A **bad words filter** detects offensive language in chats.
- **Warning System**:
  - First and second offenses trigger a warning message.
  - Third offense results in automatic removal from the space.
- **Banning Mechanism**:
  - Banned users can’t rejoin unless the space creator unbans them.

---

## 🧰 Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: React, Tailwind CSS
- **Backend**:
  - HTTP Server: Express, Zod (for validation)
  - WebSocket Server: WS
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Video Chat**: WebRTC

---

## 📁 Project Structure

```
Pixelverse/
├── apps/
│   ├── http/       # HTTP server for authentication and space management
│   ├── ws/         # WebSocket server for real-time movement, chat, and video
│   └── frontend/   # Client-side UI built with React
├── packages/
│   └── db/         # Database models and setup
├── .gitignore
├── package.json
├── turbo.json
└── README.md
```

---

## 📚 How to Use

1. **Register and Log In**: Sign up, log in, and pick an avatar to get started.
2. **Create or Join a Space**: Create a new space or join one using a Space ID.
3. **Move Around**: Use arrow keys (↑↓←→) to navigate your avatar in the 2D world.
4. **Chat Globally**: Send messages to everyone in the space via the global chat.
5. **Chat Privately**: When near another user (within 2 pixels), send a private message.
6. **Start a Video Call**: When close to another user, initiate a video call for face-to-face interaction.
7. **Block Users**: Block someone to stop private chats with them.
8. **Stay Respectful**: Avoid offensive language—three strikes, and you’re out of the space!

---

## 🛠️ Setup Instructions

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/xKrishnaSaxena/Pixelverse.git
   ```

2. **Setup Environment Variables**

   - Create a `.env` file in the root directory of the project.
   - Add the following variables:
     - `MONGODB_URI`: Your MongoDB URI.
     - `JWT_SECRET`: A secret key for JWT authentication.
     - `PORT`: The port number for the HTTP server.

3. **Install Dependencies**:

   ```bash
   cd Pixelverse
   npm install
   ```

4. **Run the Application**:

   ```bash
   npm run dev
   ```

5. **Access Pixelverse**:
   - Open your browser and go to `http://localhost:5173`.

---

**Pixelverse** is your gateway to a fun, interactive 2D metaverse. Explore, chat, and connect with others in real time—jump in and enjoy!
