# RESOLUTION — EIA 후속 F-1 (nodeId 일치 검사)

리뷰: `review/code/2026/07/14/01_09_10/SUMMARY.md` (초회 BLOCK: YES — Critical 1). 조치 후 해소.

## 조치 항목

| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| C1 | requirement+architecture (CRITICAL) | spec §7.5.1 이 "WS 도 nodeId 지정" overclaim — 실제 미구현, JSDoc·§6-websocket-protocol 과 모순 | fix — §7.5.1 진입점별 커버리지 표 신설(EIA 적용 / trusted 면제 / WS·`/continue` 미적용). engine JSDoc 과 정합 |
| W1 | requirement+documentation | InteractionService class JSDoc dispatch 표에 expectedNodeId 누락 | fix — 매핑 4줄에 `, expectedNodeId` + 설명 |
| W2 | documentation+side_effect+api_contract | 202→409 breaking behavior CHANGELOG 누락 | fix — F-1 전용 `## Unreleased` 항목 신설 |
| W3 | testing | hooks `nodeId:'chat-channel'` placeholder 제거 회귀 가드 부재 | fix — dto.nodeId undefined 단언 추가 |

모두 본 review-fix commit(`refactor(...): ai-review F-1 반영`)에 포함.

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (G-2 wrong-nodeId → 409 포함)

## 보류·후속 항목

`plan/in-progress/eia-command-waiting-surface-guard.md` 로 이관:

- **F-6** (신설): WS continuation·REST `/continue` 의 nodeId 검사 확장. WS 는 §6-websocket-protocol
  설계상 nodeId 미전달이라 확장하려면 프로토콜 서술 갱신 선행, `/continue` 는 body 에 nodeId 파라미터
  자체가 없어 계약 확장 선행. + `expectedNodeId` optional positional=fail-open 구조를 options 객체/
  context 파생으로 견고화하는 리팩터 검토.
- **F-3** (기존): EIA 202→409 breaking-behavior 외부 클라이언트 공지 결정 — 다음 트랙에서 처리.
- 정책 명시(코드 무변경): chat-channel `form_submission`(handleFormStep)은 실제 nodeId 를 알면서도
  `in_process_trusted` scope-단위 면제 대상 — 진입점이 아니라 scope 로 판정하는 의도적 정책(plan §"스코프 밖").
