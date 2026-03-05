-- Production Schema Migration
-- Source: User provided snippet

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- I will attempt to run it by ensuring ENUMs are handled.

-- Types (Enums) - These were missing from the snippet but are required
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FundSource" AS ENUM ('CASH_REGISTER', 'OWNER_CAPITAL', 'BANK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKE_AWAY', 'DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'POINTS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SaleUnit" AS ENUM ('BOTTLE', 'GLASS', 'PLATE', 'PORTION', 'UNIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProductSize" AS ENUM ('SMALL', 'STANDARD', 'LARGE', 'XL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProductType" AS ENUM ('BEVERAGE', 'FOOD', 'SERVICE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tables

CREATE TABLE IF NOT EXISTS public.users (
  id text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  passwordHash text NOT NULL,
  role "UserRole" NOT NULL DEFAULT 'CASHIER'::"UserRole",
  status "UserStatus" NOT NULL DEFAULT 'ACTIVE'::"UserStatus",
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  baseSalary numeric,
  phone text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text NOT NULL,
  userId text NOT NULL,
  action text NOT NULL,
  entity text,
  entityId text,
  metadata jsonb,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.category_metadata (
  id text NOT NULL,
  code text NOT NULL,
  productType text NOT NULL,
  label text NOT NULL,
  labelEn text,
  description text,
  active boolean NOT NULL DEFAULT true,
  sortOrder integer NOT NULL DEFAULT 0,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT category_metadata_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id text NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  points integer NOT NULL DEFAULT 0,
  notes text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sales (
  id text NOT NULL,
  ticketNum text NOT NULL,
  clientId text,
  userId text NOT NULL,
  status "SaleStatus" NOT NULL DEFAULT 'COMPLETED'::"SaleStatus",
  paymentMethod "PaymentMethod" NOT NULL DEFAULT 'CASH'::"PaymentMethod",
  totalBrut numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  totalNet numeric NOT NULL,
  pointsEarned integer NOT NULL DEFAULT 0,
  pointsUsed integer NOT NULL DEFAULT 0,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discountBy text,
  discountType text,
  discountValue numeric,
  orderType "OrderType" NOT NULL DEFAULT 'DINE_IN'::"OrderType",
  totalCdf numeric NOT NULL DEFAULT 0,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_clientId_fkey FOREIGN KEY (clientId) REFERENCES public.clients(id),
  CONSTRAINT sales_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.delivery_info (
  id text NOT NULL,
  saleId text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  instructions text,
  estimatedTime timestamp without time zone,
  deliveryStatus "DeliveryStatus" NOT NULL DEFAULT 'PENDING'::"DeliveryStatus",
  deliveredBy text,
  deliveredAt timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT delivery_info_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_info_deliveredBy_fkey FOREIGN KEY (deliveredBy) REFERENCES public.users(id),
  CONSTRAINT delivery_info_saleId_fkey FOREIGN KEY (saleId) REFERENCES public.sales(id)
);

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id text NOT NULL,
  rateUsdToCdf numeric NOT NULL,
  effectiveDate timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expense_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_payrolls ( -- Renamed from public.payrolls to avoid conflicts if needed
  id text NOT NULL,
  userId text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  baseAmount numeric NOT NULL,
  advancesTotal numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  penalty numeric NOT NULL DEFAULT 0,
  netPaid numeric NOT NULL,
  paymentDate timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status text NOT NULL DEFAULT 'COMPLETED'::text,
  notes text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payrolls_pkey PRIMARY KEY (id),
  CONSTRAINT payrolls_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id text NOT NULL,
  date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description text NOT NULL,
  amount numeric NOT NULL,
  source "FundSource" NOT NULL DEFAULT 'CASH_REGISTER'::"FundSource",
  userId text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  categoryId text NOT NULL,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES public.expense_categories(id),
  CONSTRAINT expenses_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id text NOT NULL,
  saleId text NOT NULL,
  amount numeric NOT NULL,
  amountCdf numeric,
  paymentMethod text NOT NULL, -- Changed from USER-DEFINED to text to simplify if PaymentMethod is complex
  reference text,
  userId text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financial_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT financial_transactions_saleId_fkey FOREIGN KEY (saleId) REFERENCES public.sales(id),
  CONSTRAINT financial_transactions_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.inventory_sessions (
  id text NOT NULL,
  date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status text NOT NULL DEFAULT 'OPEN'::text,
  totalVariance numeric,
  userId text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_sessions_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id text NOT NULL,
  name text NOT NULL,
  type "ProductType" NOT NULL,
  beverageCategory text,
  foodCategory text,
  size "ProductSize" NOT NULL DEFAULT 'STANDARD'::"ProductSize",
  saleUnit "SaleUnit" NOT NULL,
  unitValue numeric,
  vendable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  imageUrl text,
  description text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  packingQuantity integer DEFAULT 1,
  purchaseUnit text,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id text NOT NULL,
  sessionId text NOT NULL,
  productId text NOT NULL,
  location text NOT NULL,
  expectedQuantity numeric NOT NULL,
  actualQuantity numeric NOT NULL,
  variance numeric NOT NULL,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT inventory_items_sessionId_fkey FOREIGN KEY (sessionId) REFERENCES public.inventory_sessions(id)
);

CREATE TABLE IF NOT EXISTS public.investments (
  id text NOT NULL,
  date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source "FundSource" NOT NULL DEFAULT 'OWNER_CAPITAL'::"FundSource",
  totalAmount numeric NOT NULL,
  vendableAmount numeric NOT NULL,
  nonVendableAmount numeric NOT NULL,
  expectedRevenue numeric NOT NULL,
  expectedProfit numeric NOT NULL,
  expectedRevenueVip numeric,
  expectedProfitVip numeric,
  description text,
  userId text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exchangeRate numeric,
  totalAmountCdf numeric,
  vendableAmountCdf numeric,
  nonVendableAmountCdf numeric,
  expectedRevenueCdf numeric,
  expectedProfitCdf numeric,
  expectedRevenueVipCdf numeric,
  expectedProfitVipCdf numeric,
  transportFeeCdf numeric,
  transportFee numeric,
  CONSTRAINT investments_pkey PRIMARY KEY (id),
  CONSTRAINT investments_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.kitchen_orders (
  id text NOT NULL,
  saleId text NOT NULL,
  orderType "OrderType" NOT NULL DEFAULT 'DINE_IN'::"OrderType",
  status "OrderStatus" NOT NULL DEFAULT 'PENDING'::"OrderStatus",
  priority integer NOT NULL DEFAULT 0,
  preparedBy text,
  preparedAt timestamp without time zone,
  deliveredAt timestamp without time zone,
  notes text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT kitchen_orders_pkey PRIMARY KEY (id),
  CONSTRAINT kitchen_orders_preparedBy_fkey FOREIGN KEY (preparedBy) REFERENCES public.users(id),
  CONSTRAINT kitchen_orders_saleId_fkey FOREIGN KEY (saleId) REFERENCES public.sales(id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id text NOT NULL,
  clientId text NOT NULL,
  amount integer NOT NULL,
  reason text,
  saleId text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_transactions_clientId_fkey FOREIGN KEY (clientId) REFERENCES public.clients(id),
  CONSTRAINT loyalty_transactions_saleId_fkey FOREIGN KEY (saleId) REFERENCES public.sales(id)
);

CREATE TABLE IF NOT EXISTS public.product_costs (
  id text NOT NULL,
  productId text NOT NULL,
  unitCostUsd numeric NOT NULL,
  unitCostCdf numeric NOT NULL,
  forUnit "SaleUnit" NOT NULL DEFAULT 'BOTTLE'::"SaleUnit",
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_costs_pkey PRIMARY KEY (id),
  CONSTRAINT product_costs_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.sale_spaces (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sale_spaces_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id text NOT NULL,
  productId text NOT NULL,
  spaceId text NOT NULL,
  priceUsd numeric NOT NULL,
  priceCdf numeric NOT NULL,
  forUnit "SaleUnit" NOT NULL DEFAULT 'BOTTLE'::"SaleUnit",
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_prices_pkey PRIMARY KEY (id),
  CONSTRAINT product_prices_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT product_prices_spaceId_fkey FOREIGN KEY (spaceId) REFERENCES public.sale_spaces(id)
);

CREATE TABLE IF NOT EXISTS public.product_type_metadata (
  id text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  labelEn text,
  description text,
  active boolean NOT NULL DEFAULT true,
  sortOrder integer NOT NULL DEFAULT 0,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_type_metadata_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.salary_advances (
  id text NOT NULL,
  userId text NOT NULL,
  amount numeric NOT NULL,
  date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason text,
  status text NOT NULL DEFAULT 'PENDING', -- Simplified
  expenseId text,
  payrollId text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT salary_advances_pkey PRIMARY KEY (id),
  CONSTRAINT salary_advances_expenseId_fkey FOREIGN KEY (expenseId) REFERENCES public.expenses(id),
  CONSTRAINT salary_advances_payrollId_fkey FOREIGN KEY (payrollId) REFERENCES public.payroll_payrolls(id),
  CONSTRAINT salary_advances_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id text NOT NULL,
  saleId text NOT NULL,
  productId text NOT NULL,
  quantity numeric NOT NULL,
  unitPrice numeric NOT NULL,
  totalPrice numeric NOT NULL,
  unitCost numeric NOT NULL DEFAULT 0,
  unitPriceCdf numeric NOT NULL DEFAULT 0,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT sale_items_saleId_fkey FOREIGN KEY (saleId) REFERENCES public.sales(id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id text NOT NULL,
  userId text NOT NULL,
  token text NOT NULL,
  expiresAt timestamp without time zone NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.stock_items (
  id text NOT NULL,
  productId text NOT NULL,
  location text NOT NULL,
  quantity numeric NOT NULL,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_items_pkey PRIMARY KEY (id),
  CONSTRAINT stock_items_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text NOT NULL,
  productId text NOT NULL,
  type text NOT NULL,
  quantity numeric NOT NULL,
  fromLocation text,
  toLocation text,
  reason text,
  costValue numeric,
  userId text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  investmentId text,
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_investmentId_fkey FOREIGN KEY (investmentId) REFERENCES public.investments(id),
  CONSTRAINT stock_movements_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT stock_movements_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);
