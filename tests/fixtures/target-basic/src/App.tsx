import { Routes, Route } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { OrderPage } from "./pages/shop/OrderPage";
import { ShopRouter } from "@/pages/shop/ShopRouter";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/shop/*" element={<ShopRouter />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
