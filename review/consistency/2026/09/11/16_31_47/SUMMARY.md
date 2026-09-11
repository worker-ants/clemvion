# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) CRITICAL 위배 0건. WARNING 3건, INFO 2건.

## 전체 위험도
**LOW** — 코드 diff 자체(순수 함수 이동, 동작 보존)는 전 checker가 NONE~LOW로 평가했고, 실질 지적은 모두 plan/spec 문서 관리(귀속 표기·트래커 동기화) 층에 있으며 이 PR을 되돌릴 사유는 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec (WARNING) / rationale_continuity·naming_collision (INFO, 등급 상향 통합) | `assertInboundSigningPlaintextByProvider`가 `TriggersService` 밖 module-level 함수로 이동해, 클래스 접두 인용 2곳이 소속 표기만 부정확(호출 관계·동작은 참) | `spec/4-nodes/7-trigger/providers/slack.md:275`, `discord.md:297` (`TriggersService.assertInboundSigningPlaintextByProvider`) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`의 module-level export로 이동 | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(약 L2523)에 planner 턴 대상으로 정확한 범위(2곳 한정, 나머지 3곳은 비대상)까지 등재됨 — 다음 planner 턴에서 두 문장을 "`TriggersService`가 `chat-channel-input-rules`의 X를 호출해 검증" 형태로 정정 |
| 2 | plan_coherence | 신규 등재 항목(위 #1)이 자신이 등재된 트래커의 `spec_impact` frontmatter 목록에 반영되지 않음 — 같은 파일이 과거(`2026/09/06/16_29_00` INFO#2) 한 번 이미 겪고 소급 등재로 고친 실패 모드가 재발 | `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact:` | `spec/4-nodes/7-trigger/providers/{slack,discord}.md` (본문 항목은 이 두 파일 정정을 요구하지만 frontmatter에 미등재) | `spec_impact`에 두 파일 경로를 추가 — 누락 시 향후 `--spec`/`--impl-done` 번들 스코프에서 이 정정 대상이 다시 빠질 위험 |
| 3 | plan_coherence | T2(`setupChatChannel`/`teardownChatChannel`→`ChatChannelBinderService` 추출)를 "이 PR 범위 밖, 트래커에 이미 별 항목으로 있다"며 유예했으나, 실측상 트래커의 관련 항목은 provider 추출이 아니라 함수 **내부** 분리(`resolveChatChannelSecretWrites`)만 다뤄 스코프가 다름. 또한 종결 문구 "남긴 3메서드"는 실제 잔존 메서드 수(5개)와 불일치 | `plan/in-progress/impl-chat-channel-binder.md` 체크리스트 (T2 취소 항목 + 트래커 종결 항목) | `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "`TriggersService`(1855줄)에 도메인 규칙이 계속 쌓인다" 항목(provider 추출 미포함) | 트래커 종결 시 (a) 원 항목을 안 닫고 "T1만 완료, T2는 별도 PR로 이월"로 재기술하거나 (b) 처방을 provider 추출까지 명시적으로 넓히고, "남긴 3메서드" 문구를 실제 5개(`setupChatChannel`·`teardownChatChannel`·`rotateBotToken`·`cleanupRotatedChatChannelTokens`·`tryRevokeOldBotToken`)로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록에 신규 파일 `chat-channel-input-rules.ts` 미등재 (기존 3라운드 관측된 배선 파일 4개 미등재 gap의 연장) | `spec/5-system/15-chat-channel.md` frontmatter | planner 턴에서 기존 미등재 4개 파일 + `chat-channel-input-rules.ts`를 한 배치로 `code:`에 추가 (developer의 `spec-draft-nullable-notation-followups.md` L2194 항목과 병합 가능) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 순수 함수 이동, cross-spec 모순 없음. `TriggersService.X` 클래스 귀속 표기 2곳 stale(이미 트래킹됨) + frontmatter code: 미등재(기존 gap 연장) |
| rationale_continuity | NONE | R-CC-21이 기각한 5개 대안 재도입 없음, "생성/수정 검증 분리" 원칙 오버로드 타입까지 보존. 결정 번복 없음 |
| convention_compliance | NONE | `details.field`+`code` 동시 배선 규칙(2026-09-11 신설) 이미 준수, 리뷰 인용 형식·파일 명명·spec 쓰기 권한 경계 모두 위반 없음 |
| plan_coherence | LOW | 신규 후속 항목의 `spec_impact` frontmatter 미동기화(과거 실패모드 재발) + T2 유예의 스코프/메서드 수 불일치 |
| naming_collision | LOW | 새 식별자 충돌 없음(전부 기존 이름 재사용). `TriggersService.X` 귀속 표기 부정확 1건(이미 트래킹됨) |

## 권장 조치사항
1. **[WARNING #2]** `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact`에 `spec/4-nodes/7-trigger/providers/slack.md`·`discord.md` 추가 (가장 저렴한 조치, 즉시 가능).
2. **[WARNING #3]** `plan/in-progress/impl-chat-channel-binder.md`의 T2 유예 체크리스트 항목을 실제 잔존 메서드 수(5개)와 트래커 스코프(provider 추출 vs 내부 분리)가 일치하도록 정정 — 트래커 종결 전에 처리.
3. **[WARNING #1]** 다음 planner 턴에서 `slack.md:275`·`discord.md:297`의 `TriggersService.assertInboundSigningPlaintextByProvider` 표기를 호출자/정의처 분리 형태로 정정 (이미 durable 트래커에 등재됨, 이번 PR을 막을 사유 아님).
4. **[INFO #1]** planner 턴에서 `15-chat-channel.md` frontmatter `code:`에 누락된 배선 파일 5개(기존 4개 + `chat-channel-input-rules.ts`)를 일괄 추가.

이 PR(`impl-chat-channel-binder`) 자체는 push/turn 종료를 차단할 사유가 없다 — 모든 지적이 문서 동기화·트래커 정확도 층에 있으며 developer가 이미 권한 경계(spec read-only)를 지키며 적절히 등재해 두었다.
