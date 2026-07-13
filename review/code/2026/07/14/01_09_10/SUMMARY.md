# 코드 리뷰 SUMMARY — EIA 후속 F-1 (nodeId 일치 검사)

- 범위: `af2ce2d3d..HEAD` (F-1 2 commits — docs + fix), 7 files
- 실행 reviewer: 9 (requirement, security, side_effect, architecture, api_contract, maintainability, testing, scope, documentation)

## 위험도: 초회 HIGH → fix 후 해소 · **BLOCK: 초회 YES(Critical 1) → 조치 완료**

| reviewer | Critical | Warning | Info |
|---|---|---|---|
| requirement | 1 | 1 | 1 |
| architecture | 1 | 2 | 2 |
| security | 0 | 1 | 4 |
| api_contract | 0 | 2 | — |
| side_effect | 0 | 1 | 4 |
| testing | 0 | 3 | 2 |
| documentation | 0 | 2 | 3 |
| maintainability | 0 | 0 | 4 |
| scope | 0 | 0 | 0 |
| **합계(dedup)** | **1** | **~8** | — |

## Critical (1, dedup) — 조치 완료

- **[requirement+architecture] spec §7.5.1 overclaim** — 내가 추가한 §7.5.1 문장이 "외부 EIA `/interact`·**WS 는 지정**하고 ... in_process_trusted 는 면제" 라 서술했으나, 실제 WS gateway 는 nodeId 를 publisher 로 전달하지 않고(미변경), 같은 diff 의 engine JSDoc("EIA `/interact` 만 전달")·기존 `6-websocket-protocol.md`("WS 는 nodeId 미송수신")와 정면 모순. spec 이 미구현 불변식을 "보장됨" 으로 주장 → SoT 위반.
  - **fix**: §7.5.1 에 **진입점별 커버리지 표** 신설 — EIA `/interact`=적용, `in_process_trusted`=면제, WS·`/continue`=미적용(프로토콜/요청 설계상 nodeId 미전달, plan F-6 후속). engine JSDoc 과 정합.

## Warning 처분

**조치 (same-turn fix)**:
- [requirement/documentation] InteractionService class JSDoc dispatch 표에 `expectedNodeId` 3번째 인자 반영.
- [documentation/side_effect/api_contract] 202→409 breaking behavior CHANGELOG 항목 신설.
- [testing] hooks.service 의 `nodeId:'chat-channel'` placeholder 제거 회귀 가드(dto.nodeId undefined 단언) 추가.

**backlog / 문서화 (plan 이관)**:
- [architecture/security/api_contract] WS·`/continue` nodeId 미적용 → **F-6** 신설(+ §7.5.1 커버리지 표에 명시). WS 는 §6 프로토콜상 nodeId 미전달이라 확장은 별도 결정.
- [architecture] `expectedNodeId` optional positional = fail-open 구조 → F-6 에 options 객체화/context 파생 리팩터 검토 이관.
- [testing] in_process_trusted 면제가 scope-단위(command-agnostic)라 submit_message 1케이스로 대표 검증 — form_submission(handleFormStep)이 실제 nodeId 를 알면서도 면제되는 점은 plan §"스코프 밖" 에 정책 근거 명시.
- [api_contract] EIA breaking-behavior 배포 vs 공지 결정 시점 → **F-3** 에서 처리.

## Info
client-safe 메시지 분리(serverDetail) 검증 통과, isInternalCtx 재사용 응집도, placeholder 안티패턴 제거 등 — 긍정/확인. 차단 아님.
