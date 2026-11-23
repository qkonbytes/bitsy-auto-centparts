// Shopify Admin GraphQL through the App Home UI extension's shopify.query (no server of our own).
export const API_VERSION = '2026-10';

/**
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export async function gql(query, variables) {
  const res = await shopify.query(query, {variables, version: API_VERSION});
  if (res.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return /** @type {any} */ (res.data);
}

/** Throws when a mutation returns userErrors. */
export function assertNoUserErrors(payload, what) {
  const errs = payload?.userErrors ?? [];
  if (errs.length) {
    throw new Error(`${what}: ${errs.map((e) => e.message).join('; ')}`);
  }
}

export async function getCatalogueCounts() {
  const data = await gql(`#graphql
    query BitsyCounts {
      productsCount(limit: null) { count }
      productVariantsCount(limit: null) { count }
    }`);
  return {
    products: data.productsCount?.count ?? null,
    variants: data.productVariantsCount?.count ?? null,
  };
}

export async function listPages() {
  const data = await gql(`#graphql
    query BitsyPages {
      pages(first: 100, sortKey: TITLE) { nodes { id title handle } }
    }`);
  return data.pages?.nodes ?? [];
}

export const RESULTS_PAGE = {
  title: 'Parts for your vehicle',
  handle: 'parts-for-your-vehicle',
};

export async function createResultsPage() {
  const data = await gql(
    `#graphql
    mutation BitsyCreatePage($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id title handle }
        userErrors { field message }
      }
    }`,
    {
      page: {
        title: RESULTS_PAGE.title,
        handle: RESULTS_PAGE.handle,
        body: '',
        isPublished: true,
      },
    },
  );
  assertNoUserErrors(data.pageCreate, 'Could not create the results page');
  return data.pageCreate.page;
}
