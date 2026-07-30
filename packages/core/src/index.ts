export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly permissions: ReadonlySet<string>;
  readonly correlationId: string;
}

export class AuthorizationError extends Error {
  readonly code = "AUTHORIZATION_DENIED";
}

export function requirePermission(context: TenantContext, permission: string): void {
  if (!context.permissions.has(permission)) throw new AuthorizationError(`Missing permission: ${permission}`);
}

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: Date;
  readonly tenantId: TenantId;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly version: number;
}

export interface UnitOfWork {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
