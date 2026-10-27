import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { GUIDANCE, rewriteText } from './rtl'

const isOn = atom({ plugin: 'rtl-mode', key: 'isOn' } as const, false)

// $.state redraws the readers; $.store keeps the mode for the next session.
async function setMode($: EngineInterface, value: (was: boolean) => boolean) {
  const next = await update($, isOn, value)
  await $.store.set('isOn', next)

  return next
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rtl',
      description: 'Toggle right-to-left display of Hebrew lines (/rtl, /rtl on, /rtl off)',
    })
    const stored = (await $.store.get('isOn')) === true
    await update($, isOn, () => stored)

    return next(e)
  })

  on('command.run', { command: 'rtl' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') {
      return { text: 'Usage: /rtl, /rtl on or /rtl off' }
    }
    const value = await setMode($, was => (arg === '' ? !was : arg === 'on'))

    return { text: `RTL mode ${value ? 'ON' : 'OFF'}` }
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)

    return next({ ...e, props: { ...e.props, text: rewriteText(e.props.text) } })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)

    return next({ ...e, props: { ...e.props, text: rewriteText(e.props.text) } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const value = await read($, isOn)
    const { Button, Text } = $.ui.resolve(e)

    return (
      <Button key="rtl" label={`RTL ${value ? 'ON' : 'OFF'}`} plain onPress={() => setMode($, was => !was)}>
        RTL{' '}
        {value ? <Text color="#17DD95" bold>ON</Text> : <Text dimColor>OFF</Text>}
      </Button>
    )
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await read($, isOn))) return composed

    return {
      sections: [...composed.sections, { id: 'rtl-mode:guidance', text: GUIDANCE, scope: 'session' as const }],
    }
  })
}
