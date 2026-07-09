export function FullText({ html }: { html: string }) {
  return <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />;
}
