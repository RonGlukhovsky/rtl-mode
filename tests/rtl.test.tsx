import { expect, mock, test } from 'claude-code/testing'

import { OFF_BACKGROUND, ON_BACKGROUND } from '../hooks/register'
import { LRE, LRM, PDF, RLE, RLM, rewriteText } from '../hooks/rtl'

test('a Hebrew line opens RTL and embeds its English code spans', () => {
  expect(rewriteText('הרץ את `npm test` עכשיו')).toBe(`${RLM}${RLE}הרץ את ${LRE}\`npm test\`${PDF} עכשיו`)
})

test('an English line with a Hebrew quote that holds an English word', () => {
  expect(rewriteText('Click the "שמור את ה file עכשיו" button')).toBe(
    `${LRM}${LRE}Click the "${RLE}שמור את ה file עכשיו${PDF}" button`,
  )
})

test('an English line embeds a bare Hebrew run with its closing punctuation', () => {
  expect(rewriteText('The word for hello is שלום עולם! in Hebrew')).toBe(
    `${LRM}${LRE}The word for hello is ${RLE}שלום עולם!${PDF} in Hebrew`,
  )
})

test('direction ignores the quote, code span and link', () => {
  // Hebrew outnumbers English only once the quoted English is left out.
  expect(rewriteText('כתוב "hello world from the shell" ב `bash`')).toMatch(new RegExp(`^${RLM}${RLE}`))
  expect(rewriteText('see [קישור ארוך מאוד בעברית](https://x.io) now')).toMatch(new RegExp(`^${LRM}${LRE}`))
})

test('marks go after markdown markers, gershayim is not a quote', () => {
  expect(rewriteText('## כותרת')).toBe(`## ${RLM}${RLE}כותרת`)
  expect(rewriteText('- [ ] משימה')).toBe(`- [ ] ${RLM}${RLE}משימה`)
  expect(rewriteText('> 1. צה"ל')).toBe(`> 1. ${RLM}${RLE}צה"ל`)
})

test('code blocks stay, English-only lines stay, table cells are separate', () => {
  const text = ['```', 'echo שלום', '```', 'plain English', '| שם | name |', '|---|---|'].join('\n')
  expect(rewriteText(text)).toBe(
    ['```', 'echo שלום', '```', 'plain English', `| ${RLM}${RLE}שם | name |`, '|---|---|'].join('\n'),
  )
})

const USER = {
  plugin: 'rtl-mode',
  component: 'UserMessage',
  props: { text: 'שלום `ls`', origin: { kind: 'composer' }, isExpanded: true },
} as const

const BAND = {
  plugin: 'rtl-mode',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 80 } } as const

test('/rtl toggles, stores the mode, and the messages and button follow', async ($, on) => {
  // A store in memory that the test can read back.
  const kept: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: kept[e.key] }))
  on('store.set', (_, e) => {
    kept[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'rtl' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // Stands for the engine's own drawing of a message.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{'text' in e.props ? e.props.text : ''}</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const before = await $.ui.mount({ ...USER, surface: 'terminal' })
  expect((await before.find({ type: 'Text' }))?.text).toBe('שלום `ls`')
  await before.unmount()

  expect((await $.command.run({ command: 'rtl', args: 'on', ...RUN })).text).toBe('RTL mode ON')
  expect(kept.isOn).toBe(true)

  const after = await $.ui.mount({ ...USER, surface: 'terminal' })
  expect((await after.find({ type: 'Text' }))?.text).toBe(`${RLM}${RLE}שלום ${LRE}\`ls\`${PDF}`)
  await after.unmount()

  // A desktop orders Hebrew rows itself: its messages are left as written.
  const onDesktop = await $.ui.mount({ ...USER, surface: 'desktop' })
  expect((await onDesktop.find({ type: 'Text' }))?.text).toBe('שלום `ls`')
  await onDesktop.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ type: 'Text', text: /RTL/ }))?.props.backgroundColor).toBe(ON_BACKGROUND)
  await band.press({ key: 'rtl' })
  expect(kept.isOn).toBe(false)
  expect((await band.find({ type: 'Text', text: /RTL/ }))?.props.backgroundColor).toBe(OFF_BACKGROUND)
  await band.unmount()

  // A desktop draws a native button from its label: RTL ○ off, RTL ● and primary while on.
  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desktop.find({ type: 'Button' }))?.props).toMatchObject({ label: 'RTL ○', variant: 'secondary' })
  await desktop.press({ key: 'rtl' })
  expect((await desktop.find({ type: 'Button' }))?.props).toMatchObject({ label: 'RTL ●', variant: 'primary' })
  await desktop.unmount()
  expect(kept.isOn).toBe(true)

  expect((await $.command.run({ command: 'rtl', args: '', ...RUN })).text).toBe('RTL mode OFF')
})

test('the mode stored by an earlier session is on at start, with the prompt guidance', async ($, on) => {
  mock.store(on, { isOn: true })
  on('command.register', () => ({ value: { command: 'rtl' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const { sections } = await $.prompt.compose({
    model: 'm',
    promptModel: 'm',
    surfaces: ['terminal'],
    tools: [],
    outputStyle: null,
    traits: [],
  })
  expect(sections.map(s => s.id)).toEqual(['intro', 'rtl-mode:guidance'])
})
