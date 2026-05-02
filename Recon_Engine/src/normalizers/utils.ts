export function normalizeDate(input: any): string {
    if (!input) return '';
    const s = String(input).trim();
    // Try common DD/MM/YYYY or D/M/YYYY first (avoid locale MM/DD mis-parse)
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
        const [_, dd, mm, yyyy] = m;
        let yy = Number(yyyy);
        // handle two-digit years by mapping to 2000-2099
        if (String(yyyy).length === 2) {
            yy = 2000 + yy;
        }
        const mmn = Number(mm);
        const ddn = Number(dd);
        const iso = new Date(Date.UTC(yy, mmn - 1, ddn));
        if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    }

    // If input is ISO-like YYYY-MM-DD, build UTC date to avoid local TZ shifts
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [_, yy, mm, dd] = isoMatch;
        const dUTC = new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd)));
        if (!Number.isNaN(dUTC.getTime())) return dUTC.toISOString().slice(0, 10);
    }

    // Fallback: try to detect two-digit year patterns like DD/MM/YY or MM-DD-YY
    const twoDigit = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (twoDigit) {
        const [_, a, b, yy2] = twoDigit;
        const yy = 2000 + Number(yy2);
        // try DD/MM/YY -> YYYY-MM-DD
        const dd = String(a).padStart(2, '0');
        const mm = String(b).padStart(2, '0');
        const iso = new Date(Date.UTC(yy, Number(mm) - 1, Number(dd)));
        if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    }

    // Fallback to generic Date parse
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }

    return '';
}

export function normalizeAmount(amount: any, debit: any, credit: any): number {
    if ((amount ?? '') !== '') {
        let s = String(amount);
        // remove currency symbols and whitespace
        s = s.replace(/[$£€\s]/g, '');
        // detect parentheses as negative
        const paren = /\((.*)\)/.exec(s);
        if (paren) s = `-${paren[1]}`;
        const n = Number(s.replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }
    const d = debit ?? 0;
    const c = credit ?? 0;
    const dn = Number(String(d).replace(/[,\s]/g, '')) || 0;
    const cn = Number(String(c).replace(/[,\s]/g, '')) || 0;
    if (dn && !cn) return -Math.abs(dn);
    if (cn && !dn) return Math.abs(cn);
    return 0;
}
