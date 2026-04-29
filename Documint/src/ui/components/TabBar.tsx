import React from 'react';
import { tabBarStyle, tabButtonStyle, tabButtonActiveStyle } from '../styles';

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function TabBar({ tabs, activeIndex, onSelect }: TabBarProps) {
  return (
    <div style={tabBarStyle}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          style={i === activeIndex ? tabButtonActiveStyle : tabButtonStyle}
          onClick={() => onSelect(i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
