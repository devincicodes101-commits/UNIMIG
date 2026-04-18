"use client";

import React, { useEffect, useState } from 'react'
import { History } from './history'
import { HistoryList } from './history-list'

const HistoryContainer = () => {
  const [showHistory, setShowHistory] = useState(false);
  
  useEffect(() => {
    // Check if ENABLE_SAVE_CHAT_HISTORY is true on client side
    // This is just a fallback, ideally set this as NEXT_PUBLIC_ env var
    const enableSaveChatHistory = process.env.NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY === 'true';
    setShowHistory(enableSaveChatHistory);
  }, []);

  if (!showHistory) {
    return null;
  }

  return (
    <div>
      <History>
        <HistoryList userId="anonymous" />
      </History>
    </div>
  )
}

export default HistoryContainer
