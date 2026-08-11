# Plan 정합성 검토 — `spec/7-channel-web-chat` (impl-done)

## 검증 범위 (이번 라운드 지시사항)

직전 라운드 WARNING 2건의 정정이 **실제 코드 상태와 일치하는지**를 최우선으로 재검증했다:

- (a) `plan/in-progress/webchat-usewidget-extraction.md` — "완료된 REST 분기" 를 "미구현" 으로
  서술하던 오류 정정 + 신규 "추출 시 함께 옮겨야 하는 것" 목록
- (b) `plan/in-progress/webchat-auth-session-status-reconcile.md` — 요약표를 본문 9축에 재동기화

CRITICAL 판정은 이번 라운드 지시대로 특히 엄격하게 적용했다 — 미해결 결정을 target 이 실제로
**우회·선점**하는 경우만 CRITICAL 로 간주하고, 그 외 관찰은 findings 로 올리지 않고 본 SUMMARY 에만
기록한다(비-CRITICAL 을 findings 로 올리면 fix 루프가 다시 열려 게이트가 안 닫힌다).

## (a) 검증 — `webchat-usewidget-extraction.md` "추출 시 함께 옮겨야 하는 것"

plan 최하단 문구:

> 추출 시 함께 옮겨야 하는 것: `SeedOutcome` 네 갈래, `shouldAbortAfterSeed`, `recoverFromExpiredToken`,
> 그리고 호출부 두 곳의 꼬리 블록(그 중복은 `webchat-auth-session-status-reconcile.md` 에 별도
> 등재돼 있다).

`codebase/channel-web-chat/src/widget/use-widget.ts` (HEAD, 절대경로로 직접 확인)와 대조:

- `SeedOutcome` — `"ended" | "stale" | "continue" | "refresh_deferred"` **정확히 4갈래** (L84-111). 일치.
- `shouldAbortAfterSeed` — L142 에 독립 함수로 존재. 일치.
- `recoverFromExpiredToken` — L536 `useCallback` 으로 존재, `seedWaitingFromStatus` 의 `401` 분기(L754-755)가
  위임. 일치.
- "호출부 두 곳의 꼬리 블록" — `openStream(...)` 호출이 정확히 2곳(L884 `start()` 안, L1247 `applyConfig`
  안)이고, 각각 `deferredStreamRef` 세팅(L879/L1244) → 조건부 `openStream` → `scheduleRefresh()`
  (L887/L1250) 패턴이 리터럴로 복제돼 있다. 일치.
- `webchat-auth-session-status-reconcile.md` 의 "`start()`/`applyConfig` 꼬리 블록 중복" 섹션(§)이
  같은 두 라인 번호(732/1089 — 리뷰 시점 기준, 현재는 884/1247 로 이동했으나 대상 식별은 동일 위치)를
  인용하며 "다섯 번째 갈래 추가 시" 를 트리거로 명시. 상호 참조 정합.

또한 "순서 문제는 해소됐다" 근거로 인용한 `plan/complete/webchat-reload-rest-error-branches.md` 를
직접 열어 대조 — 그 문서 자신도 "세 분기를 `seedWaitingFromStatus` 안에 그대로 넣되 `401` 복구만
`recoverFromExpiredToken` 헬퍼로 분리했다" 고 명시해 이 plan 의 서술과 정합한다.

**target 문서(§3.1 배너)와도 교차 확인**: `3-auth-session.md` §3.1 은 "`404`·복구불가 `401`/`410`
REST 분기와 `401 → 낙관적 refresh 1회` 도 구현됐다(2026-08-10)... 그 외 status·오류는 `catch`
soft-fail 후 SSE 로 진행한다 — **미구현이 아니라 의도된 경계다**" 로 서술한다. 코드의
`seedWaitingFromStatus` catch 블록(L732-761)을 직접 읽어 `404`(L744)·`401`(L754)·기본 soft-fail
(L761) 분기가 그대로 존재함을 확인 — spec 서술과 일치.

**결론**: (a) 는 코드와 정확히 일치한다. 결함 없음.

## (b) 검증 — `webchat-auth-session-status-reconcile.md` 요약표 ↔ 본문 9축

머리말 표의 9행과 본문 `##` 섹션을 1:1 대조:

| 표 행 | 본문 섹션 | 정합 |
|---|---|---|
| §frontmatter 재판정 | `## 처리 (나중 머지 쪽)` | 일치 |
| §`start()` 경로 401 갭 | `## 함께 남은 미확인 갭 — start() 경로의 401` | 일치 |
| §refresh 동시 발화 경합 | `## refresh 동시 발화 경합` | 일치 |
| §catch 분기 세대 재검사 미검증 | `## catch 분기 세대 재검사가 회귀로 안 묶여 있다` | 일치 |
| §비-terminal refresh 실패 후 스트림 부재(닫힘) | `## 해소됨 — refresh_deferred 의 나머지 절반` | 일치 (처분 완료 상태까지 일치) |
| §주기 갱신이 terminal 을 만나도 storage 미정리 | `## 주기 갱신이 terminal 을 만나도 세션을 정리하지 않는다` | 일치 |
| §`start()`/`applyConfig` 꼬리 블록 중복 | `## start()/applyConfig 꼬리 블록 중복` | 일치 |
| §`runApplyConfig` catch stale 가드 | `## runApplyConfig catch 에 stale 가드가 없다` | 일치 |
| §`16_09_40` provenance 사본 "2명" | `## 16_09_40 provenance 사본이 "2명"으로 남아 있다` | 일치 |

9행 모두 본문 섹션과 1:1 대응하며 완료조건 서술도 각 섹션의 실제 체크박스 상태(예: frontmatter
재판정 전 항목 `[x]`, 나머지는 `[ ]` 로 조건부 대기)와 모순 없다. 표에 없는 본문 섹션이나 본문에
없는 표 행도 없다.

**결론**: (b) 도 본문과 완전히 동기화돼 있다. 결함 없음.

## 그 외 미해결 결정·선행 plan 대조 (추가 확인, 문제 없음)

- `webchat-command-failure-is-not-termination.md` (A/B/C 미결) — target 의 §3.1-3 storage 정리
  조건 열거·`sendCommand` 코드(L899-944) 모두 "비-410 명령 실패는 종료가 아니다" 를 그대로 유지하고
  있어 이 미결 결정을 선점하지 않는다.
- `webchat-boot-apibase-scheme-validation.md` (wc:boot 스킴 검증 여부 미결) — target(`4-security.md`)
  은 query-fallback 검증만 서술하고 `wc:boot` 경로 검증 여부를 단정하지 않아 충돌 없음.
- `spec-sync-external-interaction-api-gaps.md` §5.5 `410` 미기재 — EIA §5.5 를 직접 읽어 여전히
  `401` 만 기재돼 있음을 확인(코드 SoT 인용 `interaction.controller.ts:149` 도 현재 라인과 일치).
  target(`3-auth-session.md` §3.1-2)의 "EIA §5.5 본문은 이 분기를 아직 담지 않는다" 캐비엇은 사실과
  일치하며, 처리 책임이 이 EIA plan 으로 정확히 위임돼 있다.
- `webchat-spec-rationale-followup.md` — §R7/§R8 신설 완료 체크가 target 문서에 실제로 반영됨을
  확인(`3-auth-session.md §R7`·`§R8` 존재), 미결 항목("불변식 2" 는 위 command-failure 미결 결정에
  의도적으로 종속)도 target 과 충돌 없음.
- `spec-update-webchat-evidence-pointers.md` — `code:` 갱신 체크 3건 모두 `2-sdk.md`/`3-auth-session.md`
  frontmatter 에 실제 반영됨을 확인.

## 발견사항

없음. (엄격 기준 적용 — CRITICAL 후보 0건. 위 §"그 외" 항목은 모두 target 이 미결 결정을 침범하지
않음을 확인한 결과이지 새로운 미해결 사안이 아니므로 별도 finding 으로 올리지 않는다.)

## 요약

직전 라운드에서 지적한 WARNING 2건(추출 plan 의 REST 분기 서술 정정, reconcile plan 요약표 동기화)은
모두 현재 HEAD 코드·spec 상태와 정확히 일치함을 절대경로 코드 대조로 확인했다 — `SeedOutcome` 4갈래,
`shouldAbortAfterSeed`, `recoverFromExpiredToken`, 호출부 2곳의 꼬리 블록 중복 모두 plan 서술 그대로
코드에 존재하며, reconcile plan 의 9행 표는 본문 9개 섹션과 완전히 1:1 대응한다. 추가로 `spec/7-channel-web-chat`
전역의 다른 in-progress plan(비-410 명령 실패 결정, apiBase 스킴 검증 결정, EIA §5.5 410 분기 누락)도
target 이 그 미해결 결정을 선점하거나 전제를 어긋나게 만들지 않음을 확인했다. Plan 정합성 관점에서
이번 target 변경분에 CRITICAL·WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
