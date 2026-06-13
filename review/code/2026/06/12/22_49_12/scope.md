# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 파일 16 (`spec/5-system/1-auth.md`) — rate-limit 작업과 무관한 문단 삭제
- 위치: `spec/5-system/1-auth.md` line 1826 ("기각된 대안: ..." 문단)
- 상세: SameSite 결정의 "기각된 대안" 설명 문장 한 줄이 삭제되었다. 이 변경은 CCH-NF-03 rate-limit 구현과 직접 관련이 없는 `spec/5-system/1-auth.md` 의 auth 인증 섹션이다. 변경 전 diff를 보면 `**기각된 대안**: "기본 Lax + cross-site 배포만 none opt-in" 원안 — ...` 문장이 제거되었다.
- 제안: 이 변경이 의도적(오래된 텍스트 cleanup)이라면 별도 PR/커밋으로 분리하는 것이 이상적이다. 다만 실질 기능 변경 없이 spec 본문의 중복·잡음 정리 수준이라 차단 사유는 아니다.

### [INFO] 파일 18 (`spec/5-system/6-websocket-protocol.md`) — rate-limit 작업과 무관한 섹션 삭제
- 위치: `spec/5-system/6-websocket-protocol.md` lines 1922–1928 (§3.3 채널 인가 섹션 전체 삭제)
- 상세: `§3.3 채널 인가 — workflow:·notifications: authorizer 추가 (refactor 04 M-6)` 섹션 전체(약 7줄)가 삭제되었다. 이 섹션은 CCH-NF-03 rate-limit와 완전히 무관한 websocket 채널 인가 rationale이다. 변경 이유가 prompt에 명시되어 있지 않다.
- 제안: 이 삭제가 rate-limit PR에 포함된 명시적 이유가 없다. `refactor-04` 작업의 일환으로 이미 적용된 결정을 정리하는 cleanup이라면 별도 PR로 분리하거나, 최소한 커밋 메시지에 명시하는 것이 바람직하다. 삭제된 내용이 현재 스펙과 코드와의 정합성을 떨어뜨리는 것인지 확인이 필요하다.

### [INFO] `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` frontmatter `worktree` slug 누락
- 위치: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` 2행 `worktree: chat-channel-rate-limit`
- 상세: consistency-check 에서도 이미 W-5로 지적된 사항이다. 실제 worktree 디렉토리는 `chat-channel-rate-limit-baa15a`인데 slug가 누락되었다. 범위 일탈이라기보다 규약 미준수이나, 향후 plan-coherence 도구 매칭 오류를 유발할 수 있다.
- 제안: `worktree: chat-channel-rate-limit-baa15a`로 교정.

### [INFO] `spec/data-flow/14-chat-channel.md` 구현 갭 callout이 "아직 없다(구현 대기)"로 기술됐으나 실제 구현 포함
- 위치: `spec/data-flow/14-chat-channel.md` lines 1953–1960
- 상세: data-flow spec의 구현 갭 callout 텍스트를 "메커니즘은 확정됨 — per-chat Redis fixed-window ..." 형식으로 갱신하면서 `inbound hot path에 이를 적용하는 코드는 아직 없다`라고 남겨두었다. 그런데 이 PR에 `hooks.service.ts`와 `ChatChannelRateLimiterService` 구현이 함께 포함되어 있어 "아직 없다(구현 대기)"는 PR 병합 후 즉시 stale이 된다. 또한 `spec-sync-chat-channel-gaps.md`의 CCH-NF-03 항목도 `[x] 구현 완료`로 표시되어 있어 data-flow의 callout 문구와 불일치한다.
- 제안: `inbound hot path에 이를 적용하는 코드는 아직 없다` → `구현 완료 (2026-06-12, hooks.service.ts + ChatChannelRateLimiterService)`로 갱신하거나, callout 자체를 제거하는 것이 일관성에 부합한다.

## 요약

변경의 핵심 의도(CCH-NF-03 per-chat rate-limit 구현: `ChatChannelRateLimiterService` 신규 서비스, `HooksService` enforcement 통합, `ChatChannelModule` DI 등록, spec 문서 갱신, plan 추적)는 전반적으로 명확한 단일 목적에 부합한다. 코드 파일(파일 1~5)과 spec/plan 파일(파일 6~7, 17, 19)은 모두 rate-limit 기능과 직접 연결된다. review/ 디렉토리 파일(파일 8~15)은 consistency-check 산출물로 workflow 자체의 필수 산출물이다. 범위 이탈로 주목할 부분은 두 가지다: (1) `spec/5-system/1-auth.md`의 SameSite 기각 대안 문장 삭제와 (2) `spec/5-system/6-websocket-protocol.md`의 §3.3 채널 인가 rationale 섹션 전체 삭제 — 두 변경 모두 rate-limit와 무관하다. 단 실질 기능·로직 변경 없이 spec 텍스트 정리 수준이라 기능상 위험은 낮다. data-flow spec의 구현 갭 callout 문구가 "구현 대기"로 남아 있어 PR 병합 직후 stale이 되는 점도 일관성상 수정이 권장된다.

## 위험도

LOW

STATUS: SUCCESS
