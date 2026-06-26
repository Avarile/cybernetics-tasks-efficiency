import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { KrProgressBar } from './KrProgressBar';

describe('KrProgressBar', () => {
  it('renders bar at correct width percentage', () => {
    const { container } = render(
      <KrProgressBar progressPct={0.6} paceStatus="on_track" />
    );
    const bar = container.querySelector('[data-testid="kr-bar"]');
    expect(bar).not.toBeNull();
    expect((bar as HTMLElement).style.width).toBe('60%');
  });

  it('applies red color class for behind pace', () => {
    const { container } = render(
      <KrProgressBar progressPct={0.3} paceStatus="behind" />
    );
    const bar = container.querySelector('[data-testid="kr-bar"]');
    expect(bar?.className).toContain('bg-red');
  });

  it('applies amber color class for on_track pace', () => {
    const { container } = render(
      <KrProgressBar progressPct={0.5} paceStatus="on_track" />
    );
    const bar = container.querySelector('[data-testid="kr-bar"]');
    expect(bar?.className).toContain('bg-amber');
  });

  it('applies green color class for ahead pace', () => {
    const { container } = render(
      <KrProgressBar progressPct={0.8} paceStatus="ahead" />
    );
    const bar = container.querySelector('[data-testid="kr-bar"]');
    expect(bar?.className).toContain('bg-green');
  });
});
