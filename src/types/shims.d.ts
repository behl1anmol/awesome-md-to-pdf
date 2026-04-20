/*
 * Ambient module shims for third-party packages that don't ship their own
 * TypeScript types. These give us just enough shape to consume the plugins
 * without degrading the rest of the codebase to `any`.
 */

declare module 'markdown-it-toc-done-right' {
  import type MarkdownIt from 'markdown-it';
  interface TocOptions {
    placeholder?: string;
    slugify?: (s: string) => string;
    containerId?: string;
    containerClass?: string;
    listType?: 'ul' | 'ol';
    listClass?: string | null;
    itemClass?: string | null;
    linkClass?: string | null;
    level?: number | number[];
    callback?: (html: string, ast: unknown) => void;
  }
  const plugin: (md: MarkdownIt, options?: TocOptions) => void;
  export default plugin;
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';
  interface TaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }
  const plugin: (md: MarkdownIt, options?: TaskListsOptions) => void;
  export default plugin;
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it';
  type EmojiPlugin = (md: MarkdownIt, options?: Record<string, unknown>) => void;
  const plugin: {
    bare: EmojiPlugin;
    full: EmojiPlugin;
    light: EmojiPlugin;
  };
  export default plugin;
}

declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it';
  interface ContainerRenderOptions {
    render?: (tokens: unknown[], idx: number) => string;
    validate?: (params: string) => boolean;
    marker?: string;
  }
  const plugin: (md: MarkdownIt, name: string, opts?: ContainerRenderOptions) => void;
  export default plugin;
}

declare module 'markdown-it-attrs' {
  import type MarkdownIt from 'markdown-it';
  interface AttrsOptions {
    leftDelimiter?: string;
    rightDelimiter?: string;
    allowedAttributes?: Array<string | RegExp>;
  }
  const plugin: (md: MarkdownIt, options?: AttrsOptions) => void;
  export default plugin;
}

declare module '@vscode/markdown-it-katex' {
  import type MarkdownIt from 'markdown-it';
  interface KatexOptions {
    throwOnError?: boolean;
    errorColor?: string;
    [key: string]: unknown;
  }
  const plugin: (md: MarkdownIt, options?: KatexOptions) => void;
  export default plugin;
}

declare module 'markdown-it-anchor' {
  import type MarkdownIt from 'markdown-it';
  interface PermalinkFn {
    (slug: string, opts: object, state: unknown, idx: number): void;
  }
  interface AnchorOptions {
    level?: number | number[];
    slugify?: (s: string) => string;
    uniqueSlugStartIndex?: number;
    permalink?: PermalinkFn | false;
    permalinkClass?: string;
    permalinkSpace?: boolean;
    permalinkSymbol?: string;
    permalinkBefore?: boolean;
    permalinkHref?: (slug: string, state: unknown) => string;
    permalinkAttrs?: (slug: string, state: unknown) => Record<string, string>;
    callback?: (token: unknown, info: { slug: string; title: string }) => void;
    tabIndex?: number | false;
    getTokensText?: (tokens: unknown[]) => string;
  }
  const plugin: ((md: MarkdownIt, options?: AnchorOptions) => void) & {
    permalink: {
      linkInsideHeader: (opts?: {
        symbol?: string;
        placement?: 'before' | 'after';
        class?: string;
        ariaHidden?: boolean;
        renderAttrs?: (slug: string) => Record<string, string>;
      }) => PermalinkFn;
      headerLink: (opts?: object) => PermalinkFn;
      ariaHidden: (opts?: object) => PermalinkFn;
    };
  };
  export default plugin;
}
