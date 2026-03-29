import { useState } from "react";
import { InboxOutlined } from "@ant-design/icons";
import { Upload, message, Progress, Typography } from "antd";
import type { UploadProps } from "antd";
import { uploadPlan } from "./api";

const { Dragger } = Upload;
const { Text } = Typography;

type Props = {
  onUploaded?: (fileName: string) => void;
};

export default function UploadBox({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);

  const props: UploadProps = {
    name: "file",
    multiple: false,
    showUploadList: false,
    customRequest: async (options) => {
      const file = options.file as File;
      try {
        setUploading(true);
        setPercent(20);

        await uploadPlan(file);

        setPercent(100);
        message.success(`${file.name} uploaded successfully`);
        onUploaded?.(file.name);
        options.onSuccess?.({}, file);
      } catch (e: any) {
        message.error(e?.message ?? `${file.name} upload failed`);
        options.onError?.(e);
      } finally {
        setTimeout(() => {
          setUploading(false);
          setPercent(0);
        }, 400);
      }
    },
  };

  return (
    <Dragger
      {...props}
      style={{
        padding: 16,
        borderRadius: 10,
        background: uploading ? "#f0f7ff" : "#fafafa",
        border: "2px dashed #91caff",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        {uploading ? (
          <>
            <Progress
              percent={percent}
              style={{ width: "100%", maxWidth: 260 }}
              size="small"
              status="active"
            />
            <Text style={{ color: "#1677ff", fontWeight: 500 }}>Uploading your interview plan…</Text>
          </>
        ) : (
          <>
            <InboxOutlined style={{ fontSize: 40, color: "#1677ff" }} />
            <h3 style={{ margin: 0 }}>Drop interview plan to upload</h3>
            <p style={{ margin: 0, color: "#666" }}>
              or <span style={{ color: "#1677ff" }}>browse from your computer</span>
            </p>
          </>
        )}
      </div>
    </Dragger>
  );
}


