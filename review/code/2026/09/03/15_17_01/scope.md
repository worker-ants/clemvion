# 변경 범위(Scope) 리뷰

## 사전 확인

- 리뷰 대상 diff(26개 파일)는 `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 1"
  작업 전체(엔티티 8필드 `| null` 확장 + 캐스트 8건 제거) + 그 배치를 검토한 직전 리뷰 라운드
  (`review/code/2026/09/03/14_44_15/`)에서 나온 CRITICAL 1건·WARNING 4건에 대한 조치(RESOLUTION.md
  기준)를 함께 포함한다. 두 축 모두 같은 plan 문서·같은 배치에 속하므로 하나의 diff 로 묶인 것
  자체는 스코프 위반이 아니다.
- `review/code/2026/09/03/14_44_15/*` 11개 파일(SUMMARY.md·RESOLUTION.md·`_retry_state.json`·
  `meta.json`·에이전트별 리포트 7종)이 신규 파일로 이 diff 에 포함돼 있다. 이는 코드 변경이 아니라
  직전 리뷰 라운드의 산출물이며, 저장소 관례상 `review/`는 gitignored 가 아니고 "마무리 커밋(리뷰
  반영 후)에 review 산출물을 함께 커밋"하는 것이 표준 흐름이다(CLAUDE.md 저장 위치표 + 기존
  선례). **스코프 위반으로 보지 않는다** — 정보로만 남긴다.
- 나머지 15개 코드/plan 파일은 전부 `entity-nullable-column-type-mismatch` 배치 1의 대상
  모듈(`auth`·`totp`·`schedules`·`users`·신규 guard)에 국한된다. 다른 모듈·컨트롤러·DTO·프론트엔드·
  무관한 설정 파일 변경은 없다.

## 발견사항

- **[INFO]** 회귀 가드 2개 파일(신규) — "타입 확장 + 캐스트 제거"라는 좁은 요청 범위를 넘는 부가
  인프라
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`(신규 파일 전체),
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`(신규 파일 전체)
  - 상세: 배치의 핵심은 "캐스트를 강제하던 8개 필드 타입 확장 + 캐스트 8건 제거"인데, 여기에 더해
    (a) `null as unknown as X` 재발을 잡는 정적 스캔 가드, (b) 이번 CRITICAL(부팅 실패)에 대응해
    추가된 `findUntypedNullableColumns`(`\| null`인데 `@Column`에 `type:` 없는 자리 탐지, 관계
    컬럼 예외 처리 포함, 게이트 105~122) 두 축이 함께 들어갔다. 원칙적으로는 "요청 범위 밖"이지만,
    `plan/in-progress/entity-nullable-column-type-mismatch.md`의 "## 회귀 가드" 절에 근거가
    명시돼 있고, 손수 새 정규식을 짜지 않고 저장소 기존 형제 가드(`masked-reject-callers-guard.ts`
    등)·형제 술어(`hasRawUpdateReturning`)와 동일한 guard+spec 2파일 관례를 그대로 따랐다. 또한
    `findUntypedNullableColumns` 는 정확히 이번 배치가 스스로 만든 CRITICAL(부팅 실패)의 재발
    방지책이라 "이 변경이 연 구멍을 그 자리에서 막는" 성격에 가깝다. over-engineering 으로 보기엔
    근거가 탄탄해 INFO 로 유지한다(직전 라운드 scope 리뷰와 동일 결론).
  - 제안: 조치 불요. 배치 2/3 에서 `countNullAsUnknownAsCasts`/`findUntypedNullableColumns` 는
    범용 가드이므로 재생성이 불필요함을 plan 문서에서 재확인 권장(이미 후속 항목 절에 일부 반영됨).

- **[INFO]** `schedules.service.ts` 대입문 3줄 → 1줄 축약 — 포맷팅과 실질 변경이 한 hunk 에 섞임
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241`
  - 상세: `schedule.nextRunAt = nextRun ? new Date(nextRun) : (null as unknown as Date);`(3줄)
    → `schedule.nextRunAt = nextRun ? new Date(nextRun) : null;`(1줄). 캐스트 제거로 줄 길이가
    짧아지며 prettier 가 자동으로 한 줄로 합친 결과로 보인다. 실질 변경(캐스트 제거)과 줄바꿈
    변경이 분리되지 않고 하나의 hunk 에 섞여 있으나, 변경의 유일한 실질 내용이 캐스트 제거이고
    포맷팅도 그 결과로만 발생한 것이라 지적 실익은 낮다.
  - 제안: 조치 불요(정보 제공용).

- **[INFO]** 직전 리뷰 라운드 산출물 11개 파일이 코드 fix 와 같은 diff 에 포함됨
  - 위치: `review/code/2026/09/03/14_44_15/*`(SUMMARY.md·RESOLUTION.md·`_retry_state.json`·
    `meta.json`·`documentation.md`·`maintainability.md`·`requirement.md`·`scope.md`·`security.md`·
    `side_effect.md`·`testing.md`)
  - 상세: 코드가 아닌 리뷰 메타 산출물이 이번 커밋(들)에 함께 묶여 있다. `review/` 는 저장소
    관례상 커밋 대상이고, "리뷰 반영 후 마무리 커밋에 review 산출물을 함께 넣는다"는 패턴은 이미
    확립돼 있어(plan-checkbox·`complete/` 이동과 같은 성격의 마무리 동작) 스코프 위반은 아니다.
    다만 코드 변경 diff 를 읽는 사람 입장에서 15개 코드/plan 파일 사이에 11개 비-코드 리포트가
    섞여 diff 규모가 커 보일 수 있다는 점만 관측해 둔다.
  - 제안: 조치 불요.

## 스코프 정합성 확인 (plan 자기 서술 대비 실제 diff)

- `User` 필드 7건(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·
  `passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`) + `Schedule.nextRunAt` 1건 =
  plan 이 주장하는 "8필드"와 일치.
- 캐스트 제거 8건(`auth.service.ts` 2쌍·`totp.service.ts` 1건·`schedule-runner.service.ts` 1건·
  `schedules.service.ts` 1건·`users.service.ts` 1건)도 plan 의 "캐스트 8건 제거" 주장과 일치.
- 이번 diff 에 새로 추가된 `type: 'varchar'` 4건(`passwordHash`·`twoFactorSecret`·
  `emailVerifyToken`·`passwordResetToken`)은 plan 문서 자체가 "배치 1을 커밋한 뒤 e2e 가 부팅
  실패를 냈다"고 기록한 실측 CRITICAL 을 그대로 반영한 정정이며, RESOLUTION.md 가 이를 "이 커밋에
  흡수했다"고 명시한다 — 문서·코드·리뷰 산출물 세 축이 서로 정합적이다.
- `auth.service.spec.ts`·`schedule-runner.service.spec.ts`·`schedules.service.spec.ts`·
  `users-login-attempts.service.spec.ts` 에 추가된 신규 테스트는 각각 리뷰 W2/W3/W4 로 지목된
  "null 대입 분기 미검증" 을 정확히 겨냥하며, 기존 테스트를 리팩터링하거나 무관한 케이스를
  건드리지 않고 새 `it()` 블록만 추가했다.
- `user.entity.ts` 의 `oauthProvider`/`oauthProviderId`(둘 다 `nullable: true` 인데 non-null
  타입으로 그대로 남음)는 plan 이 "배치 2"로 명시적으로 이월한 항목이라 손대지 않은 것이 스코프
  이탈이 아니라 정확히 선언된 경계 준수다.
- 무관한 모듈(다른 컨트롤러·DTO·프론트엔드)·설정 파일 변경, 불필요한 import 정리, 의도치 않은
  주석 변경은 발견되지 않았다.

## 요약

이 diff 는 plan 문서(`entity-nullable-column-type-mismatch.md`)가 스스로 선언한 배치 1 범위(8필드
타입 확장 + 캐스트 8건 제거)와 그 배치를 검토한 직전 리뷰 라운드가 지목한 CRITICAL 1건·WARNING
4건에 대한 조치를 정확히 반영하며, 필드 수·캐스트 수·테스트 신설 위치가 plan/RESOLUTION 문서와
전부 일치한다. 새로 추가된 회귀 가드 2파일은 엄밀히는 "타입 확장 + 캐스트 제거"를 넘는 부가
산출물이지만 이 배치 자체가 만든 위험(ratchet 사각지대, 부팅 실패 재발)을 그 자리에서 막는 것으로
plan 문서에 근거가 상세히 기록돼 있고 저장소의 기존 guard+spec 관례를 그대로 따라 over-engineering
으로 보기 어렵다. 직전 리뷰 라운드의 산출물 11개가 같은 diff 에 포함된 것도 `review/` 산출물을
마무리 커밋에 함께 담는 저장소 관례에 부합해 위반이 아니다. 무관한 파일·포맷팅 드라이브바이·불필요한
주석/임포트 변경은 발견되지 않았다(단 1건의 3줄→1줄 포맷 축약은 캐스트 제거의 직접 결과로 지적
실익이 낮다).

## 위험도

LOW
