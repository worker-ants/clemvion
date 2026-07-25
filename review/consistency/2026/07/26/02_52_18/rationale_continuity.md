# Rationale 연속성 검토 — spec-draft-node-cancellation-chat-channel-correction

## 대상

- target: `plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`
- 편집 대상 spec: `spec/conventions/node-cancellation.md` (§1, §6), `spec/4-nodes/1-logic/10-parallel.md` (244행)

## 검증 방법

target 이 인용하는 코드·문서 근거를 직접 열어 실측 대조했다:

- `spec/conventions/node-cancellation.md` 전문 (§1 24행, §6 137~139행, `## Rationale`)
- `spec/4-nodes/1-logic/10-parallel.md` 244행
- `codebase/backend/src/nodes/core/node-handler.interface.ts` 190~246행 (JSDoc)
- `spec/5-system/15-chat-channel.md` `## Rationale` (R1~R8), `spec/1-data-model.md` §2.8 Trigger.type
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (추가 위임 #5, 2026-07-25, #2~#4)
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
- `plan/in-progress/node-cancellation-residual-signal-propagation.md`
- git 커밋 `e83da5052` (#1019) 및 `cafe24.handler.spec.ts` / `makeshop.handler.spec.ts` / `*-api.client.spec.ts` 테스트 실체
- `spec/conventions/spec-impl-evidence.md` `## Rationale` (R-1, R-6), `spec-code-paths.test.ts` 가드 로직

## 발견사항

### [INFO] 변경 1 은 기존 Rationale 을 어기는 게 아니라 오히려 그것과의 불일치를 바로잡는 것 — 근거로 명시 인용하면 더 강해진다

- target 위치: target 문서 "변경 1 — chat-channel 은 노드가 아니다 (Critical)" 절, `spec/conventions/node-cancellation.md` §1·§6 diff
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` **R1. 새 트리거 유형 신설하지 않음** — "Webhook 트리거 + `chatChannel` config 채택 ... 신규 노드로 두면 트리거 종류가 N+1 로 늘고 ... 코드 중복"(명시적으로 "노드로 만드는 안"을 기각한 대안으로 적어둠). `spec/1-data-model.md` §2.8 Trigger.type 행("chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel 변형")도 동일 결론.
- 상세: `node-cancellation.md` §1/§6 의 기존 문구("... Email / chat-channel / 이커머스 통합 ...", "chat-channel 노드 signal 전파")는 R1 이 명시적으로 기각한 "chat-channel = 별도 노드" 라는 전제를 이미 어기고 있었다. 즉 target 이 지금 하려는 편집은 **새 결정의 도입이 아니라, 다른 spec 파일(15-chat-channel.md)에 이미 박혀 있는 확정 Rationale 을 node-cancellation.md 에 뒤늦게 정합시키는 것**이다. `node-handler.interface.ts:239-244` JSDoc 은 이미 이 정정을 반영해 커밋돼 있고(코드가 spec 보다 먼저 옳아짐), `node-cancellation-residual-signal-propagation.md:35` 도 chat-channel 항목을 "won't-do (범주 오류)" 로 이미 체크 완료해 두었다 — 코드·잔여 plan·본 draft 세 곳이 서로 정합적이다.
- 제안: target 의 "변경 1" 상세 서술 또는 §6 표의 신규 셀 문구에 `spec/5-system/15-chat-channel.md#r1-새-트리거-유형-신설하지-않음` 링크를 명시 추가하면, 이 정정이 "실측으로 새로 발견한 사실"이 아니라 "이미 합의된 R1 을 다른 문서에 소급 적용하는 것"임이 리뷰어에게 더 분명해진다. (선택 사항 — 없어도 결론은 이미 맞다.)

### [INFO] `code:` frontmatter 미갱신 결정이 `spec-impl-evidence.md` R-6 취지와는 다소 거리가 있으나 가드 위반은 아니다

- target 위치: target 문서 "범위 밖 (의도적)" 절 — "`frontmatter.code:` 에 commerce client/handler 등재 여부 ... 이번 초안에서 바꾸지 않는다"
- 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` `## Rationale` **R-6** — "spec `.md` `code:` → `spec-code-paths.test.ts` — spec 이 **약속한 구현 surface** (책임용)"
- 상세: target 은 §6 표에서 MakeShop/Cafe24 행을 `— (Planned)` → `✓` 로 올리면서도(변경 2), 두 client/handler 파일(`cafe24-api.client.ts`, `cafe24.handler.ts`, `makeshop-api.client.ts`, `makeshop.handler.ts`)을 `code:` 리스트에 추가하지 않기로 명시적으로 결정했다. R-6 의 "code: 는 spec 이 약속한 구현 surface" 라는 취지에는 살짝 어긋나지만, `spec-code-paths.test.ts` 가드는 "status 가 partial/implemented 면 code: 중 **최소 1개**가 실재 파일에 매치"만 요구하고(`http-request`/`database-query` handler 로 이미 충족) 완전성은 강제하지 않는다 — R-1 이 "글로브 허용... 마이그레이션 부담을 낮춤"으로 이미 이 느슨함을 의도적으로 채택해 두었다. 따라서 CI 를 깨지 않고, target 도 이 결정을 "이번 초안에서 바꾸지 않는다"고 명시적으로 남겨 두어 무근거 누락은 아니다.
- 제안: 필수는 아니나, "범위 밖" 서술에 "R-6 의 완전성 취지보다는 R-1 의 글로브 허용/최소 매치 정책을 따른다"는 한 줄을 덧붙이면 이후 리뷰어가 같은 질문을 다시 던지는 것을 막을 수 있다.

## 교차 검증으로 확인한 사항 (참고, 발견사항 아님)

- 변경 2(MakeShop/Cafe24 §6 갱신)는 `origin/main` 커밋 `e83da5052`(#1019, 현재 HEAD 의 ancestor)로 실제 병합되어 있고, 인용된 4개 테스트(`cafe24.handler.spec.ts:750` 등)도 실재해 "client 재throw + handler 재throw 둘 다 필요" 라는 주장이 사실과 일치한다.
- target diff 의 라인 번호(§1 24행, §6 137/138/139행, `10-parallel.md` 244행)는 현재 파일 실제 내용과 정확히 일치한다 — stale diff 아님.
- target Rationale 의 "기각한 대안 — impl-done Critical 을 우회한다" 항목은 `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 를 정확히 인용하고 있으며, 그 문서의 실제 내용(규약에 하향 조항이 없다는 지적)과 일치한다 — 지어낸 역사가 아니다.
- 위임 문서(`spec-update-node-cancellation-shutdown-classification.md` 추가 위임 #5)의 "제안"은 "행을 삭제하거나, 남긴다면 성격을 바꿔 기재"라는 **두 옵션을 모두 명시**했고, target 은 후자를 택하며 그 이유("삭제하면 재발 근거가 사라진다", "JSDoc·spec 양쪽 복제 이력")를 본문+Rationale 양쪽에 남겼다 — 결정 번복이 아니라 문서가 이미 열어둔 선택지 중 하나를 근거와 함께 채택한 것.
- 저장소 전역에서 chat-channel 을 cascade 대상으로 묶은 곳은 `node-cancellation.md` 단 한 곳뿐이었다(§1/§6). `1-data-model.md`, `4-execution-engine.md`, `data-flow/3-execution.md`, `execution-context.md` 등 다른 모든 곳은 이미 "webhook 트리거의 config 변형" 으로 일관 서술 — target 의 정정이 새로운 고립점을 만드는 게 아니라 유일한 예외를 없애는 것.

## 요약

target 초안은 과거 Rationale 을 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 "변경 1"(chat-channel 범주 오류 제거)은 `spec/5-system/15-chat-channel.md` R1("chat-channel 을 별도 노드로 만들지 않는다")과 `spec/1-data-model.md` 의 Trigger.type 정의라는 기존 확정 Rationale을 node-cancellation.md 에 소급 정합시키는 정정이며, 코드(JSDoc)·잔여 plan 모두 이미 같은 결론으로 갱신되어 있어 세 레이어가 서로를 보강한다. "변경 2"(MakeShop/Cafe24 §6 상태 갱신)는 실제 병합된 커밋·테스트로 뒷받침되는 SPEC-DRIFT 정정이고, 삭제 대신 철회 표기를 택한 이유·impl-done Critical 우회를 기각한 이유를 모두 본문 Rationale 에 남겨 "결정의 무근거 번복" 에 해당하지 않는다. 발견한 두 건은 모두 INFO 수준으로, (a) 기존 R1 을 명시 인용하면 근거가 더 견고해진다는 보완 제안, (b) `code:` frontmatter 완전성에 관한 R-6 취지와의 미세한 거리(가드 위반은 아님)다.

## 위험도

LOW
