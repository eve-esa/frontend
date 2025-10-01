import React, { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface RenameConversationInputProps {
  conversationId: string;
  initialName: string;
  onSave: (conversationId: string, newName: string) => void;
  onCancel: () => void;
}

export const RenameConversationInput: React.FC<
  RenameConversationInputProps
> = ({ conversationId, initialName, onSave, onCancel }) => {
  const [editingName, setEditingName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  const isNameValid = editingName.trim().length > 0;

  // Select all text when editing mode is activated
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleRenameSubmit = () => {
    if (isNameValid) {
      onSave(conversationId, editingName.trim());
    }
  };

  const handleRenameCancel = () => {
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isNameValid) {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleRenameSubmit();
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="w-full">
      <Input
        ref={inputRef}
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleRenameCancel}
        variant="secondary"
        className="border-0 focus-visible:border-0 focus-visible:ring-0 bg-transparent px-2 h-auto text-lg font-medium text-natural-100 pr-8 py-1 w-full"
        autoFocus
        endSlot={
          <FontAwesomeIcon
            icon={faCheck}
            onMouseDown={handleIconClick}
            className={cn(
              "size-3 cursor-pointer transition-colors",
              isNameValid
                ? "text-natural-50 hover:text-natural-200"
                : "text-primary-300 cursor-not-allowed"
            )}
          />
        }
      />
    </div>
  );
};
