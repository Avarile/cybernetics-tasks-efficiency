import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
}

export function PageContainer({ children, title }: PageContainerProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {title && (
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h1>
      )}
      {children}
    </div>
  );
}
