# rtl-mode

A Claude Code mod for reading Hebrew in the transcript. With RTL mode on, every line of your prompts and Claude's replies that holds Hebrew is shown right to left or left to right, by the language most of its letters are in (quotes, code spans and links not counted), with Unicode bidi marks around the runs of the other language. The stored messages are not changed: only their display.

- `/rtl` toggles the mode, `/rtl on` and `/rtl off` set it. The mode is kept between sessions.
- A small button above the prompt shows `RTL ON` (in green) or `RTL OFF`, and toggles the mode when pressed.
- While the mode is on, Claude is asked to format its answers so they read well right to left: a Hebrew word at the start of each line of a Hebrew answer, spaces around English words, commands and paths in backticks, and Hebrew inside quotes in an English answer.

Lines inside fenced code blocks are left alone, and each table cell is handled on its own.

## Install

At the prompt of a terminal session:

```
/plugin install rtl-mode --marketplace RonGlukhovsky/rtl-mode
```

From a shell:

```
claude plugin install rtl-mode --marketplace RonGlukhovsky/rtl-mode
```

Answer `y` to add the marketplace, then choose the user scope so it loads in every session.

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `RonGlukhovsky/rtl-mode`, then Add plugin.

## Develop

```
claude plugin validate .
claude plugin test .
```
