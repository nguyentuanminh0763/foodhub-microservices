# Auth Service (Spring Boot + MySQL)

Owns users and identity. Issues JWTs used by every other service.

## Done for you (plumbing)
- Dockerfile, pom.xml (web, JPA, security, MySQL, jjwt), application.yml, bootstrap class
- `/api/auth/health` endpoint

## What YOU code (look for `TODO (YOU CODE THIS)`)
- `model/User.java` — the User entity
- `security/JwtUtil.java` — generate/validate JWT
- `service/AuthService.java` — register/login logic + a `UserRepository` interface
- `controller/AuthController.java` — `/register` and `/login` endpoints + DTOs

## Pre-read (discuss in chat before coding)
- How does stateless JWT auth work, and why does it fit microservices?
- Why hash passwords (BCrypt) instead of encrypting them?

Runs on port **8081**.
