# Plan 정합성 검토 — spec/5-system (--impl-prep)

## 검토 대상 파악

이번 --impl-prep 의 실제 작업 대상은 `plan/in-progress/race-helper-guard-tests.md`
(spec_impact: none, `codebase/backend/src/shared/testing/overlap-preconditions.ts` 신설 +
`test/helpers/concurrency.ts` 호출 배선 + `PROJECT.md:331` 예외 문구 + 트래커 항목 종결)이며,
scope 산정 결과 `spec/5-system` 이 target 번들로 잡혔다. 이 작업은 spec 본문을 바꾸지
않으므로, 검토는 (a) 이 plan 이 근거로 삼는 선행 plan/트래커 항목이 실제로 그 상태인지,
(b) 그 항목을 닫음으로써 다른 plan 의 후속 항목이 무효화·누락되지 않는지에 집중했다.

## 계보 실측 (전부 일치 확인)

| 확인 항목 | 결과 |
| --- | --- |
| 트래커 항목 존재 여부 (`spec-draft-nullable-notation-followups.md:5041`) | 「`raceUnderHeldLock` 의 순수 동기 분기 둘이 어떤 테스트도 지나가지 않는다」 — 대상 분기(`fires.length < 2`, `KNOWN_LOCK_TIMEOUTS_MS`)가 plan 본문과 **정확히 일치**, 아직 `[ ]` 미해결 |
| `PROJECT.md:331` 현재 문면 | 「신규 헬퍼: `codebase/backend/test/helpers/<name>.ts`」— plan 이 지적한 그대로, `src/shared/testing/` 예외 문구는 아직 없음 |
| 선례로 인용한 `src/shared/testing/` 5쌍 | 실제 5쌍(`response-contract`·`schedule-trigger-ref`·`swagger-probe`·`trigger-workflow-ref`·`user-secret-absence`) 존재 확인 — 인용이 정확함 |
| 완료 plan `plan/complete/e2e-race-helper.md` 존재 여부 | 존재. "이 PR 이 남긴 후속" 절이 지금 plan 이 닫으려는 항목과 동일 문구로 인수인계 |
| `spec-sync-auth-gaps.md` 의 "남은 둘"(ModelConfigService.remove()·WebAuthn credential 삭제) 위임 상태 | `spec-draft-nullable-notation-followups.md` §8·§9 모두 `[x]` 완료 (git log `890fcd9b7`·`3cbb4a1dc` 와 일치) — 위임 참조가 stale 하지 않음 |
| 관련 plan(`auth-guard-reflection-hardening.md`, `harness-review-gate-followups.md`) 과의 충돌 | 주제 불일치 확인 — 겹치는 결정·전제 없음 |

## 발견사항

없음. 이번 target(spec/5-system)에 대해 진행 중인 plan(`race-helper-guard-tests.md`)은
- 미해결 결정을 우회하지 않는다 — 오히려 직전 `--impl-prep` CRITICAL(선례 부재 오판)을
  실측으로 정정하고 재실행 대기 상태다.
- 선행 plan(`spec-draft-nullable-notation-followups.md` 트래커, `PROJECT.md` 문면)의 상태를
  정확히 인용하고 있고, 인용된 사실(파일 존재·줄 내용) 전부 실측과 일치한다.
- 다른 plan 의 후속 항목을 무효화하지 않는다 — 관련된 "동시 삭제 감사 중복" 클래스(9자리)는
  이미 전량 종결되어 있고, 이번 작업 범위(`fires.length < 2`/`KNOWN_LOCK_TIMEOUTS_MS` 순수
  분기 unit 커버리지)는 그 클래스와 독립적인 잔여 항목 하나만 다룬다.

## 요약

target(spec/5-system)에 spec 내용 변경은 없고(spec_impact: none), 실제 변경은 테스트 전용
헬퍼 배선이다. 검토 대상 plan 이 인용하는 선행 트래커 항목·PROJECT.md 문면·선례 파일 5쌍·
완료 plan 인수인계 문구를 모두 실측 대조한 결과 전부 일치했으며, 다른 in-progress plan 과의
결정 충돌이나 후속 항목 누락도 발견되지 않았다. Plan 정합성 관점에서 이 target 은 안전하다.

## 위험도

NONE
