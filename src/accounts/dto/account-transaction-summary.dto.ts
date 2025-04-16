import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { AccountTransactionItemDTO } from './account-transaction-item.dto';

/**
 * 계좌별 그룹 요약 응답 (기간별)
 */
export class AccountTransactionSummaryDTO extends BaseListSummaryResponseDTO<AccountTransactionItemDTO> {}
