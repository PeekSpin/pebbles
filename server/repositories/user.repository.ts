import "server-only";

import { and, count, eq, isNull, sum } from "drizzle-orm";

import { db } from "../db";
import { orders, users } from "../db/schema";

export type UserProfileInput = {
  externalUserId: string;
  name: string | null;
  email: string | null;
};

export async function upsertUserProfile(input: UserProfileInput) {
  const [existingByExternalId] = await db
    .select()
    .from(users)
    .where(eq(users.externalUserId, input.externalUserId))
    .limit(1);

  if (existingByExternalId) {
    const [user] = await db
      .update(users)
      .set({
        name: input.name,
        email: input.email,
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, existingByExternalId.id))
      .returning();
    return user;
  }

  if (input.email) {
    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existingByEmail) {
      const [user] = await db
        .update(users)
        .set({
          externalUserId: input.externalUserId,
          name: input.name,
          email: input.email,
          deletedAt: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      return user;
    }
  }

  const [user] = await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({
      target: users.externalUserId,
      set: {
        name: input.name,
        email: input.email,
        deletedAt: null,
        updatedAt: new Date()
      }
    })
    .returning();

  return user;
}

export async function anonymizeUserProfile(externalUserId: string) {
  await db
    .update(users)
    .set({
      name: null,
      email: null,
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(users.externalUserId, externalUserId));
}

export async function findUserByExternalId(externalUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.externalUserId, externalUserId))
    .limit(1);

  return user ?? null;
}

export async function listAdminCustomers(options: { page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const customerWhere = and(eq(users.role, "customer"), isNull(users.deletedAt));
  const [customerRows, [{ total }]] = await Promise.all([db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(customerWhere)
    .orderBy(users.createdAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize), db.select({ total: count() }).from(users).where(customerWhere)]);

  return {
    customers: await Promise.all(customerRows.map(async (customer) => {
    const [summary] = await db
      .select({ orderCount: count(orders.id), totalSpent: sum(orders.totalAmount) })
      .from(orders)
      .where(eq(orders.userId, customer.id));
    return {
      ...customer,
      orderCount: Number(summary.orderCount),
      totalSpent: Number(summary.totalSpent ?? 0)
    };
    })),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}
