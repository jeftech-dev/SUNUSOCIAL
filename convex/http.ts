import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();

// Convex Auth: OpenID configuration and JWKS used to verify session tokens.
auth.addHttpRoutes(http);

export default http;
