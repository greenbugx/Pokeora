import type { VariantEvidencePolicy } from '../../../application/use-cases/sync/sync-cards';
import { toVariantIdentity } from './mapper';

/** Applies the v1 TCGPlayer pricing-key evidence policy. */
export class TcgPlayerVariantEvidencePolicy implements VariantEvidencePolicy {
  toVariantIdentity(evidenceKey: string): { variantType: string; finish: string } | null {
    return toVariantIdentity(evidenceKey);
  }
}
