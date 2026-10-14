-- =============================================================================
-- POSTGRESQL DDL: AUDITABLE MULTI-TENANT CHARITY MANAGEMENT & FUND ACCOUNTING
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS & USERS
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    base_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    financial_year_start INT NOT NULL DEFAULT 2026,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE user_role_enum AS ENUM ('SUPER_ADMIN', 'CHARITY_ADMIN', 'STAFF', 'AUDITOR');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'STAFF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MEMBERS & SEPARATED ADDRESSES
CREATE TYPE member_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    father_husband_name VARCHAR(255),
    mobile_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_contribution_amount NUMERIC(18, 2) NOT NULL DEFAULT 100.00,
    status member_status_enum NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    photo_url TEXT,
    total_monthly_contributed NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total_special_contributed NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_members_tenant_number UNIQUE (tenant_id, member_number)
);

CREATE TABLE IF NOT EXISTS local_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    building VARCHAR(100),
    flat VARCHAR(50),
    street VARCHAR(150),
    area VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Dubai',
    state_or_emirate VARCHAR(100) DEFAULT 'Dubai',
    postal_code_or_po_box VARCHAR(50),
    country VARCHAR(100) NOT NULL DEFAULT 'United Arab Emirates',
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS home_country_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    building VARCHAR(100),
    flat VARCHAR(50),
    street VARCHAR(150),
    area VARCHAR(100),
    city VARCHAR(100),
    state_or_emirate VARCHAR(100),
    postal_code_or_po_box VARCHAR(50),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CHARITY CASES (RESTRICTED FUNDS)
CREATE TYPE case_type_enum AS ENUM ('MEDICAL', 'HOUSE_MAINTENANCE', 'WEDDING', 'MASJID_WORK', 'EDUCATION', 'FOOD_AID', 'EMERGENCY', 'FUNERAL', 'OTHER');
CREATE TYPE case_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'FULLY_FUNDED', 'DISBURSED', 'CLOSED');

CREATE TABLE IF NOT EXISTS charity_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    case_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    case_type case_type_enum NOT NULL,
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_phone VARCHAR(50),
    beneficiary_national_id VARCHAR(100),
    hospital_or_vendor VARCHAR(255),
    requested_amount NUMERIC(18, 2) NOT NULL,
    approved_amount NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    collected_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    disbursed_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    status case_status_enum NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    notes TEXT,
    start_date DATE,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cases_tenant_number UNIQUE (tenant_id, case_number)
);

-- 4. CHART OF ACCOUNTS & DOUBLE-ENTRY LEDGER
CREATE TYPE account_type_enum AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'PROGRAM_EXPENSE', 'ADMIN_EXPENSE');
CREATE TYPE transaction_status_enum AS ENUM ('POSTED', 'VOIDED', 'REVERSED');
CREATE TYPE financial_class_enum AS ENUM ('MONTHLY_CONTRIBUTION', 'SPECIAL_CONTRIBUTION', 'CHARITY_ASSISTANCE', 'ADMINISTRATIVE_EXPENSE');

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type account_type_enum NOT NULL,
    parent_code VARCHAR(20),
    description TEXT,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_accounts_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    source_classification financial_class_enum NOT NULL,
    source_reference_number VARCHAR(50) NOT NULL,
    total_debit NUMERIC(18, 2) NOT NULL,
    total_credit NUMERIC(18, 2) NOT NULL,
    is_balanced BOOLEAN NOT NULL DEFAULT TRUE,
    status transaction_status_enum NOT NULL DEFAULT 'POSTED',
    voided_at TIMESTAMPTZ,
    voided_by VARCHAR(255),
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_journal_tenant_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit)
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    credit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    base_currency_debit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    base_currency_credit NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    description VARCHAR(255),
    CONSTRAINT chk_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

-- 5. CONTRIBUTIONS & DISBURSEMENTS
CREATE TYPE contribution_type_enum AS ENUM ('MONTHLY', 'SPECIAL');
CREATE TYPE disbursement_type_enum AS ENUM ('CHARITY_ASSISTANCE', 'ADMINISTRATIVE');
CREATE TYPE payment_method_enum AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_GATEWAY', 'OTHER');

CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    contribution_type contribution_type_enum NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    case_id UUID REFERENCES charity_cases(id) ON DELETE RESTRICT,
    period_month VARCHAR(7), -- 'YYYY-MM' (REQUIRED if MONTHLY)
    original_amount NUMERIC(18, 2) NOT NULL,
    original_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    base_currency_amount NUMERIC(18, 2) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'CASH',
    cash_bank_account_id UUID NOT NULL REFERENCES accounts(id),
    income_account_id UUID NOT NULL REFERENCES accounts(id),
    reference_number VARCHAR(100),
    notes TEXT,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id),
    status transaction_status_enum NOT NULL DEFAULT 'POSTED',
    voided_at TIMESTAMPTZ,
    voided_by VARCHAR(255),
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contributions_tenant_receipt UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    voucher_number VARCHAR(50) NOT NULL,
    disbursement_type disbursement_type_enum NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payee_name VARCHAR(255) NOT NULL,
    payee_phone VARCHAR(50),
    payee_address TEXT,
    case_id UUID REFERENCES charity_cases(id) ON DELETE RESTRICT,
    category VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(100),
    original_amount NUMERIC(18, 2) NOT NULL,
    original_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    base_currency_amount NUMERIC(18, 2) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'BANK_TRANSFER',
    cash_bank_account_id UUID NOT NULL REFERENCES accounts(id),
    expense_account_id UUID NOT NULL REFERENCES accounts(id),
    reference_number VARCHAR(100),
    description TEXT NOT NULL,
    prepared_by VARCHAR(150),
    verified_by VARCHAR(150),
    approved_by VARCHAR(150) NOT NULL,
    journal_entry_id UUID UNIQUE REFERENCES journal_entries(id),
    status transaction_status_enum NOT NULL DEFAULT 'POSTED',
    voided_at TIMESTAMPTZ,
    voided_by VARCHAR(255),
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_disbursements_tenant_voucher UNIQUE (tenant_id, voucher_number)
);

-- 6. AUDIT LOGS & POLYMORPHIC DOCUMENT ATTACHMENTS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    record_number VARCHAR(50),
    details TEXT NOT NULL,
    reason TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    storage_path TEXT NOT NULL,
    file_url TEXT,
    description TEXT,
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_period ON contributions(tenant_id, member_id, period_month);
CREATE INDEX IF NOT EXISTS idx_contributions_case ON contributions(tenant_id, case_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_case ON disbursements(tenant_id, case_id);
CREATE INDEX IF NOT EXISTS idx_journal_classification ON journal_entries(tenant_id, source_classification);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(tenant_id, module, record_id);
