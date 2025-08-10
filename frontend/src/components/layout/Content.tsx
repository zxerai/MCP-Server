import React, { ReactNode } from 'react';

interface ContentProps {
  children: ReactNode;
}

const Content: React.FC<ContentProps> = ({ children }) => {
  return (
    <main className="flex-1 overflow-auto bg-transparent dark:bg-gray-900/50 relative">
      <div className="p-6 min-h-full">
        <div className="container mx-auto max-w-7xl">
          {children}
        </div>
      </div>
    </main>
  );
};

export default Content;