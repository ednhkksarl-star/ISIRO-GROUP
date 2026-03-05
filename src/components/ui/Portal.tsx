'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: ReactNode;
    selector?: string;
}

export default function Portal({ children, selector = '#portal-root' }: PortalProps) {
    const [mounted, setMounted] = useState(false);
    const [element, setElement] = useState<Element | null>(null);

    useEffect(() => {
        setMounted(true);
        let el = document.querySelector(selector);

        if (!el && selector === '#portal-root') {
            el = document.createElement('div');
            el.id = 'portal-root';
            document.body.appendChild(el);
        }

        setElement(el);

        return () => {
            // We don't necessarily want to remove the portal root if other portals are using it
        };
    }, [selector]);

    return mounted && element ? createPortal(children, element) : null;
}
