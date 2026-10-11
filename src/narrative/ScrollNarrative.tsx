import { useEffect, useRef } from "react";
import { useExperience } from "../state/store";

/**
 * HTML 叙事层 —— 固定在画布之上的 500vh 滚动容器。
 * 文案按电影字幕 / 展览说明的语气排版。
 * 各幕的显隐由滚动进度在 rAF 循环里直接驱动（每帧不触发 React 重渲染）。
 *
 * 幕映射（scrollProgress 0..1，对应 4 个视口高度的行程）：
 *  S1 0.00–0.14  S2 0.18–0.36  S3 0.43–0.61  S4 0.68–0.86  S5 0.92–1
 */

interface SceneSpec {
  el: HTMLDivElement | null;
  center: number;
  halfWidth: number;
}

export default function ScrollNarrative() {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<SceneSpec[]>([]);

  // 登记各幕的文案块
  useEffect(() => {
    const blocks = Array.from(containerRef.current?.querySelectorAll<HTMLDivElement>(".narrative-block") ?? []);
    const centers = [0.055, 0.26, 0.51, 0.76, 0.97];
    const widths = [0.075, 0.1, 0.095, 0.1, 0.075];
    blocksRef.current = blocks.map((el, i) => ({
      el,
      center: centers[i] ?? 0.5,
      halfWidth: widths[i] ?? 0.1,
    }));
  }, []);

  // 滚动 → 状态存储 + 各块显隐
  useEffect(() => {
    const setScrollProgress = useExperience.getState().setScrollProgress;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      setScrollProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // rAF 循环：围绕各自的中心点淡入淡出
  useEffect(() => {
    let raf: number;
    const update = () => {
      const p = useExperience.getState().scrollProgress;
      for (const b of blocksRef.current) {
        if (!b.el) continue;
        const d = Math.abs(p - b.center) / b.halfWidth;
        const k = d < 1 ? 1 - d * d : 0; // 平滑进出
        const eased = k * k * (3 - 2 * k);
        b.el.style.opacity = String(eased);
        b.el.style.transform = `translateY(${(1 - eased) * 14}px)`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="narrative" ref={containerRef}>
      {/* S1 — 抵达 */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ right: "7vw", bottom: "12vh", textAlign: "right" }}>
          <div className="nb-tiny">AFTER RAIN</div>
          <div className="nb-main">
            11:04 PM &nbsp;·&nbsp; TOKYO
            <div className="nb-jp">雨はまだ降っている。</div>
          </div>
        </div>
        <div className="nb-corner" style={{ left: "4vw", top: "6vh" }}>
          03 — KONBINI
          <br />
          35°41' N &nbsp; 139°46' E
        </div>
      </section>

      {/* S2 — 店面 */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ left: "6vw", top: "16vh" }}>
          <div className="nb-tiny">02 — STOREFRONT</div>
          <div className="nb-main">
            <span className="nb-em">OPEN · 24 HOURS</span>
            <br />
            Even when the street falls silent.
          </div>
        </div>
      </section>

      {/* S3 — 店内 */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ right: "8vw", bottom: "18vh", textAlign: "right" }}>
          <div className="nb-tiny">03 — INSIDE</div>
          <div className="nb-main">
            Warm light. Cold rain.
            <br />
            Some places feel warmer
            <br />
            when nobody is around.
          </div>
        </div>
      </section>

      {/* S4 — 街角 */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ left: "6vw", top: "14vh" }}>
          <div className="nb-tiny">04 — STREET CORNER</div>
          <div className="nb-main">
            11:58 PM
            <br />
            The city is still awake.
            <br />
            <span className="nb-em">Just quieter.</span>
          </div>
        </div>
      </section>

      {/* S5 — 夜色 */}
      <section className="narrative-scene">
        <div
          className="narrative-block"
          style={{ left: "50%", top: "44%", transform: "translate(-50%, 0)", textAlign: "center" }}
        >
          <div className="nb-heading">
            A SMALL PLACE
            <br />
            IN A VERY LARGE NIGHT.
          </div>
          <button className="explore-again" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            EXPLORE AGAIN
          </button>
        </div>
      </section>

      <ScrollHint />
    </div>
  );
}

/** 淡淡的 "SCROLL" 提示，旅程一开始就消失 */
function ScrollHint() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (ref.current) {
        ref.current.style.opacity = window.scrollY < window.innerHeight * 0.2 ? "1" : "0";
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="scroll-hint" ref={ref}>
      SCROLL
      <span className="hint-line" />
    </div>
  );
}
