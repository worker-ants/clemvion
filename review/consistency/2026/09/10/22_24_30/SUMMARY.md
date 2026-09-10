# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**MEDIUM** — spec-vs-spec 직접 모순·규약 위반·plan 충돌·식별자 충돌은 전무하나, 이 draft 의 존재 목적(병렬 구현 턴의 401 회귀 방지) 자체를 무력화할 수 있는 두 건의 WARNING(구현 write-gate 경계 미확인, 원칙 재해석의 spec 반영 정밀도)이 남아 있음.

## Critical 위배 (BLOCK 사유)

없음.

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 병렬 구현 턴(`impl-chat-channel-patch-token-a17c4e`)의 write-gate 설계(D-2)가 telegram `issuedInboundSigning` 재저장(3번째 쓰기 지점, `triggers.service.ts:987`)을 명시적으로 배제하지 않음 — "비밀 쓰기 여부" 단일 boolean 인자가 우발적으로 이 축까지 게이팅할 위험, 그러면 이 draft 가 막으려는 401 시나리오가 코드 차원에서 재현됨 | `## 결정` D-A, 체크리스트 `impl-chat-channel-patch-token.md` frontmatter 항목 | `.claude/worktrees/impl-chat-channel-patch-token-a17c4e/plan/in-progress/impl-chat-channel-patch-token.md` D-2 (별도 워크트리, 미머지) | 체크리스트에 "D-2 write-gate 가 `result.issuedInboundSigning` 경로를 게이팅하지 않음을 구현 착수 전 확인" 항목 추가, 또는 그 impl 문서 D-2 문장에 "telegram `issuedInboundSigning` 재저장은 게이팅 대상 아님(SoT: telegram-signing-carveout D-A)" 캐비아트 동반 추가 |
| 2 | Rationale Continuity | 「값이 바뀌는가」 원칙의 재해석("사용자 주도 교체인가"로 주어 좁힘)이 spec 본문 원문 문장 옆이 아니라 별도 문단 "한 줄 추가"로만 반영될 경우, 원문을 문자 그대로 읽는 독자에게 telegram 예외가 원칙 위반처럼 보일 위험 | D-B/D-B', 변경안 A4 | `spec/5-system/15-chat-channel.md` §5.4.1 (~line 380, "값이 바뀌는가" 원문) | A4 편집 시 원문 문장 옆에 직접 "(PATCH 요청자가 자신의 비밀로 교체하는가 — provider 강제 재발급은 별도)" qualifier 병기, 별도 문단 추가에 그치지 않도록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `#### 기각한 대안` 신규 3행 중 2행이 이번 트래커 3R 리뷰 이력 출처 — 지어낸 이력 아님, 정당하나 시점 오독 방지용 도입구 권고 | A13, `15-chat-channel.md:767` | "본 carve-out 검토 중 추가로 기각:" 같은 도입구 한 줄 추가 |
| 2 | Rationale Continuity | "회전 주체"(신규 표현) vs 기존 컨벤션의 "server-issued/provider-issued" 어휘가 같은 대조축임을 한 곳에서 명시 연결 권고 | D-A/D-B', `secret-store.md §5.5`, `chat-channel-adapter.md §2.4` | A4 또는 A8 편집 시 대응관계를 한 문장으로 명시 |
| 3 | Convention Compliance | 컨벤션 미변경 판단(secret-store §5.5, chat-channel-adapter §2.3/§2.4 이미 server-issued/provider-issued 구분)이 실측과 일치 확인 | 전반 | 없음 |
| 4 | Convention Compliance | DTO 명명 이연 결정(`ChatChannelUpdateConfigDto`)이 swagger.md 무규칙 + 모듈 내 실선례(`UpdateTriggerDto`)와 이중으로 부합 | "이 턴에 하지 않는 것" | 구현 턴에서 실제 명명 후속 확인만 |
| 5 | Convention Compliance | bare `hh_mm_ss` 인용(1R/2R/3R 등)은 review-citations.md §3 이 `plan/**` 을 적용 대상에서 제외해 위반 아님 | 문서 전반 | spec 본문 반영 시 bare 인용 신설 주의 |
| 6 | Convention Compliance | 감사 액션 레지스트리에 inbound-signing 전용 액션 없음 — D-B(c) "우회 대상 자체 없음" 확인 | D-B(c) | 없음 |
| 7 | Naming Collision | `impl-chat-channel-patch-token.md` 는 저장소에 아직 미존재 — 향후 developer 턴의 전방 참조, `impl-*.md` 컨벤션과 부합해 비차단 | 체크리스트 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | spec 자체는 정합적이나, 병렬 구현 턴의 write-gate 설계가 telegram 축 배제를 명시하지 않아 draft 목적이 코드에서 무력화될 위험 |
| Rationale Continuity | LOW | R-CC-10/R-CC-21 번복 아님, 근거 견고. 단 「값이 바뀌는가」 재해석의 spec 반영 정밀도가 WARNING 수준 |
| Convention Compliance | NONE | 규약 위반 없음, 5개 관점 모두 실측 대조로 확인 |
| Plan Coherence | NONE | 3R WARNING(트래커 등재 예고 미실체화)이 C1/C2 신설로 해소 확인, 다른 in-progress plan 과 충돌 없음 |
| Naming Collision | NONE | 4라운드 연속 위험 없음, 신규 ID/DTO/endpoint/이벤트/설정키/경로 신설 없음 |

## 권장 조치사항
1. (BLOCK 해소 사유는 없으나 draft 목적 보호를 위해 우선) 체크리스트에 "`impl-chat-channel-patch-token.md` D-2 의 write-gate 가 `result.issuedInboundSigning`(3번째 쓰기 지점)을 게이팅하지 않음을 구현 착수 전 확인" 항목 명시 추가, 또는 그 impl 문서 D-2 에 telegram 예외 캐비아트 동반 추가.
2. A4 편집 시 「값이 바뀌는가」 원문 문장 옆에 qualifier 직접 병기(별도 문단 추가에 그치지 않도록).
3. A13 적용 시 신규 기각 대안 3행 앞에 시점 명시 도입구 한 줄 추가.
4. A4/A8 편집 시 "회전 주체 = server-issued(telegram) vs provider-issued(slack/discord)" 대응을 한 문장으로 명시.
