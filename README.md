# Pixelverse: 2D Metaverse with Real-Time Chat Analysis

Welcome to **Pixelverse**, a dynamic 2D metaverse platform that enables real-time communication, private and group interaction, and a secure space-based virtual experience. Built using a Turborepo monorepo structure, the project includes an HTTP server, WebSocket server, frontend client, and database setup.

---

## 🚀 Features

### 🔐 User Authentication
- Users can securely register and authenticate.
- Avatar selection is available upon login.

### 🧱 Space Creation & Joining
- Authenticated users can **create** a virtual space.
- Each space generates a unique **Space ID**.
- Other users can **join the space** using the Space ID.

### 🕹️ Real-Time Multiplayer Movement
- Users can freely move their avatars in a shared 2D space.
- Movements are synchronized using WebSockets for real-time updates.

### 💬 Chat System

#### Global Chat
- All players in the space can communicate via a shared group chat.

#### Private Proximity Chat
- Private messaging is enabled when two users are within **2 pixels of distance**.
- This encourages organic and local in-space communication.

#### Blocking Mechanism
- Users can **block** others in private chat.
- Once blocked, the other user cannot initiate or continue the private conversation.

### 🛡️ Real-Time Chat Moderation
- Offensive or inappropriate language is detected using a **bad words filter**.
- **Warning System**:
  - First and second offenses trigger a **warning message**.
  - On the **third offense**, the user is **automatically removed** from the space.
- **Banning Mechanism**:
  - Banned users cannot rejoin the space unless **unbanned by the creator**.

---

## 🧰 Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: React , Tailwind
- **Backend**:
  - HTTP Server: Express , Zod (Validation)
  - WebSocket Server: WS
- **Database**: MongoDB
- **Authentication**: JWT

---

## 📁 Project Structure

```
Pixelverse/
├── apps/
│ ├── http/ # HTTP server (auth, space mgmt)
│ ├── ws/ # WebSocket server (real-time movement, chat)
│ └── frontend/ # Client-side UI
├── packages/
│ └── db/ # DB models and setup
├── .gitignore
├── package.json
├── turbo.json
└── README.md

```

## 🖼️ Demo / Screenshots

### 🔐 Authentication & Avatar Selection
![Authentication Screenshot](link_to_image)

### 🧱 Creating & Joining a Space
![Space Creation Screenshot](link_to_image)

### 🕹️ Multiplayer Movement
![Movement Screenshot](link_to_image)

### 💬 Group & Private Chat
![Chat Screenshot](link_to_image)

### ⚠️ Warning & Ban Message
![Warning Screenshot](link_to_image)

---

## 📌 Repository

🔗 GitHub: [https://github.com/xKrishnaSaxena/Pixelverse](https://github.com/xKrishnaSaxena/Pixelverse)

---
