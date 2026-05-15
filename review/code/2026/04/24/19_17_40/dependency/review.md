### 발견사항

- **[INFO]** 외부 패키지 신규 추가 없음
  - 위치: 전체 diff
  - 상세: 10개 변경 파일 모두 새로운 npm 패키지를 추가하지 않는다. `node:crypto`, `lucide-react`, `vitest`, `@/lib/i18n` 등 기존 의존성만 사용한다.

- **[WARNING]** `ResolvedNodePorts` 인터페이스 파괴적 변경 — 미갱신 소비자 미확인
  - 위치: `shadow-workflow.ts` — `ResolvedNodePorts.outputs/inputs: string[]` → `ShadowRuntimePort[]`
  - 상세: `NodePortResolver` 반환 타입이 `string[]` 기반에서 descriptor 객체 배열로 바뀌었다. 변경된 파일(`shadow-workflow.spec.ts`, `workflow-assistant-stream.service.ts`)은 올바르게 갱신되었으나, diff에 포함되지 않은 다른 소비자(다른 테스트 픽스처, mock 구현체, 타입 단언 `as ResolvedNodePorts`)가 존재하면 TypeScript 컴파일 오류는 발생하지만 `as` 캐스트로 우회된 런타임 코드는 silent 타입 불일치가 생긴다.
  - 제안: `tsc --noEmit` 전체 통과 여부를 CI에서 확인하고, `grep -r "NodePortResolver\|ResolvedNodePorts"` 결과가 이번 diff 세 파일에만 국한되는지 검증할 것.

- **[INFO]** `tool-call-badge.tsx` — `useT` 훅 내부 의존성 신규 추가
  - 위치: `tool-call-badge.tsx:10` — `import { useT } from "@/lib/i18n"`
  - 상세: 기존에는 `useT`를 사용하지 않던 컴포넌트에 i18n 훅이 추가되었다. 파일 최상단에 `"use client"` 선언이 있으므로 React Client 컴포넌트 규칙에는 적합하다. `useT`가 `ToolCallBadge`에 들어왔으므로 해당 컴포넌트를 Server Component로 사용하는 경로가 있다면 경계 오류가 발생한다.
  - 제안: `ToolCallBadge`가 서버 컴포넌트에서 직접 import되는 경로가 없음을 확인할 것 (현재 `assistant-message.tsx`가 이미 `"use client"`이므로 현재 용법은 문제없음).

- **[INFO]** i18n 사전 en/ko 동기화 확인
  - 위치: `en.ts`, `ko.ts` — `toolCallBadgeRetryRecovered` 키
  - 상세: 두 언어 파일 모두 동일 위치에 같은 키가 추가되어 불일치 없음. 다른 로케일 파일(있다면)에도 반영이 필요하다.
  - 제안: 프로젝트에 `en`/`ko` 외 추가 로케일이 있다면 해당 파일에도 fallback 키 추가 또는 타입 에러 처리 필요.

- **[INFO]** `RUNTIME_PORTS_MAX_PER_SIDE = 50` 상수 — 번들 영향 없음
  - 위치: `shadow-workflow.ts:252`
  - 상세: 새 상수와 `buildRuntimePorts` 메서드는 서버 측 NestJS 모듈에만 존재하며 프론트엔드 번들에 포함되지 않는다. 클라이언트 번들 크기에 영향 없음.

---

### 요약

이번 변경(ED-AI-40)은 외부 npm 패키지를 전혀 추가하지 않으며, 내부 모듈 간 의존 관계 변경은 두 가지에 국한된다. 첫째, `tool-call-badge.tsx`에 `useT` 훅이 추가되었으나 이미 `"use client"` 경계 안에 있어 문제없다. 둘째, `ResolvedNodePorts` 인터페이스가 `string[]`에서 `ShadowRuntimePort[]`로 파괴적으로 변경되었는데, diff에 포함된 세 파일은 모두 올바르게 갱신되었고 TypeScript가 누락된 소비자를 컴파일 타임에 잡아주므로 실질적 위험은 낮다. 다만 `as` 캐스트나 런타임 mock이 있는 경우를 배제하려면 `tsc --noEmit` 전체 성공을 CI에서 검증하는 것이 권장된다.

### 위험도

**LOW**