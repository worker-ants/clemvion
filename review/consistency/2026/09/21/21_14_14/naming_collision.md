# 신규 식별자 충돌 검토 — `spec/5-system` (impl-done)

## 실측 요약

- 검토 모드: `--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`.
- **scope(`spec/5-system`) 델타: 0개 파일** — 이 브랜치는 spec 을 전혀 바꾸지 않았다.
- 구현 diff 는 `git -C <worktree> diff origin/main...HEAD` 로 절대경로 실측: 총 61개 파일 변경(대부분 `review/**` 산출물). "제품 코드" 로 좁히면 실질 변경은 아래로 수렴한다.
  - `codebase/backend/test/helpers/concurrency.ts` — 신규 파일 (116줄)
  - `codebase/backend/test/*-delete-concurrency.e2e-spec.ts` (8개) — 기존 인라인 락-오케스트레이션 코드를 위 헬퍼 호출로 치환한 리팩터
  - `PROJECT.md` — e2e 작성 가이드에 헬퍼 사용법 6줄 추가
  - `plan/in-progress/e2e-race-helper.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (체크박스 갱신) — plan 문서
- **프로덕션 코드(`codebase/backend/src/**`) 변경은 0줄.** 새 API endpoint·엔티티·DTO·이벤트·환경변수·요구사항 ID 는 diff 어디에도 없다 (`export` 신규 심볼을 전수 grep 한 결과 `raceUnderHeldLock` 단 1건).

## 발견사항

이번 diff 가 새로 도입하는 식별자는 실질적으로 다음 셋뿐이다 (모두 `codebase/backend/test/helpers/concurrency.ts` 신규 파일에 국한):

- 함수 `raceUnderHeldLock(locker, lock, fires)`
- 모듈-로컬 상수 `KNOWN_LOCK_TIMEOUTS_MS`, `VACUITY_GUARD_MS`
- 파일 경로 `codebase/backend/test/helpers/concurrency.ts`

각각을 저장소 전체(spec/, codebase/, plan/)에서 grep 하여 기존 사용처와의 의미 충돌을 확인했다.

- **[INFO]** 신규 식별자는 기존과 충돌 없음
  - target 신규 식별자: `raceUnderHeldLock`, `KNOWN_LOCK_TIMEOUTS_MS`, `VACUITY_GUARD_MS`, `helpers/concurrency.ts`
  - 기존 사용처: 없음 — `raceUnderHeldLock` 은 이번 작업 계보의 plan 문서(`plan/in-progress/e2e-race-helper.md`, `plan/complete/webauthn-dup-delete.md`)와 리뷰 산출물(`review/code/2026/09/21/**`)에서만 동일 의미로 등장하며, 그 외 코드베이스·spec 어디에도 선재하는 정의가 없다. `codebase/backend/test/helpers/` 디렉토리는 `auth.ts`·`db.ts`·`webauthn.ts`·`e2e-chat-channel-fixture.ts`·`e2e-client-ip.ts` 와 나란히 `concurrency.ts` 를 추가했고 이는 기존 명명 컨벤션(도메인/관심사 명사 소문자)과 일치한다.
  - 상세: `KNOWN_LOCK_TIMEOUTS_MS` 가 참조하는 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 에 이미 정의된 export 를 그대로 import 해 재사용한 것이며(값 5000, 재정의 아님), 새 이름을 부여하지 않았다.
  - 제안: 없음 — 충돌 없음.

- **[INFO]** `spec/5-system` 은 이번 변경에서 관여하지 않음
  - target 신규 식별자: (해당 없음)
  - 기존 사용처: `spec/5-system/1-auth.md`, `2-api-convention.md` 등 — 요구사항 ID(`auth`)·엔드포인트(`/api/auth/*`, `/api/users/me/*` 등)·환경변수(`WEBAUTHN_RP_ID` 등)를 대량으로 정의하고 있으나, 이번 diff 는 이 문서들을 전혀 건드리지 않았고 코드 diff 도 이 영역들의 어떤 ID·엔드포인트·env var 도 재사용/재정의하지 않는다.
  - 상세: 검토 대상 코드가 `spec/5-system` scope 로 라우팅된 것은 "5-system 소유 코드(`codebase/backend/test/**`, trigger lock 등)를 건드렸기 때문" 으로 보이나, 실제 변경은 e2e 테스트 헬퍼 리팩터에 한정되어 이 spec 영역이 정의하는 어떤 명명 공간과도 접점이 없다.
  - 제안: 없음 — 정보성 기록.

## 요약

이번 변경(`e2e-race-helper`)은 아홉 개 concurrency e2e 스펙 파일에 반복되던 락-오케스트레이션 코드를 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 헬퍼로 추출한 **테스트 전용 리팩터**다. `spec/5-system` 에는 파일 델타가 0이며, 프로덕션 코드 변경도 0줄이다. 새로 도입된 식별자는 `raceUnderHeldLock`/`KNOWN_LOCK_TIMEOUTS_MS`/`VACUITY_GUARD_MS`/`helpers/concurrency.ts` 뿐이고, 전수 grep 결과 이 중 어느 것도 기존 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로와 이름이 겹치거나 의미가 충돌하지 않는다. 6가지 점검 관점 전부에서 충돌 후보가 발견되지 않았다.

## 위험도

NONE
