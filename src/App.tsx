import { router } from "./router";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/Sonner";

function App() {
  return (
    <div className="min-h-[100dvh] bg-primary-600 text-natural-50">
      <div className="container">
        <RouterProvider router={router} />
        <Toaster />
      </div>
    </div>
  );
}

export default App;
