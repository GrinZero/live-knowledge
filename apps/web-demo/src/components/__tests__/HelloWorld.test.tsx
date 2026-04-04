import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';

// A simple component for testing
const HelloWorld = () => <h1>Hello, World!</h1>;

describe('HelloWorld Component', () => {
  it('renders "Hello, World!"', () => {
    render(<HelloWorld />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });
});
