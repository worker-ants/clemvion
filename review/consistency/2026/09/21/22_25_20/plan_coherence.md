# Plan 정합성 검토 — spec/5-system (--impl-prep, race-helper-guard-tests)

## 발견사항

- **[CRITICAL]** `roots` 확장안이 이미 존재하는 「self-spec 헬퍼는 `src/shared/testing/`」 관례와 충돌
  - target 위치: `plan/in-progress/race-helper-guard-tests.md` §B·§D (`jest.config.ts` 에 `roots` 추가해 `test/helpers/concurrency.spec.ts` 를 unit 러너가 집게 하는 접근)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 1895번째 줄) — **미해결(`- [ ]`), owner=developer** 항목 「`PROJECT.md` §e2e 파일 위치 — self-spec 동반 헬퍼는 `src/shared/testing/`」
  - 상세: 이 트래커 항목은 지금 이 PR 이 풀려는 것과 **동일한 구조적 문제**를 이미 진단해 뒀다 — "`test/helpers/<name>.ts` 에 self-spec(`*.spec.ts`)을 두면 unit jest(`rootDir: 'src'`)도 e2e jest(`testRegex: '.e2e-spec.ts$'`)도 그 파일을 안 잡아 영구히 죽은 테스트가 된다." 그리고 그 처방은 **`roots` 변경이 아니라 파일을 `codebase/backend/src/shared/testing/<name>.ts` 로 옮기는 것**이며, 이미 코드베이스에 다섯 쌍의 선례가 있다(`trigger-workflow-ref.ts`/`.spec.ts`, `schedule-trigger-ref.ts`/`.spec.ts`, `user-secret-absence.ts`/`.spec.ts`, `swagger-probe.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts` — 전부 `src/shared/testing/` 아래, `#1308` 유래). `race-helper-guard-tests.md` §D 는 "`rootDir` 자체를 바꾸지 않는다"·"필요한 최소 변경(`roots` 추가)만 한다" 고 명시적으로 **다른 메커니즘**을 선택하면서, 같은 트래커 문서(자신이 다른 항목을 닫으려고 이미 인용한 바로 그 파일) 안의 이 병렬 미해결 항목을 언급도, 반증도 하지 않는다. 두 접근이 공존하면 "self-spec 이 죽은 테스트가 되는 문제"를 푸는 방식이 파일마다 갈리는 새 비일관이 생기고, `roots` 확장은 스코프가 전역 jest 설정이라 향후 `test/helpers/` 아래 다른 우발적 `*.spec.ts` 까지 조용히 collect 되는 부작용 표면도 넓다.
  - 제안: 착수 전에 두 가지 중 하나를 결정으로 명시할 것 — (a) `assertGuardBelowKnownTimeoutsMs`(순수 함수)만 `codebase/backend/src/shared/testing/lock-timeout-guard.ts` 류로 추출해 기존 선례를 따르고 `concurrency.ts`(e2e 전용, `pg.Client` 의존)는 `test/helpers/` 에 남기거나, (b) `roots` 확장을 선택한다면 **왜 이 경우가 `src/shared/testing/` 선례의 적용 대상이 아닌지**(예: `concurrency.ts` 전체는 DB 의존 e2e 오케스트레이션이라 `src/` 로 옮기는 것이 오히려 어색함)를 plan 본문에 근거로 남기고, `spec-draft-nullable-notation-followups.md` 의 해당 항목에도 "검토했으나 이 케이스는 다른 처방을 택함" 을 교차 기록한다. 결정 없이 그대로 진행하면 다음 유사 케이스에서 어느 쪽이 정본인지 다시 논쟁하게 된다.

- **[INFO]** target(`1-auth.md` §5, `2-api-convention.md` §3)의 "동시 삭제 → 두 번째 404" 계약 문서화가 아직 비어 있음 — 이번 plan 과 무관, 참고용
  - target 위치: `spec/5-system/1-auth.md` §5 `DELETE /api/auth/2fa/webauthn/credentials/:id` 행 / `spec/5-system/2-api-convention.md` §3 HTTP 메서드 표의 `DELETE = O`(멱등) 행
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 5109~5151번째 줄) — planner 소유, 미해결(`- [ ]`), "대기 3건: auth-configs · model-config · webauthn" 으로 명시
  - 상세: 이번 세션의 직전 커밋들(`c9f0e1a75`·`890fcd9b7`·`3cbb4a1dc`, #1374~#1376)이 auth-configs·model-config·webauthn 세 자리의 동시 삭제 중복 감사 버그를 **코드에서는** 모두 고쳤지만("아홉 번째이자 마지막 자리"), 그 사실을 반영해야 할 spec 문서 쪽 각주(§2-api-convention.md §3 멱등성 각주, §1-auth.md §5 해당 행)는 아직 갱신되지 않았다 — target 번들에서 실측 확인함. 이는 이미 추적 중인 planner 항목이고 이번 developer plan(`race-helper-guard-tests.md`, spec_impact: none)의 스코프 밖이라 차단 사유는 아니다.
  - 제안: 별도 조치 불필요 — 기존 tracker 항목을 그대로 유지. 다음 planner 턴에서 세 자리를 한 번에 정리할 때 참고.

## 요약

이번 impl-prep 대상인 `race-helper-guard-tests.md` 는 spec_impact: none 의 순수 테스트 하네스 작업으로, spec/5-system 본문에 직접 결정을 내리거나 그 내용을 바꾸지 않는다. 다만 이 plan 이 채택하려는 구현 메커니즘(jest `roots` 확장)은 **같은 트래커 문서 안에 이미 열거된 미해결·developer 소유 결정**("self-spec 동반 헬퍼는 `src/shared/testing/`")과 정면으로 겹치는 문제를 다른 방식으로 풀려 하면서 그 선례를 언급하지 않는다 — 이 자체가 새 비일관을 낳을 수 있어 착수 전 반드시 짚어야 한다. 그 외에 target spec(1-auth.md·2-api-convention.md)에는 이미 추적 중이고 이번 plan 과 무관한 문서화 지연(동시 삭제 404 각주)이 남아 있으나 차단 사유는 아니다.

## 위험도

MEDIUM
