import http from "node:http";
import readline from "node:readline";
import url from "node:url";

// Helper to ask user input
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

async function startRetriever() {
  const clientIdInput =
    process.env.CLIENT_ID ||
    (await askQuestion("Enter Google OAuth Client ID: "));
  const clientSecretInput =
    process.env.CLIENT_SECRET ||
    (await askQuestion("Enter Google OAuth Client Secret: "));
  const PORT = 3000;
  const REDIRECT_URI = `http://localhost:${PORT}`;

  if (!clientIdInput || !clientSecretInput) {
    console.error("Error: Both Client ID and Client Secret are required!");
    process.exit(1);
  }

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientIdInput)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=${encodeURIComponent("https://www.googleapis.com/auth/chromewebstore")}&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log("\n=== Chrome Web Store OAuth2 Token Retriever ===");
  console.log(
    "1. Please open the following URL in your browser to authorize access:",
  );
  console.log(`\n${authUrl}\n`);
  console.log("2. Waiting for authorization code on localhost...");

  let isAuthorized = false;

  const server = http.createServer(async (req, res) => {
    if (isAuthorized) {
      res.writeHead(400);
      res.end("Already authorized or closed.");
      return;
    }

    const parsedUrl = url.parse(req.url || "", true);
    const code = parsedUrl.query.code;

    if (typeof code === "string" && code) {
      isAuthorized = true;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h1>Authorization Successful!</h1><p>You can close this tab and return to the terminal.</p>",
      );

      console.log("\n3. Code received. Exchanging code for tokens...");
      server.close();

      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientIdInput,
            client_secret: clientSecretInput,
            code: code,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to exchange code: ${response.statusText} - ${errorText}`,
          );
        }

        const tokens = (await response.json()) as {
          refresh_token?: string;
          access_token?: string;
        };
        console.log("\n================ SUCCESS ================");
        console.log(`Access Token:  ${tokens.access_token}`);
        console.log(`Refresh Token: ${tokens.refresh_token}`);
        console.log("=========================================");
        console.log(
          "\nUse this Refresh Token to configure your GitHub Actions Secrets!",
        );
        process.exit(0);
      } catch (error) {
        console.error("\nError exchanging code for token:", error);
        process.exit(1);
      }
    } else {
      res.writeHead(400);
      res.end("Authorization code missing.");
    }
  });

  server.listen(PORT);
}

startRetriever().catch((err) => {
  console.error(err);
  process.exit(1);
});
