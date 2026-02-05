import { router } from "./router";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/Sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-primary-600 text-natural-50">
        <div className="container">
          <RouterProvider router={router} />
          <Toaster />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
