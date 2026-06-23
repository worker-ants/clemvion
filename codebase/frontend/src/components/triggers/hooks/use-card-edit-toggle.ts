import { useState } from "react";

export function useCardEditToggle() {
  const [editing, setEditing] = useState(false);
  return {
    editing,
    setEditing,
    startEdit: () => setEditing(true),
    /** onReset 로 미저장 입력 버퍼를 원복한 뒤 read 모드로 전환. */
    cancelEdit: (onReset?: () => void) => {
      onReset?.();
      setEditing(false);
    },
  };
}
