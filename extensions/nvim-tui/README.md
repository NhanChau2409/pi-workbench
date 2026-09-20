# nvim-tui

A small Neovim-like interaction layer for Pi:

- the prompt editor is editable with insert/normal modes;
- the transcript is a read-only navigation window.

## Fullscreen is required for transcript navigation

Pi has two different rendering models:

- **Regular TUI:** the terminal owns scrollback. Pi and extensions cannot reliably focus, scroll, locate chunks in, or receive mouse events from the transcript. Only prompt-editor modal editing works.
- **Fullscreen TUI:** Pi owns the viewport and transcript `ScrollView`. This enables transcript focus, keyboard scrolling, mouse focus, and the relative scrollbar.

Configure it globally:

```json
{
  "tuiMode": "fullscreen",
  "fullscreenScrollbar": "always"
}
```

Or launch explicitly:

```bash
pi --tui-mode fullscreen
pi --continue --tui-mode fullscreen
```

Changing the settings file does not replace an already-running regular-screen renderer. Restart Pi, or change **TUI mode** through `/settings`, which applies immediately. `/reload` reloads extension resources but may not replace the renderer mode.

The extension shows a warning ruler when loaded in regular mode rather than silently pretending transcript navigation is available.

## Current controls

- `Esc`: editor normal mode
- `i`, `a`: editor insert mode
- `Ctrl-]`: move focus to transcript; from transcript, return to editor
- transcript `j` / `k`: scroll one line
- transcript counts such as `5j` / `5k`
- transcript `Ctrl-d` / `Ctrl-u`: half-page
- transcript `Ctrl-e` / `Ctrl-y`: one-line viewport scroll
- transcript `g` / `G`: top/bottom
- click transcript/editor: change focus in fullscreen

The transcript is read-only, so `i` and `a` are ignored while it is focused.

## Compatibility note

Pi 0.85.1 does not publicly expose its transcript component to extensions. The current prototype uses Pi's internal `getPrimaryScrollView()` method to transfer focus and observe transcript mouse input. This is version-sensitive and should be replaced with an official transcript-focus API when Pi provides one.
