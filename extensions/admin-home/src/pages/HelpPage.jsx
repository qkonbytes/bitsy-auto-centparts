const STEPS = [
  ['Shopper finds their vehicle', 'By Make, Model, Year and Engine, or by entering the VIN.'],
  ['Bitsy checks fitment live', "TecDoc's part numbers for that vehicle are matched to your SKUs on the spot."],
  ['Only fitting parts show', 'Your own product cards, prices, stock and filters, with add to cart.'],
  ['The vehicle is saved', "In My Garage on the shopper's device, ready for their next visit."],
];

const FAQS = [
  [
    'What counts as an API call?',
    'Each dropdown lookup and each parts search a shopper makes, plus tests you run from the Home page. Counts reset on the 1st of every month.',
  ],
  [
    'What happens when the VIN limit is reached?',
    'VIN searches stop until the 1st of the next month. Shoppers can still find their vehicle with Make, Model, Year and Engine. You can change the limit in Settings.',
  ],
  [
    "A part I sell doesn't show for a vehicle",
    "The product's SKU must match the TecDoc part number, ignoring spaces, dots, dashes and capitals, and its brand must be on the supported brands list.",
  ],
  [
    "Why isn't fitment in my products?",
    "TecDoc's terms don't allow fitment data to be stored, so it's looked up live for every search. It never appears as tags, metafields or collections, and Shopify's own filters can't filter by vehicle.",
  ],
  [
    'What does My Garage store?',
    "Up to 5 vehicles per shopper: Make, Model, Year, Engine and the TecDoc KType, plus the VIN if you turn that on. It's kept in the shopper's own browser only.",
  ],
  [
    'How do I change colours, fonts and spacing?',
    'In Online Store › Themes › Customize: select a Bitsy Auto section or the Bitsy Auto app embed and use its settings.',
  ],
];

export default function HelpPage() {
  return (
    <s-page heading="Help" inlineSize="base">
      <s-section heading="How it works">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
          {STEPS.map(([title, body], i) => (
            <s-box key={title} padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small-300">
                <s-text color="subdued">{String(i + 1)}</s-text>
                <s-text type="strong">{title}</s-text>
                <s-text color="subdued">{body}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Supported brands">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-paragraph>See every parts brand Bitsy Auto can match to your products.</s-paragraph>
          <s-button variant="primary" href="https://www.qkonbytes.com/pages/auto-retail-solutions" target="_blank">
            View brands
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="FAQs">
        <s-stack gap="large">
          {FAQS.map(([q, a]) => (
            <s-stack key={q} gap="small-300">
              <s-heading>{q}</s-heading>
              <s-paragraph>{a}</s-paragraph>
            </s-stack>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Need help?">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-paragraph>Bitsy support, by Q-KON Bytes.</s-paragraph>
          <s-button href="mailto:connect@qkonbytes.com">Email connect@qkonbytes.com</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}
