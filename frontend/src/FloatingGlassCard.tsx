import { Button, Typography } from "antd";
import ReactMarkdown from "react-markdown";
import { useEffect } from "react";

const { Text } = Typography;

type PromptType = "deepen" | "shift" | "empathy";

interface FloatingGlassCardProps {
  type: PromptType;
  text: string;
  onDismiss: () => void;
}

export function FloatingGlassCard({ type, text, onDismiss }: FloatingGlassCardProps) {
  const label = type === "deepen" ? "Deepen Inquiry" : type === "shift" ? "Shift Topic" : "Show Empathy";
  
  // The pinkish color for empathy is #e11d48
  const accentColor = type === "deepen" ? "#1d4ed8" : type === "shift" ? "#0d9488" : "#e11d48";

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      {/* Blurred Backdrop */}
      <div 
        onClick={onDismiss} 
        style={{ 
          position: "absolute", 
          inset: 0, 
          backgroundColor: "rgba(15,23,42,0.35)", 
          backdropFilter: "blur(4px)", 
          cursor: "pointer" 
        }} 
      />
      
      {/* Main Glass Card */}
      <div style={{ position: "relative", maxWidth: 640, width: "100%", padding: 24, borderRadius: 24, background: "rgba(248,250,252,0.96)", border: `2px solid ${accentColor}20`, boxShadow: "0 22px 55px rgba(15,23,42,0.35)", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ paddingRight: 16, flex: 1 }}>
            {/* Header Category */}
            <Text style={{ color: accentColor, fontSize: 22, fontWeight: 600, textTransform: "uppercase" }}>{label}</Text>
            
            {/* AI Coaching Content */}
            <div style={{ marginTop: 12, fontSize: 17, lineHeight: 1.6, color: "#0f172a", maxHeight: "60vh", overflowY: "auto" }}>
              <ReactMarkdown
                components={{
                  strong: ({ ...props }) => <span style={{ color: accentColor, fontWeight: 700 }} {...props} />,
                  p: ({ ...props }) => <p style={{ margin: "0 0 16px 0" }} {...props} />,
                  li: ({ ...props }) => (
                    <li style={{ marginBottom: 8, color: accentColor }} {...props}>
                      <span style={{ color: "#0f172a" }}>{props.children}</span>
                    </li>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          </div>
          <Button type="text" size="small" onClick={onDismiss} style={{ color: "#64748b" }}>✕</Button>
        </div>
      </div>
    </div>
  );
}