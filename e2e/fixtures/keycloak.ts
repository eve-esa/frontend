import type { PlaywrightWorkerArgs } from "@playwright/test";

/**
 * Keycloak admin API of the local compose stack (master realm, admin-cli), for the cleanup
 * of accounts the signup spec registers. Defaults are the compose ones.
 */

type RequestFactory = PlaywrightWorkerArgs["playwright"]["request"];

const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? "http://localhost:8080";
const KEYCLOAK_REALM = process.env.E2E_KEYCLOAK_REALM ?? "eve";
const KEYCLOAK_ADMIN_USER = process.env.E2E_KEYCLOAK_ADMIN_USER ?? "admin";
const KEYCLOAK_ADMIN_PASSWORD = process.env.E2E_KEYCLOAK_ADMIN_PASSWORD ?? "admin";

/**
 * Deletes the Keycloak user with this e-mail through the admin API (master realm,
 * admin-cli). Returns whether a user was found and deleted.
 */
export async function deleteKeycloakUser(factory: RequestFactory, email: string): Promise<boolean> {
  const context = await factory.newContext({ baseURL: KEYCLOAK_URL });
  try {
    const token = await context.post("/realms/master/protocol/openid-connect/token", {
      form: {
        grant_type: "password",
        client_id: "admin-cli",
        username: KEYCLOAK_ADMIN_USER,
        password: KEYCLOAK_ADMIN_PASSWORD,
      },
    });
    if (!token.ok()) throw new Error(`Keycloak admin token answered ${token.status()}`);
    const { access_token: accessToken } = (await token.json()) as { access_token: string };
    const headers = { Authorization: `Bearer ${accessToken}` };
    const found = await context.get(`/admin/realms/${KEYCLOAK_REALM}/users`, {
      headers,
      params: { email, exact: "true" },
    });
    if (!found.ok()) throw new Error(`Keycloak user search answered ${found.status()}`);
    const users = (await found.json()) as { id: string }[];
    for (const user of users) {
      const deleted = await context.delete(`/admin/realms/${KEYCLOAK_REALM}/users/${user.id}`, {
        headers,
      });
      if (deleted.status() !== 204) {
        throw new Error(`Keycloak user delete answered ${deleted.status()}`);
      }
    }
    return users.length > 0;
  } finally {
    await context.dispose();
  }
}
