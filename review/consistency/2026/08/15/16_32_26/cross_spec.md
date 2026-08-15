# Cross-Spec 일관성 검토 — `finalizeStalledExhausted` 트랜잭션 원자화

## 검토 범위 확정 (선행 사실확인)

프롬프트의 target 은 `spec/5-system/` 전역으로 표시되어 있으나, 프롬프트 자체 예산 초과로 실제 target 본문(특히
`14-external-interaction-api.md`)이 포함되지 않았다. `git diff origin/main...HEAD` 를 직접 실행해 실 변경 범위를
재확인했다:

- `spec/5-system/4-execution-engine.md` 1개 파일만 변경(+8/-1) — §7.1 산문 1문장 확장 + §Rationale 에 "dead-letter
  마감의 원자성 (2026-08-15 정정)" 단락 신규.
- 코드는 `codebase/backend/.../execution-engine.service.ts` 의 `finalizeStalledExhausted` 를 `dataSource.transaction`
  으로 감싸 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형화(자매 함수 패턴 적용).
- `plan/in-progress/eia-stalled-atomicity.md`(spec_impact: `spec/5-system/4-execution-engine.md` 단일 항목)와
  일치 — 브랜치/워크트리 이름(`eia-r8-cache-scope`)은 이 세션의 실제 작업 내용과 무관한 stale 명칭으로 보인다
  (실제 작업은 EIA "R8 캐시 스코프"가 아니라 실행 엔진 dead-letter 트랜잭션 원자화).

이 사실확인에 따라 검토는 위 좁은 diff 를 기준으로, 다른 spec 영역과의 충돌 여부만 판정한다.

## 검증한 핵심 주장

target 신규 문구는 "자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 은 이미 원자적이었다"고 단언한다.
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 를 직접 열어 두 함수 모두
`this.dataSource.transaction(async (manager) => {...})` 로 Execution UPDATE + NodeExecution cascade UPDATE 를
묶고 있음을 확인 — 주장은 코드와 일치한다. 허위/과장 서술로 인한 cross-spec 모순은 없다.

## 발견사항

없음 — 아래는 점검했으나 충돌이 발견되지 않은 항목의 근거만 기록한다.

- **데이터 모델 충돌**: 없음. 신규/변경 엔티티·컬럼 없음. `Execution.status`/`NodeExecution.status` 전이는 기존에
  이미 문서화된 `running→failed`(`WORKER_HEARTBEAT_TIMEOUT`) 그대로이며, 본 변경은 그 전이를 **원자적으로**
  묶었을 뿐 전이 자체나 필드를 바꾸지 않는다.
- **API 계약 충돌**: 없음. 신규/변경 endpoint 없음 — 순수 내부 서비스 메서드의 트랜잭션 경계 변경.
- **요구사항 ID 충돌**: 없음. target diff 는 신규 요구사항 ID(`EIA-*`/`R-*` 등)를 발급하지 않는다 — 기존
  `WORKER_HEARTBEAT_TIMEOUT` 에러코드(§Rationale 인용 다수: `1-data-model.md`, `5-system/3-error-handling.md`,
  `conventions/error-codes.md`, `data-flow/3-execution.md`)를 그대로 참조할 뿐 재정의하지 않는다.
- **상태 전이 충돌**: 없음. `spec/data-flow/3-execution.md` §3.1/§3.2(상태 전이 다이어그램)·§2.1(Schema 매핑)·
  §3.3(비정상 종료 회수 표)을 대조했다 — 이 문서들은 `finalizeStalledExhausted` 를 상태 전이 결과(`running→failed`,
  `WORKER_HEARTBEAT_TIMEOUT`) 수준으로만 서술하고 트랜잭션 경계 세부를 다루지 않으므로, 이번 원자화 변경과
  모순되는 서술이 없다(stale 화 대상 없음).
- **권한·RBAC 모델 충돌**: 해당 없음 — 이 변경은 인가 경로를 갖지 않는 내부 워커 크래시 복구 로직이다.
- **계층 책임 충돌**: 없음. `impl-prep`(`15_54_20`) 리뷰가 이미 "이 함수는 취소가 아니라 워커 크래시→FAILED 경로이므로
  `spec/conventions/node-cancellation.md`(취소 전용 스코프)가 아니라 `4-execution-engine.md §7.1`(진짜 SoT)에
  기록해야 한다"는 WARNING 을 내렸고, 최종 target 은 이를 반영해 `node-cancellation.md` 를 건드리지 않고
  `4-execution-engine.md` 에만 기록했다. `grep` 로 `spec/conventions/node-cancellation.md` 에
  `finalizeStalledExhausted`/`WORKER_HEARTBEAT_TIMEOUT` 문자열이 없음을 재확인 — 스코프 배치가 correct 하며
  cross-spec 중복 등록도 없다.

## 요약

이번 diff 는 `spec/5-system/4-execution-engine.md` 단 1개 파일의 좁은 서술 확장(dead-letter 마감 트랜잭션
원자화)이며, 신규 엔티티·API·요구사항 ID·RBAC·계층 경계 변경이 전혀 없다. 문서가 단언하는 "자매 두 함수는 이미
원자적" 사실은 코드로 직접 검증돼 정확했고, 이전 라운드 WARNING(취소 convention 이 아니라 실행 엔진 문서에
기록해야 한다)도 이미 반영돼 다른 spec 영역과의 스코프 침범도 없다. `spec/data-flow/3-execution.md`·
`spec/1-data-model.md`·`spec/conventions/error-codes.md` 등 `finalizeStalledExhausted`/`WORKER_HEARTBEAT_TIMEOUT`
을 언급하는 다른 문서들도 트랜잭션 세부를 다루지 않는 추상화 수준이라 stale 화되지 않았다. Cross-Spec 관점에서
차단 사유 없음.

## 위험도

NONE
