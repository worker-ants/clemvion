# Rationale 연속성 검토 — spec/5-system

## 검토 범위 확인

- **spec 델타**: `spec/5-system` 에 대한 변경은 0개 파일 — 이 브랜치는 해당 spec 영역을 건드리지 않았다.
- **구현 diff 실측** (프롬프트 예산 절단으로 diff 본문이 누락되어, 워킹트리를 절대경로로 직접 확인함):
  `git -C ".../e2e-race-helper-8d1b6e" diff --stat origin/main...HEAD` 결과, 코드 변경분은 다음으로 구성된다.
  - `codebase/backend/test/helpers/concurrency.ts` (신규, +116) — 동시성 e2e 겹침 오케스트레이션 헬퍼 `raceUnderHeldLock()`
  - `codebase/backend/test/*-delete-concurrency.e2e-spec.ts` (8개 파일) — 기존 인라인 BEGIN/락/공허성가드/COMMIT 블록을 위 헬퍼 호출로 치환하는 리팩터. 단언·기대값(예: WebAuthn credential 동시 삭제 → `[204, 404]`, 서로 다른 credential 동시 삭제 → `[204, 204]`)은 **변경 없음**
  - `PROJECT.md` — e2e 작성 가이드에 헬퍼 사용법 추가
  - `plan/in-progress/e2e-race-helper.md`, `plan/complete/spec-draft-nullable-notation-followups.md` — 작업 추적 문서
  - `codebase/backend/src/**` (production 코드)는 diff 에 **전혀 포함되지 않는다**.

## 발견사항

없음.

target 이 실제로 건드리는 것은 e2e 테스트 코드의 겹침(concurrency race) 오케스트레이션을 손으로 반복 작성하던 것을 공용 헬퍼(`raceUnderHeldLock`)로 추출하는 순수 리팩터이며, 동작·단언·기대 응답 코드는 리팩터 전후로 동일하다(예: `webauthn-credential-delete-concurrency.e2e-spec.ts` diff 확인 — `BEGIN`→`SELECT ... FOR UPDATE`→공허성 가드(`Promise.race` + 1500ms)→`COMMIT`→정렬·단언 흐름이 헬퍼 내부로 이동했을 뿐 로직·기대치는 불변). production 코드(`codebase/backend/src/**`)는 diff 에 포함되어 있지 않다.

`spec/5-system/1-auth.md` §1.4.4 "동시성 보호" Rationale(단일 트랜잭션 + `SELECT ... FOR UPDATE` pessimistic lock으로 WebAuthn counter 역행 경쟁을 직렬화한다는 설계 원칙)과 대조했을 때, 이번 변경은 그 설계가 실제로 지켜지는지를 검증하는 **테스트 하네스의 중복 제거**일 뿐 해당 invariant 를 우회하거나 재해석하지 않는다. 다른 8개 삭제-경합 e2e(schedule/trigger/workflow/workspace/model-config/auth-config/integration/member-remove)도 동일하게 오케스트레이션만 헬퍼로 옮겨졌고 도메인 동작 기대치는 그대로다.

기각된 대안의 재도입, 합의된 원칙 위반, 무근거 결정 번복, 시스템 invariant 우회 — 네 관점 모두 해당 사항을 찾지 못했다. 애초에 `spec/5-system` 문서 자체가 변경되지 않았고, 코드 diff 도 spec 이 규정하는 동시성/인증 도메인 로직이 아니라 그 도메인을 검증하는 테스트 인프라의 리팩터에 그친다.

## 요약

이번 target 은 `spec/5-system` 문서를 전혀 수정하지 않았고, 실제 코드 diff 도 프로덕션 로직이 아닌 e2e 동시성 테스트의 반복 오케스트레이션을 공용 헬퍼로 추출한 리팩터에 한정된다. 리팩터 전후로 단언·기대 응답 코드가 동일함을 diff 로 직접 확인했으며, 이는 `spec/5-system/1-auth.md` §1.4.4 에 기록된 "단일 트랜잭션 + 행 잠금" 동시성 설계 Rationale 을 우회하거나 재해석하지 않고 오히려 그 검증(공허성 가드)을 구조적으로 강화한다. Rationale 연속성 관점에서 위반·번복·재도입 사례는 발견되지 않았다.

## 위험도

NONE
