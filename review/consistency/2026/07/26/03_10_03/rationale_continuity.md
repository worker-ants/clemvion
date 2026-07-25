# Rationale 연속성 검토 — node-cancel-chat-9f3e (impl-done)

## 검토 범위 참고

프롬프트 payload(`_prompts/rationale_continuity.md`, 374KB)는 `spec/conventions/` 전체를
컨텍스트 예산 안에 담으려다 정작 이번 diff 의 실제 target 인
`spec/conventions/node-cancellation.md` 본문을 "컨텍스트 예산 초과로 생략된 파일" 목록(2924행)에
누락시켰다. 프롬프트 지시("여기 없다는 사실을 '해당 내용이 없다' 의 근거로 삼지 말 것")에 따라
payload 를 신뢰하지 않고, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-chat-9f3e`)의 실제 파일을 직접 `Read`/`git diff origin/main`/`git log -p` 로 열어 재구성했다.

실제 diff (`origin/main..HEAD`, 5 커밋, 최종 `babaf0030`):
- `spec/conventions/node-cancellation.md` (§1, §6)
- `spec/4-nodes/1-logic/10-parallel.md` (244행)
- `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc)
- `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md` (신규)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (갱신)

핵심 변경 두 가지: (1) `chat-channel` 을 "노드" 취급하던 §1/§6/JSDoc 기재를 "노드가 아니다"로
정정(범주 오류 철회, N/A), (2) MakeShop/Cafe24 §6 두 행을 `— (Planned)` → `✓` 로 갱신 (이미
`origin/main` 커밋 `e83da5052`(#1019)로 병합된 구현을 반영).

## 발견사항

### [INFO] `node-cancellation.md` 자체 `## Rationale` 섹션에는 이번 정정의 근거가 없다 — 표 셀 인용으로 대체됨

- target 위치: `spec/conventions/node-cancellation.md` §6 137행(신규 N/A 행) 대비 143~158행 `## Rationale`
- 과거 결정 출처: 없음 — 이 항목은 "과거 Rationale 위반"이 아니라 "본 문서 고유 Rationale 섹션 갱신 누락" 관점의 보완 제안
- 상세: CLAUDE.md 규약상 "결정의 배경·근거"는 해당 spec 문서 끝 `## Rationale` 이 SoT 위치다. 이번 정정(chat-channel 철회 + commerce 2행 승격)은 §6 표 셀 안에 인라인으로 충분히 설명돼 있고(`../5-system/15-chat-channel.md` CCH-AD-05·Rationale R1, `../1-data-model.md#28-trigger` 링크 포함) `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md` 의 `## Rationale` 에도 "왜 삭제가 아니라 철회 표기인가" / "기각한 대안 — impl-done Critical 우회"가 상세히 남아 있어 실질적 정보 공백은 없다. 다만 `node-cancellation.md` 자체의 하단 Rationale 섹션(이 컨벤션 문서를 향후 참조할 사람이 1차로 보는 자리)에는 이 변경에 대한 subsection 이 없어, `audit-actions.md` 가 채택한 패턴(`### 기각된 대안` 하단 subsection)과는 결이 다르다.
- 제안: 필수는 아니나, `## Rationale` 말미에 짧은 subsection(예: "### 왜 chat-channel 이 §1/§6 대상에서 빠졌는가")을 추가해 표 셀 텍스트를 요약 인용하면, 이 문서만 단독으로 읽는 향후 리뷰어에게도 배경이 즉시 보인다.

## 교차 검증 (발견사항 아님, 결론 보강용)

- **이 정정은 기각된 대안의 재도입이 아니라 반대 방향** — `chat-channel` 을 node-cancellation 대상으로 나열한 기존 §1/§6 문구가 오히려 `spec/5-system/15-chat-channel.md` `## Rationale` **R1. 새 트리거 유형 신설하지 않음**("chat-channel 을 별도 노드로 두지 않는다", "신규 노드로 두면 트리거 종류가 N+1 로 늘고 코드 중복")과 `spec/1-data-model.md` §2.8 Trigger.type 정의를 어기고 있던 drift 였다. 이번 diff 는 그 R1 결정을 `node-cancellation.md` 에 뒤늦게 소급 정합시키는 것이며, 저장소 전역에서 `chat-channel` 을 abortSignal cascade 대상으로 묶은 곳은 `node-cancellation.md` 단 한 곳뿐이었다(`1-data-model.md`/`4-execution-engine.md`/`14-external-interaction-api.md`/`6-websocket-protocol.md`/`data-flow/3-execution.md`/`chat-channel-adapter.md` 는 이미 "webhook 트리거의 config 변형 + outbound 구독자" 로 일관 서술).
- **삭제 대신 철회(N/A) 표기를 택한 근거가 문서화돼 있다** — `plan/complete/spec-draft-...md` `## Rationale`: "행을 지우면 재발 시 근거가 남지 않는다... 이 저장소는 같은 오분류를 spec 과 JSDoc 양쪽에 복제한 이력이 있다"(실제로 `node-handler.interface.ts` JSDoc 도 같은 정정을 받았음을 diff 로 확인). 지어낸 이력이 아니라 실제 git 이력(§1/§6 문구가 최초 커밋부터 chat-channel 을 포함해 왔음을 `git log -p` 로 확인)에 근거한 서술이다.
- **impl-done Critical 우회를 기각한 대안도 근거와 함께 기록됨** — `plan/complete/spec-draft-...md`: "`BYPASS_REVIEW_GUARD=1` 또는 summary 재량 하향... 기각한 이유는 `harness-consistency-summary-downgrade-rule.md` 가 지적한 그대로다." 실제 그 plan 문서 내용과 일치 (규약에 하향 조항이 없다는 지적).
- **MakeShop/Cafe24 §6 승격(변경 2)은 실제 병합 코드로 뒷받침** — `origin/main` 커밋 `e83da5052`(HEAD 의 ancestor)가 이미 client `AbortController` cascade + handler `AbortError` 재throw 를 구현했고, 인용된 4개 단위 테스트(`cafe24.handler.spec.ts:750`, `makeshop.handler.spec.ts:577`, `cafe24-api.client.spec.ts:137`, `makeshop-api.client.spec.ts` 동일)가 실재한다. `node-cancellation.md` 자체 Rationale 의 "표준 `AbortSignal` API 채택 근거" 원칙과도 정합 — 새 메커니즘을 도입한 게 아니라 기존 §4 cascade 패턴을 그대로 재사용했다.
- **본 검토 이전에 동일 diff 를 대상으로 한 `--spec` 단계 rationale_continuity 검토**(`review/consistency/2026/07/26/02_52_18/rationale_continuity.md`, risk LOW)가 이미 같은 결론(R1 소급 정합, 기각 대안 아님)에 도달했고, 그 검토가 남긴 INFO 제안("R1 링크를 표 셀에 명시하라")은 실제 커밋된 §6 137행 텍스트("별도 노드로 두지 않은 근거는 같은 문서 Rationale R1")에 반영돼 있다 — 검토 → 반영 루프가 실제로 작동했다.
- `node-handler.interface.ts` JSDoc, `10-parallel.md` 244행, `node-cancellation.md` §1/§6 세 위치의 chat-channel 서술이 서로 모순 없이 일치한다 (모두 "노드 아님 / webhook 트리거 outbound 어댑터 / cascade 대상 아님").

## 요약

이번 diff 는 과거 Rationale 을 뒤집거나 기각된 대안을 이유 없이 재도입하는 것이 아니라, `spec/5-system/15-chat-channel.md` R1("chat-channel 을 별도 노드로 두지 않는다")이라는 기존 확정 결정과 `node-cancellation.md` §1/§6 의 오래된 drift(문서 최초 커밋부터 존재)를 소급 정합시키는 정정이다. 삭제 대신 철회(N/A) 표기를 택한 이유, impl-done Critical 우회를 기각한 이유가 모두 `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md` 의 `## Rationale` 에 실제 이력과 함께 기록돼 있고, 코드(JSDoc)·§6 표·잔여 plan 세 레이어가 서로 모순 없이 일치한다. MakeShop/Cafe24 §6 승격도 이미 병합된 커밋·테스트로 뒷받침되는 사실 반영이라 별도 결정 번복이 아니다. 유일한 보완점은 `node-cancellation.md` 자신의 하단 `## Rationale` 섹션에 이번 정정을 요약하는 subsection 이 없다는 점(정보는 §6 표 셀과 plan 문서에 이미 충분히 존재)으로, 반드시 필요하지는 않은 INFO 수준 개선 제안이다.

## 위험도

LOW
