BLOCK: NO

# Consistency Check (impl-prep) — chat-channel renderer 회귀 fix

**위험도**: LOW — Critical 없음. 진행 허용.

## Critical
없음.

## WARNING (몇 건 — 본 PR scope 밖 또는 보조 정리)

- spec/5-system/15-chat-channel.md 내부 anchor / 섹션 번호 stale (broken link) — 본 fix 무관. 별 plan 후보.
- spec/conventions/chat-channel-adapter.md §3 의 CCH-AD-07 SoT anchor 깨짐 (`#31-실행-엔진과의-연결` vs `#31-어댑터-라이프사이클`) — PR #328 산출물의 작은 오류. 본 PR 에서 함께 정정 가능.
- Swagger writeOnly/readOnly 의무 cross-ref 누락 — 본 PR 무관.

## INFO (보조)

- WS protocol spec 의 `execution.node.completed` cross-ref 누락 — chat-channel internal 한정이라 본 PR 무관.
- spec frontmatter `pending_plans` 의 MERGED plan stale — frontmatter cleanup 별 작업.
- v1 fallback 정책 어휘 통일 (markdown vs mrkdwn) — 본 PR 에서 정리 가능.

## 결정

**BLOCK: NO** — 진행 허용.

본 PR scope:
1. chat-channel/providers/{telegram,discord,slack}/*-message.renderer.ts 의 nodeOutput shape 처리 보강 (회귀 ⑤)
2. presentations[i].type='form' v1 임시 fallback text 발화 (회귀 ④)
3. ai_message message 빈 string 이지만 presentations 있는 경우 sequential 발송 보장 (회귀 ④)
4. spec 동반 갱신: chat-channel-adapter.md §3 매핑 표 + 15-chat-channel.md §3.3 CCH-MP-01 보강 — render_form v1 임시 fallback 도입 명시 (별 plan `chat-channel-form-native-modal` 추적 유지)

WARNING 들은 본 fix 와 직교 — 후속 별 PR 후보.
