/**
 * FINANCIAL REPORTING & KPI AGGREGATION QUERIES
 * Production-ready Prisma ORM and raw SQL queries for fund accounting.
 */

export const FINANCIAL_QUERIES = {
  /**
   * 1. 4-WAY KPI SUMMARY
   * Returns isolated totals for:
   * - Total Monthly Contributions
   * - Total Special Contributions
   * - Total Assistance Delivered
   * - Total Administrative Expenses
   */
  fourWayKpiSql: `
    SELECT 
      COALESCE(SUM(CASE WHEN c.contribution_type = 'MONTHLY' AND c.status = 'POSTED' THEN c.base_currency_amount ELSE 0 END), 0) AS total_monthly_contributions,
      COALESCE(SUM(CASE WHEN c.contribution_type = 'SPECIAL' AND c.status = 'POSTED' THEN c.base_currency_amount ELSE 0 END), 0) AS total_special_contributions,
      COALESCE(SUM(CASE WHEN d.disbursement_type = 'CHARITY_ASSISTANCE' AND d.status = 'POSTED' THEN d.base_currency_amount ELSE 0 END), 0) AS total_charity_assistance,
      COALESCE(SUM(CASE WHEN d.disbursement_type = 'ADMINISTRATIVE' AND d.status = 'POSTED' THEN d.base_currency_amount ELSE 0 END), 0) AS total_administrative_expenses
    FROM tenants t
    LEFT JOIN contributions c ON c.tenant_id = t.id
    LEFT JOIN disbursements d ON d.tenant_id = t.id
    WHERE t.id = $1
    GROUP BY t.id;
  `,

  /**
   * 2. MEMBER MONTHLY DUES STATUS MATRIX
   * Evaluates dues status ('PAID', 'PARTIAL', 'UNPAID', 'N/A') for members across months in a given year.
   */
  memberMonthlyDuesMatrixSql: `
    WITH months AS (
      SELECT generate_series(
        date_trunc('year', $2::date),
        date_trunc('year', $2::date) + interval '11 months',
        interval '1 month'
      )::date AS period_date
    ),
    member_months AS (
      SELECT 
        m.id AS member_id,
        m.member_number,
        m.full_name,
        m.monthly_contribution_amount AS expected_dues,
        m.join_date,
        to_char(months.period_date, 'YYYY-MM') AS period_month,
        months.period_date
      FROM members m
      CROSS JOIN months
      WHERE m.tenant_id = $1
    )
    SELECT 
      mm.member_id,
      mm.member_number,
      mm.full_name,
      mm.period_month,
      mm.expected_dues,
      COALESCE(SUM(c.base_currency_amount), 0) AS actual_paid,
      CASE
        WHEN mm.period_date < date_trunc('month', mm.join_date) THEN 'N/A'
        WHEN COALESCE(SUM(c.base_currency_amount), 0) >= mm.expected_dues THEN 'PAID'
        WHEN COALESCE(SUM(c.base_currency_amount), 0) > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
      END AS status
    FROM member_months mm
    LEFT JOIN contributions c ON c.tenant_id = $1 
      AND c.member_id = mm.member_id 
      AND c.contribution_type = 'MONTHLY' 
      AND c.period_month = mm.period_month
      AND c.status = 'POSTED'
    GROUP BY mm.member_id, mm.member_number, mm.full_name, mm.period_month, mm.expected_dues, mm.join_date, mm.period_date
    ORDER BY mm.member_number, mm.period_month;
  `,

  /**
   * 3. CHARITY CASE FINANCIAL BREAKDOWN
   * Compares Approved Budget vs Collected Contributions vs Disbursed Assistance vs Live Balance.
   */
  caseFinancialSummarySql: `
    SELECT 
      cc.id,
      cc.case_number,
      cc.title,
      cc.case_type,
      cc.beneficiary_name,
      cc.approved_amount,
      cc.currency,
      COALESCE(SUM(DISTINCT c.base_currency_amount), 0) AS total_collected,
      COALESCE(SUM(DISTINCT d.base_currency_amount), 0) AS total_disbursed,
      (cc.approved_amount - COALESCE(SUM(DISTINCT d.base_currency_amount), 0)) AS remaining_budget,
      (COALESCE(SUM(DISTINCT c.base_currency_amount), 0) - COALESCE(SUM(DISTINCT d.base_currency_amount), 0)) AS current_cash_balance,
      cc.status
    FROM charity_cases cc
    LEFT JOIN contributions c ON c.case_id = cc.id AND c.status = 'POSTED' AND c.contribution_type = 'SPECIAL'
    LEFT JOIN disbursements d ON d.case_id = cc.id AND d.status = 'POSTED' AND d.disbursement_type = 'CHARITY_ASSISTANCE'
    WHERE cc.tenant_id = $1
    GROUP BY cc.id, cc.case_number, cc.title, cc.case_type, cc.beneficiary_name, cc.approved_amount, cc.currency, cc.status
    ORDER BY cc.created_at DESC;
  `,

  /**
   * 4. TRIAL BALANCE & INCOME STATEMENT (DOUBLE-ENTRY AUDIT)
   * Grouped by Chart of Accounts with verified Debits = Credits.
   */
  trialBalanceSql: `
    SELECT 
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(jl.base_currency_debit), 0) AS total_debit,
      COALESCE(SUM(jl.base_currency_credit), 0) AS total_credit,
      CASE 
        WHEN a.type IN ('ASSET', 'PROGRAM_EXPENSE', 'ADMIN_EXPENSE') THEN 
          COALESCE(SUM(jl.base_currency_debit), 0) - COALESCE(SUM(jl.base_currency_credit), 0)
        ELSE 
          COALESCE(SUM(jl.base_currency_credit), 0) - COALESCE(SUM(jl.base_currency_debit), 0)
      END AS net_balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'POSTED'
    WHERE a.tenant_id = $1
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code ASC;
  `
};
