# Enterprise SaaS Multi-Tenant Expense Management System (EMS)

This repository contains a production-ready backend built as independent microservices for a multi-tenant expense management platform.

## Services

- `api-gateway`
- `auth-service`
- `tenant-service`
- `user-service`
- `expense-service`
- `notification-service`
- `file-service`

## Shared Library

Common configuration, middleware, utilities, response helpers, Redis, and RabbitMQ layers.

## Getting Started

1. Copy `.env.example` to `.env` and adjust values.
2. Run `docker-compose up --build`.
3. Ensure MongoDB, Redis, and RabbitMQ services are available in Docker.

## Architecture

- REST APIs
- JWT Authentication
- RBAC
- Multi-tenant isolation
- Event-driven communication with RabbitMQ
- Redis caching and token storage
- Dockerized microservices
