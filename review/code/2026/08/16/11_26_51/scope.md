# 변경 범위(Scope) Review

## 리뷰 범위

`git diff origin/main...HEAD --stat` 로 직접 대조 — 67개 파일, `+4736/-11`. 브랜치
`claude/eia-terminal-error-sanitize-audit` 는 이미 3차례의 `/ai-review`(`09_51_00`→`10_19_30`→
`10_41_55`)와 1차례의 comment-only 재트리거 리뷰(`11_04_07`)를 거쳤고, 이번 라운드(`11_26_51`)는
그 뒤 추가된 마지막 커밋 `5d4d8dab7`("총칭을 열거로 바꿨다")까지 포함한 전체 누적 diff 를
대상으로 독립 재검증한다.

핵심 코드 변경은 여전히 **4개 파일**로 좁다(`git diff origin/main...HEAD -- CHANGELOG.md
codebase/...` 직접 대조):

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설 +
  `toTerminalErrorPayload()` 의 4개 반환 경로 전부에 적용. 기존 분기 구조·조건문·`if (src.details
  !== undefined) out.details = …` 관용구는 1바이트도 안 바뀌었다.
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀/음성 테스트
  8건 추가, 기존 스위트는 무변경.
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정뿐.
  마지막 커밋(`5d4d8dab7`)이 이 파일을 다시 건드렸지만 산문("호출부 3곳 전부 알림 조립") →
  표(호출부별 무엇에 쓰는지 열거)로 **서술 형식만** 바꿨다 — 정규식·함수 시그니처·로직 변경
  0줄(`git show 5d4d8dab7 -- codebase/` 로 직접 대조).
- `CHANGELOG.md` — wire 바이트 변화 고지 신규 항목 + 기존(#1174) 항목의 절 번호 오인용
  (§3.3→§3.1) 정정.

나머지 63개 파일은 두 그룹이다:

1. `plan/in-progress/eia-terminal-error-sanitize.md`(조치 목록이 위 4개 코드 변경과 1:1 대응,
   `5d4d8dab7` 델타는 체크리스트 항목 2개를 `[x]` 로 갱신한 것뿐)·
   `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(자매 트래커 체크박스 갱신 +
   잔여 갭 등재, 이번 작업이 직접 해소한 항목에 한정).
2. `review/code/2026/08/16/{09_51_00,10_19_30,10_41_55,11_04_07}/**`,
   `review/consistency/2026/08/16/{09_25_29,10_19_31}/**` — 이 세션이 실제로 거친 4회의
   `/ai-review` + 2회의 consistency-check 산출물. `CLAUDE.md` skill 권한표상 `review/**`·
   `plan/**` 는 developer/consistency-checker 의 명시된 쓰기 대상이고 워크플로 자체가 요구하는
   정상 기록이다 — 스코프 확장이 아니다.

## 발견사항

(없음)

이전 라운드들이 남긴 scope 관련 지적은 모두 해소가 코드로 재확인된다:

- `09_51_00` scope.md WARNING(신규 `redactTerminalError` JSDoc 삽입이 `toTerminalErrorPayload` 의
  기존 `@param`/`@returns` 블록을 궤도 이탈시켰다) — 현재 파일을 직접 읽어 재확인:
  `redactTerminalError` 의 JSDoc(47~106행) + 함수 본문(107~115행)이 `toTerminalErrorPayload` 의
  `@param err`/`@returns` 블록(118~121행)보다 **앞**에 오고, 그 블록은 `toTerminalErrorPayload`
  선언(122행) 바로 위에 인접해 정상 귀속을 유지한다.
- `11_04_07` requirement W1(정정한 docstring 도 여전히 과장 — `background-execution.processor`
  가 결과를 WS 에도 싣는데 "전부 알림 조립" 이라고 썼다) — `5d4d8dab7` 이 정확히 이 지점만
  고쳤다. 총칭("전부")을 표 형태 열거로 바꿔 재발 형태 자체를 구조적으로 차단했고, 그 외
  범위(로직·다른 파일)로 새지 않았다.
- `11_04_07` W3(fresh-review 체크박스가 stale 로 미체크) — plan 문서 체크리스트 두 항목만
  `[x]` 로 갱신, 다른 항목·서술은 그대로.

## 점검 관점별 확인

1. **의도 이상의 변경**: 없음. 마지막 커밋(`5d4d8dab7`)은 스스로 밝힌 범위(`11_04_07` W1/W3 fix +
   그 라운드 자신의 리뷰 산출물 커밋)를 정확히 벗어나지 않는다 — `git show --stat 5d4d8dab7` 로
   대조한 13개 파일 중 실질 코드/문서 변경은 `sanitize-error-message.ts` docstring, plan 체크박스
   2줄뿐이고 나머지 11개는 `review/code/2026/08/16/11_04_07/**` 산출물이다.
2. **불필요한 리팩토링**: 없음. `terminal-error-payload.ts` 는 새 헬퍼 추가 + 4개 반환문 래핑
   외 기존 관용구에 손대지 않았다 — "optional-키 생략 스타일 두 가지 혼재"는 이전 라운드에서
   이미 의도적으로 무조치 확정된 사안(RESOLUTION.md 에 근거 명시)이고 이번 라운드도 그대로다.
3. **기능 확장**: 없음. `redactTerminalError` 는 기존 `deepRedactSecrets`(이번 diff 로 로직
   변경되지 않음)를 재사용할 뿐 새 정규식·새 설정·새 API 를 만들지 않는다. "자격증명 없는 연결
   문자열까지 넓힐지"는 plan/JSDoc/CHANGELOG 세 곳에 일관되게 별도 PR 로 명시 분리돼 있다.
4. **무관한 수정**: 없음. `git diff origin/main...HEAD --stat` 67개 파일 전부가 이번 작업(종결
   `error` egress 마스킹)의 코드 변경·추적 문서·리뷰 워크플로 산출물 중 하나에 속한다.
   config/CI/무관 모듈 변경은 목록에 없다.
5. **포맷팅 변경**: 미검출. 핵심 파일(`terminal-error-payload.ts`, `sanitize-error-message.ts`)
   의 diff 를 직접 대조 — 신규 블록 삽입/서술 재구성 외 기존 코드 라인의 재포맷(들여쓰기·따옴표·
   개행 스타일)은 섞여 있지 않다.
6. **주석 변경**: 신규 JSDoc 분량이 크지만 전부 설계 근거·실측표·검증 범위·잔여 갭을 담아
   이전 라운드 피드백에 1:1 대응한다. `5d4d8dab7` 의 docstring 재작성도 같은 성격(과장 정정) —
   관련 없는 주석 추가/삭제는 없다.
7. **임포트 변경**: `terminal-error-payload.ts` 의 `import { deepRedactSecrets } from
   './sanitize-error-message'` 1건은 이전 라운드에서 이미 추가된 것으로 이번 라운드 델타에는
   포함되지 않는다(`5d4d8dab7` diff 에 import 변경 없음). 미사용 임포트·불필요한 정리 없음.
8. **설정 변경**: 없음. `.eslintrc`·`tsconfig`·`package.json`·CI 워크플로 등 설정 파일은 이번
   diff 67개 파일 목록에 없다.

## 요약

브랜치 전체(5개 커밋 `23d1148d5`→`a50a5764e`→`7badf0318`→`fb4a70b72`→`5d4d8dab7`)가 시종일관
"EIA 종결 이벤트 `error.message`/`details` 의 egress 시점 secret 마스킹 부재"라는 단일 결함만
다룬다. 핵심 코드 변경은 4개 파일로 전 라운드 내내 좁게 유지됐고, 이번에 새로 편입된 마지막
커밋(`5d4d8dab7`)도 직전 라운드(`11_04_07`)가 지적한 W1(docstring 과장 재발)·W3(stale 체크박스)
에 대한 정밀 fix와 그 라운드 자신의 리뷰 산출물 커밋뿐이다. 나머지 63개 파일은 `plan/**`·
`review/**` 에 쓰도록 프로젝트가 명시적으로 규정한 워크플로 산출물이며 이번 작업이 요구한 조치와
1:1 대응해 스코프 확장으로 볼 근거가 없다. 이전 라운드들의 scope 리뷰가 지적한 유일한 흠(JSDoc
궤도 이탈)도 해소가 코드로 재확인되며, 새로운 scope 위반은 발견되지 않았다.

## 위험도
NONE
