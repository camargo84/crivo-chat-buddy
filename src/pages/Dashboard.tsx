import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Plus, LogOut, Loader2, FolderOpen, CheckCircle2, Archive } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { NovaDemandaModal } from "@/components/demanda/NovaDemandaModal";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ProjectCard } from "@/components/ProjectCard";

type UserProfile = {
  id: string;
  full_name: string;
  organization_name: string;
  organization_id: string;
  profile_type: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility_status: string;
  current_enfoque: string;
  last_accessed_at: string;
  created_at: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ativas');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    // Get profile
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      navigate("/completar-cadastro");
      return;
    }

    setProfile(profileData);

    // Get active projects
    const { data: activeData } = await supabase
      .from("projects")
      .select("*")
      .eq("visibility_status", "ativa")
      .order("last_accessed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (activeData) {
      setActiveProjects(activeData);
    }

    // Get archived projects
    const { data: archivedData } = await supabase
      .from("projects")
      .select("*")
      .eq("visibility_status", "arquivada")
      .order("last_accessed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (archivedData) {
      setArchivedProjects(archivedData);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = {
    total: activeProjects.length + archivedProjects.length,
    emAndamento: activeProjects.filter((p) => p.status === "em_formalizacao").length,
    concluidas: activeProjects.filter((p) => p.status === "concluida").length,
    arquivadas: archivedProjects.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-blue rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Framework CRIVO</h1>
              <p className="text-sm text-muted-foreground">{profile?.organization_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.profile_type.replace("_", " ")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <p className="text-3xl font-bold">{stats.emAndamento}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="text-3xl font-bold">{stats.concluidas}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Arquivadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-muted-foreground" />
                <p className="text-3xl font-bold">{stats.arquivadas}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Minhas Demandas</h2>
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Demanda
          </Button>
        </div>

        <NovaDemandaModal open={dialogOpen} onOpenChange={setDialogOpen} />

        {/* Tabs: Ativas / Arquivadas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ativas">
              Ativas ({activeProjects.length})
            </TabsTrigger>
            <TabsTrigger value="arquivadas">
              Arquivadas ({archivedProjects.length})
            </TabsTrigger>
          </TabsList>
          
          {/* Tab: Demandas Ativas */}
          <TabsContent value="ativas" className="space-y-6 mt-6">
            {/* Busca em ativas */}
            <GlobalSearch searchInArchived={false} />
            
            {/* Grid de cards */}
            {activeProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeProjects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onUpdate={checkAuth} 
                  />
                ))}
              </div>
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhuma demanda ativa</p>
                  <p className="text-sm text-muted-foreground mb-4">Crie sua primeira demanda para começar</p>
                  <Button onClick={() => setDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Demanda
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Tab: Demandas Arquivadas */}
          <TabsContent value="arquivadas" className="space-y-6 mt-6">
            {/* Busca em arquivadas */}
            <GlobalSearch searchInArchived={true} />
            
            {/* Grid de cards */}
            {archivedProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedProjects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onUpdate={checkAuth} 
                  />
                ))}
              </div>
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhuma demanda arquivada</p>
                  <p className="text-sm text-muted-foreground">As demandas arquivadas aparecerão aqui</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
