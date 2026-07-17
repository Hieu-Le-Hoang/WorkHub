import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ROUTES } from '@/routes';

const D365_BASE = 'https://wecare-ii.crm5.dynamics.com/main.aspx?appid=0aeaedf8-690f-f011-998a-000d3ac71f7a&pagetype=entitylist&navbar=off';

const DEMO_PAGES = [
    { path: ROUTES.DEMO_CUSTOMER, title: 'Customer', url: `${D365_BASE}&etn=crdfd_customer` },
    { path: ROUTES.DEMO_PRODUCT, title: 'Product', url: `${D365_BASE}&etn=crdfd_products` },
    { path: ROUTES.DEMO_SALE_ORDER, title: 'Sale Order', url: `${D365_BASE}&etn=crdfd_sale_order` },
] as const;

/**
 * Demo pages — nhúng D365 entity list qua iframe (navbar=off).
 * Keep-alive: mount 1 lần cho cả /demo/*, iframe đã mở thì giữ sống (ẩn bằng CSS)
 * để chuyển qua lại giữa Customer/Product/Sale Order không phải reload app shell D365.
 */
export const DemoEmbedPage: React.FC = () => {
    const { pathname } = useLocation();
    // Các page đã ghé thăm — chỉ mount iframe khi cần, sau đó giữ sống
    const [visited, setVisited] = useState<string[]>(() => [pathname]);
    const [loaded, setLoaded] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setVisited(prev => prev.includes(pathname) ? prev : [...prev, pathname]);
    }, [pathname]);

    return (
        <div className="demo-embed-page">
            {DEMO_PAGES.filter(p => visited.includes(p.path)).map(p => (
                <div
                    key={p.path}
                    className="demo-embed-frame"
                    style={{ display: p.path === pathname ? 'block' : 'none' }}
                >
                    {!loaded[p.path] && (
                        <div className="demo-embed-loading">
                            <Loader2 size={24} className="spin" />
                            <span>Đang tải {p.title}...</span>
                        </div>
                    )}
                    <iframe
                        src={p.url}
                        className="demo-embed-iframe"
                        title={p.title}
                        onLoad={() => setLoaded(prev => ({ ...prev, [p.path]: true }))}
                    />
                </div>
            ))}
        </div>
    );
};
