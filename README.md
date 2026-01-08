# Full-Stack Authentication Application with Monitoring

A complete full-stack application featuring authentication, database integration, change data capture (CDC), and comprehensive monitoring capabilities.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- At least 4GB RAM available for Docker
- Ports available: 80, 3000, 4000, 9092, 2181, 8301

## Quick Start

### 1. Navigate to Project Directory
```bash
cd /home/liron/helfy
```

### 2. Start All Services
```bash
docker compose up -d
```

This will start all services in the following order:
1. PD (Placement Driver)
2. TiKV (Storage)
3. TiDB (SQL layer)
4. Zookeeper
5. Kafka
6. TiCDC
7. Backend API
8. Database Initializer (creates default user)
9. CDC Configurator (sets up changefeed)
10. Consumer (processes CDC events)
11. Frontend

**Note:** First run will take 5-10 minutes to download all Docker images and initialize services.

### 3. Wait for Services to Initialize
```bash
# Watch logs to see when services are ready
docker compose logs -f

# Check service health (in another terminal)
docker compose ps
```

Wait until you see:
- "Server running on http://localhost:3000" in backend logs
- "Database initialized with default user" in db-initializer logs
- "Consumer is running and waiting for messages..." in consumer logs

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **TiDB**: localhost:4000 (MySQL protocol)

### 5. Default Credentials

```
Username: admin
Password: admin123
Email: admin@example.com
```

### 6. Test the Application

#### Via Browser:
1. Open http://localhost in your browser
2. Login with admin/admin123
3. You should see the dashboard with user information

#### Via cURL:
```bash
# Test login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# You'll receive a token in the response
# Use it to test protected endpoints
TOKEN="your-token-here"
curl http://localhost:3000/api/me \
  -H "Authorization: $TOKEN"
```

### 7. View Logs

```bash
# User activity logs (shows login events)
docker compose logs backend | grep '{"timestamp"'

# Database change logs (CDC events)
docker compose logs consumer | grep '{"timestamp"'

# All logs
docker compose logs -f
```

### Stop the Application

```bash
# Stop all services
docker compose down

# Stop and remove all data
docker compose down -v
```

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Part 1: Application Development](#part-1-application-development)
- [Part 2: DevOps Implementation](#part-2-devops-implementation)
- [Part 3: Monitoring & Logging](#part-3-monitoring--logging)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Architecture Decisions](#architecture-decisions)

## Overview

This project implements a complete authentication system with:
- User registration and login with token-based authentication
- Dockerized microservices architecture
- Real-time database change tracking with TiDB CDC
- Event streaming with Apache Kafka
- Structured logging with log4js
- Automated database initialization

## Architecture

### System Components

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Nginx      │────▶│   Backend   │
│   (HTML/JS) │     │   (Proxy)    │     │   (Node.js) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                                                 ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Consumer  │◀────│    Kafka     │◀────│   TiDB CDC  │
│   (Node.js) │     │  (Message    │     │  (Change    │
└─────────────┘     │   Broker)    │     │   Capture)  │
                    └──────────────┘     └──────┬──────┘
                                                 │
                    ┌──────────────┐            │
                    │   Zookeeper  │            │
                    │  (Kafka      │            │
                    │   Coord.)    │            │
                    └──────────────┘            │
                                                 ▼
                    ┌─────────────────────────────────┐
                    │  TiDB Cluster                   │
                    │  ┌─────┐  ┌──────┐  ┌──────┐  │
                    │  │ PD  │  │ TiKV │  │ TiDB │  │
                    │  └─────┘  └──────┘  └──────┘  │
                    └─────────────────────────────────┘
```

### Service Descriptions

1. **Frontend**: Static HTML/CSS/JavaScript served by Nginx with API proxy
2. **Backend**: Node.js/Express REST API handling authentication
3. **TiDB Cluster**:
   - **PD (Placement Driver)**: Cluster coordinator and metadata storage
   - **TiKV**: Distributed key-value storage layer
   - **TiDB**: SQL layer compatible with MySQL protocol
4. **TiCDC**: Change Data Capture component tracking database changes
5. **Kafka**: Message broker for CDC events
6. **Zookeeper**: Kafka cluster coordination
7. **Consumer**: Node.js application consuming and logging CDC events
8. **DB Initializer**: One-time service creating default user

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | TiDB (distributed SQL) |
| Message Queue | Apache Kafka |
| CDC | TiDB CDC (TiCDC) |
| Logging | log4js |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx |

## Part 1: Application Development

### Features Implemented

#### Authentication System
- User registration with email, username, and password
- Secure password hashing using bcrypt (10 salt rounds)
- Token-based authentication using UUID
- Token storage in database with 30-day expiration
- Login/logout functionality
- Protected API endpoints

#### Frontend (Basic HTML)
- Login form with username/email and password fields
- Registration form with validation
- User dashboard displaying user information
- Client-side form validation
- Token management via localStorage

#### Backend API (Node.js/Express)
- RESTful API endpoints
- MySQL2 for database connectivity
- CORS enabled for cross-origin requests
- Environment-based configuration
- Error handling and validation

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tokens Table
```sql
CREATE TABLE tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
);
```

## Part 2: DevOps Implementation

### Dockerization

Each service has its own Dockerfile:

#### Backend Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

#### Frontend Dockerfile
```dockerfile
FROM nginx:alpine
COPY index.html style.css app.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Consumer Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "consumer.js"]
```

### Docker Compose Configuration

The `docker-compose.yml` file orchestrates all services with proper:
- Service dependencies
- Health checks
- Volume persistence
- Network isolation
- Environment variables
- Restart policies

### Database Initialization

The `db-initializer` service automatically:
1. Waits for backend to be ready
2. Connects to TiDB
3. Creates default admin user if not exists
4. Logs credentials to console

Script location: `backend/scripts/init-db.js`

### TiDB Cluster Setup

Three-component TiDB cluster:
1. **PD**: Coordinates cluster metadata
2. **TiKV**: Stores data in a distributed manner
3. **TiDB**: Provides MySQL-compatible interface

### Kafka Setup

- Kafka broker for message streaming
- Zookeeper for Kafka coordination
- Auto-creation of topics enabled
- Configured for single-node deployment

## Part 3: Monitoring & Logging

### User Activity Logging (log4js)

Every login is logged in JSON format:

```json
{
  "timestamp": "2026-01-08T13:00:00.000Z",
  "userId": 1,
  "username": "admin",
  "action": "login",
  "ipAddress": "172.18.0.1",
  "email": "admin@example.com"
}
```

Implementation: `backend/server.js` (login endpoint)

### Database Change Monitoring (TiDB CDC)

#### CDC Architecture
1. **TiCDC Server**: Monitors TiDB changes
2. **Changefeed**: Captures all INSERT/UPDATE/DELETE operations
3. **Kafka Sink**: Publishes changes to Kafka topic
4. **Consumer**: Processes and logs changes

#### CDC Configuration
Automatically configured via `cdc-configurator` service:
```bash
curl -X POST http://ticdc:8301/api/v1/changefeeds \
  -H 'Content-Type: application/json' \
  -d '{
    "changefeed_id": "db-changes",
    "sink_uri": "kafka://kafka:9092/tidb-changes?protocol=canal-json"
  }'
```

#### CDC Event Format (Canal-JSON)
```json
{
  "timestamp": "2026-01-08T13:00:00.000Z",
  "database": "authdb",
  "table": "users",
  "eventType": "INSERT",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "username": "newuser"
  }
}
```

### Real-time Data Processing

The consumer service (`consumer/consumer.js`):
- Connects to Kafka broker
- Subscribes to `tidb-changes` topic
- Processes CDC events in Canal-JSON format
- Logs all database changes in structured JSON format
- Handles graceful shutdown

## API Documentation

### Authentication Endpoints

#### POST /api/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "userId": 1
}
```

#### POST /api/login
Login with username/email and password.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "a819b478-8907-4e9a-9e15-35d4cbd8f908",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin"
  }
}
```

**Logs User Activity:**
```json
{"timestamp":"2026-01-08T13:00:00.000Z","userId":1,"username":"admin","action":"login","ipAddress":"172.18.0.1","email":"admin@example.com"}
```

#### GET /api/me
Get current user information (requires authentication).

**Headers:**
```
Authorization: <token>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin"
  }
}
```

#### POST /api/logout
Logout user (requires authentication).

**Headers:**
```
Authorization: <token>
```

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

#### GET /api/health
Health check endpoint.

**Response (200):**
```json
{
  "status": "ok"
}
```

## Testing

### Test Registration
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Protected Endpoint
```bash
TOKEN="your-token-here"
curl http://localhost:3000/api/me \
  -H "Authorization: $TOKEN"
```

### Test CDC
Any database operation will be captured:
```bash
# Register a new user
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"cdc@test.com","username":"cdctest","password":"password123"}'

# Check consumer logs to see CDC event
docker compose logs consumer | tail -20
```

## Monitoring & Logs

### View All Logs
```bash
docker compose logs
```

### View Specific Service Logs

```bash
# Backend logs (includes user activity)
docker compose logs -f backend

# Consumer logs (database changes)
docker compose logs -f consumer

# TiCDC logs
docker compose logs -f ticdc

# Kafka logs
docker compose logs -f kafka
```

### Log Formats

#### User Activity Logs
```
{"timestamp":"2026-01-08T13:00:00.000Z","userId":1,"username":"admin","action":"login","ipAddress":"172.18.0.1","email":"admin@example.com"}
```

#### Database Change Logs
```
{"timestamp":"2026-01-08T13:00:00.000Z","database":"authdb","table":"users","eventType":"INSERT","data":{"id":1,"email":"user@example.com","username":"newuser"},"old":null}
```

## Troubleshooting

### Services Won't Start
```bash
# Check service status
docker compose ps

# Check logs for errors
docker compose logs

# Restart specific service
docker compose restart <service-name>
```

### TiDB Connection Issues
```bash
# Check TiDB health
docker compose exec tidb curl localhost:10080/status

# Connect to TiDB directly
docker compose exec tidb mysql -h127.0.0.1 -P4000 -uroot

# Check TiDB logs
docker compose logs tidb
```

### CDC Not Working
```bash
# Check TiCDC status
curl http://localhost:8301/api/v1/health

# List changefeeds
curl http://localhost:8301/api/v1/changefeeds

# Check TiCDC logs
docker compose logs ticdc

# Check CDC configurator logs
docker compose logs cdc-configurator
```

### Kafka Issues
```bash
# Check Kafka broker
docker compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# List topics
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer logs
docker compose logs consumer
```

### Reset Everything
```bash
# Stop and remove all containers, networks, and volumes
docker compose down -v

# Rebuild and start fresh
docker compose up -d --build
```

## Project Structure

```
.
├── docker-compose.yml          # Orchestrates all services
├── README.md                   # This file
├── scripts/                    # Helper scripts
├── backend/
│   ├── Dockerfile              # Backend container image
│   ├── package.json            # Backend dependencies
│   ├── .env                    # Environment configuration
│   ├── server.js               # Express server with log4js
│   ├── db.js                   # Database connection
│   └── scripts/
│       └── init-db.js          # Database initialization
├── frontend/
│   ├── Dockerfile              # Frontend container image
│   ├── nginx.conf              # Nginx configuration with proxy
│   ├── index.html              # Main HTML page
│   ├── style.css               # Styling
│   └── app.js                  # Frontend logic
└── consumer/
    ├── Dockerfile              # Consumer container image
    ├── package.json            # Consumer dependencies
    └── consumer.js             # Kafka consumer with log4js
```

## Architecture Decisions

### Why TiDB?
- MySQL-compatible distributed SQL database
- Built-in CDC support
- Horizontal scalability
- ACID transactions

### Why Kafka?
- Reliable message streaming
- Decouples CDC from consumers
- Allows multiple consumers
- Persistent message storage

### Why log4js?
- JSON logging support
- Multiple appenders
- Category-based logging
- Industry standard

### Why Docker Compose?
- Easy orchestration
- Service dependencies
- Health checks
- Volume persistence
- Local development friendly

## Performance Considerations

- TiDB cluster optimized for development (single TiKV node)
- Kafka configured for single-node operation
- Token expiration set to 30 days
- Connection pooling enabled (10 connections)
- Health checks prevent premature service starts

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- SQL injection prevention (parameterized queries)
- CORS configured
- Token-based authentication
- Token expiration
- Secure HTTP headers via nginx proxy
- No secrets in code (environment variables)

## Scaling Considerations

To scale for production:
1. Add more TiKV nodes for storage
2. Add multiple TiDB nodes for SQL layer
3. Scale Kafka brokers
4. Use Redis for session storage
5. Add load balancer for backend
6. Use managed database service
7. Implement rate limiting
8. Add authentication refresh tokens

## License

ISC

## Support

For issues and questions, refer to the troubleshooting section or check service logs.
