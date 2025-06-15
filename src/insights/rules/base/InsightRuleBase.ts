// insights/InsightRuleBase.ts

import { InsightDTO } from '../../dto/insight.dto';
import { InsightQueryDTO } from '../../dto/query.dto';
import { InsightContextType } from '../../types/type';

export abstract class InsightRuleBase {
  abstract getSupportedContexts(): InsightContextType[];
  abstract generate(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<InsightDTO[]>;
}
