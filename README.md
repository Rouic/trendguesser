# 🎮 TrendGuesser

Welcome to **TrendGuesser** – the ultimate higher/lower guessing game where you predict which trending search term has the higher search volume! 🚀 Whether you're a casual player or a tech aficionado, get ready to have fun, challenge your intuition, and climb the leaderboards!

![TrendGuesser Screenshot](/public/images/social-cover.png)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Firebase Functions](#firebase-functions)
- [Deployment](#deployment)
- [CLAUDE.md](#claudemd)
- [License & Acknowledgements](#license--acknowledgements)

---

## Overview

**TrendGuesser** is a fun and engaging game that challenges players to guess whether a hidden search term has a higher or lower search volume compared to a revealed term. With a visually appealing and mobile-friendly design inspired by Balatro, this game offers quick play sessions, customizable challenges, and competitive score-tracking across various categories.

---

## Features

- **Game Mechanics** 🎲:
  - Start with one revealed term displaying its search volume.
  - Guess whether a hidden term has a *higher* or *lower* search volume.
  - On a correct guess: the hidden term becomes the new known term and a new challenge term is presented.
  - On an incorrect guess: the game ends, and your score (the count of consecutive correct guesses) is recorded.

- **Categories & Customization** 🎯:
  - Choose from predefined categories like animals, celebrities, technology, games, and more!
  - Play in *custom mode* by entering your own search term.
  - Track high scores for each category per player.

- **Sleek UI/UX** 💫:
  - Balatro-inspired neon design with a card-based UI.
  - Fully responsive layout – play comfortably on any device.
  - Dynamic backgrounds with royalty-free images for each term.

- **Backend & Data** 🔥:
  - **Firebase Authentication**: Seamless user sign-in.
  - **Firestore Database**: Manage and track trending terms, scores, and leaderboards.
  - **Firebase Cloud Functions**:
    - **fetchSearchVolume**: Get search volume data for custom terms.
    - **updateTrendingTerms**: Refresh trending terms daily.
  - Note: Search volume data is simulated, reminiscent of services like Google Trends.

---

## Project Structure

This project uses **Turborepo** to manage a monorepo, consisting of:

- **`web/`**  
  A Next.js application for the frontend built with TypeScript, TailwindCSS, and Framer Motion.

- **`functions/`**  
  Firebase Cloud Functions serving as the backend for search volume fetching and trending term updates.

- **`packages/`**  
  Shared packages for utilities or components used across the project.

---

## Getting Started

### Prerequisites

- **Node.js**: v18+
- **npm** or **yarn**
- A **Firebase account**