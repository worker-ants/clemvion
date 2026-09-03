# 변경 범위(Scope) 리뷰 — Batch 1 4라운드 누적 diff (`entity-nullable-column-type-mismatch`)

## 사전 확인 (독립 재검증)

- `git branch --show-current` → `claude/entity-nullable-batch1`. base 는 `af41a3c6e`
  (`#1269` change-password 코드 정렬, 이미 `origin/main` 에 머지됨) — 이 배치와
  `change-password` 작업은 물리적으로 분리된 브랜치다. `plan/in-progress/entity-nullable-column-type-mismatch.md`
  가 스스로 명시한 "`#1269` 범위 밖이라 섞지 않는다" 는 경계가 실제로 지켜졌다.
- `git diff --stat origin/main...HEAD` 로 직접 재계산 — **57 files changed, 4051 insertions(+),
  27 deletions(-)**. 프롬프트가 준 파일 목록(파일 1~57)과 정확히 일치한다.
- `git diff --stat origin/main...HEAD --name-only | grep -v '^review/'` 로 "실질 코드/plan 변경"
  만 추려 재검증 — **정확히 15개**(코드 14 + `plan/in-progress/entity-nullable-column-type-mismatch.md`
  1개). 이 15개는 1R(`review/code/.../14_44_15`)부터 지금까지 **파일 집합이 그대로 고정**돼 있다 —
  라운드가 거듭돼도 실질 변경 표면이 넓어지지 않았음을 이번 라운드에서도 재확인.
- `git log --oneline` 으로 확인한 4개 커밋: `7ce4fa92a`(배치 1 본체) → `40fa58b8f`(1R CRITICAL
  수정 — `type: 'varchar'` 4건 + 회귀 가드) → `52ca3128a`(2R WARNING/INFO 수정) →
  `e78b6dbad`(3R INFO 2건 수정, 이번 라운드에 새로 추가된 유일한 코드 커밋).
- `git show e78b6dbad -- codebase/ plan/` 로 최신 커밋을 단독 대조 — 실제로 건드린 자리는
  **딱 2줄**: `auth.service.spec.ts` 에 `expect(usersService.update.mock.calls[0][0]).toBe('user-uuid')`
  1줄 추가, `schedules.service.spec.ts` 테스트 제목을 `[방어 분기]` 로 바꾸고 docstring 에
  "도달 불가" 사실을 4줄 보강. 커밋 메시지가 예고한 범위(INFO#1 서술 정정 · INFO#5 대상 id
  단언 추가) 밖의 변경은 없다.
- **배치 2 로 명시 이연된 두 항목이 실제로 손대지 않은 채 남아 있는지** 직접 grep 으로 확인:
  - `schedule.entity.ts:45` → `lastRunAt: Date;` (여전히 non-null, 이연 (d) 항목 그대로)
  - `auth.service.spec.ts:58` → `lockedUntil: null as unknown as Date,` (여전히 낡은 캐스트,
    이연 (e) 항목 그대로)

  plan 문서가 "배치 1 은 캐스트 강제 8필드만" 이라 선언한 경계를 **이번 라운드까지 포함해**
  코드가 실제로 지키고 있다 — 인접한 유사 결함을 "손댄 김에" 같이 고치는 스코프 크립이 없었다.

## 발견사항

- **[INFO]** 코드 대 리뷰/일관성-산출물 비율이 라운드를 거듭할수록 계속 커진다(1R 11 → 2R 26 →
  3R 46 → 4R 57 파일 중 실질 코드/plan 변경은 여전히 15개로 고정)
  - 위치: 파일 목록 전체(실질 변경 15개: 파일 1~15 / 리뷰·consistency 산출물 42개: 파일 16~57)
  - 상세: 1R·2R·3R scope 리뷰가 동일 항목을 이미 INFO 로 낮춰 판단했고("review/** 는 이 저장소가
    확립한 SoT 산출 위치이자 CLAUDE.md 저장 위치표에 명시된 관례"), 이번 라운드에도 새로 늘어난
    11개(3R 자신의 리뷰 산출물 `review/code/.../15_36_03/*`)가 그 패턴을 그대로 반복할 뿐 다른
    성격이 아니다. 스코프 위반은 아니되, 배치가 `complete/` 로 이동할 시점에 "무엇이 실제로
    바뀌었는가"를 판단하려는 사람은 여전히 파일 1~15 만 보면 된다는 점을 재확인해 둔다.
  - 제안: 조치 불요. 기존 3라운드 판단 유지.

- **[INFO]** 신규 가드 2파일(`nullable-type-lie-cast-guard.ts`/`.spec.ts`)은 "캐스트 제거 +
  타입 확장" 이라는 배치 1 본질을 넘어서는 부가 산출물이지만, 근거가 plan 문서(§"회귀 가드 —
  이 클래스는 이제 스스로 닫힌다")에 상세히 기록돼 있고 저장소의 기존 guard+spec 관례
  (`masked-reject-callers-guard.ts` 등)를 그대로 따른다 — 1R 스코프 리뷰가 이미 이 판단을
  내렸고 이번 라운드에도 새로 뒤집을 근거가 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (신규 파일 전체)
  - 제안: 조치 불요.

## 스코프 정합성 확인 (plan 자기 서술 대비 실제 diff, 4라운드 누적 기준)

- User 필드 7건 + Schedule 필드 1건(`nextRunAt`) 타입 확장, 캐스트 8건 제거, `type: 'varchar'`
  4건 보강, 회귀 가드 2파일, null 대입 분기 테스트 5건 — 필드 수·캐스트 수·파일 목록이 이번
  라운드의 직접 재계산과도 정확히 일치한다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 수정분은 배치 1 자체의 결정·완료
  기록·후속 항목(§2.9 문서 정정은 developer 권한 밖이라 **명시적으로 planner 턴 이관**, 공용
  walker 추출 이연, 배치 2 후보 (a)~(e) 이름 등재)에 국한되며 다른 트래커·spec 파일을 건드리지
  않는다.
- 무관한 모듈(다른 컨트롤러·DTO·프론트엔드 등) 수정, drive-by import 정리, 불필요한 주석/포맷팅
  변경은 파일 1~15 전체에서 발견되지 않았다. 3R 의 유일한 코드 diff(`e78b6dbad`)도 예고된 두
  자리(테스트 docstring 정정 + 단언 1줄)에 정확히 국한됨을 직접 확인했다.

## 요약

4라운드 누적 diff(57개 파일, 4051+/27- 라인)의 실질 코드·plan 변경은 여전히 15개 파일로 고정돼
있고, plan 문서가 스스로 선언한 "배치 1 — 캐스트를 강제하던 8필드 타입 확장 + 캐스트 8건 제거"
범위와 필드 수·캐스트 수가 정확히 일치한다. 이번 라운드에 새로 추가된 유일한 코드 커밋
(`e78b6dbad`)도 직접 대조한 결과 예고된 범위(테스트 docstring 서술 정정 1건 + 단언 1줄 추가)에
정확히 국한됐다. "배치 2" 로 명시 이연된 두 인접 항목(`Schedule.lastRunAt` 비대칭,
`auth.service.spec.ts:58` 의 낡은 캐스트)은 이번 라운드까지 실제로 손대지 않은 채 남아 있음을
grep 으로 직접 확인해, 인접 결함을 "손댄 김에" 같이 고치는 스코프 크립이 없었음을 재확인했다.
나머지 42개 파일은 세 차례 코드 리뷰 라운드 및 한 차례 consistency-check 의 산출물이며, 이를
마무리 커밋에 함께 싣는 것은 이 저장소의 확립된 관례(`review/**` 는 CLAUDE.md 가 지정한 SoT
산출 위치)로 1R·2R·3R scope 리뷰가 이미 위반이 아니라고 판단했고 이번 라운드도 독립적인 재검증
(git diff 직접 재계산, 최신 커밋 단독 대조, 이연 항목 미접촉 확인)을 통해 같은 결론에 도달했다.
change-password 작업(`#1269`)과는 별도 브랜치로 물리적으로 분리돼 있어 스코프 혼입도 없다.
무관한 파일·포맷팅 드라이브바이·불필요한 주석/임포트 변경은 발견되지 않았다.

## 위험도

LOW
