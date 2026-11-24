import { useEffect, useState } from 'react';

export const ROUTES = ['expediente', 'costo', 'pagos', 'aprobaciones', 'conciliacion', 'aduana', 'preguntar', 'gobernanza'] as const;
export type Route = (typeof ROUTES)[number];

const parse = (hash: string): Route => {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'expediente';
};

/** URL is the state for the active section (shareable, survives reload). */
export const useHashRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
};

export const href = (route: Route): string => `#/${route}`;
