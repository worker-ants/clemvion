# 변경 범위(Scope) 리뷰 — Batch 1 (`entity-nullable-column-type-mismatch`)

## 사전 확인

- 브랜치: `git branch --show-current` → `claude/entity-nullable-batch1` (별도 브랜치). 최근 커밋
  `7ce4fa92a refactor(entity): nullable 컬럼인데 non-null 이던 타입 8건 — 캐스트 8건이 사라졌다`.
  base 는 `af41a3c6e feat(auth): change-password 실패 코드를 형제 흐름과 정렬 (#1269)` 이 이미
  머지된 지점 — 즉 **change-password 코드 정렬 작업과는 물리적으로 분리된 브랜치**다. 리뷰 대상
  plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`)가 스스로 명시한
  "`#1269` 범위 밖이라 섞지 않는다" 는 경계가 실제로 지켜졌다.
- `git diff --stat origin/main...HEAD` 로 대조 — 프롬프트에 주어진 11개 파일과 **정확히 일치**
  (265 insertions / 23 deletions, 11 files). 프롬프트 밖에 숨은 추가 파일 변경은 없다.
- **저장소 이상 상태 관측**: `git status --short` 결과 `codebase/backend/src/modules/users/entities/user.entity.ts`
  가 **커밋되지 않은 상태로 dirty** 하다. 실제 diff 확인 결과 `passwordHash`·`twoFactorSecret`·
  `emailVerifyToken`·`passwordResetToken` 4개 컬럼에 `type: 'varchar'` 옵션이 추가돼 있다. 이
  변경은 review 프롬프트가 준 diff(`origin/main...HEAD`)에 **포함돼 있지 않다** — 즉 이번에 검토할
  커밋의 일부가 아니라 워킹트리의 미커밋 잔여물이다. 병렬 리뷰 프로토콜에 따라 이 파일에 손을 대지
  않았고 원복 시도도 하지 않았다(내가 만든 변경이 아니라 원본을 모른다). 이 상태를 그대로 보고한다
  — 다른 reviewer 의 프로브 잔여물일 수도, 실제 후속 작업 중인 미커밋 변경일 수도 있다. **이 리뷰의
  등급 판정에는 반영하지 않는다**(리뷰 대상 diff 밖).

## 발견사항

- **[INFO]** 회귀 가드 2개 파일 신규 추가 — "타입 넓히기 + 캐스트 제거" 라는 핵심 작업 대비 부가 산출물
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (신규 파일 전체),
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (신규 파일 전체)
  - 상세: 이번 배치의 본질은 "캐스트를 강제하던 8개 필드 타입을 넓히고 캐스트 8건을 제거"다. 여기에
    더해 같은 버그 클래스의 재발을 막는 정적 스캔 가드(파서 로직 파일 + spec 파일, `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168` 에 추가된
    `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 를 소비)가 함께 들어갔다. 엄밀히는 "요청된
    범위(캐스트 제거)" 를 넘어서는 부가 기능(회귀 방지 인프라)이라 원칙적으로 스코프 체크 대상이지만,
    (1) `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "## 회귀 가드 — 이 클래스는
    이제 스스로 닫힌다" 절에 명시적으로 근거가 문서화돼 있고, (2) 손수 새 정규식을 짜지 않고 저장소에
    이미 있는 형제 술어(`hasRawUpdateReturning`)·형제 가드(`masked-reject-callers-guard.ts`,
    `eslint-unicorn-peer-guard.ts`)와 동일한 guard+spec 2파일 관례를 그대로 따랐으며, (3) 바로 이
    변경이 만드는 위험(캐스트를 다시 넣어도 어떤 게이트도 못 본다는 사실 — ratchet 이 비-spec 소스를
    안 본다는 실측까지 문서화)을 직접 닫는 것이라 "요청하지 않은 기능 추가"라기보다 "이 변경이 열어
    둔 구멍을 그 자리에서 막는" 성격에 가깝다. over-engineering 으로 보기엔 근거가 탄탄해 INFO 로 낮춘다.
  - 제안: 별도 조치 불요. 다만 향후 배치(2·3…)에서도 매번 새 가드를 만들 필요는 없다는 점을
    plan 문서가 이미 인지하고 있는지(`countNullAsUnknownAsCasts` 가 필드 단위가 아니라 전체 패턴을
    보는 범용 가드이므로 배치 2/3 에는 가드 추가가 불필요함) 확인 권장.

- **[INFO]** `schedules.service.ts` 의 3줄 대입문이 1줄로 축약됨 — 포맷팅처럼 보이는 변경
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241`
  - 상세: `schedule.nextRunAt = nextRun ? new Date(nextRun) : (null as unknown as Date);` (3줄)
    → `schedule.nextRunAt = nextRun ? new Date(nextRun) : null;` (1줄). 캐스트 제거로 줄 길이가
    짧아져 prettier 가 자동으로 한 줄로 합친 것으로 보이며, 실질 변경(캐스트 제거)과 줄바꿈 변경이
    분리되지 않고 하나의 diff hunk 에 섞여 있다. 다만 변경된 유일한 실질 내용이 캐스트 제거이고
    포맷팅도 그 결과로만 발생한 것이라 별도 지적할 실익은 낮다.
  - 제안: 없음(정보 제공용).

## 스코프 정합성 확인 (플랜 자기 서술 대비 실제 diff)

- User 필드 7건: `passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·
  `passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil` — `user.entity.ts` diff 와 정확히
  일치(`codebase/backend/src/modules/users/entities/user.entity.ts:22,40,71,78,81,88,130`).
- Schedule 필드 1건: `nextRunAt` — `schedule.entity.ts:42` 와 일치.
- 캐스트 제거 8건: `auth.service.ts` 4건(:233-234, :752-753) + `totp.service.ts` 1건(:124) +
  `schedule-runner.service.ts` 1건(:190) + `schedules.service.ts` 1건(:241) + `users.service.ts`
  1건(:387) = 8건, plan 문서가 주장하는 "캐스트 8건이 사라졌다" 와 정확히 일치.
- `user.entity.ts` 의 `oauthProvider`/`oauthProviderId`(둘 다 `nullable: true` 인데 non-null
  타입, :133/:136 문맥에 그대로 남음)는 이번 diff 에서 **손대지 않았다** — plan 문서가 "배치 2"로
  명시적으로 이월한 항목이라 스코프 이탈이 아니라 정확히 선언된 경계 준수다.
- plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`) 수정분은 이번 배치
  자체의 의사결정·완료 기록·다음 배치 기준(체크리스트)만 담고 있고, 다른 트래커·spec 파일을
  건드리지 않았다.
- 관련 없는 파일(다른 모듈·컨트롤러·DTO·프론트엔드 등) 수정은 없다. import 정리·불필요한 주석
  변경·설정 파일 변경은 발견되지 않았다.

## 요약

11개 파일 diff 는 plan 문서가 스스로 선언한 "배치 1 — 캐스트를 강제하던 8필드(User 7 + Schedule 1)
타입 확장 + 캐스트 8건 제거" 범위와 필드 수·캐스트 수·파일 목록이 정확히 일치하며, 이전 작업
(`change-password` 코드 정렬, #1269)과는 별도 브랜치(`claude/entity-nullable-batch1`)로 물리적으로
분리돼 plan 문서가 명시한 스코프 경계("타입 확장은 그 범위 밖")가 실제로 지켜졌다. 새로 추가된
회귀 가드 2파일은 엄밀히는 "타입 확장 + 캐스트 제거"를 넘어서는 부가 산출물이지만, 이 변경이 여는
구멍(ratchet 사각지대)을 그 자리에서 막는 것으로 plan 문서에 근거가 상세히 기록돼 있고 저장소의
기존 guard+spec 관례를 그대로 따르므로 over-engineering 으로 보기 어렵다. 무관한 파일·포맷팅
드라이브바이·불필요한 주석/임포트 변경은 발견되지 않았다. 별도로, 리뷰 대상 diff 밖에서 `user.entity.ts`
에 미커밋 `type: 'varchar'` 변경이 관측됐으나 이는 이번 커밋의 일부가 아니므로 등급에 반영하지 않고
사실만 보고한다.

## 위험도

LOW
