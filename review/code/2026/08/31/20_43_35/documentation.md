# 문서화(Documentation) 리뷰 — 엔진 에러 코드 앵커링 fix round (`20_43_35`)

## 배경

이번 diff 는 직전 라운드(`review/code/2026/08/31/20_27_29`)의 documentation reviewer 가 남긴
유일한 **WARNING(`CHANGELOG.md` 미갱신)** 을 해소하는 fix 커밋(`4141c64e3`)과, 그 이전 본
변경 커밋(`adc4a3ff6`)의 누적 diff, 그리고 직전 라운드의 리뷰 산출물 11개 파일(신규 커밋)로
구성된다. 즉 이번 라운드의 실질 문서화 검토 대상은 "**W1 이 제대로 고쳐졌는가 + 그 사이 새
문서화 결함이 들어오지 않았는가**" 이다.

## 검증 방법 (실제 실행, 저장소 뮤테이션 없음 — 단, 아래 "관측된 이상 상태" 참조)

- `CHANGELOG.md` 신규 항목 실물 확인(`Read`) — 저장소의 기존 관례("## Unreleased — <제목>"
  헤더를 매 항목마다 반복, 최신이 최상단)와 형식이 일치함을 `grep -n "^## " CHANGELOG.md` 로
  전체 21개 헤더와 대조.
- `engine-error-code-anchor-fixture.ts` 상단 `eslint-disable` 지시어가 실제로 제거됐는지
  (`grep -n eslint-disable`) 확인 — INFO 3(→ WARNING 재분류) 조치가 실제로 반영됨.
- `EngineErrorCode` JSDoc·가드 `ANCHORED_ELSEWHERE` 의 사유 서술을 실제 소스와 대조:
  - `INVALID_EXECUTION_STATE` → `workflow-errors.ts:114`
    (`readonly code = 'INVALID_EXECUTION_STATE' as const`) — 일치.
  - `ERROR_PORT_FALLBACK` → `execution-engine.service.ts` 의 `ErrorPortFallbackError` 클래스
    (313행 부근) — 일치.
- `plan/complete/exec-intake-followups.md` ↔ `plan/complete/spec-draft-webchat-execution-residuals.md`
  상호링크가 **양방향 모두 실제로 착지**함을 확인 (`./exec-intake-followups.md`,
  `../complete/spec-draft-webchat-execution-residuals.md`).
- `findUnanchored` positive-path 테스트(INFO 2 fix)가 실제로 spec 에 추가됐는지 확인
  (`it('[positive path] 앵커 없는 코드를 실제로 검출한다', …)` 존재) + `npx jest
  engine-error-code-anchor.spec.ts` 재실행 → **12/12 PASS** (RESOLUTION.md 의 "12/12" 서술과 일치).
- `plan/complete/exec-intake-followups.md` 의 ARCH#5 체크박스가 `[x]` 로 실제 반영돼 있음을 확인.

## 발견사항

없음 — CRITICAL/WARNING 급 문서화 결함을 찾지 못했다.

## 확인된 사항 (참고용 — 결함 아님)

- **W1 (전 라운드 WARNING) 은 실제로 해소됐다.** `CHANGELOG.md` 최상단에 신규
  `## Unreleased — 엔진 에러 코드가 반만 상수였다 …` 항목이 이 저장소의 확립된 서술 밀도
  (근거·수치·뮤테이션 검증 경위 포함)로 추가돼 있고, 직전 항목("raw UPDATE/DELETE …
  RETURNING 회귀 가드")과 형식·톤이 일관된다.
- **INFO 3(불필요한 `eslint-disable`)의 재분류와 조치가 정확하다.** RESOLUTION.md 는 이를
  "실은 CI lint breaker(`--max-warnings 0`)였다" 로 격상해 WARNING 급으로 다뤘고, 실제로
  `engine-error-code-anchor-fixture.ts` 의 지시어가 제거됐음을 소스에서 직접 확인했다.
- **INFO 2(`findUnanchored` positive-path 테스트 부재) 조치가 실제로 반영됐다.** 가드
  spec 에 픽스처 디렉터리를 겨냥한 검출 테스트가 추가돼 있고, 재실행 결과 12/12 GREEN.
- **plan 문서 상호링크·체크박스 동기화**: `exec-intake-followups.md` (complete) 와
  `spec-draft-webchat-execution-residuals.md` 의 교차링크가 이동 후 위치 기준으로 둘 다
  깨지지 않고, ARCH#5 체크박스도 완료 서술과 함께 `[x]` 로 반영돼 있다.
- **리뷰 산출물 11개 파일**(`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/
  reviewer 산출물 8개)이 `review/code/2026/08/31/20_27_29/` 에 커밋된 것은 이 저장소의 정착된
  관례(`review/` 는 gitignore 대상 아님, 리뷰 산출물을 이력으로 보존)에 부합하며 새로운
  문서화 결함이 아니다.

## 관측된 이상 상태 (내 세션의 뮤테이션 아님 — 병렬 리뷰어 뮤테이션으로 추정)

작업 도중 `git status --short` 로 원복 확인을 하다가 다음을 관측했다:

```
 M codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts
```

`git diff` 로 확인한 실제 변경:

```diff
-  return collectBoundCodes(repoRoot, relDir).filter(
+  return collectBoundCodes(repoRoot, undefined).filter(
```

이는 **내가 만든 변경이 아니다** — 나는 이 세션에서 저장소 파일을 편집한 적이 없다
(모든 검증은 `Read`/`grep`/`jest` 실행뿐). `findUnanchored` 의 `relDir` 파라미터를
`collectBoundCodes` 호출부에서 무력화(`undefined` 로 고정)하는 형태로, 다른 reviewer 가
같은 워킹트리에서 **지금** 뮤테이션 검증(가설: `relDir` 스레딩이 실제로 필요한지 확인)을
수행 중인 것으로 보인다 — 이 diff 자체가 이번 라운드에서 검증한 "INFO 2 fix"(positive-path
테스트가 `relDir` 을 실제로 통과시키는지)의 뮤테이션 대상과 정확히 일치한다. 프로토콜상
`git checkout`/`git restore` 로 원복하지 않았다 — 그 명령이 다른 reviewer 의 미완료 작업을
지울 수 있기 때문이다. **원복은 시도하지 않았고, 이 사실을 그대로 보고한다.** orchestrator/
후속 reviewer 는 이 한 줄짜리 diff 를 결함으로 오인하지 말 것.

## 요약

이번 라운드는 순수 fix 라운드로, 직전 documentation 리뷰의 유일한 WARNING(`CHANGELOG.md`
미갱신)이 저장소 관례에 맞게 정확히 해소됐고, 함께 반영된 INFO 2건(positive-path 테스트,
lint-breaking eslint-disable 제거)도 소스 대조·테스트 재실행으로 실제 반영을 확인했다. plan
문서의 상호링크·체크박스 동기화, JSDoc/가드의 예외 사유 서술도 실제 코드와 전부 일치한다.
새로 도입된 문서화 결함은 없다. 다만 검증 도중 병렬 reviewer 로 추정되는 뮤테이션
(`engine-error-code-anchor-guard.ts` 의 `relDir` 무력화, 미커밋)을 관측했으며 원복하지 않고
그대로 보고한다.

## 위험도

NONE
