# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

`origin/main` 대비 실제 diff 는 다음 5개 파일에 한정된다 (target 은 `spec/5-system/` 이지만 번들에 포함된 다른 파일은 대부분 비-diff 컨텍스트):

- `spec/5-system/14-external-interaction-api.md` (§7.1 캐비엇 정정 + §R17 "내부 읽기 경로" 확장)
- `spec/5-system/6-websocket-protocol.md` (`execution.snapshot` 마스킹 상속 서술 추가)
- `spec/2-navigation/14-execution-history.md` (R-5 대상 범위 캐비엇)
- `spec/4-nodes/1-logic/12-background.md` (`nodeExecutions.data[].error` 마스킹 서술 추가)
- `spec/conventions/secret-store.md` (`triggerToken` 명시적 비대상 예외 등재)

내용은 이전에 이미 EIA §R17 에 등재된 "내부 REST 비대칭은 미결" 항목을 실제로 해소한 후속 변경(`Execution.error`/`nodeExecutions[].error` 에 egress 값-패턴 마스킹 적용)이다.

## 코드 대조 (impl-done 확인)

target worktree 를 절대경로로 직접 열어 diff 의 주장을 전수 대조했다 — 전부 코드와 일치한다:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` — `redactStoredErrorForResponse` 존재, `deepRedactSecrets` 위임, 형태 보존, null-safe. 문서 서술과 정확히 일치.
- `codebase/backend/src/modules/executions/executions.service.ts` — `findById`(nodeExecutions[].error 포함, L613-636) · `toExecutionDto`(L926) · `getChain`/`stop`(공통 관문 `toResponseExecution`, L970-976) 4곳 모두 적용 확인. `POST /executions/:id/re-run`(L482 `this.findById`) · WS `execution.snapshot`(`websocket.gateway.ts:399 emitExecutionSnapshot` → `this.executionsService.findById`) 이 `findById` 를 재사용해 함께 덮인다는 서술도 코드로 확인됨.
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302` — body 노드 `error` 마스킹 확인.
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:71,167` — `error?: Record<string, unknown> | null` 로, "내부 응답 계약은 그대로 두고 값만 마스킹" 서술과 일치.
- 잔여 목록(①WS `execution.node.*` emit 원문 / ②내부 REST `inputData`/`outputData` 원문 / ③`explore-tools.service.ts` 의 `error` 필드가 `maskSensitiveFields` 키-이름 기반으로만 걸림, L462-464·482-484)도 코드로 재확인 — 셋 다 문서 서술과 정확히 일치하며 과장·축소 없음. (초기에는 "③ 이 inputData/outputData 를 가리킨다"로 오독했으나, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 동일 항목이 `explore-tools.service.ts:464`·`:484`(둘 다 `.error` 라인)를 명시 지목하고 있어 "같은 두 컬럼" = `Execution.error`/`NodeExecution.error` 임을 확인. 스펙 서술이 옳다.)
- `spec/conventions/secret-store.md` 의 `triggerToken` 비대상 예외 — `1-data-model.md §2.8 Trigger` / `14-external-interaction-api.md §4·§7.1` 어디에도 상충 서술 없음. `AuthConfig.config` 예외와 근거를 명시적으로 분리(암호화 유무)해 "비대상 선례 남용" 을 문서 스스로 경고하는 구조.

## 다른 영역과의 정합성

1. **데이터 모델** — `spec/1-data-model.md §2.13 Execution` / `§2.14 NodeExecution` 은 `error` 컬럼을 DB 저장 형태로만 정의하고(egress 마스킹 언급 없음), 이번 diff 는 "DB 는 원문 보존, egress 에서만 마스킹" 원칙을 반복 명시한다. 두 문서가 서술하는 층(저장 vs 응답)이 다르므로 모순이 아니다.
2. **WS 프로토콜** — `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표의 `execution.node.failed`/`execution.node.cancelled` 행은 `error` 필드에 마스킹 언급이 없고, EIA §R17 "잔여 ①" 이 정확히 그 갭("emit 경로는 원문")을 명시한다 — 상호 일치.
3. **실행 내역 화면** — `spec/2-navigation/14-execution-history.md` R-5 는 "Config 탭 echo" 로 대상이 한정되고, 새 캐비엇이 "Execution.error/nodeExecutions[].error 는 별개 정책(egress 마스킹)" 이라고 명시적으로 분리해 R-5 원칙의 **원용**과 **직접 규정**을 구분한다 — 순환 인용 없이 일관.
4. **Background 노드** — `12-background.md` §8.2 의 새 캐비엇이 "실행 상세의 `nodeExecutions[].error` 와 같은 관문" 이라 서술하는데, `background-runs.service.ts:302` 가 실제로 같은 `redactStoredErrorForResponse` 함수를 재사용해 이를 뒷받침한다.
5. **secret-store 컨벤션** — `AuthConfig.config` 기존 예외와 신규 `triggerToken` 예외를 같은 절에 병기하면서 "근거를 서로 재사용하지 않는다" 고 명시해, 향후 세 번째 필드가 안일하게 선례를 인용하는 것을 스스로 차단한다. Rationale 문서 규약(근거의 배경 명시)과 부합.
6. **요구사항 ID / RBAC / 계층 책임** — 이번 diff 는 신규 요구사항 ID를 부여하지 않고, 권한 모델을 변경하지 않으며(viewer 노출 범위는 R-5 선례 그대로), 마스킹 책임을 기존에 확립된 위치(`shared/utils/*`, `executions.service.ts` 공통 관문)에만 추가해 계층 책임 분할과 어긋나지 않는다.

## 발견사항

없음 — CRITICAL/WARNING 레벨의 cross-spec 모순을 발견하지 못했다.

- **[INFO]** `spec/4-nodes/1-logic/12-background.md` frontmatter `code:` 목록에 `redact-stored-error.ts` 가 명시적으로 등재되어 있지 않음
  - target 위치: `spec/4-nodes/1-logic/12-background.md` frontmatter `code:` 블록
  - 충돌 대상: 없음 (모순 아님, 완전성 관찰)
  - 상세: 본문 §8.2 는 `redactStoredErrorForResponse` 재사용을 명시하지만, frontmatter 는 `background-runs/**` 글롭으로만 커버한다. `14-external-interaction-api.md`/`2-navigation/14-execution-history.md` 는 이번 diff 에서 `redact-stored-error.ts` 를 `code:` 리스트에 명시적으로 추가했으나 `12-background.md` 는 하지 않았다(불일치는 아니고 커버리지 정밀도 차이).
  - 제안: 후속 spec-coverage 패스에서 `code:` 리스트에 `redact-stored-error.ts` 를 추가해 세 문서의 등재 방식을 통일 (기능적 영향 없음, 선택 사항).

## 요약

diff 는 `spec/5-system/14-external-interaction-api.md` §R17 에 이미 "미결"로 등재돼 있던 내부 REST/`Execution.error` 비대칭을 실제로 해소하는 후속 변경이며, WS 프로토콜·실행 내역·Background 노드·secret-store 컨벤션의 4개 위성 문서가 모두 같은 결정(2026-08-16)을 정확히 반영하고 있다. 코드(`redact-stored-error.ts`, `executions.service.ts` 4경로, `background-runs.service.ts`, `websocket.gateway.ts`)를 직접 대조한 결과 문서의 모든 구체적 주장(적용 범위·잔여 갭 3건·응답 계약 불변)이 사실과 일치했다. 잔여 갭(WS node.* emit 원문·내부 REST inputData/outputData 원문·workflow-assistant 도구의 약한 마스킹)은 문서 자신이 "적용 범위는 열거이지 총칭이 아니다" 라고 명시하며 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 항목으로 정확히 추적되고 있어, 이번 target 문서가 그 갭을 은폐하거나 다른 영역과 다르게 말하는 지점은 없다.

## 위험도

NONE
