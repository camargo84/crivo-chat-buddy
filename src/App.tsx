import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import VerificarEmail from "./pages/VerificarEmail";
import RedefinirSenha from "./pages/RedefinirSenha";
import CompleteProfile from "./pages/CompleteProfile";
import CadastroPF from "./pages/CadastroPF";
import CadastroPJ from "./pages/CadastroPJ";
import CadastroPJResponsavel from "./pages/CadastroPJResponsavel";
import Dashboard from "./pages/Dashboard";
import AgenteCenario from "./pages/AgenteCenario";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeToggle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/completar-cadastro" element={<CompleteProfile />} />
          <Route path="/cadastro-pf" element={<CadastroPF />} />
          <Route path="/cadastro-pj" element={<CadastroPJ />} />
          <Route path="/cadastro-pj/responsavel" element={<CadastroPJResponsavel />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agente-cenario/:id" element={<AgenteCenario />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
