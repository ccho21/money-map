import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDTO } from './transaction-create.dto';

export class UpdateTransactionDTO extends PartialType(CreateTransactionDTO) {}
