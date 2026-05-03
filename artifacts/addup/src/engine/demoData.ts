import type { Tx } from "./types";
import { csvToTx } from "./parser";

// ── Demo bank statement ───────────────────────────────────────────────────────
// Realistic South African business bank statement for April 2024.
// Scenarios included:
//  - AUTO_MATCHED: salary, Woolworths, equipment, transfer, Shoprite
//  - TIMING_DIFFERENCE: client payment (1-day), vendor refund (2-day), internet (1-day)
//  - BANK_FEES: FNB monthly service fee, bank admin charge
//  - MISSING_LEDGER_ENTRY: petty cash, unknown EFT
//  - MISSING_BANK_ENTRY: consulting fees (ledger only)
//  - MANY_TO_ONE_MATCH: two Paystack settlements → one ledger entry

const DEMO_BANK_ROWS: Record<string, string>[] = [
  { Date: "2024-04-01", Description: "Salary Payment April",        Amount: "50000.00"  },
  { Date: "2024-04-02", Description: "FNB Monthly Service Fee",     Amount: "-125.50"   },
  { Date: "2024-04-03", Description: "Client Payment Ref A1023",    Amount: "15000.00"  },
  { Date: "2024-04-03", Description: "Woolworths Food Cape Town",   Amount: "-1850.00"  },
  { Date: "2024-04-04", Description: "Internet Subscription Apr",   Amount: "-1200.00"  },
  { Date: "2024-04-04", Description: "Equipment Purchase",          Amount: "-8500.00"  },
  { Date: "2024-04-05", Description: "Transfer to Savings Account", Amount: "-10000.00" },
  { Date: "2024-04-06", Description: "Vendor Refund Credit",        Amount: "450.00"    },
  { Date: "2024-04-10", Description: "Paystack Card Settlement A",  Amount: "-780.00"   },
  { Date: "2024-04-10", Description: "Paystack Card Settlement B",  Amount: "-560.00"   },
  { Date: "2024-04-12", Description: "Bank Administration Charge",  Amount: "-45.00"    },
  { Date: "2024-04-15", Description: "Client Invoice 0044",         Amount: "7500.00"   },
  { Date: "2024-04-18", Description: "Petty Cash Withdrawal",       Amount: "-500.00"   },
  { Date: "2024-04-22", Description: "Shoprite Holdings",           Amount: "-890.00"   },
  { Date: "2024-04-25", Description: "Unknown Transfer EFT8872",    Amount: "3200.00"   },
];

// ── Demo general ledger ───────────────────────────────────────────────────────

const DEMO_LEDGER_ROWS: Record<string, string>[] = [
  { Date: "2024-04-01", Description: "Sal Apr Pay",                         Amount: "50000.00"  },
  { Date: "2024-04-04", Description: "Client Inv 1001 Ref A1023",           Amount: "15000.00"  },
  { Date: "2024-04-03", Description: "Woolworths Staff Catering",           Amount: "-1850.00"  },
  { Date: "2024-04-05", Description: "Internet Sub Apr",                    Amount: "-1200.00"  },
  { Date: "2024-04-04", Description: "Eqp Purch",                          Amount: "-8500.00"  },
  { Date: "2024-04-05", Description: "Transfer Savings",                    Amount: "-10000.00" },
  { Date: "2024-04-08", Description: "Vendor Refund",                       Amount: "450.00"    },
  { Date: "2024-04-10", Description: "Paystack Merchant Settlement Apr",    Amount: "-1340.00"  },
  { Date: "2024-04-16", Description: "Client Inv 0044",                     Amount: "7500.00"   },
  { Date: "2024-04-22", Description: "Shoprite Holdings",                   Amount: "-890.00"   },
  { Date: "2024-04-25", Description: "Consulting Services April",           Amount: "12000.00"  },
];

export function loadDemoData(): { bank: Tx[]; ledger: Tx[] } {
  const { txns: bank,   invalid: bankInv   } = csvToTx(DEMO_BANK_ROWS,   "B");
  const { txns: ledger, invalid: ledgerInv } = csvToTx(DEMO_LEDGER_ROWS, "L");
  return {
    bank:   [...bank,   ...bankInv],
    ledger: [...ledger, ...ledgerInv],
  };
}

export const DEMO_BANK_NAME   = "FNB Business Banking";
export const DEMO_LEDGER_NAME = "Xero Accounting";
export const DEMO_COMPANY     = "Acme Trading (Pty) Ltd";
