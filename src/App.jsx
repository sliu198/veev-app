import React, {useCallback, useEffect, useState} from "react";

import auth from './auth';
import SignInForm from "./SignInForm";

const PAGE_LOAD_ERROR_MESSAGE = 'There was an error loading this page. Please refresh to try again.'

export function App() {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAuth, setHasAuth] = useState(false);

  const signIn = useCallback(async (email, password) => {
    try {
      await auth.signIn(email, password);
      setHasAuth(true);
    } catch (error) {
      setError(error.message);
    }
  }, [setError, setHasAuth]);

  useEffect(() => {
    const wrappedEffect = async () => {
      const hashMap = await import('./assets/hash-map.json');
      auth.configure({hashMap});

      try {
        const accessToken = await auth.getAccessToken();
        if (accessToken) setHasAuth(true);
      } catch (error) {}

      setIsLoading(false);
    }

    wrappedEffect();
  }, [])

  return <ErrorBoundary>
    {error && <div>{error}</div>}
    {isLoading
      ? <div>Loading...</div>
      : hasAuth
        ? <div>Main App Placeholder</div>
        : <SignInForm onSubmit={signIn}/>
    }
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