# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/` (impl-done)

## 검토 범위 요약

`--impl-done` 모드, diff-base `origin/main`. 실제 코드 diff 는 `codebase/channel-web-chat/src/widget/`
내부 4개 파일에 한정된 **순수 내부 리팩터링**이다:

- `use-session-generations.ts` (신규) — `use-widget.ts` 에서 staleness 세대 축(`worldGenRef`/
  `bootGenRef`/`unmountedRef` + `isStale`/`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`)을
  그대로 추출한 커스텀 훅. 로직 자체는 diff 상 원본과 동일(제거 블록과 추가 블록 비교 결과 동작 변경 없음).
  plan `webchat-usewidget-extraction.md`(§1차 slice)의 산문과도 "기능 변경 없음" 으로 일치한다.
  `use-session-generations.test.ts` (신규 단위 테스트).
- `use-widget.ts` — 위 로직을 훅 호출로 대체 + `useCallback` deps 배열에 `worldGenRef` 추가(ref 객체
  안정성에 의존하는 계약 명시).
  `use-widget-commands.test.ts` — 콜백 참조 안정성 회귀 테스트 추가.

spec 문서(`spec/7-channel-web-chat/*.md`) 자체는 이번 diff 로 **변경되지 않았다** — 조회된 target 본문은
기존 spec 텍스트 그대로이며, 이번 변경은 그 spec 이 이미 서술한 §3(재전송) 계약(`2-sdk.md §3`)·상태기계
(`1-widget-app.md §3`)를 구현하는 코드의 내부 구조만 재배치한 것이다.

## 발견사항

- **[INFO]** spec frontmatter `code:` 증거 목록이 신규 파일을 반영하지 않음
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter(`code:`, "§3(재전송)…이 문서가 그 계약의
    SoT이므로 여기 증거를 건다" 주석) · `spec/7-channel-web-chat/3-auth-session.md` frontmatter(`code:`)
  - 충돌 대상: `codebase/channel-web-chat/src/widget/use-session-generations.ts` (신규 파일, diff 에서
    확인)
  - 상세: 두 spec 문서 모두 `code:` 증거 목록에 `codebase/channel-web-chat/src/widget/use-widget.ts` 만
    명시하고 있다. 그런데 이번 diff 로 §3(재전송) 계약(`beginBootAttempt`/`cannotApplyConfig`/
    `isAttemptStale`)과 세션 staleness 판정 로직의 **실제 구현 본체**가 `use-session-generations.ts` 로
    옮겨갔다. `use-widget.ts` 는 여전히 그 훅을 호출·소비하므로 `spec-code-paths.test.ts` 가 요구하는
    "글로브가 ≥1 파일 매치" 조건은 계속 만족해 빌드 가드는 통과하지만(따라서 CRITICAL/WARNING 아님),
    "이 문서가 그 계약의 SoT 이므로 여기 증거를 건다" 는 2-sdk.md 의 명시적 취지(계약 구현 위치를
    정확히 가리키는 것)에는 이제 새 파일이 빠져 있어 정밀도가 떨어진다.
  - 제안: `2-sdk.md`·`3-auth-session.md` 의 `code:` 목록에
    `codebase/channel-web-chat/src/widget/use-session-generations.ts` 를 추가해 증거 포인터를 최신
    구조와 동기화. (spec 본문 내용 자체를 바꿀 필요는 없음 — frontmatter만 갱신.) 후속 slice 에서
    `establishConfig`/`applyConfig`/`start`/`teardownSession` 등이 추가로 이동할 예정이므로, 그때 일괄
    갱신해도 무방.

## 교차 검증 결과 (충돌 없음 확인)

- **데이터 모델**: 신규/변경 엔티티·필드 없음(순수 프론트엔드 훅 리팩터링, 서버 스키마 무관).
- **API 계약**: EIA·webhook·SSE 등 어떤 외부 계약도 변경되지 않음 — diff 는 `worldGenRef`/`bootGenRef`
  ref 관리 로직만 파일을 옮긴 것이고 `0-architecture.md §3`(EIA 표면 매핑)·`3-auth-session.md §3`(세션
  시퀀스) 어느 것도 이 코드 이동으로 영향받지 않는다.
- **요구사항 ID**: 신규 요구사항 ID 부여 없음(target 은 기존 spec 문서 그대로).
- **상태 전이**: `1-widget-app.md §3` 의 conversation lifecycle(`collapsed→panel→booting→streaming↔
  awaiting_user_message→ended`)은 그대로이며, `worldGenRef`/`bootGenRef` 는 그 상태기계 자체가 아니라
  "지연 비동기 응답이 낡은 세계를 덮지 않게 하는" 내부 staleness 가드일 뿐이다. 이동 후에도 무효화
  지점 3곳(teardownSession/start/unmount cleanup)·판정자 4개(isStale/beginBootAttempt/
  cannotApplyConfig/isAttemptStale)의 의미가 diff 상 그대로 보존된다.
  `use-widget.ts` 쪽 diff(`teardownSession`·`sendCommand`·`applyConfig` 관련 `useCallback` deps 에
  `worldGenRef` 추가)는 로직 변경이 아니라 **ref 객체 참조가 훅 반환값이 되면서 ESLint exhaustive-deps
  가 더 이상 정적으로 안정성을 추론하지 못해** 명시적으로 deps 에 넣은 것 — 신규 단위 테스트
  (`use-widget-commands.test.ts` "콜백 참조 안정성")가 그 계약(참조 안정성)을 직접 고정하므로 회귀
  위험도 낮다.
- **권한/RBAC**: 관련 없음 — 인증·권한 표면 변경 없음(`3-auth-session.md`·`5-admin-console.md §7` 불변).
- **계층 책임**: 이동은 `codebase/channel-web-chat/src/widget/` 내부(같은 레이어) 안에서만 일어났다 —
  `0-architecture.md §1` 의 레이어 표(Widget SPA(iframe) = "채팅 UI, EIA 클라이언트, conversation
  상태기계")가 정의하는 경계를 넘지 않음. SDK(`codebase/packages/web-chat-sdk`)·백엔드·admin 콘솔 등
  다른 영역 코드는 diff 에 포함되지 않았다.

## 요약

이번 변경은 `spec/7-channel-web-chat/` 가 이미 서술한 계약(§3 재전송, conversation 상태기계, staleness
가드 불변식)을 구현하는 프론트엔드 코드 내부에서 하나의 응집된 축(world/boot/unmount 세대)을 별도 훅
파일로 추출한 순수 리팩터링이며, spec 문서 자체는 변경되지 않았고 다른 영역(API 계약·데이터 모델·상태
전이·RBAC·계층 책임)과의 실질적 충돌은 발견되지 않았다. 유일한 지적 사항은 `2-sdk.md`·
`3-auth-session.md` frontmatter 의 `code:` 증거 목록이 신규 파일(`use-session-generations.ts`)을 아직
반영하지 않아 계약-구현 포인터의 정밀도가 떨어진다는 점(INFO, 빌드 가드는 통과)이다.

## 위험도

LOW
