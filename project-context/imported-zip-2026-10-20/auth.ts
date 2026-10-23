import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { env } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const argonOptions = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const auth = betterAuth({
  appName: "দৈনিক আজকের দিগন্ত",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL, ...env.ADDITIONAL_TRUSTED_ORIGINS],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    cookiePrefix: "ajker-diganta",
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    password: {
      hash: (password) => argonHash(password, argonOptions),
      verify: ({ password, hash }) => argonVerify(hash, password, argonOptions),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: env.NODE_ENV === "test" ? 50 : 5 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/reset-password": { window: 3600, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          const userRole = await prisma.role.findUnique({ where: { code: "USER" } });
          if (!userRole) throw new Error("Required USER role is not seeded");
          await prisma.userRole.create({
            data: { userId: newUser.id, roleId: userRole.id },
          });
        },
      },
    },
  },
});
