import { MessageOutlined, ArrowRightOutlined, HeartOutlined, StarFilled } from "@ant-design/icons";

type MagicActionType = "deepen" | "shift" | "empathy";

interface MagicActionDeckProps {
  onActionClick: (type: MagicActionType) => void;
  hasNewEmpathy?: boolean;
}

const cards: {
  type: MagicActionType;
  label: string;
  Icon: typeof MessageOutlined;
  activeGradient: string; 
  idleGradient: string;   
  activeShadow: string;
}[] = [
  {
    type: "deepen",
    label: "Deepen Inquiry",
    Icon: MessageOutlined,
    activeGradient: "linear-gradient(135deg, #22d3ee, #3b82f6, #1d4ed8)",
    idleGradient: "linear-gradient(135deg, #22d3ee, #3b82f6, #1d4ed8)",
    activeShadow: "0 18px 40px rgba(37, 99, 235, 0.35)",
  },
  {
    type: "shift",
    label: "Shift Topic",
    Icon: ArrowRightOutlined,
    activeGradient: "linear-gradient(135deg, #34d399, #14b8a6, #0d9488)",
    idleGradient: "linear-gradient(135deg, #34d399, #14b8a6, #0d9488)",
    activeShadow: "0 18px 40px rgba(13, 148, 136, 0.32)",
  },
  {
    type: "empathy",
    label: "Show Empathy",
    Icon: HeartOutlined,
    activeGradient: "linear-gradient(135deg, #a855f7, #ec4899, #e11d48)", // Pinkish Gradient
    idleGradient: "linear-gradient(135deg, #71747a, #505459, #434548)",   // Grey/Idle Gradient
    activeShadow: "0 18px 40px rgba(236, 72, 153, 0.35)",
  },
];

export function MagicActionDeck({ onActionClick, hasNewEmpathy }: MagicActionDeckProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
      {cards.map(({ type, label, Icon, activeGradient, idleGradient, activeShadow }) => {
        // Logic: Show grey if it's the empathy tile and there's no new status
        const isEmpathyAndActive = type === "empathy" && hasNewEmpathy;
        const currentGradient = (type === "empathy" && !hasNewEmpathy) ? idleGradient : activeGradient;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onActionClick(type)}
            style={{
              position: "relative",
              padding: "30px 14px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              backgroundImage: currentGradient,
              boxShadow: isEmpathyAndActive ? activeShadow : "none",
              color: "white",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.4s ease",
            }}
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 14, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.45)" }}>
                <Icon style={{ fontSize: 18, color: "white" }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "white" }}>{label}</div>
              </div>
            </div>
            {isEmpathyAndActive && (
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f97316", border: "2px solid white" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}