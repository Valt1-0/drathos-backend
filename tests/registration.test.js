import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// JWT secret must exist before userController is imported (it captures it at load)
process.env.JWT_TOKEN = "test-secret-for-registration-suite";
process.env.NODE_ENV = "test";

let mongod;
let app;

const decode = (token) => jwt.verify(token, process.env.JWT_TOKEN).user;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Import routers after env + DB are ready (controllers read JWT_TOKEN at import)
  const [{ default: userRoute }, { default: serverRoute }] = await Promise.all([
    import("../src/routes/userRoutes.js"),
    import("../src/routes/serverRoutes.js"),
  ]);

  app = express();
  app.use(express.json());
  app.use("/api/users", userRoute);
  app.use("/api/server", serverRoute);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

const validPassword = "Passw0rd!";

describe("registration + invitation flow", () => {
  let adminToken;

  it("elects exactly one admin from concurrent first registrations", async () => {
    // Both requests see an empty users collection and race to bootstrap admin.
    // The atomic adminBootstrapped flag must let only one win.
    const [a, b] = await Promise.all([
      request(app).post("/api/users/register").send({ username: "raceA", password: validPassword }),
      request(app).post("/api/users/register").send({ username: "raceB", password: validPassword }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const roles = [decode(a.body.token).role, decode(b.body.token).role].sort();
    expect(roles).toEqual(["admin", "member"]);

    adminToken = decode(a.body.token).role === "admin" ? a.body.token : b.body.token;
  });

  it("still allows open registration by default", async () => {
    const res = await request(app)
      .post("/api/users/register")
      .send({ username: "openuser", password: validPassword });
    expect(res.status).toBe(200);
    expect(decode(res.body.token).role).toBe("member");
  });

  it("rejects registration without a code once closed", async () => {
    const patch = await request(app)
      .patch("/api/server/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ registrationEnabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.settings.registrationEnabled).toBe(false);

    const res = await request(app)
      .post("/api/users/register")
      .send({ username: "nocode", password: validPassword });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("REGISTRATION_DISABLED");
  });

  it("accepts a valid invite code and consumes it single-use", async () => {
    const created = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(created.status).toBe(201);
    const code = created.body.invitation.code;
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    // First use succeeds
    const first = await request(app)
      .post("/api/users/register")
      .send({ username: "invited", password: validPassword, inviteCode: code });
    expect(first.status).toBe(200);

    // Reusing the same code fails
    const second = await request(app)
      .post("/api/users/register")
      .send({ username: "invited2", password: validPassword, inviteCode: code });
    expect(second.status).toBe(403);
    expect(second.body.code).toBe("INVALID_INVITE");
  });

  it("honors maxUses and records who used the code", async () => {
    const created = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maxUses: 2 });
    expect(created.status).toBe(201);
    expect(created.body.invitation.maxUses).toBe(2);
    const code = created.body.invitation.code;

    const u1 = await request(app)
      .post("/api/users/register")
      .send({ username: "multi1", password: validPassword, inviteCode: code });
    const u2 = await request(app)
      .post("/api/users/register")
      .send({ username: "multi2", password: validPassword, inviteCode: code });
    expect(u1.status).toBe(200);
    expect(u2.status).toBe(200);

    // Third use exceeds maxUses
    const u3 = await request(app)
      .post("/api/users/register")
      .send({ username: "multi3", password: validPassword, inviteCode: code });
    expect(u3.status).toBe(403);
    expect(u3.body.code).toBe("INVALID_INVITE");

    const list = await request(app)
      .get("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = list.body.invitations.find((i) => i.code === code);
    expect(entry.usedCount).toBe(2);
    expect(entry.status).toBe("used");
    expect(entry.uses.map((u) => u.username).sort()).toEqual(["multi1", "multi2"]);
  });

  it("never exceeds maxUses under concurrent registrations", async () => {
    const created = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maxUses: 3 });
    const code = created.body.invitation.code;

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app)
          .post("/api/users/register")
          .send({ username: `race_multi_${i}`, password: validPassword, inviteCode: code })
      )
    );
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(3);

    const list = await request(app)
      .get("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = list.body.invitations.find((i) => i.code === code);
    expect(entry.usedCount).toBe(3);
  });

  it("revokes a used code (keeps history) and blocks further use", async () => {
    const created = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maxUses: 5 });
    const code = created.body.invitation.code;
    const id = created.body.invitation._id;

    await request(app)
      .post("/api/users/register")
      .send({ username: "beforerevoke", password: validPassword, inviteCode: code });

    const del = await request(app)
      .delete(`/api/users/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(false);

    const after = await request(app)
      .post("/api/users/register")
      .send({ username: "afterrevoke", password: validPassword, inviteCode: code });
    expect(after.status).toBe(403);
  });

  it("rejects a made-up invite code", async () => {
    const res = await request(app)
      .post("/api/users/register")
      .send({ username: "faker", password: validPassword, inviteCode: "ZZZZ-ZZZZ" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_INVITE");
  });

  it("blocks invite creation for non-admins", async () => {
    // Register a member via a fresh invite, then try to create a code with it
    const invite = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    const member = await request(app)
      .post("/api/users/register")
      .send({ username: "plainmember", password: validPassword, inviteCode: invite.body.invitation.code });
    const memberToken = member.body.token;

    const res = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
