# Product boundaries

- Authenticated workspace records come from the TRACE API and database. No demo identities or seeded business records are shipped in the frontend.
- Client, auditor, and administrator roles are issued by the API; navigation is not an authorization boundary.
- Platform administrators see operational records but do not receive access to client evidence contents.
- Audit checks, sampling, and report outputs are deterministic review aids and are not audit opinions.
- The event chain is a tamper-evident application log, not a public blockchain.
- PDF and Office evidence is stored and fingerprinted; only supported tabular formats are parsed for profiling and checks.
- AI-generated code execution, external malware scanning, and background job processing are not enabled.
