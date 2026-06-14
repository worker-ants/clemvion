# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/_product-overview.md` (NF-OB-07 추가) + 관련 구현 diff (origin/main...HEAD)

---

## 발견사항

- **[WARNING]** `TERMINAL_STATUSES` 이름 중복 — 동일 의미이나 두 곳에 독립 선언
  - target 신규 식별자: `ExecutionEngineService.TERMINAL_STATUSES` (private static, `Set<ExecutionStatus>`)  
    위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 701
  - 기존 사용처: `TERMINAL_STATUSES` (module-level const, `ReadonlySet<ExecutionStatus>`)  
    위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` line 30
  - 상세: 두 정의 모두 `{COMPLETED, FAILED, CANCELLED}` 로 내용이 동일하다. 이름이 같고 의미가 같으므로 직접 충돌(다른 의미로 혼용)은 없으나, 동일한 집합이 두 파일에 중복 선언돼 유지보수 시 하나만 수정하는 실수를 유발할 수 있다.
  - 제안: 공유 상수를 `codebase/backend/src/modules/execution-engine/entities/execution-status.ts` 등 단일 파일로 추출해 두 곳 모두 import 하도록 통합한다. 이번 PR 범위 밖이면 INFO 수준으로 기록하고 후속 리팩터로 위임해도 무방하다.

- **[INFO]** `LlmTokenUsage` private 인터페이스 vs 기존 `TokenUsage` public 인터페이스 — 필드셋 의도적 차이
  - target 신규 식별자: `interface LlmTokenUsage` (module-private, `inputTokens?`, `outputTokens?`, `thinkingTokens?`)  
    위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` line 25
  - 기존 사용처: `export interface TokenUsage` (`inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens?`)  
    위치: `codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` line 53
  - 상세: `LlmTokenUsage` 는 해당 파일 내에서만 사용하는 private 타입이며 export 되지 않는다. `totalTokens` 필드가 없고 모든 필드가 optional인 점이 다르다. 이름이 달라 직접 충돌은 아니지만, `BusinessMetricsService.recordLlmTokens` 의 파라미터로 `TokenUsage` 를 그대로 받을 수 있음에도 별도 인터페이스를 만들어 관리 부담을 늘렸다.
  - 제안: `LlmTokenUsage` 대신 기존 `TokenUsage` 를 파라미터 타입으로 직접 사용하거나 `Pick<TokenUsage, 'inputTokens' | 'outputTokens' | 'thinkingTokens'>` 로 대체하면 타입 이중화를 제거할 수 있다. 현 상태에서 충돌 위험은 없으므로 강제 변경은 불필요하다.

- **[INFO]** 요구사항 ID `NF-OB-07` — origin/main 에는 없는 신규 ID, 충돌 없음
  - target 신규 식별자: `NF-OB-07` (도메인/비즈니스 커스텀 메트릭)  
    위치: `spec/5-system/_product-overview.md` line 75 (worktree)
  - 기존 사용처: origin/main 의 `spec/5-system/_product-overview.md` 에는 NF-OB-01 ~ NF-OB-06 까지만 존재. `NF-OB-07` 은 기존에 없다.
  - 상세: 시퀀스 연속(NF-OB-06 다음 NF-OB-07)이며, plan/in-progress/spec-sync-5-system-metrics-gap.md 에서 "후속 PR 에서 비즈니스 커스텀 메트릭 계측 예정"으로 사전 예고된 ID 다. 다른 의미로 선점된 사용처 없음.
  - 제안: 없음 (이상 없음).

- **[INFO]** OTel 메트릭 이름 `clemvion.*` — 기존 코드베이스에 사전 선언 없음, 충돌 없음
  - target 신규 식별자: `clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.queue.depth`, `clemvion.llm.tokens`, `clemvion.node.duration` (모두 `codebase/backend/src/modules/metrics/business-metrics.service.ts`)
  - 기존 사용처: origin/main 의 `codebase/backend/src/instrumentation.ts` 는 auto-instrumentation 전용이며 `createCounter` / `createHistogram` 직접 호출이 없다. `getMeter('clemvion.business')` 또는 위 이름들을 사용하는 기존 코드 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

- **[INFO]** 파일 경로 신규 생성 — 기존 modules 폴더에 `metrics/` 추가
  - target 신규 파일: `codebase/backend/src/modules/metrics/metrics.module.ts`, `business-metrics.service.ts`, `metrics.module.spec.ts`, `business-metrics.service.spec.ts`
  - 기존 사용처: origin/main 의 `modules/` 하위에 `metrics/` 폴더가 존재하지 않음. 인접 폴더명(`model-config/`, `mcp/`, `mail/` 등)과 prefix 충돌 없음.
  - 상세: 충돌 없음. 명명 컨벤션(`<domain>.module.ts`, `<service>.service.ts`) 과도 일치.
  - 제안: 없음.

---

## 요약

이번 변경이 도입하는 신규 식별자(`NF-OB-07`, `MetricsModule`, `BusinessMetricsService`, `QueueDepthSnapshot/Provider`, `clemvion.*` OTel 이름, 파일 경로)는 기존 코드베이스 및 spec에서 다른 의미로 사용 중인 사례와 충돌하지 않는다. 유일한 주의 사항은 `TERMINAL_STATUSES` 의 이중 선언으로, `external-interaction/interaction.service.ts` 에 이미 동명의 module-level 상수가 존재하며 내용도 동일하다. 의미 충돌이 아니라 DRY 위반에 해당하므로 CRITICAL/CRITICAL 수준의 차단 요소는 없다. `LlmTokenUsage` private 인터페이스는 기존 `TokenUsage` 와 이름이 달라 직접 충돌이 없으나 타입 이중화 정리가 바람직하다.

---

## 위험도

LOW

STATUS: SUCCESS
