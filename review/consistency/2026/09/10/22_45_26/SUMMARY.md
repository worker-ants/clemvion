# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재시도 필요 항목 없음), Critical 발견 없음.

## 전체 위험도
**MEDIUM** — cross_spec 이 지목한 `SecretResolver.store()` vs `.rotate()` 메서드명 불일치(WARNING)가 이번 구현 turn 이 직접 만지는 코드경로라는 점 때문에 전체 등급을 MEDIUM 으로 끌어올림. 나머지는 모두 이미 계획된 후속과 겹치는 INFO 뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `SecretResolver.store()` vs `.rotate()` — chat-channel 비밀 저장 호출을 가리키는 메서드명이 4개 spec 파일 9곳에서 canonical 인터페이스 계약(및 target 자신의 R-CC-21 실측 서술)과 반대로 적혀 있음. `setupChannel()` 은 생성/활성화/`chatChannel` PATCH 세 갈래에서 반복 호출되는 멱등 함수라, 문자 그대로 `store()`(이미 존재 시 throw)라면 두 번째 호출부터 깨져야 하는데 R-CC-21 은 정반대로 "무조건 `rotate()` 호출, 빈 값 가드 없어 조용히 회전"이라는 다른 실패 모드를 실측 근거로 제시 — 두 서술이 같은 호출을 두고 양립 불가 | `spec/5-system/15-chat-channel.md:200,201,373,390` | `spec/conventions/secret-store.md` §2.1/§2/§5.4/§5.5(`rotate()` 사용 명시) · target 자신의 R-CC-21(`:764`, `rotate` 실측) · `spec/conventions/chat-channel-adapter.md:354,359` · `spec/4-nodes/7-trigger/providers/{telegram,slack}.md` | 지금 이 turn(D-1/D-2/D-3, `setupChatChannel` write-gate 리팩터)이 정확히 이 호출 지점을 만지므로, 구현 전/구현과 같은 커밋에서 실제 호출 메서드를 재확인 후 9곳 `.store()` 표기를 `.rotate()` 로 일괄 정정하거나(개발자 실측 범위), turn 밖이면 `plan/in-progress/impl-chat-channel-patch-token.md` planner 후속 목록에 "`SecretResolver.store()` 오기 4파일 9자리 일괄 정정"을 별도 항목으로 추가. `spec/` 은 developer 소관 아니므로 이 정정 자체는 planner 턴 대상 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity / plan_coherence | R-CC-21 산문 폭 정정 관련 plan 후속 등재가 아직 미체크 — target 은 이미 caveat(telegram 축 제외)를 갖고 있어 우려가 spec 쪽에서는 해소된 것으로 보이나, `plan/in-progress/impl-chat-channel-patch-token.md` 체크리스트의 "R-CC-21 산문 폭 정정을 planner 후속으로 등재" 항목은 여전히 미체크 | `spec/5-system/15-chat-channel.md` R-CC-21 캐비어트 / `impl-chat-channel-patch-token.md` 체크리스트 마지막 항목 | plan 종결 전 실제 등재(SoT 트래커 반영) 완료 후에만 해당 체크박스를 체크할 것 — 미해소 우려가 미해결로 남아 다음 세션 중복 planner 턴 유발 방지 |
| 2 | rationale_continuity | CCH-AD-02 의 "3갈래 모두 필수" 단정이 §5.4.1 표 2행 자신의 "이 재호출이 실제로 일어나는지 미확정" 캐비어트를 본문에서 언급하지 않아, §5.4.1 을 직접 안 열어본 독자가 3갈래 모두 이미 검증됐다고 오독할 수 있음 | `spec/5-system/15-chat-channel.md` §3.1 CCH-AD-02 행 | 조사가 끝나기 전까지 CCH-AD-02 행에 "(활성화 브랜치는 §5.4.1 표 2행 미확정 참고)" 1줄 포인터 추가, 또는 이번 PR 범위에 포함된다면 착수 전 확정해 두 등급 일치 |
| 3 | convention_compliance | `details.field` 가 §5.4.1(botToken)·§5.4.1.1(inboundSigningPlaintext) 두 SoT 표 모두에서 여전히 미확정 placeholder — 직전 라운드 대비 상태 변화 없음 | `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 각 3행 | e2e 구현 후 신규 2필드뿐 아니라 기존 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)까지 함께 실제 페이로드 캡처(plan 체크리스트 기존 항목과 자연 병합) |
| 4 | plan_coherence | `assertChatChannelInputSafe` 의 기존 3분기 dead-code 의심(DTO `@IsEmpty()` + 전역 `APP_PIPE` 가 서비스 가드보다 먼저 거부할 수 있음, `spec-draft-nullable-notation-followups.md` 미해결)과 이번 D-1 이 신설하는 신규 2필드 `@IsEmpty()` 가드가 같은 패턴을 공유 — 도달 가능성 검증이 plan 체크리스트에 명시돼 있지 않음 | `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 차단 필드 목록 | 구현 시(테스트 선작성 단계) e2e 로 신규 2필드의 400 이 실제로 어느 레이어(전역 파이프 vs 서비스 가드)에서 발생하는지 캡처 — 위 INFO#3 캡처 작업과 자연스럽게 겹치므로 결과를 dead-code 트래커 항목에도 반영 |
| 5 | naming_collision | `ChatChannelUpdateConfigDto` (plan D-1 신규 DTO, spec 본문에는 미등장) — top-level 리소스 PATCH DTO 의 전역 `Update<Entity>Dto` 어순과는 다르지만, 참조해야 할 컨벤션은 형제 클래스(`ChatChannelUiMappingDto` 등)가 쓰는 로컬 `ChatChannel<Role>Dto` 패턴이라 정합. 이미 두 차례 독립 재검증, 저장소 전체 사용처 0건 | `plan/in-progress/impl-chat-channel-patch-token.md` D-1 | 조치 불요 — 세 번째 독립 재검증도 동일 결론 |
| 6 | naming_collision | Rationale ID 스킴 혼재(`R1~R9`/`R-K`/`R-CC-N`)는 문서가 스스로 "신규는 R-CC-N, 기존은 cross-link 파손 방지를 위해 유지"라고 명시적으로 정당화한 의도적 레거시 | `spec/5-system/15-chat-channel.md` "### Rationale ID 컨벤션" 절 | 조치 불요, 향후 대규모 리네임 시에만 재검토 |
| 7 | naming_collision | `chat_channel_health` enum 이 `notification_health` 와 완전 동일 shape — spec 각주가 이미 향후 공용 DB 타입 통합 검토 대상으로 self-flag | `spec/5-system/15-chat-channel.md` §4.2 각주 | 조치 불요, 기존 각주 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `SecretResolver.store()` vs `.rotate()` 메서드명 불일치 — 4개 spec 파일 9곳, 이번 turn 이 직접 만지는 코드경로 |
| rationale_continuity | LOW | INFO 2건 — plan-spec 동기화 갭(R-CC-21 등재 미체크), CCH-AD-02/§5.4.1 등급 불일치 가독성 문제 |
| convention_compliance | NONE | telegram carve-out 이 conventions 신규 위반 없음. `details.field` 미확정만 상태 유지 |
| plan_coherence | LOW | INFO 3건 — 모두 이미 계획된 후속 조치(등재, 페이로드 캡처)와 자연 병합 가능 |
| naming_collision | NONE | 신규 식별자 충돌 없음. `ChatChannelUpdateConfigDto` 3차 재검증 완료 |

## 권장 조치사항
1. `SecretResolver.store()` → `.rotate()` 메서드명 불일치(WARNING#1) — 이번 구현 turn 착수 시 실제 호출 메서드 재확인 후 spec 9곳 일괄 정정 또는 planner 후속 목록 신규 항목 추가 (BLOCK 사유는 아니나 이번 turn 이 해당 코드경로를 직접 리팩터하므로 우선 처리 권장)
2. `impl-chat-channel-patch-token.md` 체크리스트의 "R-CC-21 산문 폭 정정을 planner 후속으로 등재" 항목 — 실제 SoT 트래커 등재 확인 후 체크
3. e2e 구현 단계에서 `details.field` 페이로드(신규 2필드 + 기존 3필드) 캡처와 `assertChatChannelInputSafe` dead-code 도달 가능성 검증을 함께 수행하고 각각의 트래커 항목에 반영
4. CCH-AD-02 "필수" 단정에 §5.4.1 표 2행 미확정 상태를 가리키는 1줄 포인터 추가 검토 (선택, 가독성 개선)
