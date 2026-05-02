import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error('ErrorBoundary caught:', error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass rounded-xl p-8 max-w-sm text-center border border-destructive/30">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-grotesk font-bold text-foreground text-lg mb-2">Fehler aufgetreten</h2>
            <p className="text-sm text-muted-foreground mb-4">{this.state.error?.message || 'Ein unbekannter Fehler ist aufgetreten.'}</p>
            <Button onClick={this.reset} className="w-full bg-primary text-primary-foreground gap-2">
              <RotateCcw className="w-4 h-4" /> Neu laden
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}