import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Desktop from "@/components/Desktop";

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Desktop />
    </TooltipProvider>
  );
}

export default App;
