# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상: `spec/5-system/_product-overview.md` (NF-OB-07 신설) + 대응 구현 diff

---

## 발견사항

### 1. **[WARNING]** `TERMINAL_STATUSES` 상수명 중복 정의

- **target 신규 식별자**: `ExecutionEngineService.TERMINAL_STATUSES` — `private static readonly` Set (`execution-engine.service.ts` L700)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.service.ts` L30 — `const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus>` (모듈 파일-레벨 상수)
- **상세**: 두 곳 모두 `{ COMPLETED, FAILED, CANCELLED }` 집합으로 동일한 의미를 표현한다. 충돌은 아니다(스코프가 다름 — 하나는 static class member, 하나는 모듈 레벨 const). 그러나 동일 의미 집합이 이제 세 곳에 분산된다(e2e 테스트 2개 포함). 미래 `ExecutionStatus` 에 값 추가 시 한 곳만 갱신되는 드리프트 위험이 있다.
- **제안**: `ExecutionStatus` 에서 직접 도출하는 공유 `TERMINAL_EXECUTION_STATUSES` 상수를 `execution-status.enum.ts` 또는 공유 util에 두고 두 서비스 모두 import. 본 PR 범위 밖이나 INFO로 후속 기록 권장.

---

### 2. **[INFO]** `LlmTokenUsage` 인터페이스 — `TokenUsage` 와 부분 중복

- **target 신규 식별자**: `LlmTokenUsage` (`business-metrics.service.ts` L49–52, 파일 내 `private interface`)
  ```ts
  interface LlmTokenUsage {
    inputTokens?: number;
    outputTokens?: number;
    thinkingTokens?: number;
  }
  ```
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` L53 — `export interface TokenUsage { inputTokens: number; outputTokens: number; thinkingTokens?: number; ... }`
- **상세**: 의미적으로 같은 LLM 토큰 사용량을 나타내나, `LlmTokenUsage` 는 `private` 으로 파일 외부에 노출되지 않는다. `TokenUsage` 는 모든 필드가 required (`inputTokens`, `outputTokens` 필수)인 반면 `LlmTokenUsage` 는 모두 optional — 실제로 `recordLlmTokens` 에 전달되는 인자는 항상 `TokenUsage` 이므로 형 불일치 위험은 낮다. 충돌보다는 중복 정의에 해당.
- **제안**: `LlmTokenUsage` 를 별도 선언하는 대신 `import type { TokenUsage } from '../llm/interfaces/llm-client.interface'` 를 직접 사용하거나, `Pick<TokenUsage, ...>` 로 재활용. 현재 `private` 스코프이므로 즉각 충돌은 없음.

---

### 3. **[INFO]** 요구사항 ID `NF-OB-07` — spec에 신설, 기존 ID 범위와 정합

- **target 신규 식별자**: `NF-OB-07` (`spec/5-system/_product-overview.md` L75)
- **기존 사용처 확인**: `NF-OB-01` ~ `NF-OB-06` 이 L69–74에 순서대로 존재. `NF-OB-07` 은 기존에 없던 신규 ID.
- **상세**: 동일 ID가 다른 의미로 이미 사용되는 충돌 없음. 연번 순서(`NF-OB-06` 다음 `NF-OB-07`)가 자연스럽게 이어진다.
- **제안**: 없음.

---

### 4. **[INFO]** `MetricsModule` / `BusinessMetricsService` — 기존 `StatisticsModule`·`StatisticsService` 와 명명 영역 구분 확인

- **target 신규 식별자**: `MetricsModule`, `BusinessMetricsService` (`codebase/backend/src/modules/metrics/`)
- **기존 사용처**: `codebase/backend/src/modules/statistics/` — `StatisticsModule`, `StatisticsService` (DB 집계 기반 REST API)
- **상세**: `Statistics`(DB 집계·REST) vs `BusinessMetrics`(OTel 계측)는 의미상 명확히 분리된다. spec `NF-OB-07` 도 "이원화 정책"으로 역할을 명시. 이름 충돌 없음.
- **제안**: 없음.

---

### 5. **[INFO]** OTel instrument 이름 — 기존 auto-instrumentation 과 namespace 구분 확인

- **target 신규 식별자**: `clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.queue.depth`, `clemvion.llm.tokens`, `clemvion.node.duration` (meter name: `clemvion.business`)
- **기존 사용처**: `instrumentation.ts` — OTel auto-instrumentation + `instrumentation-runtime-node` 가 생성하는 표준 HTTP/runtime 메트릭(예: `http.server.request.duration`, `process.*`, `v8js.*`). `clemvion.*` prefix 는 기존에 사용되지 않음.
- **상세**: `clemvion.*` namespace 는 신규이며 기존 auto-instrumentation 메트릭과 충돌하지 않는다.
- **제안**: 없음.

---

### 6. **[INFO]** 파일 경로 — `src/modules/metrics/` 신규 폴더

- **target 신규 식별자**: `codebase/backend/src/modules/metrics/` (폴더 + `business-metrics.service.ts`, `metrics.module.ts`, `.spec.ts`)
- **기존 사용처**: 기존 `src/modules/` 에 `metrics/` 폴더 없음 (main 브랜치 기준). 인접 패턴(`statistics/`, `health/` 등) 과 일치.
- **상세**: 경로 충돌 없음. NestJS 모듈 폴더 컨벤션(`<domain>/`) 준수.
- **제안**: 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자(`NF-OB-07`, `MetricsModule`, `BusinessMetricsService`, `QueueDepthSnapshot`, `QueueDepthProvider`, OTel instrument 이름군, 파일 경로 `src/modules/metrics/`) 중 기존 사용처와 의미 충돌하는 항목은 없다. 주의가 필요한 것은 `TERMINAL_STATUSES` 상수명 중복(동일 의미가 `external-interaction`, `execution-engine`, e2e 테스트 등 여러 곳에 독립 정의됨 — 스코프가 달라 직접 충돌은 없으나 드리프트 위험) 과, `LlmTokenUsage` 가 기존 `TokenUsage` 를 재정의하는 private 인터페이스 중복(현재 파일 내부 한정이라 즉각 충돌 없음) 두 건이다. 두 건 모두 차단 수준은 아니며 경고/정보 수준이다.

## 위험도

LOW
