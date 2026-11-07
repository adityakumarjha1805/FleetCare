import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.NEXT_PUBLIC_API_URL = "https://api.example.test/base/";

const [
  { apiBaseUrl, ApiError },
  { completeOnboarding, getAuthErrorMessage, loginUser, registerUser },
] =
  await Promise.all([
    import("../lib/api-client.js"),
    import("../lib/auth-api.js"),
  ]);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
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
  const user = {
    id: "user-id",
    name: "Test User",
    email: "new-user@example.test",
    onboardingCompleted: false,
  };
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return response(
      {
        success: true,
        data: {
          user,
        },
      },
      201,
    );
  };

  const registeredUser = await registerUser({
    name: "Test User",
    email: "new-user@example.test",
    password: "example-test-password",
  });

  assert.deepEqual(registeredUser, user);
  assert.equal(apiBaseUrl, "https://api.example.test/base");
  assert.equal(requestUrl, `${apiBaseUrl}/api/auth/register`);
  assert.equal(requestOptions.method, "POST");
  assert.deepEqual(JSON.parse(requestOptions.body), {
    name: "Test User",
    email: "new-user@example.test",
    password: "example-test-password",
  });
});

test("login consumes the direct user response and announces the authenticated session", async () => {
  const user = {
    id: "user-id",
    name: "Test User",
    email: "new-user@example.test",
    onboardingCompleted: false,
  };
  let sessionEvent;
  globalThis.window = {
    dispatchEvent(event) {
      sessionEvent = event;
    },
  };
  globalThis.fetch = async () =>
    response({ success: true, data: { user } }, 200);

  const loggedInUser = await loginUser({
    email: user.email,
    password: "example-test-password",
  });

  assert.deepEqual(loggedInUser, user);
  assert.equal(sessionEvent.type, "fleetcare:session-authenticated");
  assert.deepEqual(sessionEvent.detail, { user });
});

test("onboarding completion posts to the authenticated endpoint and announces the saved status", async () => {
  const user = {
    id: "user-id",
    name: "Test User",
    email: "new-user@example.test",
    onboardingCompleted: true,
  };
  let completionEvent;
  let requestUrl;
  let requestOptions;
  globalThis.window = {
    dispatchEvent(event) {
      completionEvent = event;
    },
  };
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return response({ success: true, data: { user } }, 200);
  };

  const completedUser = await completeOnboarding();

  assert.deepEqual(completedUser, user);
  assert.equal(requestUrl, `${apiBaseUrl}/api/auth/onboarding/complete`);
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.deepEqual(JSON.parse(requestOptions.body), {});
  assert.equal(completionEvent.type, "fleetcare:onboarding-completed");
  assert.deepEqual(completionEvent.detail, { user });
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
