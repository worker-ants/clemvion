## 발견사항

---

### **[WARNING]** 빈 캔버스 Empty State — 2차 CTA("노드 추가") 미구현
- **위치**: `canvas-empty-state.tsx` 전체 / `spec/3-workflow-editor/0-canvas.md` §3.6
- **상세**: 스펙에 "2차 CTA | '노드 추가' → 팔레트 영역 하이라이트 효과"가 명시되어 있지만, 구현된 컴포넌트에는 "시작 가이드 열기" 1차 CTA만 존재. 팔레트 하이라이트 트리거 인터페이스도 없음.
- **제안**: 팔레트 하이라이트용 store/signal을 연결하는 두 번째 버튼을 추가하거나, 스펙 단계적 구현 계획으로 명시해야 함.

---

### **[WARNING]** 빈 캔버스 Empty State — 페이드 아웃 전환 미구현
- **위치**: `workflow-canvas.tsx:477-481`
- **상세**: 스펙 "첫 노드가 추가되면 페이드 아웃"이 요구사항이나, 구현은 `nodes.length === 0` 조건부 렌더링(즉시 사라짐)만 존재. 테스트 코드도 이 동작을 검증하지 않음.
- **제안**: `animate-out fade-out` 등 CSS 트랜지션 또는 Framer Motion을 적용하고, 해당 동작을 테스트 케이스로 추가.

---

### **[WARNING]** `checkboxIdCounter` — 모듈 수준 mutable 전역 상태로 인한 SSR/Hydration 불일치 위험
- **위치**: `shared.tsx` — `let checkboxIdCounter = 0` + `nextCheckboxId()`
- **상세**: Next.js 서버 렌더링 환경에서 모듈 인스턴스가 요청 간 공유될 경우 카운터 값이 누적되어 서버 렌더 ID ≠ 클라이언트 렌더 ID가 될 수 있음. React 18 Strict Mode(개발 환경 이중 렌더)에서도 ID가 어긋남.
- **제안**: `useId()` hook(React 18+) 을 사용하면 SSR에서도 안정적인 고유 ID를 보장함.
```tsx
// 변경 전
const id = typeof label === "string"
  ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
  : nextCheckboxId();

// 변경 후 (React 18 useId)
const uid = useId();
const id = typeof label === "string"
  ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
  : `cb-${uid}`;
```

---

### **[INFO]** `FieldHelp` — `docsHref`에 앵커(`#anchor`)가 없어 스펙 형태 미충족
- **위치**: `ai-configs.tsx` 내 `LabelWithHelp` 사용부 / `spec/3-workflow-editor/1-node-common.md` §2.3.1
- **상세**: 스펙은 "딥링크 | `/docs/<section>/<slug>#<anchor>` 형태"를 요구하지만 실제 `docsHref` 값은 모두 `/docs/02-nodes/ai`(앵커 없음). 특정 필드 설명으로 직접 이동하지 못함.
- **제안**: MDX 파일에 heading 앵커(`rehype-slug`로 생성된 id)를 확인하고 `docsHref="/docs/02-nodes/ai#text-classifier"` 형태로 구체화.

---

### **[INFO]** `what-is-this.mdx` — "다음에 볼 것" 섹션 내용 불완전
- **위치**: `frontend/src/content/docs/01-getting-started/what-is-this.mdx`
- **상세**: "아래 순서를 권해요"라고 안내하는 Callout 뒤에 실제 순서 목록이 없고 바로 "팁 & 참고"로 넘어감. "아래"에 해당하는 콘텐츠가 빠진 상태.
- **제안**: `<Steps>` 컴포넌트로 UI 투어 → 첫 워크플로우 두 단계를 추가하거나 섹션 제목을 제거.

---

### **[INFO]** `/docs` 모바일 환경 — 사이드바 네비게이션 부재
- **위치**: `layout.tsx` — `hidden lg:block`
- **상세**: 1024px 미만 화면에서 섹션 네비게이션이 완전히 숨겨지며, 대체 모바일 메뉴(hamburger, drawer 등)가 없어 사이드바 없이 본문만 노출됨. 다른 섹션으로 이동할 방법이 없음.
- **제안**: 모바일용 드로어 사이드바 또는 상단 select 네비게이션을 추가하거나, 스펙에 모바일 처리 방침을 명시.

---

## 요약

핵심 요구사항(NAV-UG-01~06)은 대부분 구현됐으며, MDX 파이프라인·FieldHelp·CanvasEmptyState·사이드바 진입점 모두 정상 동작할 것으로 판단됨. 다만 Empty State의 **2차 CTA(노드 추가 + 팔레트 하이라이트)와 페이드 아웃 전환**이 스펙에 명시되어 있음에도 미구현 상태이고, `checkboxIdCounter`의 전역 뮤터블 상태는 SSR 환경에서 hydration 불일치를 일으킬 수 있어 수정이 권장됨. 나머지 사항들(앵커 딥링크, 모바일 네비, 미완성 콘텐츠)은 기능 완성도 측면에서 보완이 필요하나 즉각적인 장애 수준은 아님.

## 위험도

**MEDIUM**