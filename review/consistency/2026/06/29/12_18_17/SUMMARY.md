# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**LOW** — Slack 어댑터 draft 는 cross-spec / 규약 / 명명 / plan / rationale 전 관점에서 정합. 유일한 실질 어긋남은 비차단 WARNING 1건(stale 문구).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Convention Compliance (+ Cross-Spec INFO 중복) | `200 OK` 예외를 "Chat Channel §5.5 후속 갱신 대상" 으로 서술 — 시스템 SoT 는 이미 ratified(stale 상태 표현, 값은 일치하므로 invariant 위반 아님) | §6 "Slack 특이 예외" 항목 2 + Rationale R-S-8 마지막 줄 | `spec/5-system/15-chat-channel.md §5.5` line 418–419 (Slack URL Verification / Interactivity ack 2행 등재) + §5.5.1 (예외 정책 신설, SoT 를 provider spec 으로 위임) | §6 항목2·R-S-8 의 "후속 갱신 대상" → "§5.5 line 418–419 + §5.5.1 에 반영 완료(본 spec 이 SoT)" 로 문구 정정. §3.1 의 동일 서술은 이미 정확하므로 무변경 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Rationale Continuity | frontmatter `user_guide:` 키 신설은 `spec-impl-evidence.md §2.1/§2.2` 스키마로의 수렴(`.mdx` 가이드 경로를 `code:`→`user_guide:` 재귀속). 기각 대안 재도입 아님 | slack.md / discord.md frontmatter | 변경 불필요. 정합 확인용 |
| I2 | Convention Compliance | sibling `telegram.md` 는 `user_guide` 키 없음 — provider frontmatter 비대칭(slack 이 더 완전) | frontmatter | 정보용. 일관성 원하면 telegram.md 에도 추가(가이드 페이지 존재 시). target 수정 불요 |
| I3 | Plan Coherence | slack-gaps plan item 1 잔여(form file MIME 검증, PR-E 종속)를 target 이 "Planned" 로 정확히 표기 — 일방 해소 아님 | §4.1 `file_shared` 행 | 변경 불필요. PR-E 완료 시 plan item 1 닫고 "Planned" 표기 제거 |
| I4 | Plan Coherence | R-S-3(Webhook-mode only) v2 유예·§5.4 SSR PNG 격상 모두 socket-mode·visual-ssr-png plan 의 사용자 결정 대기 항목을 우회하지 않고 future 로만 기술 | §1 / R-S-3 / §5.4 | 변경 불필요. visual-ssr-png plan 이 Slack PNG 를 Out-of-scope 명시 → pending_plans 누락 아님 |
| I5 | Naming Collision | Slack Web API 메서드를 `/api/<method>` 로 렌더 — 내부 REST `/api/triggers/...` 와 표기 prefix 공유(점-구분 vs 슬래시 segment 라 실제 라우트 충돌 없음). telegram/discord 동일 패턴 | §3 표 / §3.1 / §3.3 | 변경 불요(established convention). 원하면 `Slack: chat.postMessage` 로 host 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 데이터 모델/API 계약/요구사항 ID/상태 전이/계층 책임 직접 모순 없음. 200 OK 예외 stale 문구만 INFO(W1과 동일) |
| Rationale Continuity | NONE | `user_guide:` 분리는 spec-impl-evidence §2.1/§2.2 스키마로의 순수 수렴. 번복·기각 대안 재도입 없음 |
| Convention Compliance | LOW | frontmatter/3섹션 구조/secret ref 명명/출력 포맷/modal 게이팅 전부 정합. W1(§6·R-S-8 stale)만 정정 권고 |
| Plan Coherence | NONE | 3개 plan(slack-gaps / socket-mode / visual-ssr-png) 전부와 정합. 미해결 결정 우회·선반영 없음 |
| Naming Collision | NONE | R-S-* Slack 전용 prefix namespacing, 공유 식별자는 chat-channel-adapter/15-chat-channel SoT 의 의도적 재사용. ENV/엔티티/endpoint/파일경로 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) W1: slack.md §6 "Slack 특이 예외" 항목 2 와 Rationale R-S-8 의 "후속 갱신 대상" 문구를 "`15-chat-channel.md §5.5` line 418–419 + §5.5.1 에 반영 완료(본 provider spec 이 SoT)" 로 정정 — 문서 간 상태 표현 drift 해소. 값 자체는 이미 일치하므로 spec 동작에는 영향 없음.
2. (선택, 정보) I2: 일관성을 원하면 telegram.md frontmatter 에 `user_guide:` 추가 검토(해당 가이드 페이지 존재 시). 본 target 수정 대상 아님.
3. 그 외 INFO(I1/I3/I4/I5)는 모두 정합 확인용 — 현 시점 변경 불필요.
