import { HomePage, HomeOrder } from "./components/store";
import { listStoreProducts, listUserOrders } from "../server/repositories/product.repository";
import { ensureUserProfile } from "../server/services/user.service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { products } = await listStoreProducts({ page: 1, pageSize: 4 });
  let recentOrders: HomeOrder[] = [];
  try {
    const profile = await ensureUserProfile();
    recentOrders = (await listUserOrders(profile.id, { page: 1, pageSize: 3 })).orders.map((order) => ({
      id: order.id,
      productName: order.items[0]?.productName ?? "Pebbles order",
      totalAmount: Number(order.totalAmount),
      status: order.status,
      createdAt: order.createdAt.toISOString()
    }));
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Authentication required") throw error;
  }
  return <HomePage products={products} recentOrders={recentOrders} />;
}
