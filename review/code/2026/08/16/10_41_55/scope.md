# 변경 범위(Scope) Review

## 리뷰 범위

이번 라운드(`10_41_55`)는 브랜치 `claude/eia-terminal-error-sanitize-audit` 전체의 누적 diff(vs
`origin/main`, 44개 파일, `+2460/-11`)를 대상으로 한다. `git diff origin/main --stat` 로 직접
대조해 프롬프트에 나열된 44개 파일과 정확히 일치함을 확인했다(추가/누락 없음).

핵심 코드 변경은 **4개 파일**뿐이다:

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설,
  `toTerminalErrorPayload()` 4개 반환 경로 전부에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 8건 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만
  (실측 3곳 전부 알림 채널이라는 근거로 "WS 이벤트" 과장 서술 제거, 런타임 로직 무변경)
- `CHANGELOG.md` — wire 바이트 변화 고지 항목 신설

나머지 40개 파일은 두 그룹이다:

1. `plan/in-progress/eia-terminal-error-sanitize.md`(신규)·
   `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신) — 이번 작업의
   추적 plan + 자매 트래커 상호 참조. `eia-terminal-error-sanitize.md` "조치" 절이 실제 코드
   변경 4곳과 1:1 대응한다.
2. `review/code/2026/08/16/{09_51_00,10_19_30}/**`, `review/consistency/2026/08/16/{09_25_29,
   10_19_31}/**` — 이 세션 자체가 거친 두 라운드의 `/ai-review` + 두 라운드의 consistency-check
   산출물. 프로젝트 규약(`CLAUDE.md` skill 권한표)상 `review/**` 는 developer/consistency-checker
   의 명시된 쓰기 대상이며, 커밋에 포함되는 것이 이 워크플로 자체가 요구하는 정상 기록이다 —
   스코프 확장이 아니라 워크플로 산출물.

## 발견사항

(없음)

이전 두 라운드가 남긴 유일한 scope 관련 지적은 이미 해소가 코드로 확인된다:

- `09_51_00` scope.md WARNING(신규 `redactTerminalError` JSDoc 삽입이 `toTerminalErrorPayload`
  의 기존 `@param`/`@returns` 블록을 궤도 이탈시켰다) → `terminal-error-payload.ts` 를 직접 열어
  확인: `redactTerminalError` 의 JSDoc + 함수 본문이 `toTerminalErrorPayload` 의 `@param
  err`/`@returns` 블록보다 **앞**에 오고, 그 블록은 다시 `toTerminalErrorPayload` 선언 바로 위에
  인접해 있다 — `10_19_30` scope.md 가 "해소 확인, 위험도 NONE"으로 재검증한 것과 일치.
- `10_19_30` 라운드 이후 마지막 커밋(`7badf0318`, "검증 범위 주장을 판별된 만큼으로 좁히고 오표기
  출처까지 정정")은 `git show` 로 직접 대조한 결과 그 라운드 SUMMARY.md 의 WARNING #3(뮤테이션
  검증 범위 과장 서술)·#4("5곳" 두 집합 혼동)·#5(§3.3→§3.1 오표기)·#6(중복 단언 의도 미기록)와
  1:1 대응하는 docstring/주석/CHANGELOG/plan 텍스트 수정뿐이다. 코드 로직·시그니처·테스트 assertion
  로직에 새 변경은 없다(테스트 파일에 신규 assertion 2건 추가 — `details: null` 케이스·잔여 갭
  캐너리 — 도 같은 라운드 INFO 6·7 에 대응).

## 점검 관점별 확인

1. **의도 이상의 변경**: 없음. 핵심 로직 변경은 egress 마스킹 헬퍼 1개 추가로 좁게 유지되고,
   3개 커밋(`23d1148d5`→`a50a5764e`→`7badf0318`) 모두 같은 단일 관심사(종결 `error` 마스킹)와
   그에 대한 리뷰 피드백 반영으로 구성된다.
2. **불필요한 리팩토링**: 없음. `sanitize-error-message.ts` 는 docstring 만 바뀌었고 정규식·함수
   시그니처 무변경(diff 자체가 주석 블록 교체로만 구성됨을 확인). `terminal-error-payload.ts` 의
   기존 `if (src.details !== undefined) out.details = src.details;` 같은 기존 관용구는 그대로
   두고 새 헬퍼만 추가했다(`09_51_00`/`10_19_30` maintainability 라운드가 지적한 "관용구 두 스타일
   혼재"는 의도적으로 무조치 처리된 사안 — diff 확대를 피하려 기존 코드를 건드리지 않았다는 근거가
   RESOLUTION.md 에 기록돼 있다).
3. **기능 확장**: 없음. `redactTerminalError` 는 기존 `deepRedactSecrets`(변경 없음)를 재사용할
   뿐 새 마스킹 로직·새 정규식·새 설정을 만들지 않았다. "자격증명 없는 연결 문자열까지 넓힐지"는
   명시적으로 별도 PR 로 분리한다고 plan/JSDoc/CHANGELOG 세 곳에 일관되게 기록돼 있다 — over-
   engineering 회피가 문서화된 결정이다.
4. **무관한 수정**: 없음. `git diff --stat` 로 대조한 44개 파일 중 이번 작업(종결 error 마스킹)
   과 무관한 파일·모듈은 없다.
5. **포맷팅 변경**: 미검출. `terminal-error-payload.ts`/`sanitize-error-message.ts` 의 diff 는
   추가된 JSDoc·주석·함수 블록 외 기존 코드 라인의 재포맷(들여쓰기·따옴표 스타일 등)이 섞여
   있지 않다.
6. **주석 변경**: 신규 JSDoc/주석 분량이 상당히 크지만(설계 근거·실측표·검증 범위 명시), 전부
   이번 세션의 리뷰 라운드가 실제로 요구한 정정(범위 과장 축소·출처 표기 오류·"5곳" 혼동 해소)에
   대응한다 — 관련 없는 주석 추가/삭제 없음.
7. **임포트 변경**: `terminal-error-payload.ts` 에 `import { deepRedactSecrets } from
   './sanitize-error-message'` 1건 추가. 이 함수를 직접 호출하므로 기능상 필수이고, 순환참조
   우려도 대상 파일의 import 0줄을 직접 확인한 근거 주석과 함께 배치돼 있다. 불필요한 임포트
   추가/정리는 없음.
8. **설정 변경**: 없음. `.eslintrc`·`tsconfig`·`package.json`·CI 워크플로 등 설정 파일은 이번
   diff 44개 파일 목록에 포함되지 않는다.

## 요약

3개 커밋으로 구성된 이 브랜치는 시작부터 끝까지 "EIA 종결 이벤트 `error.message`/`details` 의
egress 시점 secret 마스킹 부재"라는 단일 결함을 좁게 다룬다. 핵심 코드 변경은 4개 파일(마스킹
헬퍼 1개 신설 + 배선, docstring 정정, 테스트, CHANGELOG)로 시종 일관되게 유지됐고, 이전 두
라운드(`09_51_00`, `10_19_30`)의 scope 리뷰가 지적한 유일한 흠(JSDoc 궤도 이탈)은 해소가 코드로
재확인됐다. 마지막 커밋(`7badf0318`)도 직전 라운드 리뷰 피드백에 1:1 대응하는 문서/주석/CHANGELOG
정정뿐이며 새로운 로직·설정·무관 파일 변경을 만들지 않았다. 나머지 40개 파일은 전부 이 프로젝트
컨벤션상 developer/consistency-checker 가 `plan/**`·`review/**` 에 남기도록 규정된 워크플로
산출물이며, 이번 diff 가 명시한 조치와 1:1 대응해 스코프 확장으로 볼 근거가 없다.

## 위험도
NONE
