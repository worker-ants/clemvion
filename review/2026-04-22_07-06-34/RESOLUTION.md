# 리뷰 이슈 조치 내역 — 2026-04-22 (노드 width/height 전파)

대상 리뷰: `review/2026-04-22_07-06-34/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견 | 조치 | 위치 |
|---|----------|------|------|------|
| W1 | Requirement | `@IsNumber` 만으로는 `width: 0` / 음수가 통과해 `??` 폴백을 무력화 | `@Min(1) @Max(10_000)` 추가. `@IsNumber` 는 기본적으로 NaN 을 거부하므로 NaN 도 함께 차단 | `assistant-message-request.dto.ts` |
| W2 | Testing | 경계값(0/NaN/음수) + DTO validator 단위 테스트 부재 | 신규 `assistant-message-request.dto.spec.ts` — `plainToInstance` + `validate` 로 6 케이스(허용/positive/0/음수/NaN/과대) 전부 고정 | backend dto |
| W3 | Maintainability | `...(typeof n.width === 'number' ? { width: n.width } : {})` 패턴 4중 중복 | `tools/workflow-view.ts` 에 `spreadMeasured(source)` 헬퍼 추출. 양의 유한 숫자만 골라 spread 하며 0/NaN 은 자동 누락. `toWorkflowView` + `toShadowSnapshot` 양쪽에서 재사용 | `workflow-view.ts`, `workflow-assistant-stream.service.ts` |
| W4 | Maintainability/Architecture | `250/80/32/24` 매직 넘버가 시스템 프롬프트 문자열에 인라인 | 파일 상단에 `LAYOUT_FALLBACK_WIDTH/HEIGHT`, `LAYOUT_NODE_GAP_X`, `LAYOUT_SIBLING_GAP_Y` 상수 선언 후 템플릿 리터럴 인터폴레이션. 변경 시 한 곳만 수정 | `prompts/system-prompt.ts` |
| W5 | Architecture | React Flow measured ↔ initial-hint 분기 로직이 컴포넌트 본체에 캐스팅·삼항과 함께 혼재 | 신규 `frontend/src/lib/utils/node-size.ts` 에 `getNodeMeasuredSize(node)` 유틸 추출. 측정값 → 이니셜 힌트 순 fallback + 양의 유한 숫자 필터. `assistant-panel.tsx` 는 한 줄 `...getNodeMeasuredSize(n)` 으로 정돈. 단위 테스트 5 케이스 추가 | `lib/utils/node-size.ts`, `__tests__/node-size.test.ts`, `assistant-panel.tsx` |
| W6 | Testing/Maintainability | stream spec 의 `async/await` vs `return …then()` 혼재 | `return .then()` 블록을 `await` 로 통일 | `workflow-assistant-stream.service.spec.ts` |
| I1 | Documentation | `height?` JSDoc 누락, `workflow-view` 헤더에 height 폴백 80px 미언급 | `ShadowNode.height?` 에 JSDoc 추가. `workflow-view.ts` 의 WorkflowView 인터페이스 주석은 이미 "없으면 필드 누락 → 프롬프트가 250×80 폴백" 흐름을 W5/system-prompt 주석과 교차 참조. | `shadow-workflow.ts` |
| I6 | Documentation | spec §5.2 의 `sourceId/targetId` 가 실제 DTO 의 `sourceNodeId/targetNodeId` 와 불일치 (기존 오탈자) | 올바른 필드명으로 정정 | `spec/3-workflow-editor/4-ai-assistant.md` §5.2 |

## 스코프 밖 (별도 과제)

| # | 이유 |
|---|------|
| I2 `as never` → `as unknown as DTO` | 스트림 spec 전체에 반복되는 관용구. 이번 turn 에서 일부만 고치면 일관성만 해침. 테스트 리팩터 전용 PR 로 분리하는 편이 명확함 |
| I3 React Flow v11 경로 dead code 정리 | W5 유틸이 `measured → node.width` 순으로 폴백하는 구조라, v12 에서 initial width 힌트를 주는 사용자 플로우를 여전히 지원. dead code 가 아니므로 유지 |
| I4 regex → JSON.parse 기반 검증 | 현재 테스트는 프롬프트 전체 문자열 유무 정도만 확인. JSON 블록만 뽑아 parse 는 커버리지 과도 — 별도 테스트 품질 PR |
| I5 `toShadowSnapshot` 순수 함수 추출 | 서비스 class 에서 분리할 수 있으나 다른 private helper 도 함께 정돈해야 자연스러움. 큰 리팩터 단위 |
| I7 주석 언어 혼재 (한/영) | 팀 컨벤션 결정 사안 |
| I8 `ShadowNode` 에 렌더 measurement 포함 | 소형 규모에선 수용 가능하다는 리뷰 agent 판단과 일치. 향후 비대해지면 `dimensions` 중첩 객체 고려 |

## 검증

- `npx eslint "src/**/*.ts"` backend → 통과
- `npx jest src/modules/workflow-assistant` backend → 89 케이스 통과 (+6 dto validator, -0 기존)
- `npx jest` backend 전체 → 통과
- `npx nest build` → 통과
- frontend `npx tsc --noEmit` → 통과
- frontend `npx vitest run` → 1012 통과 (+5 node-size)
