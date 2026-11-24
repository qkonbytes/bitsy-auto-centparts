// Opens the theme editor with each Bitsy section ready to add (merchants still click Save).
// Deep links: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#deep-linking
export const CLIENT_ID = '31def3a8ffaea17e1a4107333b10087a';

const editor = (params) => `shopify:admin/themes/current/editor?${new URLSearchParams(params).toString()}`;

/** @param {{resultsHandle: string}} props */
export default function ThemeSetup({resultsHandle}) {
  const steps = [
    {
      title: 'Bitsy Auto design',
      body: 'Fonts, colours, dropdown and button style, and wording for every Bitsy section.',
      href: editor({context: 'apps', activateAppId: `${CLIENT_ID}/design`}),
      action: 'Turn on',
    },
    {
      title: 'Bitsy Auto product cards',
      body: 'How product cards look on the results page and on filtered collections.',
      href: editor({context: 'apps', activateAppId: `${CLIENT_ID}/cards`}),
      action: 'Turn on',
    },
    {
      title: 'Vehicle nav bar and My Garage',
      body: 'Shows Make › Model › Year › Engine and the garage on every page.',
      href: editor({context: 'apps', activateAppId: `${CLIENT_ID}/vehicle-bar`}),
      action: 'Turn on',
    },
    {
      title: 'Vehicle search hero',
      body: 'Image banner with the dropdowns, for your homepage.',
      href: editor({template: 'index', addAppBlockId: `${CLIENT_ID}/hero`, target: 'newAppsSection'}),
      action: 'Add to homepage',
    },
    {
      title: 'Collection vehicle bar',
      body: 'Filters every collection to the parts that fit. Add it once to the collection template.',
      href: editor({template: 'collection', addAppBlockId: `${CLIENT_ID}/collection-bar`, target: 'newAppsSection'}),
      action: 'Add to collections',
    },
    {
      title: 'Vehicle parts results',
      body: `Add it to your results page (/pages/${resultsHandle}).`,
      href: editor({
        template: 'page',
        previewPath: `/pages/${resultsHandle}`,
        addAppBlockId: `${CLIENT_ID}/results`,
        target: 'newAppsSection',
      }),
      action: 'Add to results page',
    },
  ];

  return (
    <s-section heading="Add Bitsy Auto to your theme">
      <s-stack gap="base">
        <s-text color="subdued">
          Each button opens the theme editor with the section ready. Check it, then click Save. You
          can change every setting there, and add the Vehicle selector block to any section.
        </s-text>
        {steps.map((st) => (
          <s-stack key={st.title} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-stack gap="none">
              <s-text type="strong">{st.title}</s-text>
              <s-text color="subdued">{st.body}</s-text>
            </s-stack>
            <s-button href={st.href} target="_blank">
              {st.action}
            </s-button>
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  );
}
