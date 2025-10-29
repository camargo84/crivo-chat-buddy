import { CompletenessStatus } from '@/lib/completeness-monitor';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  status: CompletenessStatus | null;
}

export function CompletenessIndicator({ status }: Props) {
  if (!status) {
    return (
      <div className="bg-muted p-4 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground">Aguardando respostas...</p>
      </div>
    );
  }
  
  return (
    <div className={`p-4 rounded-lg border ${
      status.isComplete 
        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {status.isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        )}
        <h3 className="font-semibold text-sm">
          {status.isComplete ? 
            '✅ Coleta de informações concluída com sucesso' : 
            '⏳ Coleta de informações ainda não concluída'
          }
        </h3>
      </div>
      
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium">Completude</span>
          <span className="font-semibold">{status.score}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${
              status.score >= 70 ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${status.score}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-1.5 text-xs">
        <p className="font-semibold mb-2">Informações essenciais:</p>
        {Object.entries(status.essentialInfo).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            {value ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            )}
            <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
              {formatLabel(key)}
            </span>
          </div>
        ))}
      </div>
      
      {status.missingCritical.length > 0 && (
        <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-900">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1.5">
            Faltam:
          </p>
          <ul className="text-xs text-yellow-600 dark:text-yellow-500 space-y-1">
            {status.missingCritical.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    identificacao: 'Identificação do órgão',
    problema: 'Problema/necessidade',
    impacto: 'Impacto quantificado',
    beneficiarios: 'Beneficiários',
    solucaoCandidata: 'Hipótese de solução',
    quantitativos: 'Quantitativos',
    prazos: 'Prazos',
    orcamento: 'Orçamento'
  };
  return labels[key] || key;
}
