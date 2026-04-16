import {
  getOllamaStatus,
  listOllamaModels,
  type OllamaModelTag,
  type OllamaOptions,
  type OllamaStatus,
} from '../services/ollama'

export interface AppRuntime {
  kind: 'web'
  ollama: {
    getServerStatus(options: OllamaOptions): Promise<OllamaStatus>
    listModels(options: OllamaOptions): Promise<OllamaModelTag[]>
  }
}

export const webRuntime: AppRuntime = {
  kind: 'web',
  ollama: {
    getServerStatus: getOllamaStatus,
    listModels: listOllamaModels,
  },
}
