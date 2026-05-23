# 보안(Security) 리뷰 결과

대상 PR: render_* presentation tool 버튼 무반응 회귀 fix (render-presentation-button-click-fix)
리뷰 일시: 2026-05-23

---

### 발견사항

- **[INFO]** `randomUUID()` 사용 출처 — `node:crypto` 명시
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` (추가된 import 라인)
  - 상세: `import { randomUUID } from 'node:crypto'` 로 Node.js 내장 암호학적으로 안전한 UUID 생성기를 사용한다. `Math.random()` 기반의 미인증 UUID 라이브러리 대신 CSPRNG(암호학적으로 안전한 의사난수 생성기)를 직접 사용하므로 UUID 충돌/예측 리스크는 없다.
  - 제안: 현재 구현이 이미 올바름. 변경 불필요.

- **[INFO]** `backfillButtonUuids` 입력 — LLM 제공 payload 에 대한 신뢰 범위
  - 위치: `render-tool-provider.ts` `backfillButtonUuids()` 함수 전체 (약 72줄)
  - 상세: 함수는 Zod validate + defaults overlay + 1MB cap 이후에 호출된다. 즉, 함수가 받는 `payload`는 이미 schema 검증을 통과한 구조체다. `Array.isArray()` + `typeof b === 'object' && b !== null` 이중 가드로 null/non-object 요소를 방어하고 있어 prototype pollution 벡터(`__proto__`, `constructor` 키를 가진 버튼 객체)에 대한 직접 공격 경로도 존재하지 않는다. 스프레드 복사(`{ ...b, id: randomUUID() }`)이므로 원본 참조 오염도 없다.
  - 제안: 현재 구현 패턴은 안전하다. 향후 Zod validate 이전에 이 함수를 재사용하는 경우, `id` 필드 값 자체에 대한 패턴 검증(UUID 형식) 추가를 고려할 수 있으나 현재 컨텍스트에서는 불필요.

- **[INFO]** frontend `isSelected` 비교 수정 — 클라이언트 측 로직 보안 영향
  - 위치: `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`, CarouselContent line 242, PresentationContent line 591
  - 상세: `selectedButtonId === btn.id` → `selectedButtonId != null && selectedButtonId === btn.id` 로의 변경은 순수 논리 버그 수정이다. 이 비교는 클라이언트 UI 상태를 결정할 뿐이며, 서버 측 권한 검증이나 인증 흐름과는 독립적이다. `onPortButtonClick?.(btn.id)` 콜백으로 전달되는 `btn.id`는 화면에 렌더링된 값이므로 별도의 injestion 경로는 없다.
  - 제안: 변경 내용 자체는 보안 위험이 없다.

- **[INFO]** 테스트 파일 내 하드코딩된 UUID 패턴
  - 위치: `render-tool-provider.spec.ts` line 139 (`preset = '11111111-2222-4333-8444-555555555555'`), `presentation-renderers.test.tsx` line 454 (`selectedButtonId="btn-a"`)
  - 상세: 테스트 픽스처에 고정 ID 값이 포함되어 있으나, 이는 테스트 환경에만 존재하는 값이며 실제 사용자 데이터나 시크릿이 아니다. 프로덕션 빌드에 포함되지 않는다.
  - 제안: 변경 불필요.

- **[INFO]** UUID v4 정규식 — 대소문자 플래그 처리
  - 위치: `render-tool-provider.spec.ts` line 43 (`UUID_V4_RE` 정규식)
  - 상세: `/i` 플래그 포함으로 대소문자 구분 없이 매칭한다. `node:crypto`의 `randomUUID()`는 소문자 hex를 반환하므로 대소문자 혼합 UUID를 의도치 않게 허용하는 셈이지만, 이것은 테스트의 허용 범위 관련 문제이지 보안 취약점이 아니다.
  - 제안: 테스트 목적상 현재 구현이 적절하다.

---

### 요약

이번 변경은 LLM이 생성한 presentation 페이로드에서 누락된 `button.id`를 `node:crypto.randomUUID()`로 채우는 backend 정규화 레이어 추가와, frontend에서 `undefined === undefined` 비교로 인한 클릭 단락을 차단하는 방어 코드 적용이다. 보안 관점에서 주목할 위험 요소는 발견되지 않았다. UUID 생성에 암호학적으로 안전한 내장 API를 사용하고, 입력은 Zod schema 검증 이후에 처리되며, 스프레드 복사로 원본 오염을 방지한다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 민감 정보 노출 등 OWASP Top 10 해당 항목은 없다. 변경 범위가 presentation UI 레이어와 그 테스트에 국한되어 공격 면적 확대도 없다.

### 위험도

NONE
