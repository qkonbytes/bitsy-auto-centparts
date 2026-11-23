// The theme blocks load product cards through the Storefront API.
// They need a public, read-only Storefront access token, which this app creates once
// and keeps in an app-data metafield that the blocks read from Liquid.
import {gql, assertNoUserErrors} from './admin.js';
import {setInstallationMetafields} from './settings.js';

const TOKEN_TITLE = 'Bitsy Auto storefront';

async function findExistingToken() {
  const data = await gql(`#graphql
    query BitsyStorefrontTokens {
      shop { storefrontAccessTokens(first: 100) { nodes { title accessToken } } }
    }`);
  const nodes = data.shop?.storefrontAccessTokens?.nodes ?? [];
  return nodes.find((t) => t.title === TOKEN_TITLE)?.accessToken ?? null;
}

async function createToken() {
  const data = await gql(
    `#graphql
    mutation BitsyCreateStorefrontToken($input: StorefrontAccessTokenInput!) {
      storefrontAccessTokenCreate(input: $input) {
        storefrontAccessToken { accessToken }
        userErrors { field message }
      }
    }`,
    {input: {title: TOKEN_TITLE}},
  );
  assertNoUserErrors(data.storefrontAccessTokenCreate, 'Could not create Storefront access');
  return data.storefrontAccessTokenCreate.storefrontAccessToken.accessToken;
}

/**
 * Makes sure a token exists and is saved where the theme blocks can read it.
 * @param {string} installationId
 * @param {string | null} savedToken
 * @returns {Promise<string>}
 */
export async function ensureStorefrontToken(installationId, savedToken) {
  const existing = await findExistingToken();
  if (existing && existing === savedToken) return existing;
  const token = existing ?? (await createToken());
  await setInstallationMetafields(installationId, [
    {key: 'storefront_token', type: 'single_line_text_field', value: token},
  ]);
  return token;
}
