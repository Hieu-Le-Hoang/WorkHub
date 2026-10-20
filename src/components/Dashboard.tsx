import React from 'react';
import {
    Calendar, Clock, ExternalLink, Layout, Shield,
    Zap, Cloud, Users, KeyRound, FolderOpen, Building2,
    Github, Pencil, LayoutDashboard, Figma, DoorOpen,
} from 'lucide-react';

interface StatCard {
    label: string;
    value: string;
    icon: React.ReactNode;
    theme: string;
}

interface QuickLink {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    url: string;
    theme: string;
}

interface LinkGroup {
    label: string;
    links: QuickLink[];
}

interface DashboardProps {
    userName?: string;
}

const stats: StatCard[] = [
    { label: 'Admin Systems', value: '19', icon: <Layout size={20} />, theme: 'purple' },
    { label: 'Active Tools', value: '6', icon: <Shield size={20} />, theme: 'green' },
    { label: 'Pending Requests', value: '—', icon: <Clock size={20} />, theme: 'amber' },
    { label: 'This Month', value: '—', icon: <Calendar size={20} />, theme: 'blue' },
];

const linkGroups: LinkGroup[] = [
    {
        label: 'Admin Portals',
        links: [
            { icon: <Zap size={18} />, title: 'Power Platform', subtitle: 'Automation & Apps', url: 'https://admin.powerplatform.microsoft.com/home', theme: 'purple' },
            { icon: <Cloud size={18} />, title: 'Azure Portal', subtitle: 'Cloud Infrastructure', url: 'https://portal.azure.com/#home', theme: 'blue' },
            { icon: <Users size={18} />, title: 'Google Admin', subtitle: 'Workspace Control', url: 'https://admin.google.com/ac/home', theme: 'red' },
            { icon: <KeyRound size={18} />, title: 'MS Entra', subtitle: 'Identity & Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/EntraLanding.ReactView', theme: 'indigo' },
            { icon: <FolderOpen size={18} />, title: 'SharePoint', subtitle: 'Content Management', url: 'https://wecarei-admin.sharepoint.com/_layouts/15/online/AdminHome.aspx#/home', theme: 'teal' },
            { icon: <Building2 size={18} />, title: '365 Admin', subtitle: 'Service Operations', url: 'https://admin.cloud.microsoft/?#/homepage', theme: 'orange' },
        ],
    },
    {
        label: 'Dev Tools',
        links: [
            { icon: <Github size={18} />, title: 'GitHub', subtitle: 'Repositories & source code', url: 'https://github.com', theme: 'gray' },
            { icon: <Pencil size={18} />, title: 'Stitch', subtitle: 'UI design & prototyping', url: 'https://stitch.withgoogle.com', theme: 'purple' },
            { icon: <LayoutDashboard size={18} />, title: 'Project Tracker', subtitle: 'Tasks & project management', url: 'https://wcg-hieule.github.io/Project-Tracker/', theme: 'blue' },
            { icon: <Figma size={18} />, title: 'Figma', subtitle: 'Design & collaboration', url: 'https://figma.com', theme: 'red' },
            { icon: <DoorOpen size={18} />, title: 'Room Booking', subtitle: 'Đặt phòng họp', url: 'https://wecare-ii.crm5.dynamics.com/main.aspx?appid=7c0ada0d-cf0d-f011-998a-6045bd1cb61e&pagetype=webresource&webresourceName=crdfd_Bookingroom', theme: 'teal' },
        ],
    },
];

export const Dashboard: React.FC<DashboardProps> = ({ userName = 'User' }) => {
    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="dashboard">
            <div className="dashboard-welcome">
                <h2>{greeting}, {userName} 👋</h2>
                <p className="text-muted">{dateStr}</p>
            </div>

            <div className="stat-strip">
                {stats.map((stat) => (
                    <div key={stat.label} className="stat-strip-item">
                        <div className={`stat-icon stat-icon--${stat.theme}`}>
                            {stat.icon}
                        </div>
                        <div className="stat-strip-info">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-section">
                <div className="qa-groups">
                    {linkGroups.map((group) => (
                        <div key={group.label} className="qa-group">
                            <span className="qa-group-label">{group.label}</span>
                            <div className="qa-grid">
                                {group.links.map((link) => (
                                    <a
                                        key={link.title}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="qa-card"
                                    >
                                        <span className={`qa-icon qa-icon--${link.theme}`}>
                                            {link.icon}
                                        </span>
                                        <span className="qa-title">{link.title}</span>
                                        <ExternalLink size={12} className="qa-arrow" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
