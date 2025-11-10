
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, ...rest }) => {
  return (
    <div className={`bg-card backdrop-blur-lg rounded-xl border border-border-color/50 shadow-lg p-6 sm:p-8 transition-all duration-300 ${className}`} {...rest}>
      {title && <h2 className="text-xl font-bold text-header mb-4 border-b border-border-color/50 pb-2">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;