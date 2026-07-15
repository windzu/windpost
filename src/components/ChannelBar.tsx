import * as React from "react";

export type Channel = "blog" | "wechat" | "xiaohongshu";

const channels: Array<{ id: Channel; label: string }> = [
  { id: "blog", label: "Blog" },
  { id: "wechat", label: "公众号" },
  { id: "xiaohongshu", label: "小红书" },
];

export function ChannelBar({ value, onChange }: { value: Channel; onChange: (value: Channel) => void }) {
  return (
    <nav className="windpost-channels" aria-label="发布渠道">
      {channels.map((channel) => (
        <button
          key={channel.id}
          type="button"
          className={`windpost-channel${value === channel.id ? " is-active" : ""}`}
          onClick={() => onChange(channel.id)}
        >
          {channel.label}
        </button>
      ))}
    </nav>
  );
}
