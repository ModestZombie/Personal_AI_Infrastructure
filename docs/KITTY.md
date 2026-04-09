# Kitty Terminal Integration in PAI

The **Personal AI Infrastructure (PAI)** project leverages [Kitty](https://sw.kovidgoyal.net/kitty/) as its primary terminal emulator. Kitty is chosen for its:
1.  **GPU Acceleration:** Extremely fast rendering, crucial for heavy CLI usage.
2.  **Remote Control (`kitten @`):** Allows PAI to programmatically control the terminal (change tab titles, colors, manage windows) based on AI state.
3.  **Extensibility:** Scriptable via Python and shell, enabling deep integration with the PAI workflow.

---

## 1. PAI Integration & Automation (v3.0)

In version 3.0, PAI introduces an advanced hook system (`tab-setter.ts`, `UpdateTabTitle.hook.ts`) that turns the terminal into a dynamic status dashboard. It uses Kitty's remote control capabilities to reflect the AI's internal state directly in the tab UI.

### State Management
PAI defines three primary states for a terminal tab, visualized by emoji prefixes and color coding:

| State | Emoji | Color (Inactive Tab) | Description |
| :--- | :---: | :--- | :--- |
| **Thinking** | 🧠 | **Purple** (`#1E0A3C`) | The AI is processing a prompt or running inference. |
| **Working** | ⚙️ | **Orange** (`#804000`) | The AI is executing tools, running commands, or performing tasks. |
| **Idle** | (None) | **Default** | The session is waiting for user input. |

### Phase Management
For long-running tasks, the Algorithm tracks progress through "Phases", also reflected in the tab title:

| Phase | Emoji | Description |
| :--- | :---: | :--- |
| **Research** | 👁️ | Gathering context and information. |
| **Plan** | 📋 | Creating a detailed execution plan. |
| **Build** | 🔨 | Writing code or implementing changes. |
| **Verify** | ⚡ | Running tests and checks. |
| **Complete** | ✅ | Task finished successfully. |
| **Knowledge** | 📚 | Updating memory/knowledge base. |

### How It Works (`kitten @`)
The integration relies on the `kitten @` command-line tool to send instructions to the Kitty instance.

*   **Socket Communication:** PAI communicates with Kitty via a Unix socket (e.g., `unix:/tmp/kitty`). This is faster and more reliable than escape codes.
*   **Command Example:**
    ```bash
    # Set tab title
    kitten @ --to="unix:/tmp/kitty" set-tab-title "⚙️ Fix Bug"

    # Set tab color (active tab stays blue, inactive changes to orange)
    kitten @ --to="unix:/tmp/kitty" set-tab-color --self \
      active_bg="#002B80" active_fg="#FFFFFF" \
      inactive_bg="#804000" inactive_fg="#A0A0A0"
    ```

---

## 2. Configuration (Reference: v2.4 Baseline)

While v3.0 focuses on automation, the core Kitty configuration (keybindings, theme, fonts) is established in v2.4. Below is the reference `kitty.conf` used in PAI.

### Key Features
*   **Theme:** customized **Tokyo Night Storm** palette.
*   **Fonts:** **Hack Nerd Font** (patched for icons/glyphs).
*   **Keybindings:**
    *   `Cmd+Shift+N`: Launch a new PAI session in a new tab.
    *   `Cmd+Shift+L/H/K/J`: Create new splits (vim-style direction).
    *   `Cmd+H/J/K/L`: Navigate between splits.
    *   `Ctrl+Cmd+H/J/K/L`: Resize windows.

### `kitty.conf` Reference

```conf
# Kitty Terminal Config for PAI
# Optimized for Claude Code and PAI workflows

# Window Management
remember_window_size no
initial_window_width 75c
initial_window_height 65c
window_padding_width 16
confirm_os_window_close 0
enabled_layouts tall,fat,horizontal,vertical,grid,stack

# Tab Bar Styling
tab_bar_edge top
tab_bar_style powerline
tab_bar_min_tabs 1
tab_title_template "{index}: {title}"
active_tab_foreground   #c0caf5
active_tab_background   #1244B3
active_tab_font_style   bold
inactive_tab_foreground #787c99
inactive_tab_background #1a1b26
inactive_tab_font_style normal

# Shell Integration
shell_integration enabled
shell zsh

# Theme - Tokyo Night Storm with custom colors
background #24283b
foreground #c0caf5
selection_background #775095
selection_foreground #c0caf5

# Cursor
cursor #bb9af7
cursor_text_color #24283b
cursor_shape block
cursor_blink_interval 0

# Colors - Tokyo Night Storm palette
color0  #1a1b26
color1  #f7768e
color2  #9ece6a
color3  #e0af68
color4  #7aa2f7
color5  #bb9af7
color6  #7dcfff
color7  #a9b1d6

color8  #414868
color9  #f7768e
color10 #9ece6a
color11 #e0af68
color12 #7aa2f7
color13 #bb9af7
color14 #7dcfff
color15 #c0caf5

# Fonts
font_family Hack Nerd Font
bold_font Hack Nerd Font Bold
italic_font Hack Nerd Font Italic
bold_italic_font Hack Nerd Font Bold Italic
font_size 19.0
font_features +liga
disable_ligatures never
text_composition_strategy 1.0 20

# Keyboard Shortcuts
# Config reload
map shift+cmd+r load_config_file

# Tab management
map cmd+t new_tab
map cmd+w close_tab
map ctrl+t next_tab

# Launch new PAI session (new tab + run 'pai' command)
map cmd+shift+n launch --type=tab --cwd=current zsh -ic "pai"

# Window/Split management - Create new panes with Cmd+Shift
map cmd+shift+l launch --location=vsplit
map cmd+shift+h launch --location=vsplit --location=before
map cmd+shift+k launch --location=hsplit --location=before
map cmd+shift+j launch --location=hsplit

# Navigate between tabs with Ctrl+H/L
map ctrl+h previous_tab
map ctrl+l next_tab

# Move tabs left/right (reorder position)
map ctrl+shift+h move_tab_backward
map ctrl+shift+l move_tab_forward

# Navigate between panes (vim-style) - using Cmd
map cmd+h neighboring_window left
map cmd+j neighboring_window down
map cmd+k neighboring_window up
map cmd+l neighboring_window right

# Resize windows - using Ctrl+Cmd (native kitty resize)
map ctrl+cmd+h resize_window narrower
map ctrl+cmd+l resize_window wider
map ctrl+cmd+k resize_window taller
map ctrl+cmd+j resize_window shorter

# Scrollback
scrollback_lines 10000
scrollback_pager_history_size 10

# Mouse
hide_window_decorations titlebar-only
mouse_hide_wait 0

# Background
background_opacity 1.0
dynamic_background_opacity no
background_blur 0

# Background Image
background_image ~/.claude/skills/CORE/USER/TERMINAL/ul-circuit-embossed-v5.png
background_image_layout cscaled
background_tint 0.96

# Selection/Clipboard
copy_on_select yes
strip_trailing_spaces smart
clipboard_control write-clipboard write-primary read-clipboard read-primary

# macOS Specific
macos_option_as_alt yes
macos_titlebar_color background
macos_traditional_fullscreen no
macos_show_window_title_in all
macos_custom_beam_cursor yes
macos_thicken_font 0.75

# Performance
repaint_delay 10
input_delay 3
sync_to_monitor yes

# URLs
url_style curly
open_url_with default
detect_urls yes
url_prefixes file ftp ftps gemini git gopher http https irc ircs kitty mailto news sftp ssh

# Special key mappings
map shift+enter send_text all \n
map ctrl+enter send_text all \x1b[27;5;13~

# Window borders
window_border_width 0pt
draw_minimal_borders yes
active_border_color #bb9af7
inactive_border_color #414868
bell_border_color #e0af68

# Bell
enable_audio_bell no
visual_bell_duration 0.0
window_alert_on_bell yes

# REQUIRED for PAI Automation
allow_remote_control yes
listen_on unix:/tmp/kitty
update_check_interval 0
startup_session none
allow_hyperlinks yes
```

---

## 3. Remote Control Requirements

For PAI's hook system (v3.0) to function, your `kitty.conf` **MUST** include the following lines:

```conf
allow_remote_control yes
listen_on unix:/tmp/kitty
```

*   `allow_remote_control yes`: Enables the `kitten @` command to control the terminal.
*   `listen_on unix:/tmp/kitty`: Creates a Unix socket at `/tmp/kitty`. This is critical for PAI's background processes (hooks) to find and control the correct Kitty instance without needing complex environment variable plumbing.

---

## 4. Best Practices & Tips

### Performance Tuning
To maximize responsiveness, especially when AI is generating large amounts of text:
*   **Input Delay:** Set `input_delay 3` (ms). Lowering this improves responsiveness but may increase CPU usage.
*   **Repaint Delay:** Set `repaint_delay 10` (ms). This controls how often the screen updates (10ms = ~100fps).
*   **Sync to Monitor:** `sync_to_monitor yes` prevents screen tearing but adds minor latency. Set to `no` for raw speed if tearing isn't an issue.

### Broadcasting (Multicasting)
You can type in all open windows (panes) simultaneously. This is useful for running the same command across multiple servers or environments.
*   **Command:** `launch --type=os-window kitten broadcast`
*   **Bind it:** `map f1 launch --allow-remote-control kitten broadcast`

### Advanced Tab Formatting
You can customize the `tab_title_template` even further using Python formatting.
*   **Example:** Show only the first 2 letters of the layout name in uppercase:
    ```conf
    tab_title_template "{index}: {title} {layout_name[:2].upper()}"
    ```

### Troubleshooting
*   **"Socket not found":** If PAI hooks fail to update tab titles, check if the socket exists: `ls -l /tmp/kitty`. If not, restart Kitty.
*   **Garbage Characters:** If you see escape codes leaking into your terminal, ensure you are using the socket (`--to`) flag with `kitten @`, as PAI does. Direct pipe control can sometimes leak data.
