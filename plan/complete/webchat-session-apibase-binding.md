---
worktree: webchat-apibase-binding-a14e68
started: 2026-07-18
owner: developer
status: complete
# 초안은 `none` 이었으나 ai-review 22_09_46 W3(SPEC-DRIFT) 반영으로 §3.1 필드 열거를 실제로
# 편집했다 → 리스트로 교정(consistency 22_35_51 plan_coherence W1. Gate C 는 형식만 봐서 못 잡는다).
spec_impact:
  - spec/7-channel-web-chat/3-auth-session.md
---

# 웹채팅 위젯: 세션 ↔ 발급 `apiBase` 바인딩 (재전송 시 토큰 오전송 방지)

**상태**: 완료(2026-07-24). **선행 결함** — 이 PR 이 만든 게 아니다.

`webchat-boot-single-flight.md`(곧 `complete/` 이동)의 산문 이월에서 분리했다 — 형제 항목
(`webchat-command-failure-is-not-termination.md`, `webchat-usewidget-extraction.md`)과 같은 처분.
`--impl-done` 03_24_41 `plan_coherence` WARNING 이 "이 항목만 전용 plan 없이 산문으로 남아 plan
archive 시 매몰 위험" 을 지적했다.

## 배경

`session-store`(sessionStorage)는 `{executionId, token, expiresAt, endpoints}` 만 저장하고 **발급
`apiBase` 를 기록하지 않는다**. `applyConfig` 재전송 시 `establishConfig` 가 `clientRef` 를 새
`apiBase` 로 무조건 교체하는데(§security INFO, use-widget.ts), 저장 세션은 옛 발급 origin 의 것이다.
따라서 재전송이 `apiBase` 를 바꾸면 **옛 세션의 단명 토큰이 새 `apiBase` 로 전송될 수 있다**(세션과
엔드포인트의 축 분리).

## 왜 오늘은 무해한가 (그러나 취약)

- 유일한 재전송 경로(관리자 라이브 미리보기)가 `apiBase` 를 바꾸지 않는다.
- `apiBase` 가 바뀌는 정당한 경우는 iframe 리마운트를 동반한다는 불변식이 `use-widget.ts` 의
  `pendingResetRef` JSDoc "불변식 의존 주의" 에 문서화돼 있다.
- **이 diff 가 만든 게 아니다** — 재전송 시 복원하던 종전에도 `clientRef` 만 새 apiBase 로 바뀌었다.
  security 리뷰어(23_58_23·00_51_53·01_44_21)가 매 라운드 "이번 변경이 악화시키지 않음" 을 확인했다.

## 설계 방향

세션에 **발급 origin(apiBase)** 를 기록하고, 재전송/복원 시 현재 `apiBase` 와 불일치하면 세션을
폐기(새 세션 시작)한다. `sessionEstablished()`(스트림 열림) 기반 복원-스킵도 같은 전제("재전송은
endpoint 를 안 바꾼다")에 기대므로(concurrency 23_58_23 WARNING) 함께 재검토한다.

## 선행/참조

- 원 지적: `review/code/2026/07/17/{18_39_11,23_58_23}/security.md`, `side_effect.md`
- 분리 요구: `review/consistency/2026/07/18/03_24_41/plan_coherence.md`
- 관련 불변식: `use-widget.ts` `pendingResetRef`·`sessionEstablished()` JSDoc

## 체크리스트

- [x] `session-store` 스키마에 발급 `apiBase`(origin) 추가 — `PersistedSession.apiBase`
- [x] 재전송/복원 시 불일치 폐기 로직 — `loadSession(path, expectedApiBase)` 가 불일치·**미기록**
      둘 다 폐기(clear + null). `expectedApiBase` 를 **필수 인자**로 둔 것이 의도다: optional 이면
      호출부가 조용히 검사를 건너뛸 수 있고 그게 바로 이 함수가 막으려는 결함이다.
      `sessionEstablished()` 전제 재검토 → §아래.
- [x] 회귀 테스트(apiBase 변경 재전송 → 옛 토큰 미전송) — store 단위 4건 + **위젯 통합 1건**
      (요청 URL·헤더·바디 전수 검사로 옛 토큰 미전송 확인) + **대조군 1건**
- [x] `/consistency-check --impl-done spec/7-channel-web-chat/` — **실제 실행**
      (`review/consistency/2026/07/24/22_35_51`). 1차 `BLOCK: YES`(naming_collision CRITICAL:
      `normalizeApiBase` 가 `demo-config.ts` 의 **정반대 계약** 동명 함수와 충돌) → wrapper 제거로
      해소 후 재실행. 초안에서 이 항목을 실행 전에 `[x]` 로 적었던 것은 잘못이며, push 게이트가
      그 stale 체크박스를 잡아냈다.

## 구현 (2026-07-24)

### 정규화 경계

후행 슬래시만 제거하고 **경로는 보존**한다. `apiBase` 는 `/api` 등 경로 포함이 정상이므로
(direct-load 쿼리 하드닝 주석) origin 만 비교하면 `…/api` 와 `…/api-v2` 를 같다고 본다.
반대로 슬래시 유무를 불일치로 보면 정상 세션이 매번 폐기돼 가드가 무력화된다 — 기존 코드도
`apiBase.replace(/\/$/, "")` 로 정규화하므로 그 관행을 따랐다. 양쪽 다 테스트로 고정.

### 레거시 세션(apiBase 미기록)은 폐기

본 필드 도입 이전 세션은 발급 origin 을 증명할 수 없다. "아마 같겠지" 로 통과시키면 정확히
이 결함이 남는다. 최악의 비용은 **새 대화 1회**이고 반대편 비용은 **다른 origin 으로의 토큰
유출**이라 폐기가 옳다.

### `sessionEstablished()` 전제 재검토 결과 — 변경 불요

복원-스킵이 "재전송은 endpoint 를 안 바꾼다" 전제에 기댄다는 지적(concurrency 23_58_23)은
**이 수정으로 무해해진다**: 스트림이 이미 열린 경우(`sessionEstablished()` true)는 그 세션이
현재 apiBase 로 **발급·검증된** 것이고, 열리지 않은 경우엔 `loadSession` 이 origin 을 대조한다.
즉 두 경로 모두 옛 origin 토큰을 쓰지 않는다. 별도 배선 변경 없이 전제가 성립한다.

### mutation 검증

- `loadSession` 의 apiBase 검사 제거 → **4건 RED**(store 3 + 위젯 통합 1)
- `use-widget` 이 잘못된 apiBase 를 넘기도록 변조 → **18건 RED**(복원 경로 전반)

배선(올바른 값 전달)은 타입체커가 강제하지 못하므로 두 번째 mutation 이 그 축을 덮는다.
