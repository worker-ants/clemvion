# Rationale 연속성 검토 결과

## 점검 범위 요약

번들 프롬프트는 `spec/5-system/` 전체를 대상으로 지정했으나, 실제 diff(`git diff origin/main`)는
`spec/conventions/node-cancellation.md` 1줄 추가와 그에 대응하는
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (+`.spec.ts`) 수정,
그리고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 체크박스 갱신뿐이다
(`spec/5-system/*` 는 이번 diff 에서 변경되지 않음 — 번들에 포함된 것은 cross-reference
컨텍스트). 번들 본문 중 15개 파일(`4-execution-engine.md` 포함)이 예산 초과로 생략되어 있어,
가장 관련성 높은 `spec/5-system/4-execution-engine.md` 는 `Read` 로 직접 열어 §7.1~§7.5 및
`## Rationale` 전체를 확인했다.

target 요지: `finalizeStalledExhausted` (stalled 재배달 attempts 소진 시 Execution+NodeExecution
종결)의 두 UPDATE 를 `dataSource.transaction`으로 묶어, 이미 트랜잭션화되어 있던 자매 함수
`cancelParkedExecution`/`markWebChatIdleTimeout` 과 패턴을 통일했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 자매 함수와의 "동형" 범위는 트랜잭션 구조에 한정 — 에러 핸들링까지는 아님
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334-3413` (`finalizeStalledExhausted`)
  - 과거 결정 출처: 같은 파일 `cancelParkedExecution`(:1023-1089) / `markWebChatIdleTimeout`(:1152-1216) 및 `spec/conventions/node-cancellation.md` §2.4 표
  - 상세: 두 자매 함수는 전체를 `try { await this.dataSource.transaction(...); ...; await this.emitCancellationEvent(...); } catch (err) { this.logger.error(...) }` 로 감싸 실패를 흡수·로깅한다. `finalizeStalledExhausted` 는 트랜잭션 자체는 동일 패턴으로 도입했지만 함수 레벨 try/catch 는 추가하지 않았다. 다만 이는 이번 diff 가 만든 회귀가 아니다 — 호출부 `execution-run.processor.ts:88`(`void this.engine.finalizeStalledExhausted(executionId).catch((err) => logger.error(...))`)가 이미 예외를 흡수하고 있어(diff 이전부터 존재), 실질적 동작은 자매 함수와 동등하다. node-cancellation.md 신규 행의 문구도 "동형"을 트랜잭션 원자성 범위로만 한정해 서술하고 있어 과장된 주장은 아니다.
  - 제안: 조치 불요(선택 사항). 완전한 대칭을 원하면 `finalizeStalledExhausted` 에도 함수 레벨 try/catch 를 추가하고 caller 의 `.catch()` 를 제거하는 리팩터를 별도 항목으로 트래커에 등재할 수 있으나, 이는 Rationale 연속성이 아니라 코드 일관성 이슈로 code-review 영역이다.

## 정합성 확인 (Rationale 과 일치하는 부분 — 참고용, 위반 아님)

- `spec/conventions/node-cancellation.md` §Rationale "왜 짝 전이에 terminal 가드가 필요한가"(2026-07-27)와 `spec/5-system/4-execution-engine.md` §Rationale 전반(재개 진입 원자 claim, admission gate TOCTOU 원자화 등)이 공유하는 원칙 — *"Execution↔NodeExecution 짝 상태 갱신은 단일 트랜잭션으로 묶어 부분 커밋에 의한 영구 비-terminal 잔류를 막는다"* — 를 target 이 그대로 따른다. 셋 중 둘만 트랜잭션화됐던 상태(자매 함수 주석이 이미 경고하던 실패 모드)를 세 번째에 적용해 닫은 것으로, **원칙을 우회하는 설계가 아니라 강화하는 방향**이다.
- `finalizeStalledExhausted` 가 트랜잭션 미적용 상태였던 것에 대해 과거에 의도적으로 기각한 대안이었다는 이력은 찾지 못했다(`git log -S`, PR4 도입 커밋 `b3344e54b`, 관련 spec 어디에도 "이 경로는 트랜잭션을 쓰지 않는다"는 명시적 결정이 없음) — 단순 누락(자매 하드닝 미적용)이었고, 이번 target 이 그 누락을 메운 것이지 과거 결정을 번복한 것이 아니다.
- 커밋 후 best-effort 부수효과(`finalizeRehydrationCleanup` + WS emit)를 트랜잭션 **밖**에 두는 순서도 두 자매 함수와 동일 — "DB 상태는 이미 원자적으로 일관하다"는 동일 주석 패턴을 재사용해, emit 순서에 관한 기존 Rationale("WebSocket 이벤트 발행은 트랜잭션 commit 후 수행", 4-execution-engine.md §1.1)과 정합.
- 트래커 반영(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)이 실제 코드 리뷰 이력(`review/code/2026/08/15/12_52_39/database.md` WARNING 항목)에 근거하고 있음을 직접 확인 — 지어낸 이력이 아니다.
- 회귀 테스트(`execution-engine.service.spec.ts`)의 `affected=0` 케이스 단언을 "항상 참이 될 뻔한 단언"에서 "트랜잭션 안 QueryBuilder 호출 횟수 + 미실행" 단언으로 교체한 것도, 자매 트랜잭션 테스트 하네스(`installCancelTx` 계열)와 동형으로 맞춘 것이라 Rationale 상 문제 없음.

## 요약

이번 diff(`finalizeStalledExhausted` 트랜잭션화)는 기존 Rationale 에서 기각된 대안을 재도입하거나
합의된 설계 원칙을 우회하지 않는다. 오히려 `node-cancellation.md`·`4-execution-engine.md` 양쪽에
반복적으로 명시된 "짝 상태 갱신은 단일 트랜잭션" 원칙을 셋째 함수에 뒤늦게 적용해 이전까지 있던
불일치(자매 둘만 원자적)를 해소하는 방향이며, 새 결정을 뒤집는 것이 아니라 기존 결정을 완성하는
것이다. 트랜잭션 구조 도입 근거·비교 대상(자매 함수 라인 번호)·직전 코드 리뷰 이력까지 명시적으로
문서화되어 있어 "무근거 번복" 에도 해당하지 않는다. 유일한 관찰 사항(함수 레벨 try/catch 부재)은
caller 의 기존 `.catch()` 로 실질적으로 커버되며 Rationale 위반이 아닌 INFO 수준의 코드 일관성
참고사항이다.

## 위험도

NONE
