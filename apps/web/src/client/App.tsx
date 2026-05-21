import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./auth/AuthGate";
import { AuthProvider } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGate />}>
            <Route path="/" element={<WorkspacePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
