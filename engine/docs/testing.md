# Testing

How to install dependencies

  npm install

How to run the server (development)

  npm run dev

How to build and run

  npm run build
  npm start

How to run tests

  npm test

Example curl request for uploading two CSV files

  curl -X POST 'http://localhost:3000/api/reconciliation/upload' \
    -F 'bankFile=@bank.csv;type=text/csv' \
    -F 'ledgerFile=@ledger.csv;type=text/csv'

Example valid bank CSV

date,description,amount
2021-01-01,Deposit,100.00

Example valid ledger CSV

date,description,amount
2021-01-01,Sale,100.00

Example successful JSON response

{
  "job_id": "rec_20260428_001",
  "status": "parsed",
  "state": { "step": "parsed", "version": 1, "bank_file_checksum": "...", "ledger_file_checksum": "..." },
  "bank": { "transactions": [], "schema": {}, "issues": [] },
  "ledger": { "transactions": [], "schema": {}, "issues": [] },
  "issues": [],
  "next_step": "normalize_review"
}

Example validation error response

{
  "error": "Only CSV files are supported for engine v1",
  "status": "error"
}
