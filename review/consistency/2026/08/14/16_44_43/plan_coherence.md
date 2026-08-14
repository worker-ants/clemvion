## 발견사항

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 의 라인 번호 이동이 형제 plan 의 미해결 인용을 추가로 밀어냄
  - target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 글로브에 `strip-external-only-fields.ts` 항목이 line 9 부근에 삽입되어(diff `@@ -6,6 +6,7 @@`), 그 아래 본문 전체가 +1 line 이동함 (예: "replay 중 cancel" 불릿이 origin/main:387 → HEAD:388, `execution.node.cancelled` 행이 origin/main:186 → HEAD:187)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (`spec_impact` 에 동일 파일 등재, `owner` 미상이나 활성 in-progress). `#9` 절의 미해결 체크리스트(`- [ ]`, line 524·529)가 `spec/5-system/6-websocket-protocol.md:375` "replay 중 cancel" 표현을 정밀도 문제로 지목해 수정 대상으로 남겨 두고 있고, `#6 보강 (4)` 는 같은 파일 `:186` 을 인용해 "생산자 목록에 §2.3 가드 추가 + `error` optional 화" 를 planner 위임 항목으로 남겼다.
  - 상세: 검증 결과 이 인용들은 **이번 diff 이전(origin/main 시점)부터 이미 12줄 안팎 stale** 했다(`:375` 인용 시점 실제 내용은 지금 388행). 즉 주된 원인은 이번 diff가 아니라 그 사이 다른 커밋들이며, 이번 diff는 거기에 +1줄을 추가로 얹은 정도다. 다만 `#6 보강 (4)` 가 요구한 두 변경(3번째 생산자 `엔진 DB 관측 가드` 추가·`error` optional 서술)은 **현재 target 에 이미 반영되어 있음**을 확인했다 — 그런데 해당 plan 문서에는 이 항목을 완료로 표시하는 체크박스가 없다(번호 매긴 프로즈일 뿐). 반대로 `#9`(line 524)의 "조기 종료" 표현 정밀화 항목은 **아직 미반영**이다(현재 388행 문구가 그대로 "진행 중 turn 을 조기 종료" 를 쓴다).
  - 제안: 이번 PR 이 직접 조치할 필요는 없음(내용 충돌 없음, 소유 plan 도 다른 owner). 다만 `spec-update-node-cancellation-shutdown-classification.md` 를 다음에 집행할 때 `:186`/`:375` 같은 raw line 인용을 신뢰하지 말고 본문 텍스트("execution.node.cancelled" 행 / "replay 중 cancel" 불릿)로 재탐색할 것 — 이 세션 자신의 다른 plan들(`eia-terminal-payload.md` 등)이 이미 "줄 번호는 리팩터마다 stale 해지므로 심볼로 고정한다" 원칙을 채택한 것과 동일한 이유. 겸사겸사 `#6 보강 (4)` 를 완료로 마킹하면 좋다(이미 구현돼 있음).

그 외 항목은 target(`spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·`spec/1-data-model.md` diff, `origin/main...HEAD`)과 `plan/in-progress/**` 사이에서 **미해결 결정 우회·선행 조건 미해소·후속 항목 누락**에 해당하는 문제를 찾지 못했다. 구체적으로 대조 확인한 것:

- `eia-terminal-payload.md`(W2 `error.code` 옵셔널 결정, `nodeId` nullable 해소, §6.2 봉투 정합)의 "함께 넘기는 spec 항목" 4건 전부가 target 에 정확히 반영되어 있음(§6.2 `payload:` 래퍼 추가, `interaction` 블록 Planned 표기, URL 상대경로화, §4.4.6 인용 오귀속 정정 → WS 문서로 재지정).
- `spec-draft-eia-62-waiting-payload.md`(1)~(7) 전 항목이 diff 에 정확히 대응(§6.2 blockquote 를 "webhook↔SSE" 에서 "논리 표기↔실 wire" 로 재서술, `error.code`/`nodeId` null caveat, `1-data-model.md §2.14` 갱신, `llmCalls` 깊이-무관 strip 으로 WS Rationale + EIA §R17 동시 갱신). `turnDebug` naming collision 은 계획대로 **의도적으로 미반영**(별건으로 분리, 체크박스 `[ ]` 유지) — 충돌 아님.
- `spec-draft-eia-notification-payload-contract.md` 의 §6 도입부 재구조화(필드 집합/채널별 봉투/행동 계약 단일화)는 이번 diff 이전(origin/main)에 이미 반영돼 있고, 이번 diff 가 그 위에 후속 정정(§6.2 봉투 누락분·`error.code` null)만 얹는 구조로 일관됨.
- `R-CC-15`/`CCH-ERR-04`(`error.code === null` → `executionFailedInternal` fallback) 는 target 이 새로 인용한 사실이 실제 코드(`execution-failure-classifier.ts`)와 일치함을 직접 확인(사전에 이미 명문화돼 있던 조항).
- `spec-sync-external-interaction-api-gaps.md`·`spec-sync-websocket-protocol-gaps.md`(정본 트래커) 의 미구현 항목 체크 상태가 이번 diff 의 실제 구현 범위(스펙 문서만 변경, `durationMs`/`result.outputs`/`error` 객체화 구현은 미착수)와 정확히 일치.
- `spec-link-integrity` 가드 13/13 통과 확인 — 헤딩 텍스트 변경(`### llmCalls 외부 수신자 strip — …`)으로 인한 앵커 변경이 깨진 참조를 만들지 않음.
- `codebase/` diff(`strip-external-only-fields.ts` 신설, `websocket.service.ts`/`interaction.service.ts` 수정)가 spec Rationale 서술과 정확히 대응.

## 요약
Plan 정합성 관점에서 이번 diff(`spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·`spec/1-data-model.md`)는 세 개의 관련 plan(`eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)이 이미 다중 라운드에 걸쳐 검증·합의한 항목들을 정확히 반영하며, 미해결 결정을 우회하거나 선행 plan 을 무시한 흔적이 없다. 유일하게 확인한 문제는 이번 diff 가 아니라 이미 존재하던 drift — 다른 활성 plan(`spec-update-node-cancellation-shutdown-classification.md`)이 같은 파일에 raw line-number 로 미해결 인용을 남겨 뒀고, 이번 diff 의 프론트매터 삽입이 그 stale 도를 1줄 더 키웠다(원인의 대부분은 사전 drift). 차단 사유 없음.

## 위험도
LOW
