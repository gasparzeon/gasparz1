import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Cantos chanfrados (classe gz-cbtn em app/site.css): o fundo e a borda são
// desenhados por trás, nas variáveis --cut-bg/--cut-line; o botão continua
// retangular, então o contorno de foco aparece inteiro.
const buttonVariants = cva(
  "gz-cbtn inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-[color,filter] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:[--cut-line:var(--destructive)]",
  {
    variants: {
      variant: {
        default:
          'text-primary-foreground [--cut-bg:var(--primary)] [--cut-line:var(--primary)] hover:text-background hover:[--cut-bg:var(--foreground)] hover:[--cut-line:var(--foreground)]',
        destructive:
          'text-destructive-foreground [--cut-bg:var(--destructive)] [--cut-line:var(--destructive)] hover:brightness-110',
        outline:
          'text-foreground [--cut-bg:var(--card)] [--cut-line:var(--input)] hover:[--cut-line:var(--foreground)]',
        secondary:
          'text-secondary-foreground [--cut-bg:var(--secondary)] [--cut-line:var(--border)] hover:[--cut-line:var(--input)]',
        ghost: 'text-foreground hover:[--cut-bg:var(--accent)]',
        link: 'gz-cbtn--flat text-link underline underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
