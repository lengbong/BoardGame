import type { Side } from './types';

/** 두 편의 이름과 색. 이름을 비워 두면 편 이름(해님·달님)으로 부른다. */
export const SIDE_INFO: Record<Side, { label: string; main: string; dark: string; light: string; mark: string }> = {
  0: { label: '해님', main: '#e2762f', dark: '#a84f14', light: '#fdecdc', mark: '☀' },
  1: { label: '달님', main: '#4a5bc4', dark: '#2e3b8c', light: '#e6e9fb', mark: '☾' },
};
