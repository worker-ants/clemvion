# Rationale 연속성 검토 — spec/4-nodes/3-ai (impl-prep)

### 발견사항

- **[CRITICAL]** Multi Turn 모드 `out` 포트 유무가 `_product-overview.md`(ND-AG-24, 필수) 와 `1-ai-agent.md` §3.2(기술 spec) 사이에서 정면 모순 — 번복 사유를 남긴 Rationale 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 (`> Multi Turn 모드에는 **out 포트가 존재하지 않는다** ... 조건이 0개인 경우에도 동일` 및 바로 아래 "마이그레이션" 절 — 기존 `multi_turn` + 조건 없음 노드의 `out` 엣지가 dangling 된다는 서술)
  - 과거 결정 출처: `spec/4-nodes/3-ai/_product-overview.md:84` 및 `spec/4-nodes/_product-overview.md:215` 의 **ND-AG-24**(등급 "필수") — "Multi Turn 모드의 포트 구조 ... (`out` 없음). **조건 0개 시 `out` + `error` 제공 (하위 호환)**"
  - 상세: git 이력으로 순서를 확인했다. ND-AG-24 는 2026-04-09 커밋(`1e28b6b68`)에서 "조건 0개 시 out+error 하위호환 제공"으로 제정됐다. 이후 2026-05-10 커밋(`f5bfb46b5`)이 `1-ai-agent.md` §3.2 에 "Multi Turn 모드에는 out 포트가 존재하지 않는다 ... 조건이 0개인 경우에도 동일"이라는 문구를 도입해 이 하위호환 약속을 정면으로 뒤집었다. 이 번복을 설명하는 항목이 `1-ai-agent.md` §12 Rationale (12.1~12.16) 어디에도 없다. 실제 코드(`ai-turn-executor.ts` 의 `multiTurnPortForEndReason` — `user_ended`/`max_turns`/`error`/`condition` 만 처리, `out` 케이스 없음)는 기술 spec(§3.2, out 없음) 을 따르고 있어, 진짜 결함은 `_product-overview.md` 쪽 문구가 stale 하게 남아있는 쪽으로 보이지만 — 두 문서가 여전히 "필수" 요구사항으로 병존하며 서로 모순된 상태다. 이 이슈는 이미 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` **Critical 1** 로 별도 durable 추적 중이며, 해당 plan 은 "consistency `--impl-prep` 10:41 → 12_22_49 → 13_55_11 → 14_46_28 cross_spec Critical" 로 **4회 연속** 발견됐다고 기록하면서도 처분 체크박스는 아직 `[ ]`(미해결) 상태다.
  - 제안: developer 착수 전에 project-planner 가 처분해야 한다(CLAUDE.md 스킬 경계 — spec 변경은 project-planner 소관). 코드 SoT(현재 out 없음)를 그대로 확정한다면 `_product-overview.md` 두 파일의 "조건 0개 시 `out` + `error` 제공 (하위 호환)" 문구를 삭제하고, 왜 하위호환을 포기했는지(예: "종료 사유가 항상 명확하므로" 근거를 §12 Rationale 항목으로 승격)를 명문화한다. 반대로 하위호환 유지가 맞다면 `1-ai-agent.md` §3.2 와 마이그레이션 절(dangling edge 서술)을 정정해야 한다. 이미 durable 추적 중인 항목이므로 새 발견이 아니라 **미해소 상태의 재확인**이지만, impl-prep 게이트가 이를 또 통과시키면 developer 가 어느 쪽 spec 을 따라야 할지 불명확한 채 구현을 진행하게 된다.

- **[INFO]** §12.9 / §12.10 / §12.12~12.13 의 다단계 "번복"·"재번복" 기록은 Rationale 연속성 모범 사례
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.9(`memoryStrategy` 별도 필드화) · §12.10(conversation-thread v1/v2 경계 "번복"의 근거) · §12.12(`summaryModel`/`extractionModel` → select → `*ModelConfigId` 3단계 재번복)
  - 과거 결정 출처: 동일 문서 §12.12 자체가 각 단계의 "과거 결정"을 명시 인용하며 스스로 이력을 보존
  - 상세: 세 차례의 설계 번복 모두 (a) 이전 결정을 문자 그대로 인용, (b) 번복 사유를 명시, (c) 이전 결정이 지키려던 불변식(예: "provider/credential UI 무추가")이 새 결정에서도 유지됨을 검증하는 방식으로 기록돼 있다. `spec/conventions/conversation-thread.md §7 v2 로드맵` 도 `1-ai-agent.md §12.10` 을 상호 링크하며 "부분 실현" 으로 정합적으로 서술해, 교차 문서 간 모순이 없음을 확인했다.
  - 제안: 없음 (정보성 — 특히 CLAUDE.md 스킬 규약이 요구하는 "결정의 배경·근거는 spec 문서 끝 Rationale" 원칙을 가장 잘 지키는 사례로 참고할 만하다).

- **[INFO]** `AI_AGENT_TOOL_COUNT_MAX=128` vs Cafe24/MakeShop 카탈로그 규모 불일치는 이미 사용자 결정으로 해소됨 (번복 아님, 명확화)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 경고 박스, §12.15 Rationale
  - 과거 결정 출처: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` **Critical 2** — 2026-07-17 "✅ 해소" 처리, 사용자 결정 "경고 명문화만, 기본값 변경 없음"
  - 상세: target 의 §4.2 경고문("대형 카탈로그는 allowlist 가 사실상 필수")과 §1 `mcpServers` 필드의 교차링크가 이 결정을 정확히 반영한다. `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` 를 1차 안전망으로, count cap 을 2차 sanity 로 두는 §12.15 의 논리도 일관적이다.
  - 제안: 없음 — 처분 완료 확인 목적의 기록.

### 요약

target(`spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`)은 §12 Rationale 절에 다단계 설계 번복(§12.9~12.13)을 이전 결정 인용 + 번복 사유 + 불변식 보존 검증까지 갖춰 기록하는 성숙한 관행을 보이며, 인접 spec(`conventions/conversation-thread.md`)과의 상호 링크로 정합성도 확인된다. 다만 한 가지 실질적 결함이 여전히 열려 있다 — Multi Turn 모드 `out` 포트 유무를 두고 `_product-overview.md`(ND-AG-24, 필수 요구사항, 2026-04-09 제정)와 `1-ai-agent.md §3.2`(기술 spec, 2026-05-10 도입, 실제 코드와 일치)가 정면 모순되며 이 번복을 설명하는 Rationale 이 없다. 이 이슈는 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`(Critical 1)에 이미 4회 연속 발견 기록이 있음에도 아직 미해결 상태이므로, impl-prep 게이트에서 다시 흘려보내지 않도록 project-planner 처분을 요구해야 한다. Critical 2(도구 개수 cap vs 카탈로그 규모)는 이미 사용자 결정으로 정상 해소됐다.

### 위험도

HIGH
