import React, { lazy } from 'react';
import { useRoute } from 'wouter';
import { getEditorialTitle } from '../data/fixtures';
import { EditorialDetails } from './EditorialDetails';

const LiveDetails = lazy(() => import('./Details').then(module => ({ default: module.Details })));

export function DetailsRoute() {
  const [, params] = useRoute<{ id: string }>('/details/:id');
  return getEditorialTitle(params?.id || '') ? <EditorialDetails /> : <LiveDetails />;
}
