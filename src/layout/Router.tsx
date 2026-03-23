import { BrowserRouter, Route, Routes } from "react-router";
import AssignPage from "../pages/AssignPage/AssignPage.tsx";
import SignPage from "../pages/SignPage/SignPage.tsx";

export default function Router () {
  return <BrowserRouter>
    <Routes>
      <Route path="/assign/:endorsementId" element={<AssignPage />}/>
      <Route path="/sign/:endorsementId" element={<SignPage />}/>
    </Routes>
  </BrowserRouter>
}
