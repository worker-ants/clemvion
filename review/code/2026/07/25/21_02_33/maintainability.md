# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** Prettier 미실행 — 신규 테스트 코드가 프로젝트 포맷 컨벤션(single quote, print-width 줄바꿈)을 위반
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts:750` (`it("passes context.abortSignal into the client call", ...)` 의 큰따옴표), `:757`/`:776` (한 줄로 뭉친 `{ integrationId: ..., fields: { shop_no: 1 } }` config 객체)
  - 위치: `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.spec.ts:577`, `:584`/`:602` (동일 패턴)
  - 상세: `npx prettier --check`(리뷰 중 재현, 이후 되돌림)로 실제 확인함 — 이 두 파일만 실패하고 나머지 6개 변경 파일(`cafe24-api.client.{ts,spec.ts}`, `makeshop-api.client.{ts,spec.ts}`, `cafe24.handler.ts`, `makeshop.handler.ts`)은 통과한다. 새 `it("...")` 는 파일 내 기존 테스트가 전부 작은따옴표를 쓰는 것과 다르고, config 객체 리터럴이 한 줄로 길게 이어져 있어 파일의 기존 스타일(멀티라인 객체, 예: 같은 파일 130행대 `makeIntegration({...})` 블록)과 어긋난다. lint-staged/pre-commit 훅이 아직 이를 걸러내지 못한 것으로 보인다.
  - 제안: `npx prettier --write` 후 재커밋. CI lint 단계에서 잡히기 전에 로컬에서 정리.

- **[INFO]** abort-cascade 배선 로직이 이제 3곳에 동일하게 존재 (기존 `http-request.handler.ts` + 신규 `cafe24-api.client.ts` + 신규 `makeshop-api.client.ts`)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1208-1228`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:837-857`, 기존 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:400-421`
  - 상세: `upstream.aborted` 체크 → 이미 aborted 면 즉시 `controller.abort()`, 아니면 `once` 리스너 등록 + controller 정착 시 해제하는 15~20줄짜리 블록이 세 파일에 문자 그대로 반복된다. 각 파일의 주석이 스스로 "Identical to `http-request.handler.ts`"라고 명시해 의도적 복제임을 알린다. 이 저장소는 cafe24/makeshop 간의 **업체별 미러링**(필드 매핑·에러 코드 등 도메인 로직)은 기존 결정으로 의도된 중복이라 재지적 대상이 아니지만, 이 블록은 도메인과 무관한 범용 유틸리티(AbortSignal cascade)라 그 결정과는 별개 사안이다. 추가로, 이 블록이 삽입된 두 메서드(`Cafe24ApiClient.executeWithRateLimit` ~204줄, `MakeshopApiClient.executeWithRetry` ~145줄)는 이미 상당히 긴 함수라 추가 인라인 로직이 함수 길이를 더 늘린다.
  - 제안: `attachAbortCascade(upstream: AbortSignal | undefined, controller: AbortController): void` 같은 공용 헬퍼(`shared/` 또는 `nodes/core/`)로 추출해 3곳에서 호출하면 중복 제거와 동시에 각 실행 메서드의 길이도 줄어든다. 시급하지 않으나 4번째 소비자(chat-channel 등, 같은 plan 에 잔여로 명시됨)가 추가되기 전에 정리하면 이후 반복을 막을 수 있다.

- **[INFO]** 신규 테스트 2건이 같은 `describe` 블록 안에서 `async/await` 와 raw Promise `.then()` 체이닝을 혼용
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — `describe('abortSignal cascade (node-cancellation §4)')` 안 첫 `it`(async/await)와 둘째 `it('does not abort the fetch when the upstream signal stays open', ...)`(`return client.call(...).then(...)`), 동일 패턴이 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts` 의 같은 이름 블록에도 그대로 반복
  - 상세: 기능은 동일하지만 바로 위/아래 테스트가 스타일을 달리해 읽는 흐름이 끊긴다. 파일의 다른 테스트는 전부 `async () => { await ... }` 패턴을 쓴다.
  - 제안: 둘째 테스트도 `async () => { await client.call(...); expect(seen!.aborted).toBe(false); }` 로 통일.

- **[INFO]** plan 문서에 이중 빈 줄
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` — "관측되면 승급할 것." 문단과 신규 `## 진행 기록 — commerce 2건 (2026-07-25)` 헤더 사이에 빈 줄이 2개 삽입(다른 헤더 앞은 1개).
  - 상세: 코드는 아니지만 문서 포맷 일관성 사소한 흠. 기능적 영향 없음.
  - 제안: 빈 줄 1개로 정리(선택 사항).

## 좋게 본 점 (참고)

- 구현 코드의 JSDoc/인라인 주석이 spec 문서(§4, §2.2) 를 정확히 인용하고, "왜 이 방식인가"(리스너 once + 정착 시 해제로 누적 방지)를 명시해 의도가 코드만으로도 추적 가능하다.
- 테스트가 "발화 시 abort" / "미발화 시 no-op" / "이미 aborted" / "signal 없음" 네 가지 경계를 모두 커버하고, 회귀 방지 목적(뮤턴트 테스트로 검증됨)이 plan 문서에 근거로 남아 있다.
- cafe24 / makeshop 두 핸들러의 변경 폭(각 3줄)과 클라이언트 변경 폭(각 ~28줄)이 서로 대칭이라 리뷰·유지보수 시 대조하기 쉽다.

## 요약

핵심 변경(각 handler 의 `signal: context.abortSignal` 한 줄 배선, client 의 표준 AbortController cascade 패턴)은 간결하고 의도가 주석으로 잘 설명되어 있어 가독성·네이밍·복잡도 측면에서는 무리가 없다. 다만 (1) 신규 handler 스펙 테스트 2개 파일이 프로젝트 Prettier 컨벤션을 위반하는 상태로 남아 있고, (2) 이미 `http-request.handler.ts` 에 있던 abort-cascade 블록이 이번 변경으로 3중 복제가 되어 공용 헬퍼 추출의 명확한 후보가 생겼다. 둘 다 병합을 막을 정도는 아니며 빠르게 정리 가능하다.

## 위험도

LOW
