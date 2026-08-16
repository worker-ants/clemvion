# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 대상 변경 요약

diff-base `origin/main` 대비 실제 변경분(`git diff origin/main...HEAD`)을 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 직접 확인.

- `spec/5-system/14-external-interaction-api.md` — §R17에 "내부 읽기 경로도 같은 마스킹을 적용" 불릿 추가 (결정 2026-08-16)
- `spec/5-system/6-websocket-protocol.md` — `execution.snapshot` 설명에 마스킹 상속 캐비엇 1줄 추가
- `spec/1-data-model.md`, `spec/2-navigation/14-execution-history.md`, `spec/4-nodes/1-logic/12-background.md`, `spec/conventions/secret-store.md` — 연동 미러 갱신
- 코드: 신규 파일 `codebase/backend/src/shared/utils/redact-stored-error.ts`(+`.spec.ts`), 신규 함수 `redactStoredErrorForResponse`, 신규 타입 `ResponseExecution`/`ResponseNodeExecution`/`ExecutionDetailWithTrigger`(`executions.service.ts`)

이 변경이 새로 도입하는 식별자를 6개 관점으로 검토했다.

## 발견사항

- **[INFO]** `1-data-model.md` 안에서 "응답 마스킹" 라벨이 서로 다른 마스킹 메커니즘 두 곳에 재사용됨
  - target 신규 식별자: `spec/1-data-model.md:564` — `Execution`/`NodeExecution.error` 정의 표에 신설된 행 라벨 `응답 마스킹` (값-패턴 자격증명 마스킹, egress 시점, SoT는 EIA §R17)
  - 기존 사용처: 같은 파일 `spec/1-data-model.md:619`("응답 마스킹은 §2.17.2") · `:641`(`#### 2.17.2 마스킹·노출 정책`) — `AuthConfig.config` 의 `***<last4>` 키-이름 기반 마스킹(쓰기 시점, `auth-configs.service.ts`의 `maskConfig`/`toMasked`)
  - 상세: 코드 레벨(`redactStoredErrorForResponse` vs `maskConfig`)에서는 이름이 명확히 분리되어 충돌이 없다. 다만 spec 문서 안에서는 두 서로 다른 마스킹 체계(값-패턴 vs 키-이름, egress-time vs write-time)가 같은 한글 라벨 "응답 마스킹"을 공유한다. 각 항목이 바로 옆에서 SoT 링크(§R17 vs §2.17.2)로 즉시 구분되므로 실사용상 혼선 위험은 낮다.
  - 제안: 실질적 조치는 불필요. 원한다면 신설 행 라벨을 "응답 마스킹 (값-패턴)" 정도로 미세 구분해 두 메커니즘을 더 명확히 갈라도 좋다.

- **[INFO]** `redact*` 함수 네임스페이스 확장 — 충돌 아님, 사전 disambiguation 확인됨
  - target 신규 식별자: `redactStoredErrorForResponse` (`codebase/backend/src/shared/utils/redact-stored-error.ts:28`)
  - 기존 사용처: `redactSecrets`/`deepRedactSecrets`/`redactSecretsInJsonString`(`sanitize-error-message.ts`) · `redactMcpSecrets`(`mcp-error-codes.ts`) · `redactConfig`(`workflow-assistant/tools/redact.ts`) · `redactThreadForPublic`(`thread-renderer.ts`)
  - 상세: 이름 접두사(`redact*`)가 겹치지만 각각 파일·모듈·용도가 뚜렷이 분리되어 있고, 신규 함수의 JSDoc 자체가 "`ExecutionError` 예외 클래스와 무관하다 … 이름을 겹치지 않게 고른 이유다" 라고 명시적으로 충돌 회피를 기록해 두었다(`redact-stored-error.ts:12-13`). 실제 충돌은 확인되지 않았다.
  - 제안: 조치 불필요.

## 관점별 확인 결과 (충돌 없음)

1. **요구사항 ID 충돌** — 이번 변경은 새 `R-xxx`/`EIA-XX-NN` ID를 발급하지 않는다. 기존 `R17`(getStatus 실값 노출)의 기존 불릿에 문단을 추가하는 형태이며, `1-data-model.md`/`2-navigation/14-execution-history.md`(R-5 boundary note)/`4-nodes/1-logic/12-background.md` 는 모두 그 §R17 을 SoT로 참조만 한다. `secret-store.md` 의 "비대상 — `Trigger.config.interaction.triggerToken`" 블록도 기존 "비대상 — `AuthConfig.config`" 패턴을 재사용한 것으로, 문서 스스로 "위 예외와 같은 종류가 아니다"라고 구분해 혼동을 차단한다.
2. **엔티티/타입명 충돌** — 신규 타입 `ResponseExecution`/`ResponseNodeExecution`/`ExecutionDetailWithTrigger`(`executions.service.ts:77,91,105`)를 backend/frontend 전역에서 grep한 결과 자기 모듈(및 `.spec.ts`) 밖에서 재사용되는 동명 식별자 없음. 기존 `ExecutionResponseDto`(DTO 클래스)와 명명 패턴(`XxxDto` vs `ResponseXxx`)이 달라 혼동 여지 낮음.
3. **API endpoint 충돌** — 신규 endpoint 없음. `GET /api/executions/:id`, `POST /api/executions/:id/re-run`, `GET /api/executions/:id/background-runs/:id` 모두 기존 endpoint 재사용.
4. **이벤트/메시지명 충돌** — 신규 이벤트명 없음. `execution.snapshot`, `execution.node.*` 등 기존 이벤트에 캐비엇만 추가.
5. **환경변수·설정키 충돌** — 신규 ENV 없음(diff에 `process.env`/`ConfigService` 신규 참조 없음 확인).
6. **파일 경로 충돌** — `redact-stored-error.ts`/`.spec.ts` 는 `shared/utils/` 하위 기존 `terminal-error-payload.ts`·`sanitize-error-message.ts` 와 동일한 "leaf util" 명명 컨벤션을 따르며 기존 파일과 겹치지 않는다. spec 파일 경로도 전부 기존 파일 수정이며 신규 spec 파일 없음.

## 요약

이번 변경(EIA §R17 내부 읽기 경로 마스킹 확장, 결정 2026-08-16)은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV·파일 경로 6개 관점 모두에서 기존 사용처와의 실질적 충돌이 없다. 신규 함수·타입은 코드 전역 grep으로 유일성을 확인했고, `redact-stored-error.ts` 자체가 인접 개념(`ExecutionError`)과의 명명 비충돌 근거를 이미 문서화해 두었다. 유일하게 주목할 점은 `spec/1-data-model.md` 안에서 서로 다른 두 마스킹 메커니즘(값-패턴 egress 마스킹 vs AuthConfig 키-이름 write-time 마스킹)이 "응답 마스킹"이라는 같은 한글 라벨을 공유한다는 것인데, 인접 SoT 링크로 즉시 구분되므로 실질 위험은 낮아 INFO로 등재한다.

## 위험도
LOW
