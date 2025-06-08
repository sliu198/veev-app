import React from "react";

import HomeDashboard from "./HomeDashboard";

const PAGE_LOAD_ERROR_MESSAGE = 'There was an error loading this page. Please refresh to try again.'

export function App() {

  return <ErrorBoundary>
    <HomeDashboard/>
  </ErrorBoundary>
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error) {
    return {error};
  }

  render() {
    if (this.state.error) return PAGE_LOAD_ERROR_MESSAGE;

    return this.props.children;
  }
}