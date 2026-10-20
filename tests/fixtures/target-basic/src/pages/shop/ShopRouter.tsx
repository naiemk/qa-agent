import { Routes, Route } from "react-router-dom";
import { CatalogPage } from "./CatalogPage";
export function ShopRouter() {
  return (
    <Routes>
      <Route path="catalog" element={<CatalogPage />} />
      <Route path="item/:id" element={<CatalogPage />} />
    </Routes>
  );
}
