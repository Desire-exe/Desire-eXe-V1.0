
<div align="center">

<a href="https://desire-exe.my.id">
  <img src="https://readme-typing-svg.demolab.com?font=Instrument+Serif&italic=true&weight=500&size=52&duration=1&pause=99999&color=F5EDEE&center=true&vCenter=true&width=500&height=80&lines=D%CE%9ESIR%CE%9E-%CE%9EX%CE%9E" alt="DΞSIRΞ-ΞXΞ" />
</a>

<em>personal portfolio</em>

<br/><br/>

<a href="https://desire-exe.my.id">
  <img src="https://img.shields.io/badge/live-desire--exe.my.id-FF3B3B?style=for-the-badge&labelColor=0B0708" />
</a>

<br/><br/>

<img src="https://img.shields.io/badge/React-0B0708?style=flat-square&logo=react&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/TypeScript-0B0708?style=flat-square&logo=typescript&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/Tailwind-0B0708?style=flat-square&logo=tailwindcss&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/Framer_Motion-0B0708?style=flat-square&logo=framer&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/Node.js-0B0708?style=flat-square&logo=nodedotjs&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/Express-0B0708?style=flat-square&logo=express&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/Prisma-0B0708?style=flat-square&logo=prisma&logoColor=FF6B4A" />
<img src="https://img.shields.io/badge/PostgreSQL-0B0708?style=flat-square&logo=postgresql&logoColor=FF6B4A" />

<br/><br/>

<sub>built by <a href="https://github.com/Desire-exe"><strong>Daramola Daniel</strong></a></sub>

<br/><br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=13&duration=1&pause=99999&color=FF6B4A&center=true&vCenter=true&width=500&lines=CAN+YOU+FEEL+THE+BURN+OF+D%CE%9ESIR%CE%9E%3F" alt="tagline" />

</div>

---

## About

Full-stack developer based in Nigeria. I build web products end to end — React on the front, Node on the back, real users in between.

Currently shipping **Desire-eXe** and **FluxMeet**.

---

## Stack

**Client**
- Vite · React · TypeScript
- Tailwind CSS
- Framer Motion
- React Router

**Server**
- Node.js · Express · TypeScript
- Prisma ORM · PostgreSQL
- Resend (transactional email)
- Zod validation · rate limiting

**Infrastructure**
- Render (Static Site + Web Service + Postgres)
- Custom domain via IDwebhost
- Let's Encrypt SSL

---

## Features

- Multi-page SPA with animated route transitions
- Custom ember/aurora visual system (animated gradients, particle canvas, grain overlay)
- Project case studies with image carousels + lightbox
- Contact form → saves to Postgres → sends email via Resend
- Mobile-first responsive design
- SEO: per-route page titles, sitemap, robots, Open Graph meta

---

## Project Structure

```

Desfolio/
├── client/                 # Vite + React frontend
│   ├── public/             # Static assets (logo, OG image, project screenshots)
│   └── src/
│       ├── components/     # UI components + page sections
│       ├── routes/         # Route pages (Home, Projects, About, Contact, 404)
│       ├── data/           # Project + stack content
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Motion variants, utilities
└── server/                 # Express + Prisma backend
├── prisma/             # Schema + migrations
└── src/
├── routes/         # API routes
├── lib/            # Prisma client, Resend client
└── middleware/     # Rate limiting

```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local install or free tier at [Neon](https://neon.tech))
- [Resend](https://resend.com) API key (free tier)

### Setup

```bash
git clone https://github.com/Desire-exe/Desfolio.git
cd Desfolio

npm install

cd server
cp .env.example .env
# Edit .env — fill in DATABASE_URL, RESEND_API_KEY, CONTACT_TO_EMAIL, etc.

npx prisma generate
npx prisma migrate dev --name init

cd ..
```

Run

```bash
# Terminal 1 — server
npm run dev:server

# Terminal 2 — client
npm run dev
```

· Client: http://localhost:5173
· Server: http://localhost:3001
· Health check: http://localhost:3001/health

---

Environment Variables

Server (server/.env):

```env
DATABASE_URL="postgresql://..."
RESEND_API_KEY="re_..."
CONTACT_TO_EMAIL="you@example.com"
CONTACT_FROM_EMAIL="onboarding@resend.dev"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

Client (client/.env.production for builds):

```env
VITE_API_URL="https://your-api-url"
```

---

Deployment

Both services deploy automatically on push to main:

Service Type URL
Client Render Static Site https://desire-exe.my.id
Server Render Web Service https://desfolioexe.onrender.com
Database Render Postgres (internal)

---

Contact

<div align="center">

<a href="https://github.com/Desire-exe"><img src="https://img.shields.io/badge/GitHub-0B0708?style=for-the-badge&logo=github&logoColor=F5EDEE" /></a>
<a href="https://www.linkedin.com/in/daramola-daniel-a331b3240/"><img src="https://img.shields.io/badge/LinkedIn-0B0708?style=for-the-badge&logo=linkedin&logoColor=F5EDEE" /></a>
<a href="https://wa.me/2348161262401"><img src="https://img.shields.io/badge/WhatsApp-0B0708?style=for-the-badge&logo=whatsapp&logoColor=F5EDEE" /></a>
<a href="https://t.me/Desire_exe"><img src="https://img.shields.io/badge/Telegram-0B0708?style=for-the-badge&logo=telegram&logoColor=F5EDEE" /></a>
<a href="mailto:zaddyexe097@gmail.com"><img src="https://img.shields.io/badge/Email-0B0708?style=for-the-badge&logo=gmail&logoColor=F5EDEE" /></a>

</div>

---

<div align="center">

<sub>© DΞSIRΞ-ΞXΞ — All rights reserved</sub>

</div>