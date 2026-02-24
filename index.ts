#!/usr/bin/env bun
import { Command } from 'commander'
import { askCommand } from './src/commands/ask'
import { graphCommand } from './src/commands/graph'
import { initCommand } from './src/commands/init'
import { ralphCommand } from './src/commands/ralph'
import { yankCommand } from './src/commands/yank'

const program = new Command()

program
  .name('thou-demo')
  .description('Prototype factory CLI — init, ralph, graph, yank, ask')
  .version('0.1.0')

program.addCommand(initCommand)
program.addCommand(ralphCommand)
program.addCommand(graphCommand)
program.addCommand(yankCommand)
program.addCommand(askCommand)

program.parse()
