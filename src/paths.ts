import { homedir } from 'node:os'
import { join } from 'node:path'

export const THOU_HOME = join(homedir(), '.thou')
export const PROTOTYPES_DIR = join(THOU_HOME, 'prototypes')
export const TREE_DIR = join(THOU_HOME, 'tree')
export const PROJECTS_DIR = join(THOU_HOME, 'projects')
