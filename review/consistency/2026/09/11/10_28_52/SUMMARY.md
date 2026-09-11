# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 전 5개 checker 결과 확보(전문 인라인 authoritative, 재시도 필요 항목 없음).

## 전체 위험도
**MEDIUM** — Critical 은 없으나, plan_coherence 가 지적한 트래커-계획 파일 간 완료 표시 동기화 누락(WARNING)이 이 저장소가 반복 겪어온 "체크리스트 동기화 누락" 클래스와 동일해 방치 시 실질 추적 유실로 이어질 수 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `impl-details-code-wiring.md` 의 A/B/C/D(+후속 E) 가 `spec-draft-nullable-notation-followups.md` 의 5개 독립 체크박스와 1:1 대응하는데, 어느 파일·어느 라인인지 명시하지 않아 착지 후 트래커 쪽 체크박스가 수동 플립 안 될 위험 | `plan/in-progress/impl-details-code-wiring.md` §"왜 이 턴인가" / §체크리스트 "- [ ] 트래커 항목 종결" | `plan/in-progress/spec-draft-nullable-notation-followups.md` L2237–2265(A) · L2219–2222(C) · L2224–2229(D) · L2278–2286(B) · L2231–2235(E, 후속 PR) | 계획/체크리스트에 "L2237·L2219·L2224·L2278 을 각각 A/C/D/B 완료로 플립 + 근거 각주"를 명시 항목으로 추가. E 는 착지할 후속 PR 체크리스트에 L2231 플립을 동일하게 명시 |
| 2 | cross_spec | `botToken` "형식 검증" 정규식(`^\d{6,}:[A-Za-z0-9_-]{30,}$`)이 Telegram 전용 형식인데 provider 공용 행에 스코프 한정 없이 인용되고, 인용 target(`15-chat-channel.md §5.4`)에는 그 정규식이 아예 없음 | `spec/2-navigation/2-trigger-list.md` §3 API 표, `Chat Channel \| botToken` 행 | `spec/5-system/15-chat-channel.md` §4.1(provider별 실제 포맷: telegram/slack `xoxb-*`/discord) | `botToken` 행을 Telegram 전용으로 스코프 좁히거나(바로 위 `inboundSigning` 행 패턴처럼), 인용 target 을 `15-chat-channel.md §4.1` 로 정정(planner 턴). 이번 PR 의 `@MinLength(1)` 은 이 regex 를 쓰지 않으므로 이번 PR 자체를 막지는 않음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `details[].code` 배선(A)이 완료돼도 "3가지 거부 사유를 구분하는 도메인 특화 코드 신설 여부"는 별도 미결정으로 남음 — 계획이 이를 인용하지 않아 착지 후 "사유 구분 문제도 닫힘"으로 오독될 위험 | `plan/in-progress/impl-details-code-wiring.md` §A / `spec-draft-nullable-notation-followups.md` 미해결 항목(2026-09-11 등재) | A 섹션 또는 커밋 본문에 "generic INVALID_FIELD 만 채우며 도메인 특화 코드 신설은 별도 미결정 항목으로 남는다" 한 줄 cross-reference |
| 2 | rationale_continuity | `botToken` 형식 검증(regex) 미집행 갭은 이번 PR(`@MinLength(1)`)로도 닫히지 않고 pre-existing 으로 남음 | `plan/in-progress/impl-details-code-wiring.md` §C | 차단 사유 아님. 후속 목록에 "provider별 형식 정규식 미검증" 한 줄 등재 권장 |
| 3 | plan_coherence | 트래커 L2196–2199(`chatChannel`/`provider` 신규 검증 분기)가 `§5.4.1` 표·`2-trigger-list.md` PATCH 에러 표에 미등재라 지적하는데, A 가 이 두 분기에도 `code` 를 배선할 가능성이 높아 착지 후 "미등재" 근거 문장이 부분적으로 낡을 수 있음 | `impl-details-code-wiring.md` §A / `spec-draft-nullable-notation-followups.md` L2196–2199(owner: developer, 미해결) | A 착지 후 이 두 분기가 실제로 `code` 를 받는지 확인하고 표 등재 여부 각주 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `2-trigger-list.md` botToken 행의 provider 무자격 regex 인용 + 착지하지 않는 앵커(WARNING 1건) |
| rationale_continuity | LOW | 기각된 대안 재도입·invariant 위반 없음. 인접 미결정 항목 미인용 + pre-existing regex gap(INFO 2건) |
| convention_compliance | NONE | 오늘 앞선 라운드 WARNING 3건 중 2건 해소 확인, 1건은 이번 턴 item B 가 처리 예정. 신규 위반 없음 |
| plan_coherence | MEDIUM | target 결정 내용 자체는 §5.3 규약과 정합하나, 트래커 5개 체크박스와의 1:1 대응이 파일·라인 단위로 명시 안 됨(WARNING) |
| naming_collision | NONE | 신규 식별자 없음. `INVALID_FIELD` 재사용은 기존 카탈로그와 일치. 이전 라운드 라벨 충돌(`D-1`/`D-2`, `CV-*`)은 `94e19be8d` 에서 해소 확인 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. `impl-details-code-wiring.md` 체크리스트에 `spec-draft-nullable-notation-followups.md` L2237(A)·L2219(C)·L2224(D)·L2278(B) 완료 플립 지시를 파일·라인 단위로 명시하고, E 는 후속 PR 체크리스트에 L2231 플립을 못박는다 (WARNING #1 해소).
3. `2-trigger-list.md` botToken 행의 regex 스코프를 Telegram 전용으로 좁히거나 인용 target 을 `15-chat-channel.md §4.1` 로 정정 — planner 턴 필요 (WARNING #2, 이번 PR 비차단).
4. A 착지 시 `details[].code` 배선이 도메인 특화 코드 신설 미결정 항목을 닫지 않았음을 커밋 본문/plan 에 한 줄 명시 (INFO #1).
5. A 착지 후 `chatChannel`/`provider` 분기의 `code` 수신 여부를 확인해 트래커 L2196–2199 "미등재" 서술의 최신성 각주 (INFO #3).
