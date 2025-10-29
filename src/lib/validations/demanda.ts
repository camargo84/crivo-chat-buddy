import { z } from 'zod';

export const situacaoProblemaSchema = z.object({
  situacaoProblema: z.string()
    .trim()
    .min(10, 'A situação-problema deve ter no mínimo 10 caracteres')
    .max(150, 'A situação-problema deve ter no máximo 150 caracteres')
    .refine(
      (val) => !val.match(/^\s*$/),
      'A situação-problema não pode conter apenas espaços'
    )
});

export type SituacaoProblemaInput = z.infer<typeof situacaoProblemaSchema>;

// Função helper para validar
export function validateSituacaoProblema(input: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    situacaoProblemaSchema.parse({ situacaoProblema: input });
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        isValid: false, 
        error: error.errors[0]?.message || 'Validação falhou' 
      };
    }
    return { isValid: false, error: 'Erro de validação' };
  }
}
