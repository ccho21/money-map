export interface StatsSummaryByNote {
  label: string; // e.g. 'Apr', '2025-04-11'
  startDate: string;
  endDate: string;
  expense: number;
  income: number;

  isCurrent: boolean;
}

export interface StatsSummaryByNoteDTO {
  note: string | null; // ✅ 어떤 노트인지 (decoded 문자열)
  totalExpense: number;
  totalIncome: number;
  data: StatsSummaryByNote[]; // ✅ groupBy 단위로 묶인 summary
}
