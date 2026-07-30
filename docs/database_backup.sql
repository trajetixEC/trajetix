-- ========================================================
-- TrajetixERP Database Backup
-- Date: 2026-07-30T03:51:37.465Z
-- ========================================================

-- PRISMA SCHEMA DEFINITION --
/*
generator client {
  provider      = "prisma-client-js"
  output        = "../../../apps/web/generated/client"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CLOSED
}

enum MembershipStatus {
  INVITED
  ACTIVE
  SUSPENDED
}

enum PlatformRole {
  USER
  SUPER_ADMIN
}

enum DomainStatus {
  PENDING
  VERIFIED
  ACTIVE
  FAILED
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum ProductType {
  SIMPLE
  VARIABLE
  DIGITAL
  KIT
  BUNDLE
}

enum ShipmentStatus {
  DRAFT
  QUOTED
  LABEL_CREATED
  PICKUP_SCHEDULED
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  EXCEPTION
  CANCELLED
  RETURNED
}

enum WalletTransactionType {
  CREDIT
  DEBIT
  HOLD
  RELEASE
}

enum WithdrawalStatus {
  PENDING
  APPROVED
  PROCESSING
  PAID
  REJECTED
  CANCELLED
}

enum OrderStatus {
  DRAFT
  PENDING
  CONFIRMED
  ALLOCATED
  PICKING
  PACKED
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
}

enum InventoryMovementType {
  RECEIPT
  RESERVATION
  RELEASE
  SHIPMENT
  TRANSFER_IN
  TRANSFER_OUT
  ADJUSTMENT
  RETURN
}

model Tenant {
  id                    String                 @id @default(uuid()) @db.Uuid
  slug                  String                 @unique @db.VarChar(80)
  legalName             String                 @db.VarChar(200)
  displayName           String                 @db.VarChar(120)
  countryCode           String                 @default("EC") @db.Char(2)
  currency              String                 @default("USD") @db.Char(3)
  timezone              String                 @default("America/Guayaquil") @db.VarChar(60)
  status                TenantStatus           @default(TRIAL)
  settings              Json                   @default("{}")
  createdAt             DateTime               @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime               @updatedAt @db.Timestamptz(6)
  memberships           Membership[]
  roles                 Role[]
  warehouses            Warehouse[]
  products              Product[]
  orders                Order[]
  auditLogs             AuditLog[]
  outbox                OutboxEvent[]
  invitations           Invitation[]
  customers             Customer[]
  stores                Store[]
  branding              TenantBranding?
  domains               TenantDomain[]
  configuration         TenantConfiguration?
  shipments             Shipment[]
  ecommerceIntegrations EcommerceIntegration[]
  carrierIntegrations   CarrierIntegration[]
  webhookEndpoints      WebhookEndpoint[]
  wallet                Wallet?
  bankAccounts          BankAccount[]
  withdrawals           Withdrawal[]
  referralProfiles      ReferralProfile[]      @relation("ReferralProfileTenant")
  referredBy            ReferralAttribution?   @relation("ReferredTenant")
  referralEarnings      ReferralCommission[]   @relation("ReferralBeneficiary")
}

model User {
  id                   String               @id @default(uuid()) @db.Uuid
  /// Must be normalized to lowercase at the identity boundary.
  email                String               @unique @db.VarChar(320)
  name                 String?              @db.VarChar(150)
  phone                String?              @db.VarChar(40)
  emailVerified        DateTime?            @db.Timestamptz(6)
  image                String?
  passwordHash         String?
  preferences          Json                 @default("{}")
  twoFactorReady       Boolean              @default(false)
  twoFactorSecret      String?
  platformRole         PlatformRole         @default(USER)
  lastLoginAt          DateTime?            @db.Timestamptz(6)
  createdAt            DateTime             @default(now()) @db.Timestamptz(6)
  updatedAt            DateTime             @updatedAt @db.Timestamptz(6)
  memberships          Membership[]
  accounts             Account[]
  sessions             Session[]
  authenticators       Authenticator[]
  passwordResets       PasswordResetToken[]
  invitationsSent      Invitation[]         @relation("InvitationSender")
  withdrawalsRequested Withdrawal[]
  referralProfiles     ReferralProfile[]
}

model Account {
  userId            String  @db.Uuid
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
  @@index([userId])
}

model Session {
  sessionToken String   @unique
  userId       String   @db.Uuid
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

model Authenticator {
  credentialID         String  @unique
  userId               String  @db.Uuid
  providerAccountId    String
  credentialPublicKey  String
  counter              Int
  credentialDeviceType String
  credentialBackedUp   Boolean
  transports           String?
  user                 User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, credentialID])
}

model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  tokenHash String    @unique
  expiresAt DateTime  @db.Timestamptz(6)
  usedAt    DateTime? @db.Timestamptz(6)
  createdAt DateTime  @default(now()) @db.Timestamptz(6)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
}

model Invitation {
  id          String    @id @default(uuid()) @db.Uuid
  tenantId    String    @db.Uuid
  email       String    @db.VarChar(320)
  roleId      String?   @db.Uuid
  tokenHash   String    @unique
  invitedById String?   @db.Uuid
  expiresAt   DateTime  @db.Timestamptz(6)
  acceptedAt  DateTime? @db.Timestamptz(6)
  createdAt   DateTime  @default(now()) @db.Timestamptz(6)
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role        Role?     @relation(fields: [roleId], references: [id], onDelete: SetNull)
  invitedBy   User?     @relation("InvitationSender", fields: [invitedById], references: [id], onDelete: SetNull)

  @@unique([tenantId, email])
  @@index([tenantId, expiresAt])
}

model Membership {
  id                     String           @id @default(uuid()) @db.Uuid
  tenantId               String           @db.Uuid
  userId                 String           @db.Uuid
  status                 MembershipStatus @default(INVITED)
  permissionOverrides    String[]         @default([])
  usePermissionOverrides Boolean          @default(false)
  createdAt              DateTime         @default(now()) @db.Timestamptz(6)
  tenant                 Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user                   User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  roles                  MembershipRole[]

  @@unique([tenantId, userId])
  @@index([userId, status])
}

model Role {
  id          String           @id @default(uuid()) @db.Uuid
  tenantId    String           @db.Uuid
  name        String           @db.VarChar(80)
  description String?
  permissions String[]
  systemKey   String?          @db.VarChar(50)
  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members     MembershipRole[]
  invitations Invitation[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

model MembershipRole {
  membershipId String     @db.Uuid
  roleId       String     @db.Uuid
  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([membershipId, roleId])
}

model Warehouse {
  id        String              @id @default(uuid()) @db.Uuid
  tenantId  String              @db.Uuid
  code      String              @db.VarChar(40)
  name      String              @db.VarChar(120)
  timezone  String              @db.VarChar(60)
  address   Json
  active    Boolean             @default(true)
  createdAt DateTime            @default(now()) @db.Timestamptz(6)
  tenant    Tenant              @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  balances  InventoryBalance[]
  movements InventoryMovement[]

  @@unique([tenantId, code])
  @@unique([tenantId, id])
  @@index([tenantId, active])
}

model Product {
  id           String              @id @default(uuid()) @db.Uuid
  tenantId     String              @db.Uuid
  sku          String              @db.VarChar(100)
  name         String              @db.VarChar(250)
  description  String?
  type         ProductType         @default(SIMPLE)
  barcode      String?             @db.VarChar(100)
  qrCode       String?             @db.VarChar(250)
  category     String?             @db.VarChar(120)
  brand        String?             @db.VarChar(120)
  priceMinor   BigInt              @default(0)
  costMinor    BigInt              @default(0)
  dropshippingPriceMinor          BigInt?
  suggestedDropshippingPriceMinor BigInt?
  weightKg     Decimal?            @db.Decimal(10, 3)
  lengthCm     Decimal?            @db.Decimal(10, 2)
  widthCm      Decimal?            @db.Decimal(10, 2)
  heightCm     Decimal?            @db.Decimal(10, 2)
  minimumStock Decimal             @default(0) @db.Decimal(18, 4)
  reorderPoint Decimal             @default(0) @db.Decimal(18, 4)
  trackSerials Boolean             @default(false)
  trackLots    Boolean             @default(false)
  trackExpiry  Boolean             @default(false)
  media        Json                @default("[]")
  status       ProductStatus       @default(DRAFT)
  attributes   Json                @default("{}")
  createdAt    DateTime            @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime            @updatedAt @db.Timestamptz(6)
  tenant       Tenant              @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  balances     InventoryBalance[]
  movements    InventoryMovement[]
  orderItems   OrderItem[]

  @@unique([tenantId, sku])
  @@unique([tenantId, id])
  @@index([tenantId, status, updatedAt])
}

model Shipment {
  id                 String                  @id @default(uuid()) @db.Uuid
  tenantId           String                  @db.Uuid
  orderId            String?                 @db.Uuid
  carrier            String                  @db.VarChar(100)
  service            String?                 @db.VarChar(100)
  trackingNumber     String?                 @db.VarChar(150)
  status             ShipmentStatus          @default(DRAFT)
  origin             Json                    @default("{}")
  recipient          Json
  address            Json
  packages           Json                    @default("[]")
  quotedMinor        BigInt?
  currency           String                  @default("USD") @db.Char(3)
  codMinor           BigInt?
  labelUrl           String?
  proofSignature     String?
  proofPhotoUrl      String?
  proofLatitude      Decimal?                @db.Decimal(10, 7)
  proofLongitude     Decimal?                @db.Decimal(10, 7)
  deliveredAt        DateTime?               @db.Timestamptz(6)
  metadata           Json                    @default("{}")
  createdAt          DateTime                @default(now()) @db.Timestamptz(6)
  updatedAt          DateTime                @updatedAt @db.Timestamptz(6)
  tenant             Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order              Order?                  @relation(fields: [tenantId, orderId], references: [tenantId, id], onDelete: Restrict)
  trackingEvents     ShipmentTrackingEvent[]
  referralCommission ReferralCommission?

  @@unique([tenantId, trackingNumber])
  @@unique([tenantId, id])
  @@index([tenantId, status, createdAt])
}

model ShipmentTrackingEvent {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  shipmentId  String   @db.Uuid
  carrierCode String   @db.VarChar(80)
  status      String   @db.VarChar(80)
  description String   @db.VarChar(300)
  location    String?  @db.VarChar(160)
  occurredAt  DateTime @db.Timestamptz(6)
  raw         Json     @default("{}")
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  shipment    Shipment @relation(fields: [tenantId, shipmentId], references: [tenantId, id], onDelete: Cascade)

  @@index([tenantId, shipmentId, occurredAt])
}

model Wallet {
  tenantId     String              @id @db.Uuid
  balanceMinor BigInt              @default(0)
  currency     String              @default("USD") @db.Char(3)
  updatedAt    DateTime            @updatedAt @db.Timestamptz(6)
  tenant       Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  transactions WalletTransaction[]
}

model WalletTransaction {
  id            String                @id @default(uuid()) @db.Uuid
  tenantId      String                @db.Uuid
  type          WalletTransactionType
  amountMinor   BigInt
  description   String                @db.VarChar(250)
  referenceType String?               @db.VarChar(50)
  referenceId   String?               @db.VarChar(100)
  createdAt     DateTime              @default(now()) @db.Timestamptz(6)
  wallet        Wallet                @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)

  @@index([tenantId, createdAt])
}

model ReferralProfile {
  id              String                @id @default(uuid()) @db.Uuid
  tenantId        String                @db.Uuid
  userId          String                @db.Uuid
  code            String                @unique @db.VarChar(50)
  commissionMinor Int                   @default(10)
  active          Boolean               @default(true)
  createdAt       DateTime              @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime              @updatedAt @db.Timestamptz(6)
  tenant          Tenant                @relation("ReferralProfileTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  referrals       ReferralAttribution[]

  @@unique([tenantId, userId])
  @@index([tenantId, active])
}

model ReferralAttribution {
  id                String               @id @default(uuid()) @db.Uuid
  referralProfileId String               @db.Uuid
  referredTenantId  String               @unique @db.Uuid
  joinedAt          DateTime             @default(now()) @db.Timestamptz(6)
  profile           ReferralProfile      @relation(fields: [referralProfileId], references: [id], onDelete: Restrict)
  referredTenant    Tenant               @relation("ReferredTenant", fields: [referredTenantId], references: [id], onDelete: Restrict)
  commissions       ReferralCommission[]

  @@index([referralProfileId, joinedAt])
}

model ReferralCommission {
  id                  String              @id @default(uuid()) @db.Uuid
  attributionId       String              @db.Uuid
  shipmentId          String              @unique @db.Uuid
  beneficiaryTenantId String              @db.Uuid
  amountMinor         Int                 @default(10)
  createdAt           DateTime            @default(now()) @db.Timestamptz(6)
  attribution         ReferralAttribution @relation(fields: [attributionId], references: [id], onDelete: Restrict)
  shipment            Shipment            @relation(fields: [shipmentId], references: [id], onDelete: Restrict)
  beneficiaryTenant   Tenant              @relation("ReferralBeneficiary", fields: [beneficiaryTenantId], references: [id], onDelete: Restrict)

  @@index([attributionId, createdAt])
  @@index([beneficiaryTenantId, createdAt])
}

model BankAccount {
  id            String       @id @default(uuid()) @db.Uuid
  tenantId      String       @db.Uuid
  bankCode      String       @db.VarChar(40)
  bankName      String       @db.VarChar(140)
  accountType   String       @db.VarChar(30)
  accountLast4  String       @db.Char(4)
  accountCipher String
  holderName    String       @db.VarChar(180)
  holderId      String       @db.VarChar(30)
  isDefault     Boolean      @default(false)
  active        Boolean      @default(true)
  createdAt     DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime     @updatedAt @db.Timestamptz(6)
  tenant        Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  withdrawals   Withdrawal[]

  @@unique([tenantId, id])
  @@index([tenantId, active])
}

model Withdrawal {
  id            String           @id @default(uuid()) @db.Uuid
  tenantId      String           @db.Uuid
  bankAccountId String           @db.Uuid
  requestedById String           @db.Uuid
  amountMinor   BigInt
  status        WithdrawalStatus @default(PENDING)
  note          String?          @db.VarChar(250)
  createdAt     DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime         @updatedAt @db.Timestamptz(6)
  tenant        Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  bankAccount   BankAccount      @relation(fields: [tenantId, bankAccountId], references: [tenantId, id], onDelete: Restrict)
  requestedBy   User             @relation(fields: [requestedById], references: [id], onDelete: Restrict)

  @@index([tenantId, status, createdAt])
}

model EcommerceIntegration {
  id         String    @id @default(uuid()) @db.Uuid
  tenantId   String    @db.Uuid
  provider   String    @db.VarChar(60)
  name       String    @db.VarChar(120)
  shopDomain String?   @db.VarChar(253)
  secretRef  String?   @db.VarChar(250)
  settings   Json      @default("{}")
  active     Boolean   @default(true)
  lastSyncAt DateTime? @db.Timestamptz(6)
  createdAt  DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt  DateTime  @updatedAt @db.Timestamptz(6)
  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, provider, shopDomain])
  @@index([tenantId, active])
}

model CarrierIntegration {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  carrierKey   String   @db.VarChar(80)
  name         String   @db.VarChar(120)
  secretRef    String?  @db.VarChar(250)
  baseUrl      String?
  settings     Json     @default("{}")
  capabilities String[]
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, carrierKey])
}

model WebhookEndpoint {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String   @db.Uuid
  url        String
  events     String[]
  secretHash String   @db.VarChar(128)
  active     Boolean  @default(true)
  createdAt  DateTime @default(now()) @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @db.Timestamptz(6)
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, active])
}

model InventoryBalance {
  tenantId    String    @db.Uuid
  warehouseId String    @db.Uuid
  productId   String    @db.Uuid
  onHand      Decimal   @default(0) @db.Decimal(18, 4)
  reserved    Decimal   @default(0) @db.Decimal(18, 4)
  version     Int       @default(0)
  updatedAt   DateTime  @updatedAt @db.Timestamptz(6)
  warehouse   Warehouse @relation(fields: [tenantId, warehouseId], references: [tenantId, id], onDelete: Restrict)
  product     Product   @relation(fields: [tenantId, productId], references: [tenantId, id], onDelete: Restrict)

  @@id([tenantId, warehouseId, productId])
  @@index([tenantId, productId])
}

model InventoryMovement {
  id             String                @id @default(uuid()) @db.Uuid
  tenantId       String                @db.Uuid
  warehouseId    String                @db.Uuid
  productId      String                @db.Uuid
  type           InventoryMovementType
  quantity       Decimal               @db.Decimal(18, 4)
  referenceType  String?               @db.VarChar(40)
  referenceId    String?               @db.VarChar(100)
  idempotencyKey String                @db.VarChar(120)
  occurredAt     DateTime              @default(now()) @db.Timestamptz(6)
  warehouse      Warehouse             @relation(fields: [tenantId, warehouseId], references: [tenantId, id], onDelete: Restrict)
  product        Product               @relation(fields: [tenantId, productId], references: [tenantId, id], onDelete: Restrict)

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, productId, occurredAt])
  @@index([tenantId, warehouseId, occurredAt])
}

model Order {
  id              String      @id @default(uuid()) @db.Uuid
  tenantId        String      @db.Uuid
  number          BigInt
  externalId      String?     @db.VarChar(150)
  channel         String      @db.VarChar(50)
  status          OrderStatus @default(PENDING)
  customer        Json
  shippingAddress Json
  currency        String      @db.Char(3)
  subtotalMinor   BigInt
  discountMinor   BigInt      @default(0)
  taxMinor        BigInt      @default(0)
  shippingMinor   BigInt      @default(0)
  totalMinor      BigInt
  createdAt       DateTime    @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime    @updatedAt @db.Timestamptz(6)
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  items           OrderItem[]
  shipments       Shipment[]

  @@unique([tenantId, number])
  @@unique([tenantId, id])
  @@unique([tenantId, channel, externalId])
  @@index([tenantId, status, createdAt])
}

model Customer {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  code      String?  @db.VarChar(80)
  email     String?  @db.VarChar(320)
  name      String   @db.VarChar(200)
  phone     String?  @db.VarChar(40)
  taxId     String?  @db.VarChar(40)
  addresses Json     @default("[]")
  metadata  Json     @default("{}")
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, code])
  @@unique([tenantId, email])
  @@unique([tenantId, id])
  @@index([tenantId, active, name])
}

model Store {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  code        String   @db.VarChar(80)
  name        String   @db.VarChar(160)
  channel     String?  @db.VarChar(60)
  externalId  String?  @db.VarChar(150)
  url         String?
  settings    Json     @default("{}")
  credentials Json? // En producción, guardar solo referencias a secretos cifrados.
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, code])
  @@unique([tenantId, channel, externalId])
  @@unique([tenantId, id])
  @@index([tenantId, active])
}

model TenantBranding {
  tenantId       String   @id @db.Uuid
  logoUrl        String?
  iconUrl        String?
  primaryColor   String   @default("#ff365d") @db.VarChar(20)
  secondaryColor String   @default("#111111") @db.VarChar(20)
  emailFromName  String?  @db.VarChar(120)
  supportEmail   String?  @db.VarChar(320)
  customCss      String?
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model TenantDomain {
  id                String       @id @default(uuid()) @db.Uuid
  tenantId          String       @db.Uuid
  hostname          String       @unique @db.VarChar(253)
  status            DomainStatus @default(PENDING)
  verificationToken String       @unique @db.VarChar(120)
  isPrimary         Boolean      @default(false)
  verifiedAt        DateTime?    @db.Timestamptz(6)
  createdAt         DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime     @updatedAt @db.Timestamptz(6)
  tenant            Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, id])
  @@index([tenantId, status])
}

model TenantConfiguration {
  tenantId      String   @id @db.Uuid
  locale        String   @default("es-EC") @db.VarChar(20)
  orderPrefix   String?  @db.VarChar(20)
  invoicePrefix String?  @db.VarChar(20)
  features      Json     @default("{}")
  notifications Json     @default("{}")
  integrations  Json     @default("{}")
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model OrderItem {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid
  orderId        String   @db.Uuid
  productId      String?  @db.Uuid
  sku            String   @db.VarChar(100)
  name           String   @db.VarChar(250)
  quantity       Decimal  @db.Decimal(18, 4)
  unitPriceMinor BigInt
  totalMinor     BigInt
  order          Order    @relation(fields: [tenantId, orderId], references: [tenantId, id], onDelete: Cascade)
  product        Product? @relation(fields: [tenantId, productId], references: [tenantId, id], onDelete: Restrict)

  @@index([tenantId, orderId])
  @@index([tenantId, productId])
}

model AuditLog {
  id            BigInt   @id @default(autoincrement())
  tenantId      String   @db.Uuid
  actorId       String?  @db.Uuid
  action        String   @db.VarChar(100)
  entityType    String   @db.VarChar(80)
  entityId      String?  @db.VarChar(100)
  before        Json?
  after         Json?
  ipHash        String?  @db.VarChar(128)
  correlationId String   @db.VarChar(100)
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([tenantId, createdAt])
  @@index([tenantId, entityType, entityId])
}

model OutboxEvent {
  id            String    @id @default(uuid()) @db.Uuid
  tenantId      String    @db.Uuid
  aggregateType String    @db.VarChar(80)
  aggregateId   String    @db.VarChar(100)
  eventType     String    @db.VarChar(120)
  version       Int
  payload       Json
  occurredAt    DateTime  @default(now()) @db.Timestamptz(6)
  publishedAt   DateTime? @db.Timestamptz(6)
  attempts      Int       @default(0)
  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([publishedAt, occurredAt])
  @@index([tenantId, aggregateType, aggregateId])
}

*/

-- Model: tenant (3 records) --
-- DATA_TENANT = [
  {
    "id": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "slug": "principal-a0a80916",
    "legalName": "Quality Shop",
    "displayName": "Quality Shop",
    "countryCode": "EC",
    "currency": "USD",
    "timezone": "America/Guayaquil",
    "status": "ACTIVE",
    "settings": {
      "billing": {
        "email": "qualityshop.ecua@gmail.com",
        "phone": "",
        "legalName": "Quality Shop",
        "fiscalAddress": "cesar.mendoza221995@gmail.com",
        "identificationType": "",
        "identificationNumber": ""
      },
      "company": {
        "email": "qualityshop.ecua@gmail.com",
        "phone": "",
        "address": "",
        "legalName": "Quality Shop",
        "displayName": "Quality Shop"
      }
    },
    "createdAt": "2026-07-12T23:01:08.459Z",
    "updatedAt": "2026-07-15T02:25:49.187Z"
  },
  {
    "id": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "slug": "tecno-teens-8b4a6954",
    "legalName": "Tecno Teens",
    "displayName": "Tecno Teens",
    "countryCode": "EC",
    "currency": "USD",
    "timezone": "America/Guayaquil",
    "status": "ACTIVE",
    "settings": {},
    "createdAt": "2026-07-15T05:03:11.788Z",
    "updatedAt": "2026-07-15T05:03:11.788Z"
  },
  {
    "id": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "slug": "agility-ecuador-56026022",
    "legalName": "Agility Ecuador",
    "displayName": "Agility Ecuador",
    "countryCode": "EC",
    "currency": "USD",
    "timezone": "America/Guayaquil",
    "status": "ACTIVE",
    "settings": {},
    "createdAt": "2026-07-15T14:28:00.377Z",
    "updatedAt": "2026-07-15T14:28:00.377Z"
  }
]


-- Model: user (4 records) --
-- DATA_USER = [
  {
    "id": "56026022-f4c1-4c36-8246-b2d374179117",
    "email": "cisnerosgranda14@gmail.com",
    "name": "Carlos Cisneros",
    "phone": null,
    "emailVerified": "2026-07-15T14:28:00.326Z",
    "image": null,
    "passwordHash": "$2b$12$kRBQUyZQ6yW5qqpNvGily.oAWXfhV41gI3XDX1q1bSKIAkVzczpBa",
    "preferences": {
      "appearance": "DARK"
    },
    "twoFactorReady": false,
    "twoFactorSecret": null,
    "platformRole": "USER",
    "lastLoginAt": "2026-07-30T03:22:02.133Z",
    "createdAt": "2026-07-15T14:28:00.330Z",
    "updatedAt": "2026-07-30T03:22:02.134Z"
  },
  {
    "id": "a0a80916-cefb-4a28-a48f-5e3f813e5244",
    "email": "qualityshop.ecua@gmail.com",
    "name": "Cesar Mendoza",
    "phone": null,
    "emailVerified": "2026-07-12T23:01:08.438Z",
    "image": null,
    "passwordHash": "$2b$12$3CVXX4yBGK/8uxvIo5lLFu7KB1EnDx7ZMBrqmmlthvRshw51KknMy",
    "preferences": {
      "appearance": "LIGHT",
      "identificationType": "",
      "identificationNumber": ""
    },
    "twoFactorReady": false,
    "twoFactorSecret": null,
    "platformRole": "USER",
    "lastLoginAt": "2026-07-30T03:36:59.388Z",
    "createdAt": "2026-07-12T23:01:08.440Z",
    "updatedAt": "2026-07-30T03:36:59.388Z"
  },
  {
    "id": "8b4a6954-5db3-47c3-896c-3d5788c15fec",
    "email": "nicoleplaza126@gmail.com",
    "name": "Nicole Plaza",
    "phone": null,
    "emailVerified": "2026-07-15T05:03:11.779Z",
    "image": null,
    "passwordHash": "$2b$12$lsgJNMQE6KPG4ZUtFx8H7e7AFezpkxWU67I9gD02MauKC.y8szd4i",
    "preferences": {
      "appearance": "DARK"
    },
    "twoFactorReady": false,
    "twoFactorSecret": null,
    "platformRole": "USER",
    "lastLoginAt": "2026-07-15T05:32:20.593Z",
    "createdAt": "2026-07-15T05:03:11.780Z",
    "updatedAt": "2026-07-15T13:59:36.690Z"
  },
  {
    "id": "5f580739-b0da-48d6-b9aa-aab8456ce7df",
    "email": "cesar.mendoza221995@gmail.com",
    "name": "Javier Herrera",
    "phone": "0999072382",
    "emailVerified": "2026-07-15T00:38:59.591Z",
    "image": null,
    "passwordHash": "$2b$12$sSHlI3xy7HvjZgsYw0/CT.eepW8FY164f8mKs64SM5xu1yUqZzzqW",
    "preferences": {
      "appearance": "DARK"
    },
    "twoFactorReady": false,
    "twoFactorSecret": null,
    "platformRole": "USER",
    "lastLoginAt": "2026-07-15T04:55:18.154Z",
    "createdAt": "2026-07-15T00:38:59.592Z",
    "updatedAt": "2026-07-16T13:27:00.967Z"
  }
]


-- Model: account (0 records) --
-- DATA_ACCOUNT = []


-- Model: session (0 records) --
-- DATA_SESSION = []


-- Model: verificationToken (0 records) --
-- DATA_VERIFICATIONTOKEN = []


-- Model: authenticator (0 records) --
-- DATA_AUTHENTICATOR = []


-- Model: passwordResetToken (2 records) --
-- DATA_PASSWORDRESETTOKEN = [
  {
    "id": "f7209abb-699b-4d03-be4d-83ddff764374",
    "userId": "56026022-f4c1-4c36-8246-b2d374179117",
    "tokenHash": "ab6bf0ccd6c84a0c0358c8b10a2617868feb25926242c96f9f79494a175f9ed6",
    "expiresAt": "2026-07-15T17:58:45.682Z",
    "usedAt": "2026-07-15T17:29:20.333Z",
    "createdAt": "2026-07-15T17:28:45.683Z"
  },
  {
    "id": "e78af3fe-a0b9-4765-b869-2990ad34d22d",
    "userId": "56026022-f4c1-4c36-8246-b2d374179117",
    "tokenHash": "37086ca2e0b69c3e02bbd62db2cd761a906509a7c9115437a441cbefbcae5735",
    "expiresAt": "2026-07-30T03:51:02.422Z",
    "usedAt": "2026-07-30T03:21:47.253Z",
    "createdAt": "2026-07-30T03:21:02.423Z"
  }
]


-- Model: invitation (0 records) --
-- DATA_INVITATION = []


-- Model: membership (4 records) --
-- DATA_MEMBERSHIP = [
  {
    "id": "ba9a9369-7f50-4e7b-8a26-9c31c3297460",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "userId": "a0a80916-cefb-4a28-a48f-5e3f813e5244",
    "status": "ACTIVE",
    "permissionOverrides": [],
    "usePermissionOverrides": false,
    "createdAt": "2026-07-12T23:01:08.459Z"
  },
  {
    "id": "ea5921fb-cbed-4ee0-81c9-d7b9cff3d82f",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "userId": "5f580739-b0da-48d6-b9aa-aab8456ce7df",
    "status": "ACTIVE",
    "permissionOverrides": [
      "dashboard:read",
      "shipments:read",
      "shipments:create"
    ],
    "usePermissionOverrides": true,
    "createdAt": "2026-07-15T00:38:59.602Z"
  },
  {
    "id": "3ef1ef9b-1b66-4acf-8c94-3d8c307c1dc7",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "userId": "8b4a6954-5db3-47c3-896c-3d5788c15fec",
    "status": "ACTIVE",
    "permissionOverrides": [],
    "usePermissionOverrides": false,
    "createdAt": "2026-07-15T05:03:11.788Z"
  },
  {
    "id": "26a14e6e-12ac-462d-821f-f27c4fd327cf",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "userId": "56026022-f4c1-4c36-8246-b2d374179117",
    "status": "ACTIVE",
    "permissionOverrides": [],
    "usePermissionOverrides": false,
    "createdAt": "2026-07-15T14:28:00.377Z"
  }
]


-- Model: role (45 records) --
-- DATA_ROLE = [
  {
    "id": "38eaba7f-311b-4132-8551-e89c554259d2",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Gerente",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "stores:read",
      "picking:read",
      "packing:read",
      "delivery:read",
      "suppliers:read",
      "branding:read",
      "settings:read",
      "settings:update",
      "members:invite",
      "members:manage"
    ],
    "systemKey": "gerente"
  },
  {
    "id": "87201aeb-1d74-4b42-83ec-4c81d1ca4b87",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Supervisor",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "shipments:read",
      "shipments:update",
      "customers:read",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update"
    ],
    "systemKey": "supervisor"
  },
  {
    "id": "a77944fc-c60d-450b-b3c4-cc739d941e99",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Picking",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "inventory:read",
      "products:read",
      "warehouses:read",
      "picking:read",
      "picking:update"
    ],
    "systemKey": "picking"
  },
  {
    "id": "5c9dde97-c534-44be-a418-462e01b77864",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Packing",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "products:read",
      "packing:read",
      "packing:update",
      "shipments:read"
    ],
    "systemKey": "packing"
  },
  {
    "id": "a2d812cf-8abe-458d-835e-1591e8694f0f",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Courier",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "courier"
  },
  {
    "id": "d3516f1e-769f-48aa-bb3b-308be6d44332",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Transportista",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "shipments:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "transportista"
  },
  {
    "id": "400dccae-727d-4943-bd1a-eb0ecd440d97",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Cliente",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "products:read"
    ],
    "systemKey": "cliente"
  },
  {
    "id": "2834e781-20cb-469e-89bc-65b6b1d077bf",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Dropshipper",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "products:read",
      "inventory:read",
      "shipments:read",
      "customers:read",
      "stores:read"
    ],
    "systemKey": "dropshipper"
  },
  {
    "id": "1aa6ff48-90af-4083-b67f-603b707b2a78",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Proveedor",
    "description": null,
    "permissions": [
      "dashboard:read",
      "products:read",
      "inventory:read",
      "suppliers:read",
      "suppliers:update"
    ],
    "systemKey": "proveedor"
  },
  {
    "id": "0113ea40-d323-4be9-8261-438228169fde",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Operador Logístico",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "operador_logistico"
  },
  {
    "id": "de25ed67-f474-4387-b4ad-d327b7cbfff7",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "owner",
    "description": null,
    "permissions": [
      "shipments:read",
      "shipments:create",
      "delivery:read",
      "customers:update",
      "customers:create",
      "roles:manage",
      "packing:read",
      "customers:read",
      "stores:read",
      "suppliers:update",
      "stores:update",
      "picking:update",
      "orders:update",
      "orders:cancel",
      "stores:create",
      "members:manage",
      "orders:read",
      "members:invite",
      "branding:update",
      "suppliers:read",
      "dashboard:read",
      "warehouses:read",
      "picking:read",
      "delivery:update",
      "products:archive",
      "inventory:read",
      "orders:create",
      "inventory:transfer",
      "products:create",
      "warehouses:create",
      "packing:update",
      "products:read",
      "warehouses:update",
      "domains:manage",
      "settings:read",
      "inventory:adjust",
      "products:update",
      "branding:read",
      "settings:update",
      "shipments:update"
    ],
    "systemKey": "owner"
  },
  {
    "id": "d9fceb9a-1b5e-4262-9aea-f746269a929b",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Admin Empresa",
    "description": null,
    "permissions": [
      "shipments:read",
      "shipments:create",
      "delivery:read",
      "customers:update",
      "customers:create",
      "roles:manage",
      "packing:read",
      "customers:read",
      "stores:read",
      "suppliers:update",
      "stores:update",
      "picking:update",
      "orders:update",
      "orders:cancel",
      "stores:create",
      "members:manage",
      "orders:read",
      "members:invite",
      "branding:update",
      "suppliers:read",
      "dashboard:read",
      "warehouses:read",
      "picking:read",
      "delivery:update",
      "products:archive",
      "inventory:read",
      "orders:create",
      "inventory:transfer",
      "products:create",
      "warehouses:create",
      "packing:update",
      "products:read",
      "warehouses:update",
      "settings:read",
      "domains:manage",
      "inventory:adjust",
      "products:update",
      "settings:update",
      "branding:read",
      "shipments:update"
    ],
    "systemKey": "admin_empresa"
  },
  {
    "id": "d42c1bef-99f3-44ac-b00e-f005b7e05a55",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Propietario",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "domains:manage",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update",
      "members:invite",
      "members:manage",
      "roles:manage"
    ],
    "systemKey": "owner"
  },
  {
    "id": "7e388651-18c6-4ccc-aef2-11ab853989b8",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Admin Empresa",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "domains:manage",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update"
    ],
    "systemKey": "admin_empresa"
  },
  {
    "id": "d5103386-1c51-4792-b64e-abaf5add57cf",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Finanzas",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "finance:read",
      "finance:manage"
    ],
    "systemKey": "finanzas"
  },
  {
    "id": "1b13d399-282f-478c-89e6-67f0da8c6d70",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Bodeguero",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "products:create",
      "products:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update"
    ],
    "systemKey": "bodega"
  },
  {
    "id": "f1817707-72bb-4773-a8f6-4a9d3600644d",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "name": "Vendedor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "shipments:read",
      "shipments:create"
    ],
    "systemKey": "vendedor"
  },
  {
    "id": "8833b5c7-d5cd-4956-8b9a-02573d9b45b2",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Gerente",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update",
      "members:invite",
      "members:manage"
    ],
    "systemKey": "gerente"
  },
  {
    "id": "2cf87653-ecdf-4c1d-aaef-f202204613f0",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Supervisor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "shipments:read",
      "shipments:update",
      "customers:read",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update"
    ],
    "systemKey": "supervisor"
  },
  {
    "id": "81aaefec-dea4-4224-a345-a4f963b741a2",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Picking",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "inventory:read",
      "products:read",
      "warehouses:read",
      "picking:read",
      "picking:update"
    ],
    "systemKey": "picking"
  },
  {
    "id": "4c7c2f87-d43d-47d2-8d04-764e1de53db8",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Packing",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "products:read",
      "packing:read",
      "packing:update",
      "shipments:read"
    ],
    "systemKey": "packing"
  },
  {
    "id": "ac79fb26-f25a-4635-a792-2ba92369a671",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Courier",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "courier"
  },
  {
    "id": "8f35cf84-51e3-4b95-ad25-03805c089671",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Transportista",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "shipments:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "transportista"
  },
  {
    "id": "5a23a6a8-dd94-4c67-ac19-ebe04639c855",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Cliente",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "products:read"
    ],
    "systemKey": "cliente"
  },
  {
    "id": "f60f2415-73d8-4e75-a52a-8d7a861ce7b2",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Dropshipper",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:create",
      "products:read",
      "inventory:read",
      "shipments:read",
      "customers:read",
      "stores:read"
    ],
    "systemKey": "dropshipper"
  },
  {
    "id": "65c5458e-5b28-482a-86fc-61e3eb6caf9b",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Proveedor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "products:read",
      "inventory:read",
      "suppliers:read",
      "suppliers:update"
    ],
    "systemKey": "proveedor"
  },
  {
    "id": "81f1761a-d13b-4c4d-8e7e-b3f8af826f9b",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Operador Logístico",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "operador_logistico"
  },
  {
    "id": "6722f13d-7db3-4aa1-b530-413952c00de5",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Finanzas",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "finance:read",
      "finance:manage"
    ],
    "systemKey": "finanzas"
  },
  {
    "id": "67514606-6573-4578-8ccd-b13729db5878",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Vendedor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "shipments:read",
      "shipments:create"
    ],
    "systemKey": "vendedor"
  },
  {
    "id": "731ae847-7e46-42a5-a1f7-1d44fc57ca8c",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "name": "Bodeguero",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "products:create",
      "products:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update"
    ],
    "systemKey": "bodega"
  },
  {
    "id": "1681ac36-1712-4606-bd2d-4d1efb519495",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Propietario",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "domains:manage",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update",
      "members:invite",
      "members:manage",
      "roles:manage"
    ],
    "systemKey": "owner"
  },
  {
    "id": "912f7e19-de44-4468-a7f3-2186a5d704d0",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Admin Empresa",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "domains:manage",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update"
    ],
    "systemKey": "admin_empresa"
  },
  {
    "id": "deb6b860-3e33-4c98-a026-2c2817bc635c",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Gerente",
    "description": null,
    "permissions": [
      "dashboard:read",
      "orders:read",
      "orders:create",
      "orders:update",
      "orders:cancel",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "products:create",
      "products:update",
      "products:archive",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "customers:read",
      "customers:create",
      "customers:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update",
      "stores:read",
      "stores:create",
      "stores:update",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update",
      "suppliers:read",
      "suppliers:update",
      "branding:read",
      "branding:update",
      "finance:read",
      "finance:manage",
      "referrals:read",
      "referrals:manage",
      "settings:read",
      "settings:update",
      "members:invite",
      "members:manage"
    ],
    "systemKey": "gerente"
  },
  {
    "id": "37b666c9-a3b6-44b8-a8af-695e1203be68",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Supervisor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "shipments:read",
      "shipments:update",
      "customers:read",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update"
    ],
    "systemKey": "supervisor"
  },
  {
    "id": "2658f114-001e-4f2b-977a-f766e6b158e6",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Picking",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "inventory:read",
      "products:read",
      "warehouses:read",
      "picking:read",
      "picking:update"
    ],
    "systemKey": "picking"
  },
  {
    "id": "96d6be40-6685-40e7-851a-2a33fcd0a2cd",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Packing",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "products:read",
      "packing:read",
      "packing:update",
      "shipments:read"
    ],
    "systemKey": "packing"
  },
  {
    "id": "91f27f7d-6899-4d7d-ab3f-b214bc2789a5",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Courier",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "courier"
  },
  {
    "id": "78bb4bd7-de85-4c16-a82c-d822d5ea16c9",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Transportista",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "shipments:read",
      "shipments:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "transportista"
  },
  {
    "id": "83d282c0-b50d-4853-b84a-e1d3c0d4201c",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Cliente",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "products:read"
    ],
    "systemKey": "cliente"
  },
  {
    "id": "db038379-53ef-486e-92c8-8af8ec4021d3",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Dropshipper",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:create",
      "products:read",
      "inventory:read",
      "shipments:read",
      "customers:read",
      "stores:read"
    ],
    "systemKey": "dropshipper"
  },
  {
    "id": "aead3589-ca06-4a9a-b90a-0f61ed2be34d",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Proveedor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "products:read",
      "inventory:read",
      "suppliers:read",
      "suppliers:update"
    ],
    "systemKey": "proveedor"
  },
  {
    "id": "1c4bb199-81da-48a5-af78-9817395d1738",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Operador Logístico",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "orders:read",
      "orders:update",
      "inventory:read",
      "inventory:adjust",
      "inventory:transfer",
      "products:read",
      "shipments:read",
      "shipments:create",
      "shipments:update",
      "warehouses:read",
      "picking:read",
      "picking:update",
      "packing:read",
      "packing:update",
      "delivery:read",
      "delivery:update"
    ],
    "systemKey": "operador_logistico"
  },
  {
    "id": "06838777-9b42-4c4d-b53d-575fbb6a0dd4",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Vendedor",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "dashboard:read",
      "shipments:read",
      "shipments:create"
    ],
    "systemKey": "vendedor"
  },
  {
    "id": "f1e0441c-059c-4025-8010-fef3991affe0",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Finanzas",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "finance:read",
      "finance:manage"
    ],
    "systemKey": "finanzas"
  },
  {
    "id": "f050c46b-6c99-4b23-9b1a-9d16e645b9db",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "name": "Bodeguero",
    "description": null,
    "permissions": [
      "referrals:read",
      "referrals:manage",
      "inventory:read",
      "inventory:adjust",
      "products:read",
      "products:create",
      "products:update",
      "warehouses:read",
      "warehouses:create",
      "warehouses:update"
    ],
    "systemKey": "bodega"
  }
]


-- Model: membershipRole (4 records) --
-- DATA_MEMBERSHIPROLE = [
  {
    "membershipId": "ba9a9369-7f50-4e7b-8a26-9c31c3297460",
    "roleId": "de25ed67-f474-4387-b4ad-d327b7cbfff7"
  },
  {
    "membershipId": "ea5921fb-cbed-4ee0-81c9-d7b9cff3d82f",
    "roleId": "f1817707-72bb-4773-a8f6-4a9d3600644d"
  },
  {
    "membershipId": "3ef1ef9b-1b66-4acf-8c94-3d8c307c1dc7",
    "roleId": "d42c1bef-99f3-44ac-b00e-f005b7e05a55"
  },
  {
    "membershipId": "26a14e6e-12ac-462d-821f-f27c4fd327cf",
    "roleId": "1681ac36-1712-4606-bd2d-4d1efb519495"
  }
]


-- Model: warehouse (1 records) --
-- DATA_WAREHOUSE = [
  {
    "id": "b4dfd496-6aa6-440b-b97b-729f7bd3ad5b",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "code": "GYE-01",
    "name": "Bodega Guayaquil TecnoTeens",
    "timezone": "America/Guayaquil",
    "address": {
      "city": "Guayaquil",
      "line1": "MARTHA DE ROLDOS MZ. 215 V 7"
    },
    "active": true,
    "createdAt": "2026-07-15T05:35:11.288Z"
  }
]


-- Model: product (1 records) --
-- DATA_PRODUCT = [
  {
    "id": "4c7483b6-5ab3-4b7c-853b-3efde31e36db",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "sku": "LMPRMDLNA",
    "name": "LAMPARA LASHISTA MEDIA LUNA",
    "description": null,
    "type": "SIMPLE",
    "barcode": null,
    "qrCode": null,
    "category": "LASHISTA",
    "brand": "HS",
    "priceMinor": "7500",
    "costMinor": "0",
    "dropshippingPriceMinor": null,
    "suggestedDropshippingPriceMinor": null,
    "weightKg": null,
    "lengthCm": null,
    "widthCm": null,
    "heightCm": null,
    "minimumStock": "20",
    "reorderPoint": "0",
    "trackSerials": false,
    "trackLots": false,
    "trackExpiry": false,
    "media": [],
    "status": "ACTIVE",
    "attributes": {},
    "createdAt": "2026-07-15T05:36:54.510Z",
    "updatedAt": "2026-07-15T05:36:54.510Z"
  }
]


-- Model: shipment (0 records) --
-- DATA_SHIPMENT = []


-- Model: shipmentTrackingEvent (0 records) --
-- DATA_SHIPMENTTRACKINGEVENT = []


-- Model: wallet (3 records) --
-- DATA_WALLET = [
  {
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "balanceMinor": "0",
    "currency": "USD",
    "updatedAt": "2026-07-15T00:19:35.831Z"
  },
  {
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "balanceMinor": "0",
    "currency": "USD",
    "updatedAt": "2026-07-15T05:03:13.939Z"
  },
  {
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "balanceMinor": "0",
    "currency": "USD",
    "updatedAt": "2026-07-15T14:28:02.280Z"
  }
]


-- Model: walletTransaction (0 records) --
-- DATA_WALLETTRANSACTION = []


-- Model: referralProfile (3 records) --
-- DATA_REFERRALPROFILE = [
  {
    "id": "9ebe7a7e-36c6-4599-bd07-b0b3e11be6e6",
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "userId": "a0a80916-cefb-4a28-a48f-5e3f813e5244",
    "code": "qualityshop",
    "commissionMinor": 10,
    "active": true,
    "createdAt": "2026-07-15T03:29:44.877Z",
    "updatedAt": "2026-07-15T03:30:06.146Z"
  },
  {
    "id": "078f1933-ebb4-4f79-adb8-35a7238f05b1",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "userId": "8b4a6954-5db3-47c3-896c-3d5788c15fec",
    "code": "tecno-teens-8b4a6954-8b4a6954",
    "commissionMinor": 10,
    "active": true,
    "createdAt": "2026-07-15T05:04:07.512Z",
    "updatedAt": "2026-07-15T05:04:07.512Z"
  },
  {
    "id": "55eca278-229c-409d-8446-191e5832f50d",
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "userId": "56026022-f4c1-4c36-8246-b2d374179117",
    "code": "agility-ecuador-56026022-56026022",
    "commissionMinor": 10,
    "active": true,
    "createdAt": "2026-07-15T18:01:08.403Z",
    "updatedAt": "2026-07-15T18:01:08.403Z"
  }
]


-- Model: referralAttribution (1 records) --
-- DATA_REFERRALATTRIBUTION = [
  {
    "id": "5ca32d42-7d30-4251-8cb2-3014ea5b760f",
    "referralProfileId": "9ebe7a7e-36c6-4599-bd07-b0b3e11be6e6",
    "referredTenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "joinedAt": "2026-07-15T05:03:11.861Z"
  }
]


-- Model: referralCommission (0 records) --
-- DATA_REFERRALCOMMISSION = []


-- Model: bankAccount (1 records) --
-- DATA_BANKACCOUNT = [
  {
    "id": "5156bd9f-f03b-46e3-9d6d-f434443c1985",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "bankCode": "GUAYAQUIL",
    "bankName": "Banco Guayaquil",
    "accountType": "AHORROS",
    "accountLast4": "6419",
    "accountCipher": "T0ghMDwCb1G4B4HM.eUCmoH9oQTMsbMSYLzfNKw.BP8l5ROulCSmOw",
    "holderName": "Nicole Plaza Toala",
    "holderId": "0931910509",
    "isDefault": true,
    "active": true,
    "createdAt": "2026-07-15T05:43:14.091Z",
    "updatedAt": "2026-07-15T05:43:14.091Z"
  }
]


-- Model: withdrawal (0 records) --
-- DATA_WITHDRAWAL = []


-- Model: ecommerceIntegration (0 records) --
-- DATA_ECOMMERCEINTEGRATION = []


-- Model: carrierIntegration (0 records) --
-- DATA_CARRIERINTEGRATION = []


-- Model: webhookEndpoint (0 records) --
-- DATA_WEBHOOKENDPOINT = []


-- Model: inventoryBalance (1 records) --
-- DATA_INVENTORYBALANCE = [
  {
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "warehouseId": "b4dfd496-6aa6-440b-b97b-729f7bd3ad5b",
    "productId": "4c7483b6-5ab3-4b7c-853b-3efde31e36db",
    "onHand": "10000",
    "reserved": "0",
    "version": 0,
    "updatedAt": "2026-07-15T05:37:10.767Z"
  }
]


-- Model: inventoryMovement (1 records) --
-- DATA_INVENTORYMOVEMENT = [
  {
    "id": "4f86607f-a86f-4213-8519-d5ed5120177d",
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "warehouseId": "b4dfd496-6aa6-440b-b97b-729f7bd3ad5b",
    "productId": "4c7483b6-5ab3-4b7c-853b-3efde31e36db",
    "type": "ADJUSTMENT",
    "quantity": "10000",
    "referenceType": "MANUAL",
    "referenceId": "Ingreso de mercadería",
    "idempotencyKey": "5c724a21-b45f-4660-84c9-4cc1ec5aec88",
    "occurredAt": "2026-07-15T05:37:10.840Z"
  }
]


-- Model: order (0 records) --
-- DATA_ORDER = []


-- Model: customer (0 records) --
-- DATA_CUSTOMER = []


-- Model: store (0 records) --
-- DATA_STORE = []


-- Model: tenantBranding (3 records) --
-- DATA_TENANTBRANDING = [
  {
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "logoUrl": null,
    "iconUrl": null,
    "primaryColor": "#ff365d",
    "secondaryColor": "#111111",
    "emailFromName": null,
    "supportEmail": null,
    "customCss": null,
    "updatedAt": "2026-07-13T00:56:06.935Z"
  },
  {
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "logoUrl": null,
    "iconUrl": null,
    "primaryColor": "#ff365d",
    "secondaryColor": "#111111",
    "emailFromName": null,
    "supportEmail": null,
    "customCss": null,
    "updatedAt": "2026-07-15T05:03:11.788Z"
  },
  {
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "logoUrl": null,
    "iconUrl": null,
    "primaryColor": "#ff365d",
    "secondaryColor": "#111111",
    "emailFromName": null,
    "supportEmail": null,
    "customCss": null,
    "updatedAt": "2026-07-15T14:28:00.377Z"
  }
]


-- Model: tenantDomain (0 records) --
-- DATA_TENANTDOMAIN = []


-- Model: tenantConfiguration (3 records) --
-- DATA_TENANTCONFIGURATION = [
  {
    "tenantId": "7316e414-a3cc-4735-84e4-a58d272c751a",
    "locale": "es-EC",
    "orderPrefix": null,
    "invoicePrefix": null,
    "features": {},
    "notifications": {},
    "integrations": {},
    "updatedAt": "2026-07-13T00:56:06.935Z"
  },
  {
    "tenantId": "28207840-72e8-40a1-ab47-106cf4bb29e9",
    "locale": "es-EC",
    "orderPrefix": null,
    "invoicePrefix": null,
    "features": {},
    "notifications": {},
    "integrations": {},
    "updatedAt": "2026-07-15T05:03:11.788Z"
  },
  {
    "tenantId": "fa9e03f7-d79b-40ee-afa5-6de607f0899f",
    "locale": "es-EC",
    "orderPrefix": null,
    "invoicePrefix": null,
    "features": {},
    "notifications": {},
    "integrations": {},
    "updatedAt": "2026-07-15T14:28:00.377Z"
  }
]


-- Model: orderItem (0 records) --
-- DATA_ORDERITEM = []


-- Model: auditLog (0 records) --
-- DATA_AUDITLOG = []


-- Model: outboxEvent (0 records) --
-- DATA_OUTBOXEVENT = []

