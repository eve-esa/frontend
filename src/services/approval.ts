const PENDING_APPROVAL_CODE = "pending_approval";

type PendingApprovalErrorShape = {
  response?: {
    status?: number;
    data?: {
      detail?: {
        code?: string;
      };
    };
  };
};

/**
 * True only for the specific 403 the backend sends once a self-signed-up
 * account is past the soft limit: the user is authenticated at the identity
 * provider but not yet approved by an operator. Every other error (401, a
 * network failure with no response, a 403 with a different code) returns
 * false so callers keep their existing handling. Kept as the single place
 * that knows this payload shape.
 */
export const isPendingApproval = (error: unknown): boolean => {
  const candidate = error as PendingApprovalErrorShape | null | undefined;
  return (
    candidate?.response?.status === 403 &&
    candidate?.response?.data?.detail?.code === PENDING_APPROVAL_CODE
  );
};
