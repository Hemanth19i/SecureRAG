import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// App-wide safety net: a render error in any page is caught here and shown as a
// recoverable panel instead of white-screening the whole SPA. React error
// boundaries must be class components.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console for debugging; no telemetry is sent.
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-sr-red/30 bg-sr-red/5 p-6 text-center card-shadow">
          <AlertTriangle size={28} className="mx-auto mb-3 text-sr-red" />
          <h2 className="font-display text-lg font-bold text-sr-text">Something went wrong</h2>
          <p className="mt-1.5 text-sm text-sr-text-secondary">
            This view hit an unexpected error. The rest of the app is unaffected — try again,
            or switch to another page from the sidebar.
          </p>
          <p className="mt-3 break-words font-mono text-[11px] text-sr-text-tertiary">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-sr-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover"
          >
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      </div>
    )
  }
}
