# Plan 정합성 Check — `plan_coherence`

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`.
특별 확인 요청: (a) `webchat-reload-rest-error-branches.md` 가 `plan/complete/` 로 이동한 뒤
그 파일을 가리키던 링크가 전부 갱신됐는가(dangling 0), (b) `webchat-auth-session-status-reconcile.md`
에 등재된 잔여 7항목이 실제 코드 상태와 일치하는가(이미 고쳐진 것을 미해결로 적은 CRITICAL 이 이
브랜치에서 두 번 났었다).

## 확인 (a) — dangling 링크

**0건, 클린.** 저장소 전체(`spec/`, `plan/`, `codebase/`, `CHANGELOG.md`, `review/` 제외)에서
`in-progress/webchat-reload-rest-error-branches` / `in-progress.*webchat-reload-rest` 문자열을
검색한 결과 살아있는 참조가 없다:

- `plan/complete/web-chat-quality-backlog.md:26,29` — `./webchat-reload-rest-error-branches.md`(같은
  `complete/` 디렉터리 내 상대링크, 정상).
- `plan/in-progress/webchat-auth-session-status-reconcile.md:30,41,53` — 텍스트 언급(경로 아님) +
  이동 체크리스트.
- `plan/in-progress/webchat-command-failure-is-not-termination.md:35`,
  `plan/in-progress/webchat-usewidget-extraction.md:175` — 둘 다 `../complete/webchat-reload-rest-error-branches.md`
  로 정정된 상태.
- `spec/0-overview.md:82` — `../plan/complete/webchat-reload-rest-error-branches.md`, 실존 확인.

`in-progress/webchat-reload-rest-error-branches` 문자열이 걸리는 곳은 전부 `review/**`(역사 기록,
SoT 아님)뿐이었다. 이 판정은 같은 브랜치의 직전 코드 리뷰(`review/code/2026/08/11/10_58_43/documentation.md`
확인 (c) 4번째 불릿)가 독립적으로 이미 같은 결론(잔존 참조 0건)을 냈고, 이번 재확인도 동일하다 —
자동 가드 없이 손으로 갱신한 링크가 이번 라운드까지 안정적으로 유지되고 있다.

## 확인 (b) — 잔여 항목이 실제 코드 상태와 일치하는가

`webchat-auth-session-status-reconcile.md` 의 "처리(나중 머지 쪽)" 7항목은 전부 `[x]` 이고, 실제
파일 이동·frontmatter·§R4 고지·§3.1 배너·`spec/0-overview.md` 미러·역링크 4곳을 대조한 결과 모두
일치했다(이동한 plan `plan/complete/webchat-reload-rest-error-branches.md` 존재, `3-auth-session.md`
frontmatter `status: implemented` + `pending_plans` 없음, `spec/0-overview.md:82` 도 갱신됨).

그 아래 **미해결로 남은 축 7개**(§`start()` 401 갭 · §refresh 동시 발화 경합 · §catch 분기 세대
재검사 · §`16_09_40` provenance 사본 · §`runApplyConfig` catch stale 가드 · §`start()`/`applyConfig`
꼬리 블록 중복 · §주기 갱신 terminal 미정리)를 코드와 직접 대조했다:

| 잔여 항목 | 코드 대조 결과 |
|---|---|
| `start()` 경로 401 갭(회귀 미검증) | `use-widget.test.ts` 에 `start()` 판 401 테스트 없음(grep 0건) — 서술과 일치, 여전히 열림 |
| refresh 동시 발화 경합 | in-flight ref/단일화 코드 없음(`refreshInFlight`/`refreshPromiseRef` 등 grep 0건) — 여전히 열림 |
| `catch` 분기 세대 재검사 미검증 | `use-widget.ts:739` `isStale(gen)` 가드는 실재(코드는 맞음) — 다만 "이 분기를 갈라내는 회귀가 없다"는 **테스트 커버리지** 주장이고, 그 주장 자체가 여전히 참(대응 뮤테이션 테스트 미발견) |
| `16_09_40` provenance "2명" 사본 | `use-widget-eager-start.test.ts:105` 를 직접 열어 확인 — 여전히 `"security·side_effect 가 독립 수렴"` (4명 아님). 같은 커밋(`37b38cf31`)이 정본 앵커(`use-widget.ts` `@returns`, `:641-643`)는 "4명" 으로 고쳤지만 이 사본은 의도적으로 남겼다(성격이 다르다는 이유) — plan 서술과 정확히 일치 |
| `runApplyConfig` catch stale 가드 없음 | `use-widget.ts:1267-1290` 확인 — `isStale`/`attempt` 참조 없이 무조건 `dispatch({type:"ERROR"})`. checkpoint 2(`:1234` `isAttemptStale`) 뒤 실제로 `await` 없음(동기 구간 유지, 트리거 미발동) — 서술과 일치 |
| `start()`/`applyConfig` 꼬리 블록 중복 | `start()` 꼬리(`:874-887`) vs `applyConfig` 꼬리(`:1241-1250`) 리터럴 비교 — 4단계(`live` 재확인/`deferredStreamRef`/조건부 `openStream`/`scheduleRefresh`) 구조가 실제로 두 곳에 복제돼 있음. 미추출 상태 확인 |
| 주기 갱신이 terminal 만나도 미정리 | `use-token-refresh.ts:184-186` — `isTerminalAuthError(err)` 시 `return` 만, `finalizeEnded`/`clearSession` 호출 없음 — 서술과 일치 |

**결론: 7개 전부 실제 코드 상태와 일치, "이미 고쳐진 것을 미해결로 적은" 사례는 이번엔 없다.**
이 브랜치가 겪었던 두 번의 CRITICAL(①`refresh_deferred` 절반 미해결 서술이 실제로는 같은 PR에서
닫힌 것, `17_55_57` documentation — 이번 세션에서 `§해소됨` 절로 이미 반영·정정됨 / ②`use-widget.ts`
JSDoc 이 이미 고친 버그의 옛 반환값을 되살려 서술, `18_23_54` documentation)의 재발은 이번 라운드
직접 대조 범위에서 발견되지 않았다.

다만 **인접 문서에서 같은 계열의 stale 서술 2건**을 새로 찾았다 — 아래 발견사항 참조.

## 발견사항

- **[WARNING]** `webchat-usewidget-extraction.md` 의 "순서 주의" 노트가 이미 완료된 형제 plan 의
  상태를 옛 시점으로 서술
  - target 위치: (target 은 `spec/7-channel-web-chat` — 이 항목은 target 코드 변경이 무효화한
    인접 plan 서술) `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `seedWaitingFromStatus`
    `catch` 분기(`:732-761`, `404`/`401` 상태코드 분기가 실제로 구현·구분돼 있음)
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md:175-179`
  - 상세: 해당 노트는 다음과 같이 적는다 — `"[webchat-reload-rest-error-branches.md](../complete/webchat-reload-rest-error-branches.md)
    ... 그쪽은 seedWaitingFromStatus 의 catch 에 404·401 분기를 넣는 작업이고(현재는 상태코드
    구분 없는 soft-fail), 이 slice 는 그 함수를 훅으로 추출한다. 추출이 먼저면 분기는 새 훅
    안에 들어간다. 어느 쪽을 먼저 하든 나중 것이 앞선 것의 결과 위에서 재판정돼야 한다."`
    링크 경로는 `plan/complete/` 로 이미 정정돼 있으나(대상 (a) 항목), **괄호 안 서술
    `"(현재는 상태코드 구분 없는 soft-fail)"` 은 갱신되지 않았다.** 실제 코드
    (`use-widget.ts:744` `err.status === 404` → `finalizeEnded` / `:754` `err.status === 401`
    → `recoverFromExpiredToken`)는 이미 상태코드별로 완전히 분기돼 있다 — "아직 넣는 작업"이
    아니라 "이미 넣어졌고 이 slice 는 그걸 그대로 옮기기만 하면 된다"가 현재 사실이다. 이
    `webchat-usewidget-extraction.md` 의 "남은 slice(미착수)"는 아직 시작되지 않았으므로, 다음에
    착수하는 사람이 이 노트만 읽고 "REST 오류 분기를 새로 설계해야 하나"로 오판할 위험이 있다
    (실제로는 기존 분기를 훅으로 옮기기만 하면 됨 — 설계가 아니라 이관 작업).
  - 제안: `plan/in-progress/webchat-usewidget-extraction.md:177` 의 괄호 서술을 "이미 구현·완료됨(§404/401/기타 3-way 분기, `use-widget.ts:732-761`) — 이 slice 는 그 로직을 그대로 훅으로 이관"으로 정정. 순서 조율 문구("어느 쪽을 먼저 하든...")는 이제 무의미(이미 한쪽이 끝났으므로) — "이 slice 가 훅 추출 시 기존 404/401/기타 분기를 보존해야 한다"로 대체 권장.

- **[WARNING]** `webchat-auth-session-status-reconcile.md` 상단 요약표가 2026-08-11 에 추가된
  독립 축 4개를 누락 — "전부 닫히면 complete/ 로 옮긴다" 판단 기준이 불완전
  - target 위치: 해당 없음(target `spec/7-channel-web-chat` 자체엔 영향 없음 — plan 문서
    자체의 내부 정합성 결함)
  - 관련 plan: `plan/in-progress/webchat-auth-session-status-reconcile.md:9-22`(요약표) vs
    본문 §`16_09_40` provenance 사본(`:245`) · §`runApplyConfig` catch stale 가드(`:263`) ·
    §`start()`/`applyConfig` 꼬리 블록 중복(`:281`) · §주기 갱신 terminal 미정리(`:300`)
  - 상세: 문서 상단 표(`:14-20`)는 완료조건을 5행(frontmatter 재판정 · `start()` 401 갭 ·
    refresh 동시 발화 경합 · catch 분기 세대 재검사 · 비-terminal refresh 실패=닫힘)으로만
    나열하고 `"전부 닫히면 complete/ 로 옮긴다"`(:22)고 선언한다. 그런데 본문에는 2026-08-11
    날짜로 추가된 열려 있는 축이 최소 4개 더 있다(위 표 참조, 전부 `- [ ]` 체크리스트
    보유) — `16_09_40` provenance 사본(maintainability WARNING) · `runApplyConfig` catch
    stale 가드(side_effect WARNING, 조건부) · `start()`/`applyConfig` 꼬리 블록 중복
    (maintainability WARNING, 조건부) · 주기 갱신 terminal 미정리(범위 밖, 결정 대기). 이
    문서 자신이 이미 한 번 같은 실수를 지적받은 적이 있다(`:11-12` "처음 '두 항목' 이라
    적었는데 표는 그 뒤 다섯 행이 됐다 — 개수를 문장에 박으면 표가 늘 때마다 조용히
    거짓이 된다", `18_23_54` documentation INFO) — 그 교훈이 다시 반복됐다. 위 5행만
    보고 판단하면 5행이 전부 닫혔을 때(3행은 이미 닫힘/조건부) "complete/ 로 옮길 준비
    완료"로 오판할 수 있으나, 실제로는 4개 축이 더 열려 있다(3개는 트리거 조건부 defer
    라 즉시 조치는 아니지만 "축 자체가 없다"는 착시는 별개 위험이다).
  - 제안: 상단 표에 2026-08-11 추가분 4행을 보강하거나(트리거-조건부 항목은 "조건부 defer"
    로 표기), 표 대신 "이 문서 내 모든 `- [ ]` 를 grep 하라"는 안내로 대체해 표-본문 동기화
    부담 자체를 없앨 것.

## 요약

이번 라운드의 핵심 확인 두 가지 — (a) `webchat-reload-rest-error-branches.md` 이동에 따른
dangling 링크, (b) `webchat-auth-session-status-reconcile.md` 잔여 7항목의 코드 정합성 — 는
둘 다 클린하다: dangling 링크 0건, 잔여 7항목 전부 코드 상태와 일치하며 "이미 고쳐진 것을
미해결로 서술"하는 재발 사례는 찾지 못했다. 다만 검토 범위를 인접 형제 plan 문서로 넓히자 같은
계열의 stale-서술 패턴이 2건 새로 발견됐다 — `webchat-usewidget-extraction.md` 의 "순서 주의"
노트가 이미 구현 완료된 REST 오류 분기를 여전히 "작업 중"으로 서술하는 것, 그리고
`webchat-auth-session-status-reconcile.md` 자신의 요약표가 2026-08-11 에 추가된 4개 독립 축을
누락해 "전부 닫히면 이동" 판단 기준이 불완전한 것이다. 둘 다 즉시 결정을 요하는 CRITICAL은
아니지만(target spec 자체와 직접 충돌하지 않고, 실제 코드 동작에도 영향 없음) 다음 세션이
잘못된 전제로 착수할 위험을 낮추기 위해 plan 갱신이 필요하다.

## 위험도

MEDIUM
