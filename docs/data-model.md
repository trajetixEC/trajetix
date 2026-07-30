# Modelo de datos inicial

```mermaid
erDiagram
  TENANT ||--o{ MEMBERSHIP : has
  USER ||--o{ MEMBERSHIP : joins
  MEMBERSHIP ||--o{ MEMBERSHIP_ROLE : assigned
  ROLE ||--o{ MEMBERSHIP_ROLE : grants
  TENANT ||--o{ WAREHOUSE : owns
  TENANT ||--o{ PRODUCT : owns
  PRODUCT ||--o{ INVENTORY_BALANCE : balances
  WAREHOUSE ||--o{ INVENTORY_BALANCE : stores
  PRODUCT ||--o{ INVENTORY_MOVEMENT : records
  TENANT ||--o{ ORDER : owns
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT o|--o{ ORDER_ITEM : references
  TENANT ||--o{ AUDIT_LOG : audits
  TENANT ||--o{ OUTBOX_EVENT : emits
```

Los JSON actuales (`customer`, direcciones y settings) son snapshots deliberados. Se normalizarán en CRM y Locations cuando esos bounded contexts entren en alcance. No deben usarse como sustituto permanente de entidades con invariantes.

