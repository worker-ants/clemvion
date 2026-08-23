# Rationale 연속성 검토 — SSE/fanout `nodeOutput` allowlist 확장 (3차 재검토, `00_26_17`)

## 검토 대상

- target: `spec/conventions/` scope (impl-done, diff-base `origin/main`). 프롬프트 번들이
  `node-output.md`/`error-codes.md`/`node-cancellation.md`/`secret-store.md`/`swagger.md`/
  diff 본문을 컨텍스트 예산 초과로 절단했으므로, 아래는 실제 워크트리(HEAD)를 절대경로로
  직접 열람해 재구성한 근거다.
- 실제 diff 파일: `spec/5-system/14-external-interaction-api.md` (§R17), `spec/5-system/6-websocket-protocol.md`
  (§4.4 caveat), `spec/conventions/conversation-thread.md` (§8.4 소비처 갱신 정정), `CHANGELOG.md`,
  `codebase/backend/src/shared/utils/node-output-allowlist.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`,
  `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- 이전 라운드 산출물: `review/consistency/2026/08/23/22_26_33/rationale_continuity.md`(WARNING 2·INFO 1),
  `review/consistency/2026/08/23/23_29_27/rationale_continuity.md`(발견 없음, INFO 1, 위험도 NONE) —
  이번 라운드는 그 이후 커밋(`fe4d58de7` CRITICAL 픽스, `0e754c080` WARNING 4건 픽스, `2e0a539dc`/`b813101aa`
  문서 미러)까지 반영된 최종 상태를 본다.

## 결론 먼저

이번 diff 는 §R17 이 스스로 예고해 둔 "SSE/fanout 잔여" 항목을 닫는 계획된 후속 작업이며,
과거 Rationale 이 명시적으로 기각한 대안을 재도입하거나 합의 원칙을 무단 우회하는 지점은
발견되지 않았다. 오히려 이 PR 자체가 이전 라운드(`23_29_27`)가 CRITICAL 로 잡은 "보장이
구현보다 넓다"는 지적을 이 diff 안에서 취소선 + 정정 blockquote + 캐너리 테스트로 정직하게
좁혔고, `0e754c080` 커밋에서 REST 로도 새 4키가 새는 부수효과를 숨기지 않고 CHANGELOG 정정
블록 + canary 로 명시했다. 유일한 잔존 흠은 코드 주석 한 곳이 R17 에 실제로 없는 표현을
소급 인용하는 것으로, 3라운드째 INFO 로만 지적돼 있어 이번엔 WARNING 으로 격상해 등재한다.

## 발견사항

### [WARNING] 코드 주석이 R17 에 없는 표현("렌더에 필요한 키")을 소급 인용 — 2라운드째 미반영

- target 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:84-85`
  ```
  // **표면별로 목록을 가르지 않는다** — 그러면 손-동기화 지점이 둘 생긴다. 이 넷도
  // §R17 이 정의한 "렌더에 필요한 키" 에 해당한다.
  ```
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 전체(실측: `grep -n
  "렌더에 필요한 키" spec/5-system/14-external-interaction-api.md` → 0건). R17 이 실제로 쓴
  표현은 "위젯 파서가 top-level 로 읽는 wire 키"(원판) 및 이번 diff 가 추가한 "wire 전용
  (chat-channel 렌더러)" 갈래 — "렌더에 필요한 키"라는 총칭적 정의는 R17 문서 어디에도 없다.
- 상세: 이 comment 는 `review/consistency/2026/08/23/22_26_33/rationale_continuity.md` INFO
  항목("새 근거를 R17 에 소급 부여하는 형태로 읽힐 소지")에서 이미 지적됐고,
  `23_29_27/rationale_continuity.md` 개별 검증 메모에서 "코드 주석에 그 문구가 그대로 남아
  완전히 반영되진 않았으나 등급이 INFO였다" 로 재확인만 된 채 지금 상태(`00_26_17`)까지
  그대로다. 이 저장소가 memory 로 이미 명문화한 실패 패턴("Rationale '기각된 대안' 은 실제
  이력 필수 — 선례에 없는 근거를 소급 부여하는 것도 같은 결함")과 정확히 같은 형태다. 실질
  위험은 낮다 — chat-channel 4키를 allowlist 에 넣는 **결정 자체**는 R17 표·spec 산문·
  plan 트래커에 이미 근거가 풍부하게 기록돼 있어 이 comment 가 없어도 결정이 무너지지 않는다.
  다만 이 문구가 "R17 이 이미 정의했다" 는 인상을 주므로, 다음에 누군가 새 wire-only 키를
  추가할 때 "R17 의 기존 정의를 확장한다"는 잘못된 전제로 근거 없이 목록을 넓힐 소급 선례가
  될 수 있다. 2라운드 연속 미반영이라 방치 시 반복 재발 소지가 있어 INFO 에서 WARNING 으로
  격상한다.
- 제안: 주석을 "이 넷은 §R17 이 정의한 키가 아니라 chat-channel legacy flat shape 보존을 위한
  **별개 carve-out**(근거: R17 위 표 'wire 전용 (chat-channel 렌더러)' 행)" 로 정정. `22_26_33`
  INFO 가 이미 제안한 문구("이 4키는 신규 handler 설계 가이드가 아니다")를 그대로 반영해도 된다.

### [INFO] `node-output.md` Principle 0 닫힌 레지스트리와의 거리감(4→8키) — 계속 추적 중, 이번 diff 로 악화 없음

- target 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` JSDoc 표 (L44-L51),
  `NODE_OUTPUT_ALLOWED_KEYS` 배열 (L61-L92)
- 과거 결정 출처: `spec/conventions/node-output.md` Principle 0 — `NodeHandlerOutput` 5필드 +
  `_resumeState`/`_resumeCheckpoint`/`_retryState` 3예외로 **닫힌 레지스트리**(실측: L20-L31).
  wire-only 8키(`formConfig`·`conversationConfig`·`buttonConfig`·`interactionType`·`payload`·
  `title`·`rendered`·`nodeType`)는 이 닫힌 목록 어디에도 없다.
- 상세: `23_29_27` 라운드가 이미 이 gap 을 "새로 발견된 위반이 아니라 기존에 식별·기록된
  간극의 연장" 으로 판정했고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  가 owner=planner 로 명시 추적 중이다(이번 diff 에서 `~~4키~~ → **8키**` 로 갱신 확인,
  `git diff origin/main...HEAD -- plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  실측). 이번 SSE 작업이 그 gap 을 **의도적으로 넓혔지만**(4→8키), 그 확장 자체가 spec
  Rationale·plan 트래커·CHANGELOG 세 곳에 모두 근거와 함께 기록돼 있어 "무근거 번복"이
  아니다.
- 제안: 처리 불필요 — 다음 planner 턴에서 Principle 0 에 "EIA/chat-channel wire 조립 레이어가
  얹는 wire-only 필드는 `NodeHandlerOutput` 계약 밖" 각주를 추가하면 해소된다(이미 트래커에
  적힌 처방과 동일).

### [INFO] `egress-masking.md` §2 파이프라인 순서 3단계 서술이 이번 diff 로 낡음 — 이미 planner 소관으로 등재, 미반영은 예상된 상태

- target 위치: (미변경 파일, 참고용) `spec/conventions/egress-masking.md` §2
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 상단 "구현 좌표계는 별도
  규약이 소유한다" blockquote — egress-masking.md 를 마스커·스캐너 파이프라인의 SoT 로 지정.
- 상세: `toFanoutEnvelope` 는 이제 `strip → nodeOutput allowlist → routing` 3단계인데,
  egress-masking.md §2 는 이 diff 에서 갱신되지 않았다(diff --stat 확인: 해당 파일 미변경).
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 `23_29_27 convention_compliance
  W1` 출처로 이미 planner 소관 항목으로 등재돼 있어(실측: 위 plan diff), 이번 라운드가 새로
  발견한 사항이 아니라 알려진 지연이다.
- 제안: 처리 불필요 — 트래킹 유지로 충분.

## 개별 검증 메모 (근거)

- **§R17 CRITICAL 정정 확인**: `fe4d58de7` 커밋이 "REST·SSE 가 이제 같은 강도"라는 초판 정정문을
  다시 취소선 처리하고, `envelope.output`(execution.node.completed/.failed) 은 여전히 deny-list
  잔여임을 명시하는 새 blockquote 를 달았다. 원문(취소선 보존) + 실측 근거(`{}` 로 붕괴하는 버튼
  재개 record) + 캐너리(`websocket.service.spec.ts` `[잔여]` 케이스, 실측 L931) 3박자가 모두
  갖춰져 있어 "자기-반증형 소정정" 관례를 충실히 따른다.
- **`llmCalls` strip-only 결정 불훼손 재확인**: 이번 diff 는 `llmCalls` strip 정책을 건드리지
  않는다 — `toFanoutEnvelope` 의 새 `allowlistFanoutNodeOutput` 은 `stripExternalOnlyFields`
  **다음** 단계로 추가돼 기존 strip 을 대체하지 않고 누적된다(코드 diff 실측).
- **내부 WS(에디터) 불변식 유지**: WS §4.4 caveat 갱신문이 "`waiting_for_input` 의 `nodeOutput`
  키 집합은 공유하지 않는다" 를 명시적으로 추가하면서도 "내부 WS 는 원문 그대로다" 를 그대로
  보존 — `toFanoutEnvelope` 는 이미 `broadcastToChannel` 로 나간 뒤의 새 clone 에만 건다는
  코드 주석과 정합.
- **REST 로 새는 부수효과 투명화**: `0e754c080` W1 이 "REST 도 4키가 통과한다"는 사실을 숨기지
  않고 CHANGELOG 정정 + canary(같은 응답에서 `_retryState` 는 계속 제거됨을 동시 고정)로 남겼다
  — R17 의 "범위는 총칭이 아니라 열거다, getStatus 1곳에만 적용" 원칙은 *적용 endpoint 범위*에
  대한 것이라 이 확장(허용 키 집합 자체가 넓어짐)과 축이 다르며, 두 축을 혼동하지 않고 각각
  기록했다.
- **`conversation-thread.md` 정정의 5조건 충족 확인**: CLAUDE.md §자기-반증형 소정정의 다섯
  조건 — (1) 문장 작성자가 developer 자신(`#1205`, 문서가 스스로 명시), (2) 예고·트리거 문장
  (제품 정의 아님), (3) 실측 반증 동봉(호출부 chokepoint 실측), (4) 취소선 보존 + 인접 서술
  비변경, (5) 커밋 본문 기록(`fe4d58de7`) — 5개 전부 diff 상에서 확인됨.

## 요약

이번 라운드는 새로운 CRITICAL/WARNING 급 Rationale 위반을 발견하지 못했다. 오히려 이 diff
자체가 직전 라운드(`23_29_27`)가 잡은 CRITICAL("`envelope.output` 은 안 닫혔는데 보장 문구는
닫혔다고 썼다")과 `22_51_46` 코드리뷰가 잡은 WARNING 4건(REST 부수 확장·동일성 계약 갭·
CHANGELOG 거짓 서술·미수행 감사 과장)을 모두 취소선+정정+캐너리로 투명하게 해소한 상태다.
유일한 신규 등재는 코드 주석 한 줄이 R17 에 실재하지 않는 표현을 2라운드째 소급 인용하는
것으로, 실질 결정에는 영향이 없으나 "선례 없는 근거의 소급 부여" 패턴이 방치되고 있어
WARNING 으로 격상해 이번에 명시적으로 등재한다. `node-output.md` Principle 0 거리감과
`egress-masking.md` 파이프라인 서술 지연은 둘 다 planner 소관으로 이미 트래킹 중이며 이번
diff 로 악화되지 않았다.

## 위험도

LOW
