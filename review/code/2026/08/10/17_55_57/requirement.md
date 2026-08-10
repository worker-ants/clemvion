# 요구사항(Requirement) Review — `17_55_57`

대상: 직전 라운드(`17_25_34_2`)가 낸 CRITICAL(`refresh_deferred` 가 약속한 복구가 구조적으로
성립하지 않음)의 실제 코드 fix(`410705910`)·문서 fix(`092d784a3`)·머지 정합(`51e8c72e8`) 검증.
액면가로 받지 않고 소스·spec·plan 을 직접 읽고, 레포 밖 scratch 사본에서 독립 뮤테이션 2건을
직접 실행해 검증했다(워킹트리는 건드리지 않음).

## 검증 방법

- `codebase/channel-web-chat/src/widget/use-token-refresh.ts`·`use-widget.ts`·
  `lib/eia-client.ts`·`lib/session-store.ts` 전문 정독 — `deferredStreamRef`·
  `resumeDeferredStreamRef`·`onRefreshed`·`isTerminalAuthError`·`retryDelayMs` 배선을
  호출 그래프로 추적.
- `spec/7-channel-web-chat/3-auth-session.md` §3.1-2·§R4 전문 + Rationale 나머지(R5~R8) 전체
  재독 — "미구현" 잔존 텍스트 grep.
- `spec/0-overview.md`, `plan/complete/webchat-reload-rest-error-branches.md`,
  `plan/in-progress/webchat-auth-session-status-reconcile.md`, 세 개의 역링크 수정 파일 확인.
- `npx vitest run`(위젯 전체) 실행 — HEAD 기준 **426 passed** 확인(RESOLUTION 수치와 일치).
- **독립 뮤테이션 2건**을 `/private/tmp/.../scratchpad/webchat-mutcheck`(repo 밖) 에 `node_modules`
  만 심볼릭 링크한 사본을 만들어 직접 실행(RESOLUTION 의 뮤테이션 표를 재현이 아니라 재실측):
  - M-a: `onRefreshedRef.current?.(updated);` 제거(갱신 성공 통지 제거, 원 CRITICAL 절반 A 복원)
    → **RED 2건**(`use-token-refresh.test.ts` 단위 테스트, `use-widget-eager-start.test.ts` 통합
    테스트 둘 다 실패). RESOLUTION M4 주장과 일치.
  - M-b: `.catch()` 의 `failuresRef.current += 1; scheduleRefresh(retryDelayMs(...))` 를 제거(재예약
    제거, 원 CRITICAL 절반 B 복원) → **RED 1건**(`일시적 실패(네트워크) → 백오프로 재예약 —
    사이클이 죽지 않는다`). RESOLUTION M1 주장과 일치. 통합 테스트는 이 뮤턴트에 안 걸리는데
    이유도 확인했다 — 그 fixture 는 refresh 를 1회만 실패시키므로 최초 `scheduleRefresh()`(boot
    호출부가 무조건 거는 정상 예약)만으로 성공 분기에 도달해 `.catch()` 내부 재예약 분기 자체를
    지나지 않는다. 커버리지 갭이 아니라 두 테스트가 서로 다른 축(단위=백오프 성장, 통합=E2E 배선)을
    보는 정상적 분업이다.

## 판정 (a) — 두 절반이 실제로 닫혔는가: **예**

1. **갱신 성공 → 스트림 오픈**: `use-widget.ts:271-277`(`onRefreshed: (session) =>
   resumeDeferredStreamRef.current?.(session)`) → `use-widget.ts:741-750`
   (`resumeDeferredStreamRef.current` 가 `deferredStreamRef.current` 를 보고 `openStream(session,
   "0")` 호출) → `use-token-refresh.ts:140-156`(`.then()` 이 `applyRefreshedToken` 후
   `onRefreshedRef.current?.(updated)` 를 **`scheduleRefresh()` 재귀보다 먼저** 호출 — 순서
   주석이 근거를 남기고 있고 실제로도 그 순서다). `start()`(`use-widget.ts:826-838`)와
   `applyConfig`(`use-widget.ts:1192-1202`) 양쪽 모두 `deferredStreamRef.current = outcome ===
   "refresh_deferred"` 로 세우고 `scheduleRefresh()` 는 **무조건**(스트림을 열든 미루든) 호출한다
   — 미루는 경우에도 갱신 사이클이 시작되도록 대칭적으로 배선됨을 코드로 확인.
2. **재시도 실패 → 지수 백오프**: `use-token-refresh.ts:158-172` — `isTerminalAuthError` 로
   `401`/`410` 만 멈추고, 그 외는 `failuresRef.current += 1; scheduleRefresh(retryDelayMs(...))`.
   `retryDelayMs`(5s→10s→…→상한 300000ms=5분) 구현이 CHANGELOG·spec 서술("지수 백오프로
   무기한 재시도, 상한 5분")과 정확히 일치.
3. `401`/`410` 판정(`isTerminalAuthError`, `eia-client.ts:179-181`)이 재로드 복구
   (`recoverFromExpiredToken`, `use-widget.ts:528`)와 주기 갱신(`use-token-refresh.ts:165`) 양쪽
   에서 **같은 함수**를 공유 — "한쪽만 고치는" 이 브랜치의 반복 결함 형태가 이번엔 재발하지 않았다.
4. `teardownSession` 이 `deferredStreamRef.current = false` 로 미뤄 둔 의사도 폐기한다
   (`use-widget.ts:349`). 그 위 주석이 "이 줄을 지우는 뮤턴트는 생존한다"(등가 방어 — 바로 위
   `clearRefreshTimer()` 가 `onRefreshed` 발화 자체를 끊고, `openStream` 내부 게이트가 자매
   방어선)를 실측 근거와 함께 정직하게 적어 뒀다 — 이 정직한 미검증 기록 자체는 문제가 아니다.

`use-widget-eager-start.test.ts:557`("§R4: 미뤄 둔 스트림은 주기 갱신이 토큰을 되살리면
열린다")은 **정확히 절반 A** 를 겨냥한다 — 1회차 refresh 를 네트워크 실패시키고 2회차를
성공시켜 `getUrl()).toContain("iext_revived")` 로 "죽은 토큰이 아니라 되살아난 토큰으로 열렸다"
까지 단언한다. HEAD 기준 통과 확인 + 위 M-a 뮤테이션으로 RED 확인(이중 검증).

## 판정 (b) — §R4 새 문단이 구현보다 넓게 약속하지 않는가: **넓지 않음**

§R4 신설 문장("유예가 성립하려면 갱신 사이클이 실제로 복구까지 이어져야 한다 — 갱신 성공이
스트림을 열지 않거나 갱신 실패가 재예약 없이 끝나면 이 갈래는 '종료 안 함' 이라는 이름의
영구 고착일 뿐이다")은 **조건문**이지 현재 구현 상태에 대한 무조건적 단언이 아니다. 실제
구현 상태에 대한 단언은 §3.1-2 쪽에 있다("그 갱신이 성공하면 그때 SSE 를 연다. 갱신 실패는
지수 백오프로 재시도한다") — 이는 위 (a)에서 코드·테스트·독립 뮤테이션으로 확인한 실제
동작과 line-level 로 일치한다. 이 브랜치가 반복해 낸 "문서가 구현보다 넓다" 패턴(§R4 최초
"결정은 내려졌으나 구현은 없다" 고지, `SeedOutcome` JSDoc 의 "갱신은 기대할 수 있다")이 이번
문단에서는 재발하지 않았다.

## 판정 (c) — `status: implemented` 승격이 정당한가: **정당**

- `3-auth-session.md` 본문 전체(§1~§3.1, Rationale R3~R8)를 재독해 "미구현"·"Planned"·
  "후속 결정으로 남긴다" 류 잔존 텍스트를 찾았으나 **없음**(유일한 "미구현" 언급은 "미구현이
  아니라 의도된 경계다" — 그 외 status·오류의 soft-fail 이 의도적 설계임을 부인하는 방향).
- frontmatter `pending_plans:` 제거 확인, `status: implemented` (line 3) 확인.
- `plan/complete/webchat-reload-rest-error-branches.md` 가 실제로 `plan/complete/` 에 존재하고
  세 항목(`404`·`401`→refresh 성공/실패) 체크됨 — `spec-impl-evidence.md §3` 의 "`partial` →
  `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격" 규칙과
  부합.
- `spec/0-overview.md:82` 미러("영역 spec 6문서가 모두 `implemented` 다")도 동반 갱신 확인 —
  직전 라운드 W4/plan 교훈("체크리스트가 frontmatter 두 줄만 보고 미러를 놓쳤었다")이 실제로
  반영됨.
- `plan/in-progress/webchat-command-failure-is-not-termination.md`,
  `plan/in-progress/webchat-usewidget-extraction.md`, `plan/complete/web-chat-quality-backlog.md`
  의 `in-progress/webchat-reload-rest-error-branches.md` 역링크 3곳 모두 `complete/` 경로로
  정정 확인(끊긴 링크 없음).

## 발견사항

- **[WARNING]** `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 "미해결" 절이
  이 diff 자신이 방금 고친 바로 그 결함을 여전히 "설계 선택 대기 중"으로 서술한다 — 코드는
  맞고 plan 문서가 stale.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` — `## 미해결 —
    "refresh_deferred" 는 고착의 절반만 닫는다 (2026-08-10 실측)` 절 전체(체크리스트
    `- [ ] (a)/(b) 중 선택`·`- [ ] 선택 후 회귀` 미체크), 그리고 문서 상단 완료조건 표의
    `§비-terminal refresh 실패 후 스트림 부재 | 실측 완료 — 결함 확정. 아래 §미해결 참조` 행.
  - 상세: 이 절은 "주기 갱신이 몇 번을 성공하든 스트림은 영영 안 열린다"·"이 PR 이 닫은 것과
    안 닫은 것" 이라며 스트림 미오픈(원인 B)을 **명시적으로 안 고친 것**으로 등재하고, 처방을
    "(a) `useTokenRefresh` 에 `openStream` 의존 주입 / (b) phase 전이로 확장 / (c) 종료로 되돌림"
    3택 설계 결정으로 미룬다. 그런데 바로 다음 커밋들(`410705910`→`092d784a3`, 이 diff 에 포함)
    이 정확히 옵션 (a) 방향(스트림 오픈 콜백 주입)으로 이 gap 을 실제로 닫았다 — 위 판정 (a)
    에서 코드·테스트·독립 뮤테이션 2건으로 확인. `git log --oneline -- <이 plan 파일>` 로 확인한
    결과 이 plan 파일을 마지막으로 건드린 커밋(`d03deb339`)은 fix 커밋(`410705910`)보다
    **먼저**이고, 그 이후 fix/docs 커밋(`410705910`, `092d784a3`) 어느 쪽도 `git show --stat` 상
    이 plan 파일을 건드리지 않았다. 즉 diff 안에서 "코드가 고친 결함"과 "plan 이 아직 안
    고쳤다고 서술하는 결함"이 **동일 diff 안에서 서로 모순**된다.
  - 왜 문제인가: `review/**` 는 SoT 가 아니라는 원칙과 대칭으로, `plan/**` 는 이 저장소의
    작업 추적 SoT다. 이 문서를 나중에 여는 사람/에이전트(project-planner, 다음 세션)는 "설계
    결정 미정"으로 읽고 이미 닫힌 결함을 다시 조사하거나, 반대로 "아직 안 고쳐졌다"는 잘못된
    전제로 다른 작업을 설계할 수 있다. 이 세션 자신의 메모리에도 반복 기록된 실패 형태다("plan
    서술은 철회로 거짓이 될 수 있다" — 미룬 항목은 그 턴에 반영해야 사라지지 않는다).
  - 제안: `## 미해결` 절을 실제 상태로 갱신 — (1) 원인 B 가 `410705910`(`onRefreshed` +
    `deferredStreamRef` + 통합 회귀 `use-widget-eager-start.test.ts:557`)로 닫혔음을 명시,
    (2) 남은 체크박스 처리(닫힌 것으로 체크하거나 절 자체를 "처리 완료" 로 표기), (3) 상단
    완료조건 표의 해당 행도 "닫힘(`410705910`)"으로 갱신. 이 plan 문서 자체는 다른 3개 항목
    (`start()` 401 갭·refresh 동시 발화 경합·`catch` 세대 재검사)이 여전히 정당하게 열려 있어
    `in-progress` 잔존 자체는 맞다 — 문제는 닫힌 항목이 안 닫힌 것처럼 남아 있는 것뿐이다.

- **[INFO]** 위 WARNING 은 기능·spec·CHANGELOG 정합성에는 영향이 없다 — 코드·spec·CHANGELOG·
  `plan/complete/webchat-reload-rest-error-branches.md`·`spec/0-overview.md` 는 전부 서로
  일치하고 실측(테스트 426 passed + 독립 뮤테이션 3건 RED)으로 뒷받침된다. 이번 발견은 순수하게
  **부수 plan 문서 하나**의 최신성 문제이며 `status: implemented` 승격의 정당성(판정 c)이나
  spec fidelity 자체를 흔들지 않는다.

## 요약

직전 라운드가 낸 CRITICAL(`refresh_deferred` 가 약속한 복구 배선 부재)은 액면가가 아니라
소스 추적 + HEAD 테스트 426 통과 확인 + repo 밖 scratch 사본에서의 독립 뮤테이션 3건(RED 3/3)
으로 재검증했고, 두 절반(갱신 성공 시 미뤄 둔 스트림 오픈 / 갱신 실패 시 지수 백오프 재시도)
모두 실제로 닫혔다. §R4 신설 문단은 구현보다 넓게 약속하지 않으며, `status: implemented`
승격은 spec 본문에 잔존 미구현 서술이 없고 `pending_plans` 정리·plan 이동·`spec/0-overview.md`
미러·역링크 3곳이 전부 동반 갱신돼 `spec-impl-evidence.md §3` 기준을 충족한다. 다만 이 diff
가 새로 만든 `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 "미해결" 절이 이
diff 자신이 방금 고친 결함을 여전히 미해결/설계-대기로 서술하는 자기모순을 안고 있어(코드가
plan 보다 먼저 앞서갔고 plan 갱신이 누락됨) WARNING 으로 등재한다 — 기능적 회귀는 아니지만
이 프로젝트가 반복 지적해 온 "plan 서술의 stale 화" 패턴의 재발이다.

## 위험도

LOW — 요청받은 CRITICAL 은 실제로 닫혔고 spec fidelity 도 정당하다. 유일한 발견은 부수
문서(plan) 최신성 WARNING 한 건.

STATUS: DONE
