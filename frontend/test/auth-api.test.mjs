import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.NEXT_PUBLIC_API_URL = "https://api.example.test/base/";

const [{ apiBaseUrl, ApiError }, { getAuthErrorMessage, registerUser }] =
  await Promise.all([
    import("../lib/api-client.js"),
    import("../lib/auth-api.js"),
  ]);
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function response(payload, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => payload,
  };
}

test("registration uses the configured API URL and sends the supplied normalized email", async () => {
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return response(
      {
        success: true,
        data: {
          verificationRequired: true,
          challengeId: "A".repeat(43),
        },
      },
      201,
    );
  };

  await registerUser({
    name: "Test User",
    email: "new-user@example.test",
    password: "example-test-password",
  });

  assert.equal(apiBaseUrl, "https://api.example.test/base");
  assert.equal(requestUrl, `${apiBaseUrl}/api/auth/register`);
  assert.equal(requestOptions.method, "POST");
  assert.deepEqual(JSON.parse(requestOptions.body), {
    name: "Test User",
    email: "new-user@example.test",
    password: "example-test-password",
  });
});

test("the registration UI receives backend error messages without replacing unrelated errors", async () => {
  const cases = [
    {
      status: 409,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "Account already exists. Please sign in.",
    },
    {
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  ];

  for (const backendError of cases) {
    globalThis.fetch = async () =>
      response(
        {
          success: false,
          error: {
            code: backendError.code,
            message: backendError.message,
          },
        },
        backendError.status,
      );

    await assert.rejects(
      registerUser({
        name: "Test User",
        email: "new-user@example.test",
        password: "example-test-password",
      }),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(getAuthErrorMessage(error), backendError.message);
        return true;
      },
    );
  }
});
