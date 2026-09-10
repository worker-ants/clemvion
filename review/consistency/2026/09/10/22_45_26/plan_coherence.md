# Plan 정합성 검토 — `spec/5-system` (chat-channel PATCH token)

## 발견사항

- **[INFO]** R-CC-21 산문 폭 정정 후속 등록이 아직 미완료
  - target 위치: `spec/5-system/15-chat-channel.md` §R-CC-21 제목 (`PATCH 는 비밀을 쓰지 않는다 — 차단이 필드명 층에만 걸려 있었다`)
  - 관련 plan: `plan/in-progress/impl-chat-channel-patch-token.md` 체크리스트 마지막 항목 `- [ ] R-CC-21 산문 폭 정정을 planner 후속으로 등재`
  - 상세: target 은 이미 §R-CC-21 헤더 바로 아래 캐비어트(2026-09-10 정정, "「비밀」은 두 축 한정")로 telegram server-issued 축을 스코프 밖에 두었지만, 헤더/요약 레벨 문구("PATCH 는 비밀을 쓰지 않는다")만 읽으면 여전히 넓게 읽힐 수 있다는 점을 developer plan 스스로 정확히 짚었다. 다만 자기-반증형 소정정 조건 1(그 문장은 planner PR #1311 작성)이 성립하지 않아 developer 가 직접 고치지 않고 planner 후속으로 넘기기로 한 판단은 프로젝트 관례(§자기-반증형 소정정)에 맞다. 문제는 이 "등재" 자체가 plan 체크리스트에서 아직 미체크 상태라는 점 — 이 plan 이 `complete/` 로 이동하기 전에 실제로 `spec-draft-nullable-notation-followups.md` 류 SoT 트래커에 등재되지 않으면 발견이 유실될 위험이 있다.
  - 제안: target 변경 불필요. `impl-chat-channel-patch-token.md` 종결 전 해당 체크박스를 실제 등재 완료 후에만 체크할 것 (plan 갱신, 이미 계획된 절차이므로 추가 조치는 "잊지 말 것" 수준).

- **[INFO]** `assertChatChannelInputSafe` dead-code 의심과 D-1 의 신규 가드가 같은 메커니즘을 공유
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 / §5.4.1.1 (PATCH 차단 필드 목록)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L2038-2044 `assertChatChannelInputSafe 의 세 분기가 dead code 일 수 있다` (owner: developer, 미해결)
  - 상세: 기존 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`) 차단은 DTO `@IsEmpty()` + 전역 `APP_PIPE` 가 서비스 가드보다 먼저 거부해 서비스 레벨 가드가 도달 불가(dead code)일 수 있다는 의심이 별도 항목으로 열려 있다. `impl-chat-channel-patch-token.md` 의 D-1 은 같은 패턴(`@IsEmpty()` 신설)을 `botToken`/`inboundSigningPlaintext` 2필드에 그대로 확장하므로, 이 미해결 dead-code 의심이 신규 2필드에도 동일하게 적용될 수 있다. `impl-chat-channel-patch-token.md` 체크리스트에는 이 도달 가능성 검증이 명시돼 있지 않다.
  - 제안: target 변경 불필요. `impl-chat-channel-patch-token.md` 구현 시(테스트 선작성 단계) e2e 로 새 두 필드의 400 이 실제로 어느 레이어(전역 파이프 vs 서비스 가드)에서 발생하는지 캡처하면, 이미 계획된 "`details.field` 실제 페이로드 캡처" 작업과 자연스럽게 겹친다 — 별도 plan 항목 신설보다는 그 캡처 결과를 dead-code 트래커 항목에도 반영하도록 한 줄만 덧붙이면 충분.

- **[INFO]** §5.4.1 표 2행(활성화 PATCH 의 `setupChannel` 재호출 여부) 미확정 상태는 이번 구현 범위에서 의도적으로 배제됨 — 정합
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 표 2행 인라인 캐비어트("이 재호출이 실제로 일어나는지 미확정")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L2046-2053 `§5.4.1 표 2행이 구현과 어긋날 수 있다` (owner: planner + 조사, 미해결)
  - 상세: 이 항목은 여전히 미해결이지만, `impl-chat-channel-patch-token.md` 의 설계(D-1/D-2/D-3)는 이 불확실한 표 2행을 근거로 인용하지 않는다고 명시적으로 밝히고 있어(`D-2 선례로 인용하지 않았다`) 충돌이 없다. target 문서도 같은 미확정 사실을 인라인으로 정직하게 노출하고 있다. 확인만 하고 조치는 불필요.

## 요약

`spec/5-system/15-chat-channel.md` (target) 과 `plan/in-progress/impl-chat-channel-patch-token.md` (이 작업의 구현 plan), 그리고 그 상위 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 세 문서는 서로 매우 촘촘하게 교차 참조되어 있고, 미해결 항목("미확정 — 후속 e2e 확인 대기", "§5.4.1 표 2행 불확실", "v2 회전 후보 A/B/C 결정 보류")들은 target 문서 안에서 스스로 그 불확실성을 인라인 캐비어트로 정직하게 노출하고 있으며, 구현 plan 은 그 경계를 침범하지 않도록(예: telegram server-issued 축을 D-2 게이팅에서 제외, v2 slack/discord 회전 결정에 손대지 않음, R-CC-21 산문 정정을 자기-반증형 소정정 조건 미충족으로 판단해 planner 턴으로 위임) 설계돼 있다. `pending_plans` (Discord Gateway·Slack Socket Mode·Visual SSR PNG) 3건은 모두 별도 "사용자 결정 필요" 게이트를 가진 backlog 이고 이번 target/plan 변경이 그 결정을 선점하지 않는다. 발견된 두 건은 이미 계획된 후속 조치(별도 등재, 페이로드 캡처)와 겹쳐 실질적으로 흡수 가능한 INFO 수준이며, 미해결 결정에 대한 일방적 처분이나 선행 plan 미해소, 후속 항목 누락에 해당하는 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
