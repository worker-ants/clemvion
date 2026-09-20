# 보안(Security) 리뷰

## 발견사항

없음.

이번 changeset(파일 44개)의 실질 코드 변경은 `codebase/backend/test/schedule-trigger.e2e-spec.ts`
「D. PATCH cron → nextRunAt 재계산」 케이스 하나뿐이다 — 생성 cron 리터럴 교체(`'0 10 * * *'` →
`'0 0 1 1 *'`)와, PATCH 응답의 `nextRunAt` 이 요청 시각 기준 시간창 안이며 분 경계(`getUTCSeconds() === 0`)인지
보는 판별 단언 추가다. 나머지 43개 파일은 전부 `plan/in-progress/**`(작업 트래커) 또는
`review/code/**`·`review/consistency/**`(1~3라운드 리뷰·컨시스턴시 산출물) — 이 저장소의 워크플로 관례가
요구하는 프로세스 부산물이며 실행되는 애플리케이션 코드가 아니다. 서비스·컨트롤러·엔티티·인증 미들웨어·DB
쿼리·의존성 매니페스트 어느 것도 이번 diff 에 포함되지 않는다.

점검 관점별 확인:

1. **인젝션** — 변경분은 하드코딩된 cron 리터럴(`'0 0 1 1 *'`, `'*/1 * * * *'`)과 `Date.now()` 기반 타임스탬프
   비교만 추가한다. `scheduleId` 는 직전 `POST /api/schedules` 응답의 `create.body.data.id` 를 그대로
   템플릿 리터럴로 URL 경로에 넣는데(`` `/api/schedules/${scheduleId}` ``), 이는 서버가 생성해 반환한 UUID/ID 이지
   외부에서 임의 조작 가능한 사용자 입력이 아니며, 이 파일의 다른 케이스들도 동일한 패턴을 이미 쓰고 있다(신규
   패턴 아님). 파일 내 raw SQL 조회도 파라미터 바인딩(`$1`)을 쓴다. 커맨드 실행·경로 조합·LDAP 질의 등 인젝션
   표면 없음.
2. **하드코딩된 시크릿** — 변경분·plan 문서·리뷰 산출물 전체를 확인했으나 실제 자격증명 값은 없다. `token`
   언급은 전부 기존 `authHeaders()` 헬퍼 재사용 또는 문서 서술이다. `_retry_state.json` 에 워크트리 절대경로가
   박혀 있으나(orchestrator 표준 포맷, 기존 관례) 이는 시크릿이 아니라 로컬 파일시스템 경로다.
3. **인증/인가** — 신규 request 두 건(`POST /api/schedules`, `PATCH /api/schedules/:id`) 모두 기존
   `authHeaders()` 헬퍼(`Authorization: Bearer` + 워크스페이스 헤더)를 그대로 재사용하며, 인증/인가 로직 자체나
   권한 검증 경로는 손대지 않았다.
4. **입력 검증** — 테스트 코드이며 외부 입력을 받는 지점이 아니다. cron 리터럴 교체는 서버 측 cron 파서
   취약점과 무관한, 테스트 시나리오의 시간 충돌(flake) 회피 목적이다.
5. **OWASP Top 10** — 해당 없음. 프로덕션 코드 경로 변경이 없다.
6. **암호화** — 해당 없음. 신규 해시·암호화·평문 전송 로직 없음.
7. **에러 처리** — 새로 추가된 것은 `expect(...).toBeGreaterThan(...)` / `toBeLessThanOrEqual(...)` /
   `toBe(0)` 단언뿐이며, 에러 메시지 조립이나 스택트레이스 노출 관련 변경은 없다.
8. **의존성 보안** — `package.json`/lockfile 등 의존성 매니페스트 변경 없음.

`plan/in-progress/schedule-cron-flake.md` 는 이 flake 수정의 배경(cron 겹침 시각 창)을 기록한 문서로 보안과
무관하며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 두 항목(NAV 상태 불일치,
cron 재계산 happy-path 단위 테스트 부재)도 각각 문서 정합성·테스트 커버리지 사안으로 보안 취약점을 시사하지
않는다. 3개 리뷰 라운드(`11_54_10`·`12_17_18`·`12_45_31`)의 이전 security.md 도 매 라운드 NONE 을 냈고, 이번
최종 형태(옛 값 비교를 완전히 제거하고 「새 cron 이 만드는 값인가」 단일 판정으로 수렴)를 검토해도 그 결론을
뒤집을 근거가 없다.

뮤테이션(재현용 코드 수정)은 수행하지 않았다 — 보안 관점에서 재현이 필요한 가설이 없었다. `git status --short`
로 저장소에 잔여 변경이 없음을 확인했다(이 세션이 아무것도 쓰지 않았다).

## 요약

이번 changeset 은 backend e2e 테스트 한 케이스의 cron 리터럴·시간창 단언을 재구성한 순수 테스트 수정과, 그
과정을 기록한 plan/리뷰 산출물 43개로 구성된다. 애플리케이션 코드·인증/인가·데이터 접근 경로·의존성 어느 축에도
변경이 없어 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화·민감정보 노출·취약 의존성 등 보안 관점에서
지적할 사항을 찾지 못했다.

## 위험도

NONE
