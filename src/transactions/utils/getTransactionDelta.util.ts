import { Transaction, TransactionType } from '@prisma/client';
import { TransactionUpdateRequestDTO } from '../dto/transaction-request.dto';

/**
 * 기존 트랜잭션과 업데이트 요청 DTO 간의 금액 차이를 계산합니다.
 *
 * @param before - 기존 트랜잭션 (DB 객체)
 * @param afterDto - 수정 요청 DTO
 * @returns 변화된 금액 (양수 = 증가, 음수 = 감소)
 */
export const getTransactionDelta = (
  before: Pick<Transaction, 'amount'>,
  afterDto: Partial<Pick<TransactionUpdateRequestDTO, 'amount'>>,
): number => {
  const beforeAmount = before.amount;
  const afterAmount = afterDto.amount ?? beforeAmount;
  return afterAmount - beforeAmount;
};
