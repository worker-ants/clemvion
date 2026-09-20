# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done)

## 검토 방법

- diff-base `origin/main` 대비 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/schedule-cron-flake-2f9a4c`)를
  절대경로로 직접 확인했다: `git diff origin/main --stat`, `git diff origin/main -- codebase/`,
  `git diff origin/main --stat -- spec/`.
- **scope(`spec/2-navigation/`) 델타: 0개 파일** — 실측 확인(`git diff origin/main --stat -- spec/` 무출력). 이번 브랜치는
  spec 을 바꾸지 않았다.
- **구현 diff: 1개 파일** — `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 `describe('Schedule trigger (e2e)')` 안
  기존 `it('D. PATCH cron → nextRunAt 재계산', ...)` 케이스의 **주석 추가 + 단언 교체**). prompt 번들에는 diff 본문이 예산으로
  잘려 있었으나, 이는 "구현 없음" 이 아니라 "예산 절단" 임을 프롬프트 자신이 경고하므로 워킹트리를 직접 읽어 실측했다.
- plan 문서 변경 2건도 확인: `plan/in-progress/schedule-cron-flake.md`(신규) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(항목 추가).

## 변경 내용 요약 (신규 식별자 유무 판정 근거)

diff 전문(`git diff origin/main -- codebase/backend/test/schedule-trigger.e2e-spec.ts`)을 실측한 결과:

- 새로 추가된 것은 **주석(JSDoc 블록)** 과 **기존 테스트 케이스 내부의 로컬 변수·단언**뿐이다:
  - `cronExpression` 리터럴 값을 `'0 10 * * *'` → `'0 0 1 1 *'` 로 교체 (같은 파일의 기존 E 케이스가 이미 쓰는 값 — 신규 상수 아님).
  - 로컬 변수 `originalNext` 제거, `patchedAt`(테스트 함수 스코프 지역 변수) 추가.
  - 단언을 `not.toBe(originalNext)` 에서 `nextRunMs` 범위 비교(`toBeGreaterThan` / `toBeLessThanOrEqual`) + `getUTCSeconds()` 비교로 교체.
- 기존 `it(...)` 블록·`describe(...)` 블록 이름, API 경로(`POST /api/schedules`, `PATCH /api/schedules/:id`), DTO/엔티티명, 이벤트명,
  ENV var, 설정 키, 파일 경로는 **하나도 신설되지 않았다** — 전부 기존 스펙(`spec/2-navigation/3-schedule.md`)이 이미 문서화한
  것을 그대로 재사용한다.
- `plan/in-progress/schedule-cron-flake.md`(신규 plan 파일)는 `plan/` 명명 컨벤션(`<slug>.md`, frontmatter `title/status/owner/worktree/started/spec_impact`)을 그대로 따르고, 기존 plan 파일명과 겹치지 않는다 (`plan/in-progress/`, `plan/complete/` 어디에도 `schedule-cron-flake.md` 동일명 기존 파일 없음 — 실측: 신규 파일로 diff 에 `new file mode` 로 잡힘).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 기존 트래커 문서에 체크리스트 항목 2건을 추가한 것으로, 새 식별자를 도입하지 않는다(기존 `NAV-WF-02`/`NAV-WF-06` ID 를 **참조**만 함 — 재정의 아님).

## 점검 관점별 판정

1. **요구사항 ID 충돌** — 신규 ID 부여 없음. `NAV-WF-02`/`NAV-WF-06` 은 트래커 항목에서 기존 의미 그대로 참조된다. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 테스트가 호출하는 `POST /api/schedules` · `PATCH /api/schedules/:id` 는 `spec/2-navigation/3-schedule.md` §API 에 이미 정의된 기존 endpoint 다. 해당 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 이름 신설 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var/config key 없음. 해당 없음.
6. **파일 경로 충돌** — 변경된 유일한 코드 파일은 기존 파일(`schedule-trigger.e2e-spec.ts`)이고, 신규 plan 파일(`schedule-cron-flake.md`)은 컨벤션을 따르며 기존 파일과 겹치지 않는다. 해당 없음.

## 발견사항

없음.

## 요약

이번 diff 는 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 기존 e2e 케이스 하나를 대상으로 한 **테스트 전용 수정**(주석 추가 + 판정 로직을 「값이 달라졌는가」에서 「새 cron 이 만드는 값인가」로 교체)이며, `spec/2-navigation/` 자체는 변경되지 않았다(델타 0, 실측 확인). 새로 도입된 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로가 전무하므로 신규 식별자 충돌 관점에서 볼 대상이 없다. 함께 변경된 plan 문서 2건도 기존 트래커 참조·컨벤션 준수 신규 파일일 뿐 식별자 신설이 아니다.

## 위험도

NONE
