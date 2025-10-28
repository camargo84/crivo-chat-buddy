import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Archive } from "lucide-react";

type StatusBadgeProps = {
  status: string;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const statusConfig = {
    em_formalizacao: {
      label: "Em Andamento",
      variant: "default" as const,
      icon: Clock,
      className: "",
    },
    concluida: {
      label: "Concluída",
      variant: "default" as const,
      icon: CheckCircle2,
      className: "bg-success text-success-foreground",
    },
    arquivada: {
      label: "Arquivada",
      variant: "secondary" as const,
      icon: Archive,
      className: "",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.em_formalizacao;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
