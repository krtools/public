import clsx from 'clsx';
import React from 'react';

type BaseProps<E extends keyof HTMLElementTagNameMap> = string | React.ComponentPropsWithoutRef<E> | undefined;

export function elWith<E extends keyof HTMLElementTagNameMap>(
  tag: E,
  base?: BaseProps<E>
): React.ForwardRefExoticComponent<React.PropsWithoutRef<React.ComponentPropsWithoutRef<E>> & React.RefAttributes<HTMLElementTagNameMap[E]>> {
  const baseClass = typeof base === 'string' ? base : base?.className;
  const baseProps = typeof base === 'object' && base !== null ? {...base, className: undefined} : {};

  const Comp = React.forwardRef<HTMLElementTagNameMap[E], React.ComponentPropsWithoutRef<E>>((props, ref) => {
    const {className, children, ...rest} = props;
    const mergedClass = clsx(baseClass, className);

    return React.createElement(tag, {
      ref,
      className: mergedClass || undefined,
      ...baseProps,
      ...rest,
      children
    });
  });

  Comp.displayName = `elWith(${tag}, ${baseClass ?? 'anonymous'})`;
  return Comp;
}

export default function divWith(base?: BaseProps<'div'>) {
  return elWith('div', base);
}

