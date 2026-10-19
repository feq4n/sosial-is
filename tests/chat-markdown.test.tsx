import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/chat/Markdown';

describe('Markdown (AI cavabları)', () => {
  it('başlıq, qalın, kursiv, sətirdaxili kod və siyahıları göstərir', () => {
    const { container } = render(<Markdown text={'## Başlıq\n\nBu **vacibdir** və *kursiv* `kod`.\n\n- bir\n- iki\n\n1. a\n2. b'} />);
    expect(screen.getByRole('heading', { name: 'Başlıq' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('vacibdir');
    expect(container.querySelector('em')).toHaveTextContent('kursiv');
    expect(container.querySelector('p code')).toHaveTextContent('kod');
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('kod blokunu olduğu kimi (HTML kimi yox) göstərir', () => {
    const { container } = render(<Markdown text={'```js\nconst a = "<b>x</b>";\nif (a) {}\n```'} />);
    const code = container.querySelector('pre code') as HTMLElement;
    expect(code.textContent).toBe('const a = "<b>x</b>";\nif (a) {}');
    expect(code.querySelector('b')).toBeNull();
    expect(screen.getByLabelText('js kod bloku')).toBeInTheDocument();
  });

  it('xam HTML və təhlükəli keçidlər icra olunmur', () => {
    const { container } = render(<Markdown text={'<img src=x onerror=alert(1)> <script>alert(1)</script>\n\n[pis](javascript:alert(1)) [yaxşı](https://example.com/a)'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com/a');
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(links[0]).toHaveAttribute('target', '_blank');
  });

  it('cədvəl və [n] istinadlarını göstərir, qapanmamış kod blokunda donmur', () => {
    const { container } = render(<Markdown text={'| Ad | Rol |\n|---|---|\n| Ana | Sosial işçi |\n\nMənbə [1].\n\n```\nqapanmamış'} />);
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelector('td')).toHaveTextContent('Ana');
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(container.querySelector('pre')).toHaveTextContent('qapanmamış');
  });

  it('Azərbaycan hərfləri və boş mətn problemsiz işləyir', () => {
    const { container, rerender } = render(<Markdown text="Əhəmiyyətli: ığüşöçə İ" />);
    expect(container).toHaveTextContent('Əhəmiyyətli: ığüşöçə İ');
    rerender(<Markdown text="" />);
    expect(container.textContent).toBe('');
  });
});
