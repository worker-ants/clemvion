# Rationale 연속성 검토 — spec/5-system (--impl-prep)

## 검토 범위와 실제 변경 사항의 관계

이번 `--impl-prep spec/5-system` 게이트는 `plan/in-progress/race-helper-guard-tests.md`
착수 전 체크리스트 1번 항목으로 호출되었다. 실제 작업 범위를 먼저 확인했다:

- `git diff --stat origin/main...HEAD` 기준 현재까지 변경된 파일은 `plan/in-progress/race-helper-guard-tests.md` 1개뿐 (신규 plan 등재).
- 해당 plan 은 스스로 **"프로덕션 코드 변경 0"**, `codebase/backend/src/**` 비접촉을 명시하고, frontmatter 는 `spec_impact: none` 이다.
- 작업 내용은 (a) `test/helpers/concurrency.spec.ts` 신규 unit spec 작성, (b) `raceUnderHeldLock` 헬퍼의 순수 동기 분기(`fires.length < 2` 가드, `KNOWN_LOCK_TIMEOUTS_MS` 상한 검사)를 순수 함수로 추출, (c) jest `roots` 설정 최소 변경 — 전부 **테스트 하네스 내부 리팩터**이며 어떤 API 계약·인증 흐름·감사 로그 동작도 바꾸지 않는다.
- 번들된 target(`spec/5-system/1-auth.md`, `2-api-convention.md`, `3-error-handling.md`) 및 관련 Rationale 발췌 전체에서 `raceUnderHeldLock`·`KNOWN_LOCK_TIMEOUTS`·`concurrency.spec` 등 이번 작업 관련 식별자를 검색했으나 **0건** — 이번 변경은 spec 본문이 규정하는 어떤 동작 표면도 참조하지 않는다.

## 관련성 있는 기존 Rationale 확인 (교차 점검)

이번 작업의 배경이 된 최근 커밋들(`c9f0e1a75`/`890fcd9b7`/`3cbb4a1dc` — 동시 DELETE 시
`auth_config.delete`/`model_config.delete`/`user.2fa_disabled` 감사 로그 중복 기록 수정)이
`1-auth.md` 의 기존 Rationale 과 상충하지 않는지 대조했다:

- `1-auth.md` §1.4.2 "동시성 보호" 서술(`SELECT ... FOR UPDATE` pessimistic lock + 트랜잭션 안에서 credential 조회·검증·counter 갱신·역행 삭제, LoginHistory 는 트랜잭션 밖) — 이번 task 는 이 서술을 변경하지 않고, 그 위에서 동작을 검증하는 e2e 헬퍼(`raceUnderHeldLock`, 직전 PR #1377)의 순수 로직 커버리지만 보강한다. 상충 없음.
- Rationale `2.3.B`(클라이언트 IP 신뢰)·`부트 캐너리`(§`@WorkspaceId()` reflection) 항목처럼 이 저장소가 이미 "라우트별 opt-in 마커" 패턴을 명시적으로 기각한 사례가 존재하지만, 이번 task 는 그런 설계 대안을 채택하지 않는다.
- 감사 로그 append-only 원칙(`4.1.A`/`4.1.B`), audit-actions 규약 등은 이번 test-only 변경과 무접점이다.

## 발견사항

없음. 실제 diff 가 스펙이 규정하는 어떤 결정·원칙·invariant 도 다시 열거나 우회하지 않는다 (harness-only 변경, `spec_impact: none`).

번들 자체(현재 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 전문 및 관련 Rationale 발췌)를 정독한 결과, 이 세 문서 내부에서도 과거 기각 대안의 재도입·원칙 위반·무근거 번복 징후는 없었다 — 오히려 각 Rationale 항목이 날짜·기각 대안·실측 근거를 일관되게 남기는 성숙한 상태다 (예: `1.1.B-1`~`1.1.B-6`, `2.3.A`~`2.3.D`, `1.4.A`~`1.4.K`, `§5.3 410 미등재`, `§10.4 위임` 갱신 이력, `ACCOUNT_LOCKED` 423→401 정정 등). 단, `spec/5-system/4-execution-engine.md` 외 14개 파일은 컨텍스트 예산 초과로 본문이 생략되어 이번 검토에서 직접 열람하지 않았다 — 이번 task 의 실제 변경(테스트 하네스)이 그 문서들의 표면과도 무관하므로 위험으로 보지 않는다.

## 요약

이번 `--impl-prep` 호출 시점의 실제 diff 는 `plan/in-progress/race-helper-guard-tests.md` 신규 등재뿐이며, 그 plan 이 예고하는 작업(테스트 헬퍼 순수 함수 추출 + jest 설정 최소 변경 + 신규 unit spec)은 프로덕션 코드·API 계약·spec 본문을 전혀 건드리지 않는다(`spec_impact: none`, 명시적 "프로덕션 코드 변경 0"). 번들된 `spec/5-system` 대상 문서와 관련 Rationale 발췌를 대조한 결과 이번 작업이 기각된 대안을 재도입하거나 합의 원칙을 위반하거나 무근거로 결정을 번복하는 지점은 발견되지 않았고, 문서 자체의 Rationale 연속성도 양호하다.

## 위험도

NONE
