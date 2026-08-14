STATUS=success rationale_continuity 검토 완료 — CRITICAL 0, WARNING 0, INFO 2 (target=plan/in-progress/spec-draft-eia-62-waiting-payload.md)
===REPORT_MARKDOWN_BELOW===
# Rationale 연속성 검토 — `spec-draft-eia-62-waiting-payload.md`

## 검증 방법

target 이 인용하는 모든 spec Rationale 항목(WS §4.4 "wire 필드 caveat"/PR #945/2026-08-13 갱신, EIA §R17, EIA §6.2 blockquote, `1-data-model.md §2.14`, `15-chat-channel.md R-CC-15`)을 실제 spec 파일에서 `grep`/`Read` 로 직접 대조했고, target 이 인용하는 리뷰 라운드 타임스탬프(`07_44_12`·`09_38_17`·`12_06_21`·`15_06_43`·`14_55_31`·`11_02_18`·`10_32_29`·`11_02_16`)와 커밋(`#1166`·`PR #945`·`81f2c60d6` 등)이 실재하는지 `git log`/`find` 로 확인했다. 전부 실재를 확인했다 — 지어낸 이력은 없었다.

## 발견사항

- **[INFO]** `error.code: null` 이 R-CC-15 의 닫힌 분류 입력 가정에 미치는 영향 — 검증 전 상태를 체크리스트에 명시화 권장
  - target 위치: `## 변경 제안 (4)` "파급 2곳" 두 번째 불릿 + `## 체크리스트`
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `### R-CC-15. Execution Failed 안내 — 분류 입력 화이트리스트 + placeholder 1종 정책` — "`error.code` enum + `details.statusCode` 2 필드만 분류 입력"·"unknown code fallback 은 `executionFailedInternal`"
  - 상세: target 은 `error.code` 를 항상-존재 문자열에서 `string | null` 로 바꾼다. R-CC-15 의 분류 로직이 `code` 를 enum switch 입력으로 가정하고 있어(현재 문서화된 fallback 은 "인식 못 하는 코드 문자열" 케이스이지 "코드 부재(`null`)" 케이스가 아니다), `null` 이 같은 fallback 경로로 안전하게 흡수되는지는 실제 분류 switch 구현을 봐야 확정된다. **target 은 이미 이 리스크를 스스로 식별**하고 "확인 전에는 (4)를 완료로 보지 말 것" 이라는 gate 를 §변경제안(4) 본문에 적어 두었다 — 이는 criterion 3(무근거 번복 금지)·4(암묵적 가정 충돌 회피)를 절차적으로 충족한다.
  - 제안: 이 gate 가 산문 안에만 있고 `## 체크리스트` 항목으로는 승격돼 있지 않다. `- [ ] spec 반영 — 7항목` 아래에 `- [ ] (4) 완료 전 R-CC-15 unknown-code fallback 이 code:null 을 흡수하는지 코드 확인` 을 별도 체크박스로 추가하면, "spec 반영 7항목" 체크가 이 하위 검증 없이 조기 완료되는 것을 구조적으로 막는다 (메모리 교훈: "plan 체크박스 = 실제 상태" 계열 재발 방지).

- **[INFO]** WS §4.4 "strip-only 결정" Rationale 확장 시 기각된 대안 문구가 여전히 유효함을 명시
  - target 위치: `## 변경 제안 (7)` 첫 불릿 (WS §4.4 Rationale 제목·본문 확장 지시)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `### ai_message.llmCalls[] 외부 수신자 strip (strip-only 결정)` — "**기각된 대안**: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고 부분적이며..."
  - 상세: target 이 지시하는 확장(strip 대상을 "위치·이벤트 무관"·"WS fanout + EIA REST `getStatus()` 양쪽" 으로 넓힘)은 strip 메커니즘 자체의 범위 확대이지, 기각됐던 "값-레벨 마스킹으로 전환" 을 재도입하는 것이 아니다(실측 확인: `1-data-model.md`/EIA §R17 본문 어디에도 `llmCalls` 에 `deepRedactSecrets` 를 적용하자는 제안은 없다 — masking 은 `conversationConfig`/`result`/`error`/`conversationThread` 등 별개 필드에만 쓰인다). 다만 Rationale 문구를 넓히는 편집을 실제로 수행하는 사람(planner)이 "기각된 대안" 단락까지 함께 건드리다 그 문구를 삭제/약화시킬 위험이 실무적으로 있다.
  - 제안: (7) 집행 시 "strip-only 결정" 의 "기각된 대안" 문단은 **그대로 보존**하라는 한 줄을 명시적으로 추가하면, 편집자가 제목·본문 확장과 기각 문단을 혼동해 함께 지우는 사고를 예방한다 (target 이 이미 §R17 잔여 항목 보존 지시("§R17 재서술 시 열린 항목을 지우지 말 것")를 §7에 두고 있으므로, 동일 원칙을 WS §4.4 Rationale 에도 한 줄만 추가하면 됨).

## 요약

target 이 인용하는 모든 과거 Rationale(WS §4.4 wire 필드 caveat/PR #945/2026-08-13 갱신, EIA R17, EIA §6.2 blockquote 실제 텍스트, `1-data-model.md §2.14` 현재 구조, `15-chat-channel.md R-CC-15`)을 spec 원문과 대조한 결과 전부 실재하며 인용이 정확했다. target 의 핵심 조치들 — (1) "직접 재작성 대신 caveat" 채택을 유지하며 안쪽 JSON 재작성을 철회, (3) blockquote 오서술만 정정(오너십 분리 구조는 그대로 유지), (7) strip 범위 확장 시 기존 Rationale 본문을 코드 현실에 맞춰 갱신 — 은 모두 기각된 대안을 조용히 되살리는 것이 아니라 **기존에 채택된 원칙을 실제 구현 범위에 맞게 정정·확장**하는 패턴이며, 결정을 뒤집는 곳(strip 깊이 (a)/(b) 선택 등)마다 새 근거를 함께 적었다. WS 내부 전용 필드(`waitingNodeType` 등)를 EIA 표면에 끌어오지 않는 등 오너십 경계도 명시적으로 존중하고 있다. 유일하게 짚을 지점은 (4)의 `error.code: null` 이 R-CC-15 의 닫힌-분류 가정에 영향을 줄 수 있다는 점인데, target 스스로 "확인 전 완료로 보지 말 것" 이라는 gate 를 이미 걸어 두어 실질 위험은 낮다 — 다만 그 gate 가 체크리스트가 아니라 산문에만 있어 누락 위험이 남는다.

## 위험도

LOW
