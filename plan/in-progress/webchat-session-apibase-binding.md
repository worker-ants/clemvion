---
worktree: (unstarted)
started: 2026-07-18
owner: developer
---

# 웹채팅 위젯: 세션 ↔ 발급 `apiBase` 바인딩 (재전송 시 토큰 오전송 방지)

**상태**: 미착수. **선행 결함** — 이 PR 이 만든 게 아니다.

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

- [ ] `session-store` 스키마에 발급 `apiBase`(origin) 추가
- [ ] 재전송/복원 시 불일치 폐기 로직 + `sessionEstablished()` 전제 재검토
- [ ] 회귀 테스트(apiBase 변경 재전송 → 옛 토큰 미전송)
- [ ] `/consistency-check --impl-done spec/7-channel-web-chat/` 통과
</content>
