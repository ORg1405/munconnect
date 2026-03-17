export default function ComingSoon({ title }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 12,
      color: "#aaa",
    }}>
      <div style={{ fontSize: 36 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: "#888" }}>{title}</div>
      <div style={{ fontSize: 13 }}>Em desenvolvimento</div>
    </div>
  );
}
