import prompts from 'prompts';

export type RenderMode = 'light' | 'dark';

/**
 * Ask the user to pick a render mode when --mode was not supplied.
 * Returns "light" or "dark". If stdin is not a TTY, defaults to the given
 * fallback mode.
 */
export async function askMode(defaultMode: RenderMode = 'light'): Promise<RenderMode> {
  if (!process.stdin.isTTY) return defaultMode;

  const response = await prompts(
    {
      type: 'select',
      name: 'mode',
      message: 'Render mode?',
      choices: [
        { title: 'Light  - Parchment canvas (recommended for print)', value: 'light' },
        { title: 'Dark   - Near Black canvas', value: 'dark' },
      ],
      initial: defaultMode === 'dark' ? 1 : 0,
    },
    {
      onCancel: () => {
        process.exit(130);
      },
    }
  );

  return (response.mode as RenderMode | undefined) ?? defaultMode;
}
