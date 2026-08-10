# 요구사항(Requirement) Review

## 대상 요약

- 핵심 변경: `codebase/channel-web-chat/src/widget/use-widget.ts` — SSE 스트림 소유권 게이트를
  `start()`/`applyConfig` 두 호출부의 손 복제(`if (sessionEstablished()) return;`)에서
  `openStream()` 내부 단일 지점으로 이동. 반환 타입은 명명 union `StreamClaim`
  (`"opened" | "already_owned" | "no_client"`), 호출부는 fail-closed 부정 비교
  (`claim !== "opened" && claim !== "no_client"`)로 게이팅.
- `use-widget-eager-start.test.ts` — 회귀 테스트 주석을 옛 구조("호출부 양쪽 게이트")에서
  현재 구조("openStream 내부 게이트")로 갱신 (assertion 자체는 esCount 불변으로 무변경).
- `plan/in-progress/webchat-usewidget-extraction.md` — 위 리팩터를 완료 항목으로 승격, 결정
  근거·뮤테이션 검증 결과 기록. `webchat-reload-rest-error-branches.md` 와의 순서 의존성 명시.
- `plan/in-progress/webchat-reload-rest-error-branches.md`(신설) — §3.1 이 자인한 미구현 REST
  분기(404/복구불가 401/낙관적 refresh)를 소유하는 developer 트랙 plan. 구현은 없음(정직하게
  체크박스 미완).
- `spec/7-channel-web-chat/3-auth-session.md` — frontmatter `status: implemented → partial` +
  `pending_plans:` 신설, §R7 문단을 현재 구조(openStream 내부 게이트)로 재서술.
- `review/code/**`, `review/consistency/**` 하위 다수 — 선행 라운드(`12_39_25`, `12_56_30`,
  `13_12_16`)의 리뷰/consistency-check 산출물(SUMMARY/RESOLUTION/각 checker 리포트/meta.json/
  `_retry_state.json`). 관례상 `review/**` 산출물 저장 위치에 부합.

## 검증 절차 (직접 실측)

- `pnpm --filter channel-web-chat exec tsc --noEmit` → **0 errors** (RESOLUTION/SUMMARY 주장과 일치)
- `pnpm --filter channel-web-chat test -- --run` → **23 files / 409 tests passed** (동일 수치 재확인)
- `use-widget.ts` 전체를 직접 `Read` 하여 `openStream`/`start()`/`applyConfig`/
  `seedWaitingFromStatus` 본문을 diff 문맥이 아닌 최종 소스 라인으로 대조.
- `git log -S`/`git show`로 `43423f830`·`933eff66d`·`2d9da4f26`·`ce6c81838`·`84765cc96`·
  `bf8d71802` 커밋 실존 및 서술 내용 확인 — plan/RESOLUTION 이 인용하는 커밋 해시 전부 정합.
- `spec/conventions/spec-impl-evidence.md §3`을 직접 읽어 `status: partial` +
  `pending_plans:` 조합이 규약과 정합함을 확인.

## 발견사항

- **[INFO]** `openStream` JSDoc/plan/SUMMARY 가 "세 번째 요구가 생기면 boolean 을 다시 쪼개야
  한다" · "컴파일러가 미처리 케이스를 잡는다" 는 취지로 union 전환을 정당화하는데, 실제 호출부는
  `switch`/exhaustive 매칭이 아니라 `claim !== "opened" && claim !== "no_client"` fail-closed
  부정 비교다. 이 패턴은 **의도적으로** 향후 새 variant 가 추가돼도 컴파일 에러 없이 자동으로
  "중단" 쪽으로 fail-closed 되도록 설계된 것(코드 주석 618-621 이 그 이유를 명시)이라 기능상
  문제는 없으나, "컴파일러가 미처리 케이스를 잡는다"는 JSDoc 문장(96-101)은 정확히는 "구현
  누락을 막는다"가 아니라 "새 case 를 fail-closed 로 자동 분류한다"는 뜻에 더 가깝다 — 사소한
  표현상 오차.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — StreamClaim JSDoc(약 92-102행)
    vs 호출부 게이팅(622-623행, 973-974행)
  - 제안: 조치 불요(회색지대). 여유가 있으면 JSDoc 을 "새 variant 는 기본적으로 중단(fail-closed)
    으로 처리된다"로 다듬으면 더 정확해짐.

- **[INFO]** `spec/7-channel-web-chat/3-auth-session.md` §3.1 이 자인한 REST 오류 분기 잔여
  (`404`·복구불가 `401`·낙관적 refresh)는 이번 PR 에서도 여전히 미구현이다. 다만 이는 이번
  diff 가 새로 만든 갭이 아니라 기존 결함이며(2026-07-05 `6b25ccc3e` 부터 존재), 이번 PR 은
  오히려 그 상태를 정확히 반영하도록 `status: partial` + `pending_plans:`(신설 plan)로
  frontmatter 를 정정하고, 신설 plan 본문에서 "결정은 이미 내려졌고 구현만 남았다"고 명확히
  범위를 좁혔다(자체 재판정 라운드에서 "결정 필요"로 되돌렸던 자기모순도 같은 PR 안에서 정정).
  회색지대이자 이미 정직하게 추적되는 상태.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 blockquote, §R4;
    `plan/in-progress/webchat-reload-rest-error-branches.md`
  - 제안: 조치 불요. 착수 시점에 원 서술과 어긋남이 발견되면 plan 자체가 이미 "그때는 planner
    턴으로 되돌린다"고 명시해 뒀다.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값 검토 결과

- **동작 보존 확인**: `openStream` 세 분기(`!client → "no_client"`, `streamRef.current !== null
  → "already_owned"`, 정상 open `→ "opened"`) 모두 명시적 반환 — 누락 경로 없음. `"no_client"`
  가 진행(호출부가 `scheduleRefresh()` 를 실행)인 것은 종전 동작(`openStream` 내부 no-op 후
  호출부가 그대로 `scheduleRefresh()` 실행)과 관측 가능한 차이가 없음을 소스 대조로 확인.
- **이중 EventSource race 방지**: `start()`(622-623)·`applyConfig` 복원(973-974) 두 호출부
  모두 동일한 fail-closed 패턴으로 게이팅 — "가드를 한쪽에만 적용" 클래스 결함의 재발이 구조적
  으로 봉쇄됨(호출부가 아니라 `openStream` 진입점 하나가 소유권을 강제).
  `raceStartVsResendSingleStream` 양방향 회귀 테스트(순서 반전 2건, `esCount===1` 단언)가 실제
  코드 흐름과 일치.
- **`start()` useCallback 의존성 배열**: 선행 라운드(`12_39_25`) 3인 독립 지적(WARNING)이었던
  미사용 `sessionEstablished` 잔재가 이번 diff 에서 정확히 제거됨(현재
  `[openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]`) —
  본문에서 실제로 더 이상 호출되지 않음을 grep 으로 확인.
  `applyConfig`(mount-effect, deps `[]`) 안의 `sessionEstablished()` 호출(재전송 판별용)은
  의도적으로 유지된 별개 용법 — 제거 대상 아님.
- **plan 체크리스트 실측**: `webchat-usewidget-extraction.md` 가 주장하는 "23파일 409건
  통과·`tsc --noEmit` 0 errors"를 직접 재실행해 일치 확인. RESOLUTION.md·SUMMARY.md 의 동일
  수치도 일치.
- **TODO/FIXME/HACK/XXX**: diff 범위 내 없음(`git diff origin/main...HEAD` grep 확인).
- **의도-구현 일치**: 함수명 `openStream`, JSDoc, 인라인 주석, 호출부 주석, plan 서술, spec
  §R7 재서술이 서로 다른 5곳에서 동일한 사실(게이트 위치·fail-closed 방향·no_client 의미)을
  각자의 관점으로 정확히 서술 — drift 없음(중복 자체는 maintainability 관점 별건, 이 리뷰
  범위 밖).

## Spec Fidelity

- `spec/7-channel-web-chat/3-auth-session.md` §R7("표면 되감기 방어는 세션 확립 축")이 이번
  PR 에서 **정확히 같은 diff 로 함께 재서술**됐다 — "종전엔 호출부 2곳에 손으로 복제 → 이제
  스트림 열기 진입에서 소유권 재확인, fail-closed 부정 비교" 서술이 실제 코드
  (`use-widget.ts:104-110, 386-411, 616-623, 968-974`)와 line-level 로 일치. 별개
  `plan_coherence` checker(선행 라운드)도 동일 대조를 수행해 "문서-코드-plan 삼자 정합" 판정을
  냄 — 본 리뷰의 직접 대조도 같은 결론.
- frontmatter `status: implemented → partial` + `pending_plans:` 전환은
  `spec/conventions/spec-impl-evidence.md §3`("partial 은 pending_plans 의무")과 정확히
  부합. 이 CRITICAL(선행 `convention_compliance` 라운드)은 이번 diff 로 해소됨 — 별도
  재판정 라운드(`13_12_16`)가 독립적으로 재확인(BLOCK:NO, Critical 0).
- `openStream`/`StreamClaim` 같은 함수 시그니처·반환값 세부는 spec 서술 범위 밖(spec 은
  사용자-가시적 계약만 정의, 예: `2-sdk.md §3` 재전송 시 SSE 재오픈 금지) — 내부 구현
  디테일이라 spec 갱신 의무 없음. SPEC-DRIFT 아님(spec 이 이미 갱신됐고, 갱신 안 해도 될
  세부는 spec 범위 밖).
- 관련 spec 문서(`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/
  5-admin-console.md`)의 `openStream(lastEventId=0)` replay 서술과도 충돌 없음(변경 없음).

## 요약

`openStream` 내부로 SSE 소유권 게이트를 구조적으로 이전한 리팩터는 기능 무변경을 목표로
정확히 달성했다 — 세 반환 분기 모두 명시적이고, 종전 동작(특히 `client` 미확립 시
`scheduleRefresh()` 그대로 진행)이 보존되며, 이중 EventSource 방지 회귀 테스트가 양방향으로
고정돼 있다. `tsc --noEmit` 0 errors·23파일/409건 테스트 통과를 직접 재실행해 plan·RESOLUTION·
SUMMARY 의 수치 주장과 정확히 일치함을 확인했다. 선행 라운드가 지적한 WARNING(미사용
`sessionEstablished` deps 잔재, boolean 안티패턴, 테스트 주석 drift)은 모두 이번 diff 에서
반영·검증됐다. spec(`3-auth-session.md §R7`)도 같은 diff 로 코드와 동기화됐고, frontmatter
`status: partial` + `pending_plans:` 전환은 `spec-impl-evidence.md §3` 규약과 정확히 부합하며
별도 재판정 라운드가 독립적으로 재확인했다. 함께 신설된 `webchat-reload-rest-error-branches.md`
는 §3.1 이 오래 자인해 온 REST 오류 분기 잔여(기존 결함, 이번 diff 가 만든 갭 아님)를 정직하게
소유·추적하며 자기모순(결정 필요 vs 이미 결정됨)도 같은 PR 안에서 정정됐다. CRITICAL 은
발견되지 않았고, 두 INFO 는 모두 회색지대·조치 불요 수준이다.

## 위험도

NONE
