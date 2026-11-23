export default function NotFoundPage() {
  return (
    <s-page heading="Page not found">
      <s-section>
        <s-stack gap="base">
          <s-paragraph>This page doesn't exist in Bitsy Auto.</s-paragraph>
          <s-button href="/">Back to Home</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}
