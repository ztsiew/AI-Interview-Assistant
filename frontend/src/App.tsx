// Trying to commit with new account (ztsiew)

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge,Button,Card,Divider,Input,Layout,Modal,Space,Tag,Typography,message,Steps,List,Tabs,Tooltip,Checkbox,} from "antd";
import {AudioOutlined,EyeOutlined,FilePdfOutlined,ArrowRightOutlined,MenuOutlined,CheckCircleFilled,} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MagicActionDeck } from "./MagicActionDeck";
import { FloatingGlassCard } from "./FloatingGlassCard";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function App() {
  // --- STATE MANAGEMENT ---
  const [sid, setSid] = useState<string | null>(null); // DEPLOYMENT: Added Session ID tracking
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // DEPLOYMENT: Added for browser audio
  const chunkIntervalRef = useRef<number | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");
  const [planName, setPlanName] = useState<string | null>(null);
  const [activePlanData, setActivePlanData] = useState<any>(null);
  const [viewPlanOpen, setViewPlanOpen] = useState(false); 
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [followup, setFollowup] = useState<string>("Waiting for insights...");
  const [transition, setTransition] = useState<string>("Waiting for insights...");
  const [empathy, setEmpathy] = useState<string>("Waiting for insights...");
  const [scorecardMd, setScorecardMd] = useState<string>("");
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [allocatedTime, setAllocatedTime] = useState<number>(30);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [activePrompt, setActivePrompt] = useState<{ type: "deepen" | "shift" | "empathy"; content: string; } | null>(null);
  const [hasNewEmpathy, setHasNewEmpathy] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  
  const [collapsed, setCollapsed] = useState(false);
  const [completedQuestions, setCompletedQuestions] = useState<string[]>([]);

  const pollTimer = useRef<number | null>(null);
  const prevEmpathyRef = useRef<string>("");
  const API_URL = "https://ai-interview-assistant-backend-web-render.onrender.com"; // DEPLOYMENT: Change to your Render URL
  // const API_URL = "http://localhost:8000";

  // --- STYLING ---
  const glassStyle: React.CSSProperties = {
    background: "rgba(230, 247, 255, 0.6)", 
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.4)",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
  };

  const customInstructionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
  };

  const sharedBackgroundStyle: React.CSSProperties = {
    minHeight: "100vh",
    width: "100%",
    backgroundImage: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    display: "flex",
    flexDirection: "column"
  };

  // --- API FUNCTIONS ---
  // DEPLOYMENT: Helper to ensure a session room exists before uploading or recording
  async function initSession() {
  const res = await fetch(`${API_URL}/start`, { method: "POST" });
  const data = await res.json();
  setSid(data.session_id);
  setInterviewId(data.interview_id); // Save the human-readable ID
  return data.session_id;
}

  async function uploadPdf(file: File) {
  let currentSid = sid;

  if (!currentSid) {
    currentSid = await initSession();
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload_pdf/${currentSid}`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(txt);
    throw new Error("Upload failed");
  }

  return await res.json();
}

  async function updateProgress(questionId: string) {
    if (!sid) return;
    try {
      // DEPLOYMENT: Added /${sid} to route
      await fetch(`${API_URL}/update_progress/${sid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
    } catch (e) { console.error("Progress update error", e); }
  }

  async function updateConfig(promptText: string) {
    if (!sid) return;
    // DEPLOYMENT: Added /${sid} to route
    await fetch(`${API_URL}/update_config/${sid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_prompt: promptText }),
    });
    message.success("Directives updated");
  }

  async function getStatus() {
    if (!sid) return {};
    // DEPLOYMENT: Added /${sid} to route
    const res = await fetch(`${API_URL}/status/${sid}`);
    return await res.json();
  }

async function startRecording() { 
    try {
      let currentSid = sid;
      if (!currentSid) {
        currentSid = await initSession();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Helper function to spawn a fresh recorder with headers
      const spawnRecorder = () => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = async (e) => {
          if (e.data.size > 0) {
            const formData = new FormData();
            formData.append("file", e.data, "audio.webm"); 
            await fetch(`${API_URL}/process_audio/${currentSid}`, { method: "POST", body: formData });
          }
        };
        
        recorder.start();
        return recorder;
      };

      let activeRecorder = spawnRecorder();

      // Stop the current recorder and start a new one every 7 seconds 
      // This guarantees EVERY chunk sent to the backend has a valid WebM header
      chunkIntervalRef.current = window.setInterval(() => {
        if (activeRecorder.state === "recording") {
          activeRecorder.stop(); // Triggers the upload of a complete file
        }
        activeRecorder = spawnRecorder(); // Immediately start the next chunk
      }, 7000);

      setIsRecording(true);
      setStartTime(Date.now());
    } catch (e) {
      message.error("Microphone access required.");
    }
  }
  
  async function stopRecording() {
    if (!sid) return;
    
    // Clear the interval so we stop spawning new recorders
    if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
    
    // Stop the active recorder and the hardware mic
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    
    const res = await fetch(`${API_URL}/stop/${sid}`, { method: "POST" });
    return await res.json();
  }

  const triggerLogDownload = async (targetSid: string) => {
    try {
      const res = await fetch(`${API_URL}/download_log/${targetSid}`);
      const data = await res.json();
      if (data.content) {
        const blob = new Blob([data.content], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename || "interview_log.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Failed to download log", e);
    }
  };

  // --- LOGIC HANDLERS ---
  const toggleQuestion = (qId: string) => {
    setCompletedQuestions(prev => {
      const isAlreadyDone = prev.includes(qId);
      const updatedList = isAlreadyDone 
        ? prev.filter(id => id !== qId) 
        : [...prev, qId];
      
      if (!isAlreadyDone) {
        updateProgress(qId);
      }
      return updatedList;
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const hide = message.loading("Loading Interview Plan...", 0);
    try {
      const result = await uploadPdf(file);
      setPlanName(file.name);
      setActivePlanData(result.data);
      message.success("Interview Plan Loaded!");
    } catch (err) { message.error("Upload failed"); } finally { hide(); }
  };

  const handleStopAndScore = async () => {
    setIsStopping(true);
    try {
      const res = await stopRecording();
      setScorecardMd(res.scorecard || "");
      
      // --- TRIGGER DOWNLOAD ON END ---
      if (sid) await triggerLogDownload(sid);
      
      if (res.scorecard) setScorecardOpen(true);
    } catch (e) {
      message.error("Failed to generate scorecard");
    } finally {
      setIsStopping(false);
      setIsRecording(false);
    }
  };

  // --- POLLING & TIMERS ---
  useEffect(() => {
    // DEPLOYMENT: Added `sid` check so it doesn't poll empty sessions
    if (isRecording && sid && !isStopping && !scorecardMd) { 
      pollTimer.current = window.setInterval(async () => {
        try {
          const s = await getStatus();
          setTranscript(s.transcript_list || []);
          setFollowup(s.followup || "Waiting...");
          setTransition(s.transition || "Waiting...");
          const nextEmp = s.empathy || "Status: Normal";
          setEmpathy(nextEmp);
          if (nextEmp !== prevEmpathyRef.current && !/status:\s*normal/i.test(nextEmp)) {
            setHasNewEmpathy(true);
          }
          prevEmpathyRef.current = nextEmp;
        } catch (e) { console.error(e); }
      }, 2000); // DEPLOYMENT: Increased to 2s to prevent hammering the cloud server
    }
    return () => { if (pollTimer.current) window.clearInterval(pollTimer.current); };
  }, [isRecording, isStopping, scorecardMd, sid]);

  useEffect(() => {
    let clock: number;
    if (isRecording && startTime && !isStopping && !scorecardMd) {
      clock = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    }
    return () => clearInterval(clock);
  }, [isRecording, startTime, isStopping, scorecardMd]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        // Modern way to trigger the prompt
        e.preventDefault();
        
        // Included for legacy browser support (it satisfies the trigger requirement)
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecording]);

  // --- RENDER COMPONENTS ---
  const VisualSteps = () => {
    const collection = activePlanData?.interview_guides_collection[0];
    if (!collection) return null;

    const themeSteps = collection.themes.map((t: any) => ({
      title: <Text strong style={{ fontSize: 14, color: "#1890ff" }}>{t.title}</Text>,
      description: (
        <div style={{ marginBottom: 12, paddingLeft: 4 }}>
          <div style={{ background: "#e6fffb", border: "1px solid #87e8de", borderRadius: "6px", padding: "6px 10px", marginBottom: "8px" }}>
            <Text style={{ fontSize: 9, color: "#08979c", fontWeight: 800, display: "block", textTransform: "uppercase" }}>Objective</Text>
            <Text style={{ fontSize: 11, lineHeight: 1.2 }}>{t.objective}</Text>
          </div>
          <List 
            size="small" 
            dataSource={t.questions} 
            renderItem={(q: any) => {
              const isDone = completedQuestions.includes(q.id);
              return (
                <div 
                  onClick={() => toggleQuestion(q.id)}
                  style={{ 
                    marginBottom: 8, padding: "8px", borderRadius: "8px", cursor: "pointer",
                    backgroundColor: isDone ? "rgba(82, 196, 26, 0.1)" : "white",
                    border: isDone ? "1px solid #b7eb8f" : "1px solid #f0f0f0",
                    transition: "all 0.2s ease"
                  }}
                >
                  <Space align="start" size={12} style={{ width: '100%' }}>
                    <Checkbox 
                        checked={isDone} 
                        style={{ marginTop: 2 }} 
                        onClick={(e) => e.stopPropagation()} 
                        onChange={() => toggleQuestion(q.id)}
                    />
                    <Text style={{ 
                        fontSize: 13, 
                        fontWeight: 500, 
                        color: isDone ? "#237804" : "#262626", 
                        textDecoration: isDone ? "line-through" : "none",
                        flex: 1
                    }}>
                      {q.text}
                    </Text>
                  </Space>
                  {q.probes && q.probes.length > 0 && (
                    <div style={{ marginLeft: 28, paddingLeft: 10, borderLeft: "1px solid #f0f0f0", marginTop: 4 }}>
                      {q.probes.map((p: any, idx: number) => (
                        <div key={idx} style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", fontStyle: 'italic' }}>↳ {p.text}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }} 
          />
        </div>
      )
    }));

    if (collection.opening_statement) {
      themeSteps.unshift({
        title: <Text strong style={{ fontSize: 14, color: "#722ed1" }}>Introduction</Text>,
        description: <div style={{ marginBottom: 12, padding: 8, background: "#f9f0ff", border: "1px solid #d3adf7", borderRadius: 8, fontStyle: "italic", fontSize: 12 }}>{collection.opening_statement}</div>
      } as any);
    }

    return <Steps direction="vertical" size="small" items={themeSteps} />;
  };

  const formatTime = (ts: number) => {
    const m = Math.floor(ts / 60);
    const s = ts % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const statusUi = useMemo(() => {
    if (scorecardMd) return { color: "green", text: "Interview Completed" };
    if (isStopping) return { color: "gold", text: "Analyzing..." };
    if (isRecording) return { color: "red", text: "LIVE" };
    return { color: "default", text: "Ready" };
  }, [isRecording, isStopping, scorecardMd]);

  if (showLanding) {
    return (
      <div style={sharedBackgroundStyle}>
        <Header style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", paddingInline: 40, display: "flex", alignItems: "center" }}>
          <Title level={4} style={{ margin: 0, color: "#1890ff" }}>AI Interview Assistant</Title>
        </Header>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...glassStyle, padding: "60px 40px", textAlign: "center", maxWidth: 650, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <Title level={1}>Welcome to AI Interview Assistant!</Title>
            <Text style={{ fontSize: 18, display: "block", marginBottom: 32 }}>An intelligent companion providing real-time guidance and strategic support directly to the interviewer.</Text>
            <Button type="primary" size="large" onClick={() => setShowLanding(false)} style={{ height: 50, paddingInline: 40, borderRadius: 8, fontWeight: 'bold' }}>
              GET STARTED
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ height: "100vh", background: "#f0f2f5", overflow: "hidden" }}>
      <Header style={{ background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 24, borderBottom: "1px solid #f0f0f0", zIndex: 10 }}>
        <Space size={16}>
          {(isRecording || scorecardMd) && (
            <Tooltip title="Toggle Sidebar">
              <Button type="text" icon={<MenuOutlined />} onClick={() => setCollapsed(!collapsed)} />
            </Tooltip>
          )}
          <Space>
            <AudioOutlined style={{ color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0 }}>AI Interview Assistant</Title>
          </Space>
        </Space>
        
        <Space>
          {(isRecording || scorecardMd) && (
            <Tag color={elapsedSeconds > (allocatedTime * 60) ? "error" : "blue"} style={{ fontWeight: 'bold' }}>
              {formatTime(elapsedSeconds)} / {formatTime(allocatedTime * 60)}
            </Tag>
          )}
          <Tag color={statusUi.color}>{statusUi.text}</Tag>
        </Space>
      </Header>

      <Layout style={{ background: "transparent", height: "calc(100vh - 64px)" }}>
        {!isRecording && !scorecardMd && !isStopping ? (
          <Content style={{ ...sharedBackgroundStyle, justifyContent: "center", alignItems: "center", padding: 24 }}>
            <Card style={{ ...glassStyle, width: 450 }}>
              <Title level={4} style={{ textAlign: "center", marginBottom: 24 }}>Interview Setup</Title>
              <Space direction="vertical" size={20} style={{ width: "100%" }}>
                {/* --- STEP C: INTERVIEW ID DISPLAY --- */}
                {interviewId && (
                  <div style={{ 
                    padding: "16px", 
                    background: "rgba(82, 196, 26, 0.05)", 
                    border: "1px dashed #b7eb8f", 
                    borderRadius: "12px", 
                    textAlign: "center",
                    marginBottom: 8
                  }}>
                    <Text type="secondary" style={{ fontSize: 10, display: "block", letterSpacing: 1 }}>ANONYMOUS INTERVIEW ID</Text>
                    <Text copyable strong style={{ fontSize: 24, color: "#52c41a", display: "block", margin: "4px 0" }}>
                      {interviewId}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Please copy this ID for your research records or survey forms.
                    </Text>
                  </div>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>1. LOAD INTERVIEW PLAN</Text>
                  <Input type="file" accept=".pdf" onChange={handlePdfUpload} style={{ marginTop: 8 }} />
                  {planName && activePlanData && (
                    <div style={{ marginTop: 8 }}>
                       <Text type="success" style={{ fontSize: 12, fontWeight: '500', display: "block" }}> ✓ {planName} loaded.</Text>
                       <Button type="default" size="middle" icon={<EyeOutlined />} onClick={() => setViewPlanOpen(true)} block style={{ marginTop: 8, fontWeight: 'bold', backgroundColor: '#61d527', color: 'white', fontSize: 14, height: 35 }}>
                          View Generated Strategy
                        </Button>
                    </div>
                  )}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>2. CUSTOM AI INSTRUCTION</Text>
                  <Input.TextArea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3} placeholder="e.g. 'Be very encouraging'" style={{ marginTop: 8 }} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>3. SESSION TIME (MINUTES)</Text>
                  <Input type="number" value={allocatedTime} onChange={e => setAllocatedTime(Number(e.target.value))} style={{ marginTop: 8 }} />
                </div>
                <Button type="default" size="middle" block onClick={startRecording} style={{ marginTop: 5, fontWeight: 'bold', backgroundColor: '#1890ff', color: 'white', fontSize: 16, height: 35 }}>
                  Start Interview
                </Button>
              </Space>
            </Card>
          </Content>
        ) : (
          <Layout hasSider style={{ background: "transparent" }}>
            <Sider trigger={null} collapsible collapsed={collapsed} width={320} collapsedWidth={0} style={{ ...glassStyle, margin: "16px 0 16px 16px", height: "calc(100vh - 96px)", transition: "all 0.3s" }}>
              <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <div style={{ background: "rgba(230, 247, 255, 0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.4)", borderRadius: "16px", padding: 16, display: "flex", flexDirection: "column" }}>
                    <Text type="secondary" style={{ ...customInstructionLabelStyle, color: "#1890ff", fontSize: 16 }}>CUSTOM AI INSTRUCTION</Text>
                    <Input.TextArea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={6} style={{ marginTop: 8, border: "1.2px solid #1890ff" }} />
                    <Button type="primary" size="large" block onClick={() => updateConfig(customPrompt)} style={{ marginTop: 12 }}>Update</Button>
                  </div>
                  {!scorecardMd ? (
                    <Button type="primary" danger block size="large" loading={isStopping} onClick={handleStopAndScore}>END INTERVIEW</Button>
                  ) : (
                    <Button type="default" block onClick={() => setScorecardOpen(true)} style={{ backgroundColor: '#141ffac1', color: 'white' }}>RE-OPEN SCORECARD</Button>
                  )}
                  <Divider style={{ margin: "8px 0" , fontSize: 16}}>TRANSCRIPT</Divider>
                </Space>
                <div style={{ flex: 1, overflowY: "auto", fontSize: 11, padding: "8px 0", marginTop: 8 }}>
                  {transcript.map((s, i) => <p key={i} style={{ marginBottom: 6, color: i === transcript.length - 1 ? "#000" : "#888" }}>{s}</p>)}
                </div>
              </div>
            </Sider>

            <Content style={{ display: "flex", flexDirection: "column", padding: 16, gap: 16, height: "100%" }}>
              <Card title="Interview Plan" style={{ ...glassStyle, flex: "1 1 70%", overflow: 'hidden' }} styles={{ body: { flex: 1, overflowY: "auto", padding: "16px 20px" }}}>
                {activePlanData ? <VisualSteps /> : <div style={{ textAlign: "center", padding: 40 }}><Text type="secondary">No interview plan loaded.</Text></div>}
              </Card>
              <Card title="💡 AI Suggestions" style={{ ...glassStyle, flex: "1 1 30%", overflow: "visible" }} styles={{ body: { padding: 12, height: "100%"} }}>
                <div style={{ position: "relative", height: "100%" }}>
                  <MagicActionDeck hasNewEmpathy={hasNewEmpathy} onActionClick={(type) => {
                      let content = type === "deepen" ? followup : type === "shift" ? transition : empathy;
                      setActivePrompt({ type, content });
                      if (type === "empathy") setHasNewEmpathy(false);

                      if (sid) {
                        fetch(`${API_URL}/log_interaction/${sid}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action_type: type, content: content }),
                        });
                      }
                    }}
                  />
                  {activePrompt && <FloatingGlassCard type={activePrompt.type} text={activePrompt.content} onDismiss={() => setActivePrompt(null)} />}
                </div>
              </Card>
            </Content>
          </Layout>
        )}
      </Layout>

      <Modal title="🗺️ Plan Strategy Preview" open={viewPlanOpen} onCancel={() => setViewPlanOpen(false)} footer={[<Button key="close" onClick={() => setViewPlanOpen(false)}>Close</Button>]} width={1200}>
        {activePlanData ? (
          <Tabs items={[
            { key: "1", label: "Visual Strategy", children: <VisualSteps /> },
            { key: "2", label: "Raw Intelligence (JSON)", children: <div style={{ background: "#1e293b", color: "#e2e8f0", padding: 12, borderRadius: 8, fontSize: 10, maxHeight: "400px", overflow: "auto" }}><pre>{JSON.stringify(activePlanData, null, 2)}</pre></div> }
          ]} />
        ) : <Text type="secondary">No data available.</Text>}
      </Modal>

      <Modal title="📊 Interview Feedback" open={scorecardOpen} onCancel={() => setScorecardOpen(false)} width={1000} footer={[<Button key="ok" type="primary" onClick={() => setScorecardOpen(false)}>Done</Button>]}>
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{scorecardMd}</ReactMarkdown>
        </div>
      </Modal>
    </Layout>
  );
}