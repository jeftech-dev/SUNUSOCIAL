// Convex Auth JWT configuration (DT-1). Keys: JWT_PRIVATE_KEY / JWKS in the Convex environment.
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
