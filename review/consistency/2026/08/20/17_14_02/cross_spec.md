# Cross-Spec 일관성 검토 — `Execution.inputData` egress 마스킹 카브아웃 폐지 (2026-08-20)

## 검토 범위

diff-base `origin/main` 대비 변경 spec 7개 (`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`) + 대응 코드
(`executions.service.ts`/DTO, `background-runs.service.ts`/DTO, `rerun-modal.tsx`, `editor-toolbar.tsx`,
`masked-markers.ts`, i18n dict). 원 prompt 번들은 예산 초과로 diff 와 `spec/5-system/` 의 다수 파일 본문이
생략돼 있었으므로, `git -C <worktree> diff origin/main...HEAD` 와 대상 파일을 직접 절대경로로 Read 해 재구성했다.

## 발견사항

교차-spec 모순·충돌을 찾지 못했다. 변경은 하나의 결정(`Execution.inputData` 도 egress 값-패턴 마스킹
대상으로 전환 — 프런트 마커 가드 3곳이 재제출 카브아웃의 전제 조건을 충족했으므로)을 7개 spec 파일에
**일관되게** 미러했다:

- **데이터 모델**: `spec/1-data-model.md` §2.13(`Execution.input_data`)·§2.14(`NodeExecution.input_data`)가
  "형제 컬럼과 같은 규칙" 으로 갱신됐고, 코드(`executions.service.ts` `ResponseExecution` 타입·
  `toResponseExecution`·`toExecutionDto`·`background-runs.service.ts`)가 실제로 `inputData` 를
  `redactStoredDataForResponse` 관문에 넣은 것과 부합한다. 구 카브아웃 근거였던 `MASKED_INPUT_DATA_REASON`
  상수는 spec·코드 양쪽에서 흔적 없이 제거됐다 (`grep` 확인).
- **API 계약**: `execution-response.dto.ts`의 `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData`
  JSDoc 이 "값-패턴 마스킹 대상" 으로 정정됐고, `spec/5-system/14-external-interaction-api.md` §R17 의
  "적용 범위는 열거다" 표(여섯 표면)에 `inputData` 가 명시적으로 추가됐다. WS 프로토콜(`6-websocket-protocol.md`
  §4.1)의 REST/WS 동일 규칙 서술과도 일치한다.
- **요구사항 ID**: `RR-PL-02`(입력 데이터 모드) 안에 새 캐비엇이 삽입됐을 뿐 새 ID 를 채번하지 않았다 —
  `RR-PL-01~07` 카탈로그와 충돌 없음.
- **상태 전이**: 영향 없음 (masking 은 egress-only 이며 `waiting_for_input`/재실행 상태 머신을 바꾸지 않는다).
- **RBAC**: 영향 없음 — 문서가 스스로 "안전성은 role 게이팅이 아니라 boundary masking parity" 원칙
  (`2-navigation/14-execution-history.md` R-5)을 재확인하며 새 예외를 만들지 않는다.
- **계층 책임**: 새 책임 분할(backend=egress 값-마스킹 SoT, frontend=마스킹된 값의 재제출을 막는 소비-측
  마커 가드)이 `masked-markers.ts` 로 명확히 문서화됐고, backend `sanitize-error-message.ts` 의 마커 집합
  (`***`/`[REDACTED]`/`[REDACTED_DEPTH]`, `MAX_REDACT_DEPTH=10`)과 frontend 미러가 값·깊이 상수까지
  정확히 일치한다 (직접 코드 대조 완료).

부수적으로 아래 잔여 참조들도 확인했으며 모두 정합했다 (stale 없음):
- 구 카브아웃 서술("마스킹 대상이 아니다"/"카브아웃")을 인용하던 spec 파일은 위 7개 뿐이었고, 전부
  갱신됐다 (`grep -rn` 로 spec/ 전역에서 잔존 인용 0건 확인).
- `spec/2-navigation/14-execution-history.md` §3.7·R-5, `spec/3-workflow-editor/4-ai-assistant.md`
  §4.1.2(Re-run 비트리거)·§4.1.1(별개의 key-based 마스킹, "잔여 ③"으로 R17 이 이미 분리 인정)은
  이번 변경과 무관하거나 이미 SoT 위임 서술이라 갱신 불필요.
- `spec/4-nodes/6-presentation/4-form.md`(폼 `defaultValue` 프리필 마스킹, 2026-08-17 도입분)는
  이번 diff 대상이 아니며 이전부터 SoT 를 EIA §R17 로 위임하는 패턴을 유지 — 이번 변경으로 새로
  어긋나지 않았다.
- `spec/data-flow/3-execution.md`·`10-triggers.md`의 `input_data` 언급은 전부 **DB write 경로**
  서술(ingestion, INSERT/UPDATE)이라 egress 마스킹 정책과 레이어가 달라 충돌 없음.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫는 결정을 데이터 모델(`1-data-model.md`)·
API 계약(EIA §R17, DTO JSDoc)·에디터 UX(§2.2 실행 데이터 흐름)·Re-run(§10.2)·webhook 방어층(§5.3)·
WS 프로토콜(§4.1) 등 관련된 모든 spec 표면에 같은 날짜(2026-08-20)·같은 근거로 동시에 미러했고,
코드(backend 마스킹 관문 3곳 + frontend 마커 가드 3소비처 + 마커 상수 미러)와도 1:1 로 대응한다.
이전 라운드에서 지적됐던 flip-flop·프리필 왕복·off-by-one 류 CRITICAL 은 spec 본문에 스스로 이력으로
남아 재발 방지 각주가 돼 있다. Cross-spec 관점에서 새로운 모순·중복 정의·ID 충돌을 찾지 못했다.

## 위험도

NONE
