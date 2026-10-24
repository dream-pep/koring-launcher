/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useRef, useMemo, useLayoutEffect, useEffect } from "react";
import { Color, type Mesh, type ShaderMaterial } from "three";

const hexToNormalizedRGB = (hex: string) => {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
};

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

interface SilkPlaneProps {
  uniforms: Record<string, { value: number | Color }>;
  /** 画面稳定后回调一帧静态 PNG（供 View Transition 快照期间替代 WebGL 画面） */
  onSnapshot?: (dataUrl: string) => void;
}

const SilkPlane = forwardRef(function SilkPlane(
  { uniforms, onSnapshot }: SilkPlaneProps,
  ref: React.Ref<Mesh>,
) {
  const { viewport, invalidate, gl } = useThree();
  const frameCount = useRef(0);
  const captured = useRef(false);
  const attempts = useRef(0);

  useLayoutEffect(() => {
    if (ref && typeof ref === "object" && ref.current) {
      ref.current.scale.set(viewport.width, viewport.height, 1);
    }
    invalidate();
  }, [ref, viewport, invalidate]);

  // 窗口隐藏/最小化时停帧（无可见画面，零视觉影响）；恢复可见后立即刷新一帧重启动画
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [invalidate]);

  useFrame((_, delta) => {
    if (document.hidden) return; // 不可见时不再推进 uTime / 请求帧，避免 GPU 空转
    if (ref && typeof ref === "object" && ref.current) {
      (ref.current.material as ShaderMaterial).uniforms.uTime.value += 0.1 * delta;
      invalidate();
    }
    // 尽早抓一帧：路由转场的快照在切换当帧就生成，越早拿到越能命中；着色器在 uTime=0
    // 时也已是完整的丝绸纹理。前几帧可能还没画出有效像素（返回近乎空白的 PNG），
    // 因此按 2/8/30 帧依次尝试，拿到足够大的图就停（避免反复 toDataURL 拖慢渲染）。
    if (onSnapshot && !captured.current) {
      frameCount.current += 1;
      const marks = [2, 8, 30];
      if (attempts.current < marks.length && frameCount.current >= marks[attempts.current]) {
        attempts.current += 1;
        try {
          if (gl.domElement.width > 0) {
            const dataUrl = gl.domElement.toDataURL("image/png");
            if (dataUrl.length > 2000) {
              captured.current = true;
              onSnapshot(dataUrl);
            }
          }
        } catch {
          // 拿不到像素（上下文丢失/隐私限制）就不提供静态帧，不影响正常渲染
        }
      }
    }
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
});
SilkPlane.displayName = "SilkPlane";

interface SilkProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  /** 画面稳定后回调一帧静态 PNG；用于在 View Transition 快照里保留丝绸质感 */
  onSnapshot?: (dataUrl: string) => void;
}

const Silk = ({
  speed = 5,
  scale = 1,
  color = "#7B7481",
  noiseIntensity = 1.5,
  rotation = 0,
  onSnapshot,
}: SilkProps) => {
  const meshRef = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uSpeed: { value: speed },
      uScale: { value: scale },
      uNoiseIntensity: { value: noiseIntensity },
      uColor: { value: new Color(...hexToNormalizedRGB(color)) },
      uRotation: { value: rotation },
      uTime: { value: 0 },
    }),
    [speed, scale, noiseIntensity, color, rotation],
  );

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}
    >
      <SilkPlane ref={meshRef} uniforms={uniforms} onSnapshot={onSnapshot} />
    </Canvas>
  );
};

export default Silk;
