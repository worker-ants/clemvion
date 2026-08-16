# 변경 범위(Scope) Review

## 리뷰 범위

이번 라운드(`11_04_07`)는 브랜치 `claude/eia-terminal-error-sanitize-audit` 전체의 누적 diff(vs
`origin/main`, `git diff origin/main --stat` 로 직접 확인 — 56개 파일, `+3532/-11`)를 대상으로 한다.
이 브랜치는 이미 3차례의 `/ai-review` 라운드(`09_51_00` → `10_19_30` → `10_41_55`)를 거쳤고, 직전
라운드(`10_41_55`)의 RESOLUTION.md 는 "3라운드 만에 발견의 성격이 실제 결함 → 문서/검증 주장 →
주석·spec 미러 로 수렴했다. codebase 편집을 멈춘다" 로 결론 내렸다. 본 라운드는 그 결론 이후 실제로
추가된 마지막 커밋(`fb4a70b72`)까지 포함한 전체 diff 를 대상으로 독립 재검증한다.

핵심 코드 변경은 여전히 **4개 파일**로 좁다 (`git diff origin/main -- codebase/` 직접 대조):

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설,
  `toTerminalErrorPayload()` 의 4개 반환 경로 전부에 적용. diff 를 직접 읽어 확인 — 새 함수 삽입 +
  기존 4개 `return` 문을 `redactTerminalError(...)` 로 감싸는 것 외에 기존 로직·분기 구조·조건문은
  1바이트도 바뀌지 않았다.
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 추가.
  이번 라운드에서 새로 늘어난 델타는 `fb4a70b72` 커밋의 3줄 주석(`details 가 없으면 키를 만들지
  않는다` 테스트 바로 위)뿐이며, 이는 직전 라운드(`10_41_55` maintainability WARNING — "두 완전
  동일 중복 단언 중 한쪽에만 의도 주석이 달려 비대칭") 를 정확히 겨냥한 fix 다.
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만.
  `git diff origin/main` 대조 결과 로직·정규식·함수 시그니처 변경 0줄, 주석 블록 교체뿐.
- `CHANGELOG.md` — wire 바이트 변화 고지 `## Unreleased` 항목 신설 + 기존(#1174) 항목의 절 번호
  오인용(§3.3→§3.1) 정정.

나머지 52개 파일은 두 그룹이다:

1. `plan/in-progress/eia-terminal-error-sanitize.md`(신규, 조치 목록이 위 4개 코드 변경과 1:1
   대응)·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신 + 잔여 갭 등재).
   이번 라운드에서 새로 늘어난 델타(`fb4a70b72`)는 미완성 문장 하나를 완결한 것뿐 — `git show
   fb4a70b72 -- plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 직접 대조: "blast
   radius 가 다른 별건" → "blast radius 가 다른 별건**이다**. 승격 시 그 소비자들의 회귀 테스트를
   선행해야 한다" — 술어 없이 끊긴 문장을 지적한 직전 라운드(`10_41_55` documentation INFO)에 대한
   fix 다.
2. `review/code/2026/08/16/{09_51_00,10_19_30,10_41_55}/**`, `review/consistency/2026/08/16/
   {09_25_29,10_19_31}/**` — 이 세션이 실제로 거친 3회의 `/ai-review` + 2회의 consistency-check
   산출물. `CLAUDE.md` skill 권한표상 `review/**`·`plan/**` 는 developer/consistency-checker 의
   명시된 쓰기 대상이며 워크플로 자체가 요구하는 정상 기록이다 — 스코프 확장이 아니다.

## 발견사항

(없음)

이전 세 라운드가 남긴 scope 관련 지적은 모두 해소가 코드로 재확인된다:

- `09_51_00` scope.md WARNING(신규 `redactTerminalError` JSDoc 삽입이 `toTerminalErrorPayload` 의
  기존 `@param`/`@returns` 블록을 궤도 이탈시켰다) — 현재 파일(`terminal-error-payload.ts`)을 직접
  읽어 재확인: `redactTerminalError` 의 JSDoc(47~105행) + 함수 본문(107~115행)이
  `toTerminalErrorPayload` 의 `@param err`/`@returns` 블록(117~121행)보다 **앞**에 오고, 그 블록은
  `toTerminalErrorPayload` 선언(122행) 바로 위에 인접해 정상 귀속된 상태를 유지한다.
- `10_41_55` maintainability WARNING(중복 단언 2건 중 한쪽만 주석이 달려 비대칭) — `fb4a70b72` 의
  3줄 diff 로 해소가 정확히 그 지점(spec.ts, `details 가 없으면 키를 만들지 않는다` 테스트 바로
  위)에 적용됐음을 확인.
- `10_41_55` documentation INFO(plan 문서 문장이 술어 없이 끊김) — `fb4a70b72` 의 plan diff 로
  해소가 정확히 그 지점(같은 bullet, 같은 줄)에 적용됐음을 확인.

## 점검 관점별 확인

1. **의도 이상의 변경**: 없음. 마지막 커밋(`fb4a70b72`)은 스스로 밝힌 범위(직전 라운드 WARNING/INFO
   fix + 그 라운드 자신의 리뷰 산출물 커밋) 를 정확히 벗어나지 않는다 — `git show --stat fb4a70b72`
   로 대조한 14개 파일 중 코드 변경은 `terminal-error-payload.spec.ts` 3줄, plan 문서 1줄 교체뿐이고
   나머지 12개는 `review/code/2026/08/16/10_41_55/**` 산출물이다.
2. **불필요한 리팩토링**: 없음. `sanitize-error-message.ts` 는 docstring 만, `terminal-error-payload.ts`
   는 새 헬퍼 추가 + 4개 반환문 래핑 외 기존 관용구(`if (src.details !== undefined) out.details = …`
   같은 명령형 optional-키 생략)에 손대지 않았다 — 이전 라운드가 지적한 "관용구 두 스타일 혼재"는
   의도적으로 무조치 확정된 사안(diff 확대 회피 근거가 RESOLUTION.md 에 명시)이다.
3. **기능 확장**: 없음. `redactTerminalError` 는 기존 `deepRedactSecrets`(이번 diff 로 변경되지
   않음)를 재사용할 뿐 새 정규식·새 설정·새 API 를 만들지 않는다. "자격증명 없는 연결 문자열까지
   넓힐지"는 plan/JSDoc/CHANGELOG 세 곳에 일관되게 별도 PR 로 명시 분리돼 있다.
4. **무관한 수정**: 없음. `git diff origin/main --stat` 의 56개 파일 전부가 이번 작업(종결 `error`
   egress 마스킹)의 코드 변경·추적 문서·리뷰 워크플로 산출물 중 하나에 속한다. config/CI/무관 모듈
   변경은 목록에 없다.
5. **포맷팅 변경**: 미검출. 핵심 파일 두 곳(`terminal-error-payload.ts`, `sanitize-error-message.ts`)
   의 diff 를 직접 대조 — 신규 블록 삽입 외 기존 코드 라인의 재포맷(들여쓰기·따옴표·개행 스타일)은
   섞여 있지 않다.
6. **주석 변경**: 신규 JSDoc 분량이 크지만 전부 설계 근거·실측표·검증 범위·잔여 갭을 담아 이번
   세션의 리뷰 피드백에 1:1 대응한다. 관련 없는 주석 추가/삭제는 없다.
7. **임포트 변경**: `terminal-error-payload.ts` 에 `import { deepRedactSecrets } from
   './sanitize-error-message'` 1건 추가 — 함수 본문에서 실제로 호출되어 사용되고, 순환참조 우려도
   대상 파일의 import 0줄을 실측 확인한 근거 주석과 함께 배치돼 있다. 미사용 임포트·불필요한 정리
   없음.
8. **설정 변경**: 없음. `.eslintrc`·`tsconfig`·`package.json`·CI 워크플로 등 설정 파일은 이번 diff
   56개 파일 목록에 없다.

## 요약

이 브랜치는 4개 커밋(`23d1148d5`→`a50a5764e`→`7badf0318`→`fb4a70b72`)에 걸쳐 시작부터 끝까지
"EIA 종결 이벤트 `error.message`/`details` 의 egress 시점 secret 마스킹 부재"라는 단일 결함만
다룬다. 핵심 코드 변경은 4개 파일(마스킹 헬퍼 1개 신설 + 4개 반환 경로 배선, docstring 정정,
테스트, CHANGELOG)로 세 라운드 내내 일관되게 좁게 유지됐고, `git diff`/`git show` 로 직접 대조한
결과 이번 라운드까지 새로 편입된 델타(`fb4a70b72`)도 직전 라운드가 지적한 WARNING/INFO 2건에 대한
정밀 fix(주석 3줄, 문장 완결 1곳)와 그 라운드 자신의 리뷰 산출물 커밋뿐이다. 나머지 52개 파일은
`plan/**`·`review/**` 에 쓰도록 프로젝트가 명시적으로 규정한 워크플로 산출물이며, 이번 작업이
요구한 조치와 1:1 대응해 스코프 확장으로 볼 근거가 없다. 이전 세 라운드의 scope 리뷰가 지적한
유일한 흠(JSDoc 궤도 이탈)도 해소가 코드로 재확인된다. 새로운 scope 위반은 발견되지 않았다.

## 위험도
NONE
