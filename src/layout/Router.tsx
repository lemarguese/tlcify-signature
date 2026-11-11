import { BrowserRouter, Route, Routes } from "react-router";
import SignPage from "../pages/SignPage/SignPage.tsx";
import PlaygroundPage from "../pages/PlaygroundPage/PlaygroundPage.tsx";

export default function Router () {
  return <BrowserRouter>
    <Routes>
      <Route path="/sign/:endorsementId" element={<SignPage />}/>
      <Route path="/assign/:endorsementId" element={<PlaygroundPage />}/>
    </Routes>
  </BrowserRouter>
}
