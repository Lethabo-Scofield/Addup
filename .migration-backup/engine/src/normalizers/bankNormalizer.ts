export default function bankNormalizer(row: any) {
    const map = {
        date: row.date ?? row.transaction_date ?? row.posted_date,
        description: row.description ?? row.details ?? row.narration,
        amount: row.amount ?? row.Amount,
        debit: row.debit ?? row.Debit,
        credit: row.credit ?? row.Credit,
        reference: row.reference ?? row.ref ?? row.transaction_id
    };
    return map;
}
