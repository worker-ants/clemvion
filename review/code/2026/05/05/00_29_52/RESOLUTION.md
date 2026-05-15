# Code Review 조치 결과 — 2026-05-05_00-29-52

대상 커밋: `581802e` (`fix(ai-agent): Preview의 tool 응답을 컴팩트 시스템 라인으로 분리`)
조치 후 검증: lint ✓ · unit test 1151 통과 ✓ · build ✓

## Critical 조치

| # | 발견 | 조치 |
|---|------|------|
| 1 | History 모드(`isLive=false`) `useMemo` 재조립 루프에 `role === "tool"` 분기 누락 → 실행 이력에서 tool 호출이 소리없이 드롭 | `conversation-inspector.tsx` `SummaryView` 내 `useMemo` 루프에 `tool` 분기 추가. `assistant.toolCalls` 를 순회하며 `callNameById: Map<string, string>` 을 빌드해 `toolCallId → name` 매핑. tool 메시지는 `tryParseJson(content)` 으로 `toolResult` 채움. 동일 turnIndex 유지. **assistant 분기에도 `assistantToolCalls` 매핑을 추가**해 SummaryView ToolCallBadge 가 history 에서도 노출되도록 함 |

## Warning 조치

| # | 발견 | 조치 |
|---|------|------|
| 1 | 테스트 전체가 `isLive: true` 고정 — history 경로 미검증 | `History 모드 (isLive=false) 에서도 tool 메시지가 표시된다` 테스트 추가 — outputData.result.messages 에 tool role 메시지 포함, `🔧 / kb_search / 2 items` 모두 검증 |
| 2 | `summarizeToolResult` 경계값 미커버 (단수 배열·빈 객체·단일 키·≤80자·number/boolean) | `summarizeToolResult` 를 export 하고 별도 describe 블록으로 단위 테스트 8개 추가 (null/undefined, 단수/복수 배열, 임계값 정확/초과 문자열, 빈/단일/다중 키 객체, raw value 일관성, nested 방어, 객체값 truncate, number/boolean) |
| 3 | `ToolStatusIcon` 시각적 렌더링 미검증 | success/error/pending 3 분기 모두 lucide class (`lucide-circle-check-big`, `lucide-circle-x`, `lucide-loader-circle`) 기반 querySelector 단언으로 검증. pending 은 `animate-spin` 클래스도 추가 검증 |
| 4 | 키보드 인터랙션 미테스트 | `Enter / Space 키로 tool 라인을 활성화하면 onSelectMessage 가 호출된다` 테스트 추가 |
| 5 | `durationMs` 렌더링 미검증 | 첫 번째 tool 테스트에 `expect(screen.getByText("124ms"))` 단언 추가 |
| 6 | `onSelectItem` 미제공 시 상태 미테스트 | `onSelectMessage 가 없으면 tool 라인이 button 역할을 갖지 않는다` 테스트 추가 |
| 7 | `pending` 상태 tool 미테스트 | 위 (3) 과 합쳐서 pending 케이스 추가 — 결과 요약 미노출 (`/^· /` 텍스트 부재)도 함께 단언 |
| 8 | `baseProps` 에 required prop `conversationMessages` 누락 | `baseProps` 를 `makeBaseProps()` 팩토리로 변경, `conversationMessages: [] as ConversationItem[]` 기본 포함 |
| 10 | 매직 넘버 `80`/`40` 하드코딩 | `SUMMARY_STRING_MAX = 80`, `SUMMARY_VALUE_MAX = 40` 으로 export 상수화. 테스트도 동일 상수 참조 |
| 11 | 객체 값 따옴표 처리 포맷 불일치 (문자열만 따옴표) | 모든 값을 raw 출력으로 통일 (`{x: 42}`, `{x: Hong}`, `{x: true}`). nested object/array 는 `{…}` / `[…]` 로 방어 |
| 12 | 멀티라인 주석 컨벤션 위반 | `summarizeToolResult` JSDoc 1줄로 압축, `if (isTool)` 직전 인라인 주석 1줄로 압축 |

### Warning 9 (Architecture — dispatch 패턴 통일) — 보류

**보류 사유:** SummaryView 의 `items.map` 콜백을 `ToolCompactLine`/`RagBubble`/`MessageBubble` 컴포넌트로 분리하는 변경은 본 PR 의 버그 픽스 범위를 넘는 구조적 리팩토링. 동일 기능 추가 시점에 별도 PR 로 처리할 것을 권장. 현재 콜백 길이 (~140줄) 가 임계점에 가까우니 다음 메시지 타입 추가 전 우선 처리 대상.

## INFO 조치

| # | 발견 | 조치 |
|---|------|------|
| 4 | `ragSourceCount` 선언이 `isTool` early return 이전에 위치 | `isTool` early return 이후로 이동 (불필요한 regex 매치 회피, 의도 명확화) |
| 5 | `String(v)` — nested object 시 `[object Object]` | 객체 분기에서 `typeof v === "object"` 시 `{…}` / `[…]` 로 방어 (Warning 11 와 함께 처리) |
| 9 | `conversationMessages` prop JSDoc 부재 (Live/History 이중 경로) | `ConversationInspectorProps.conversationMessages` 에 1줄 JSDoc 추가 |

### INFO 보류

| # | 발견 | 보류 사유 |
|---|------|-----------|
| 1 | 민감 키 (password/token/secret) UI 노출 | 본 fix 범위 외. tool 결과 마스킹은 백엔드/툴 정의 영역에서 다뤄야 함 (LLM 에 그대로 전달되는 데이터이므로 UI 마스킹은 표면적 처리) |
| 2 | `item.error` 길이 제한 | 현재 길이 노이즈는 미관찰. 문제 발생 시 별도 처리 |
| 3 | `JSON.stringify` 순환 참조 방어 (`ToolDetail`) | 본 변경 영역 밖. 별도 PR |
| 6 | `summarizeToolResult` 별도 모듈 분리 | 함수가 25줄 미만이며 같은 파일의 SummaryView 만 사용 중. 사용처 늘면 분리 |
| 7 | 파일 응집도 ~700줄 | Warning 9 와 동일 — 다음 기능 추가 전 분리 |
| 8 | 테스트 격리 | `makeBaseProps()` 팩토리로 격리는 확보됨 |
| 10 | `aria-hidden="true"` 이모지를 `getByText` 로 쿼리 | jest-dom 의 기본 동작은 `aria-hidden` 영역도 텍스트 매칭 가능 — 의미적 단언이라 변경 불필요 |
