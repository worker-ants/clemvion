# Cross-Spec 일관성 검토 — `spec/5-system` (impl-done)

## 검토 배경 및 실측

- **scope(`spec/5-system`) 델타**: 0개 파일 — 이 브랜치는 `spec/5-system`(또는 그 밖의 어떤 `spec/**`)도 변경하지 않았다.
- **구현 diff 실측** (`git diff origin/main...HEAD -- codebase/ PROJECT.md`, 절대경로 워킹트리 기준):
  - `codebase/backend/test/helpers/concurrency.ts` — 신규 파일, `raceUnderHeldLock()` 헬퍼(테스트 전용 오케스트레이션 함수)
  - `codebase/backend/test/{auth-config,integration,member-remove,model-config,schedule,trigger,webauthn-credential,workflow,workspace}-delete-concurrency.e2e-spec.ts` (9개 파일 11개 블록) — 기존에 각 파일에 손으로 복제돼 있던 "락 획득 → 두 요청 발사 → 공허성 가드 → COMMIT" 오케스트레이션을 공용 헬퍼 호출로 치환
  - `PROJECT.md` — 위 헬퍼 사용 규약을 e2e 작성 가이드에 추가
  - `codebase/backend/src/**` (프로덕션 코드) — **변경 0** (diff 확인, `plan/in-progress/e2e-race-helper.md` 의 "§D 하지 않는 것"에도 명시)
  - 신규 helper 가 참조하는 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 에 이미 존재하는 기존 상수 (신규 도입 아님, 확인함)
- `plan/in-progress/e2e-race-helper.md` frontmatter 에 `spec_impact: none` 명시.

## 발견사항

없음 — 아래 이유로 Cross-Spec 6개 관점 전부 해당 사항이 없다.

- **데이터 모델 충돌**: 신규/변경 엔티티·필드 없음. 헬퍼는 기존 테이블(`webauthn_credential` 등)에 대한 기존 락 SQL 을 호출부에서 그대로 위임받아 실행할 뿐, 스키마·필드 정의를 추가/변경하지 않는다.
- **API 계약 충돌**: 신규/변경 endpoint 없음. 각 e2e 스펙이 호출하는 기존 DELETE 엔드포인트(트리거·워크스페이스·워크플로우·webauthn credential 등)의 request/response shape 은 그대로이며, 테스트 오케스트레이션 코드만 리팩터링됐다.
- **요구사항 ID 충돌**: 신규 요구사항 ID 부여 없음.
- **상태 전이 충돌**: 도메인 엔티티의 상태 머신 변경 없음. 삭제 경합 시나리오(204/404 결과)는 기존 동작을 검증하는 테스트 로직 이동일 뿐, 상태 전이 자체를 재정의하지 않는다.
- **권한·RBAC 모델 충돌**: RBAC 규칙 변경 없음. 헬퍼는 인증/인가 로직에 관여하지 않는 순수 DB 락 오케스트레이션이다.
- **계층 책임 충돌**: `codebase/backend/test/helpers/` 는 기존에도 `db.ts`·`auth.ts` 같은 e2e 전용 헬퍼가 위치하던 자리이며, 신규 `concurrency.ts` 도 동일 계층(테스트 인프라)에 머문다. 프로덕션 코드(`src/**`)와의 경계를 넘지 않았고, `PROJECT.md` 문서화도 기존 "Backend e2e 패턴" 절 관례를 따른다.

## 요약

이번 diff(10개 파일 / 프로덕션 코드 변경 0)는 아홉 개 동시성 e2e 파일에 중복돼 있던 "락 획득 → 겹침 유발 → 공허성 가드 → 검증" 오케스트레이션을 `raceUnderHeldLock()` 공용 헬퍼로 추출한 순수 테스트 리팩터다. `spec/5-system` 을 포함해 어떤 `spec/**` 문서도 변경하지 않았고(`spec_impact: none` 이 plan 에 명시), 프로덕션 코드·API 계약·데이터 모델·상태 머신·RBAC·계층 경계 중 어느 것도 건드리지 않았으므로 Cross-Spec 관점에서 충돌 후보 자체가 존재하지 않는다.

## 위험도

NONE
