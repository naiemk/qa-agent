import { OrderForm } from "./OrderForm";
import { format } from "../../lib/format";
export function OrderPage() {
  return <OrderForm data-testid="order-form" />;
}
export function OrderPlaced() {
  return <h1>Order placed</h1>;
}
