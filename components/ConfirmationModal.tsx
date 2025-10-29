import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonClassName?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message,
    confirmButtonText = "Підтвердити",
    confirmButtonClassName = "bg-red-600 hover:bg-red-700"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border-color">
          <h2 className="text-xl font-bold text-header">{title}</h2>
        </div>
        <div className="p-6 text-primary-text">
          {message}
        </div>
        <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
          <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
          <button onClick={onConfirm} className={`text-white px-4 py-2 rounded-md transition-colors ${confirmButtonClassName}`}>
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
