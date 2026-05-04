# Code Review 통합 보고서

## 전체 위험도
**HIGH** — History 모드에서 tool 메시지가 재조립 루프에 누락되어 실행 이력 조회 시 tool 호출이 전혀 표시되지 않는 치명적 결함이 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | **History 모드에서 tool 메시지 완전 누락** — `isLive=false`일 때 `SummaryView` 내 `useMemo`의 메시지 재조립 루프에 `role === "tool"` 분기가 없어, 실행 이력 조회 시 tool 아이템이 소리 없이 드롭됨. 새로 추가된 compact tool 라인 기능 전체가 History 모드에서 동작하지 않음 | `conversation-inspector.tsx` — `SummaryView` 내 `useMemo` 루프 | `else if (m.role === "tool")` 분기 추가 후 `toolCallId`, `toolStatus`, `toolResult`, `toolArgs`, `durationMs` 매핑 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **테스트 전체가 `isLive: true` 고정** — History 모드(`isLive: false`) 경로 미검증. Critical 이슈와 직결되며 CI에서 걸러지지 않음 | `conversation-inspector.test.tsx` 전체 | `isLive: false` + `result.outputData`에 tool role 메시지를 포함한 케이스 추가 |
| 2 | Testing | **`summarizeToolResult` 경계값 미커버** — 단수 배열(`"1 item"`), 빈 객체(`{}`), 단일 키 객체, 문자열 ≤80자(truncate 미적용 확인), `number`/`boolean` 비표준 타입 분기가 모두 미테스트 | `conversation-inspector.test.tsx` 테스트 3~5 | 각 분기별 단위 테스트 케이스 추가 |
| 3 | Testing | **`ToolStatusIcon` 시각적 렌더링 미검증** — `pending`(Loader2), `success`(CheckCircle), `error`(XCircle) 세 분기 모두 미테스트 | `conversation-inspector.test.tsx` 전체 | `data-testid` 또는 `aria-label` 기반으로 아이콘 존재 단언 추가 |
| 4 | Testing | **키보드 인터랙션 미테스트** — `handleKeyDown`의 `Enter`/`Space` 키 → `onSelectItem(i)` 경로 미검증 | 테스트 7 (클릭 테스트) | `fireEvent.keyDown(el, { key: "Enter" })` 케이스 추가 |
| 5 | Testing | **`durationMs` 렌더링 미검증** — fixture에 `durationMs: 124` 포함되나 `"124ms"` DOM 노출 여부 단언 없음 | 테스트 1 | `expect(screen.getByText("124ms")).toBeInTheDocument()` 추가 |
| 6 | Testing | **`onSelectItem` 미제공 시 상태 미테스트** — prop 없을 때 `role="button"` 미노출, `tabIndex`·`cursor-pointer` 제거 경로 미검증 | 테스트 7 | `onSelectMessage` 없이 렌더 후 `getByRole("button")` 부재 확인 케이스 추가 |
| 7 | Testing / Requirement | **`pending` 상태 tool 미테스트** — 스트리밍 중 빈번히 발생하는 경로임에도 `toolStatus === "pending"` 케이스 누락 | `conversation-inspector.test.tsx` | pending 상태 아이템으로 summary span 미노출 + 스피너 표시 검증 추가 |
| 8 | Dependency / Side Effect / Requirement | **`baseProps`에 required prop `conversationMessages` 누락** — `ConversationInspectorProps`의 필수 필드가 공유 fixture에 없어, 향후 spread만으로 props를 구성하는 테스트 추가 시 타입 오류 또는 런타임 오류 유발 가능 | `conversation-inspector.test.tsx:29-38` | `baseProps`에 `conversationMessages: [] as ConversationItem[]` 포함하거나 타입을 `Omit<..., 'conversationMessages'>`로 명시 |
| 9 | Architecture / Maintainability | **`SummaryView` 아이템 렌더 분기 패턴 혼재** — `tool` 타입은 early return, `rag` 타입은 최종 return 인라인 조건부로 처리되어 두 패턴이 공존. 새 메시지 타입 추가 시마다 콜백이 비대해지는 구조적 취약점 | `conversation-inspector.tsx:519-615` (`items.map()` 콜백 ~100줄) | `ToolCompactLine`, `RagBubble`, `MessageBubble` 등 타입별 컴포넌트로 분리하고 `map` 내부를 단순 dispatch로 통일 |
| 10 | Maintainability | **매직 넘버 `80`, `40` 하드코딩** — 문자열 truncate 임계값이 상수명 없이 인라인에 존재. 테스트가 동일 값을 직접 참조하여 임계값 변경 시 이중 수정 필요 | `conversation-inspector.tsx:222, 231` | `const SUMMARY_STRING_MAX = 80` / `const SUMMARY_VALUE_MAX = 40`으로 파일 상단 분리 후 테스트에서 동일 상수 참조 |
| 11 | Requirement | **객체 값 따옴표 처리 포맷 불일치** — 문자열 값은 `"value"` 형태로 감싸지만 숫자·불리언은 raw 출력(`42`, `true`)하여 시각적 불일치 | `conversation-inspector.tsx` — `summarizeToolResult` 객체 분기 | 따옴표 제거로 raw 값 통일 또는 JSON 직렬화 형태로 전체 통일 |
| 12 | Scope | **멀티라인 주석이 CLAUDE.md 컨벤션 위반** — `summarizeToolResult` 상단 8줄 JSDoc 블록과 `if (isTool)` 직전 3줄 인라인 주석이 "one short line max" 규정 초과 | `conversation-inspector.tsx` — `summarizeToolResult` JSDoc, `SummaryView` isTool 분기 직전 | 한 줄로 압축하거나 삭제 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `summarizeToolResult`에서 `Object.keys(obj)[0]` 결과를 UI에 직접 노출 — tool 결과가 외부 API 응답이면 `password`, `token` 등 민감 키가 요약 줄에 렌더될 수 있음 | `conversation-inspector.tsx` — `summarizeToolResult` 객체 분기 | 민감 키 블랙리스트(`password`, `token`, `secret`, `key`, `authorization`) 적용 또는 접근 제어 레이어 확인 |
| 2 | Security | `item.error` 문자열 직접 렌더 — React 기본 이스케이프로 XSS는 낮으나 스택 트레이스·내부 경로 노출 가능 | `conversation-inspector.tsx` — tool 라인 렌더 블록 `{item.error}` | 백엔드에서 사용자 노출용 메시지와 내부 로그 분리 또는 길이 제한 적용 |
| 3 | Security | `JSON.stringify` 예외 처리 누락 — `toolResult` 전체를 `<pre>`로 출력 시 순환 참조 또는 대용량 데이터로 런타임 오류 가능 | `ToolDetail` 컴포넌트, Result 섹션 | `JSON.stringify` try-catch 감싸기 + 렌더 크기 상한(50KB) 적용 |
| 4 | Performance | `ragSourceCount` 선언이 `isTool` early return 이전에 위치 — 실제 regex는 단락 평가로 실행 안 되나 코드 의도 불명확 | `conversation-inspector.tsx:524-526` | `ragSourceCount` 선언을 `isTool` early return 이후로 이동 |
| 5 | Performance | `String(v)` — nested object 전달 시 `"[object Object]"` 반환으로 truncate 의미 퇴색 | `conversation-inspector.tsx` — `summarizeToolResult` 문자열 분기 | `typeof v === "object"` 분기 추가 방어 |
| 6 | Architecture | `summarizeToolResult`가 export되지 않아 렌더링 통해서만 간접 검증 — 로직 확장 시 직접 단위 테스트 불가 | `conversation-inspector.tsx:208` | 로직 복잡도 증가 시 `format-tool-result.ts` 유틸 모듈로 분리 및 export |
| 7 | Architecture | 파일 응집도 임계점 도달 — 10개 이상 서브 컴포넌트가 ~700줄 단일 파일에 존재 | `conversation-inspector.tsx` 전체 | 다음 기능 추가 시 `summary-view.tsx` / `detail-view.tsx` / `message-input.tsx` 분리 고려 |
| 8 | Testing / Maintainability | 모듈 스코프 `baseProps`에 `vi.fn()` 공유 — `mockClear()`로 현재는 안전하나 테스트 추가 시 격리 취약 | `conversation-inspector.test.tsx:28-35` | `beforeEach` 내에서 `vi.fn()` 재할당 또는 `vi.clearAllMocks()` 전역 설정 추가 |
| 9 | Documentation | `conversationMessages` prop에 JSDoc 없음 — Live 모드(store 직접 주입)와 History 모드(useMemo 재가공) 이중 경로가 문서화 안 됨 | `ConversationInspectorProps` 인터페이스 | `/** Live: store 주입, History: useMemo가 outputData에서 재가공 */` 단문 주석 추가 |
| 10 | Testing | `aria-hidden` 이모지를 `getByText("🔧")`로 쿼리 — 접근성 시맨틱과 불일치 | `conversation-inspector.test.tsx` 테스트 1 | `data-testid` 사용 또는 `{ hidden: true }` 옵션 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | **HIGH** | History 모드 tool 메시지 재조립 루프 누락 (Critical) |
| Testing | **MEDIUM** | isLive:false 경로·경계값·키보드·ToolStatusIcon 미검증 |
| Security | LOW | 민감 키 UI 노출 패턴, JSON.stringify 예외 처리 누락 |
| Architecture | LOW | SummaryView dispatch 패턴 혼재, 파일 응집도 임계점 |
| Maintainability | LOW | map 콜백 과도한 길이, 매직 넘버, baseProps 격리 |
| Performance | LOW | ragSourceCount 위치, String(v) 네스티드 객체 처리 |
| Documentation | LOW | conversationMessages prop 문서 미비, 80자 책임 경계 |
| Side Effect | LOW | baseProps 필수 prop 누락, Object.keys 키 순서 의존 |
| Dependency | LOW | baseProps 타입 안전성 느슨함 |
| Scope | NONE | 멀티라인 주석 컨벤션 위반 (스타일 문제) |

---

## 발견 없는 에이전트

| 에이전트 | 판정 |
|----------|------|
| API Contract | 해당 없음 — 백엔드 API 인터페이스 변경 없음 |
| Database | 해당 없음 — DB 관련 코드 없음 |
| Concurrency | 해당 없음 — 공유 가변 상태·비동기 사이드 이펙트 없음 |

---

## 권장 조치사항

1. **[즉시] History 모드 tool 메시지 재조립 누락 수정** — `SummaryView` 내 `useMemo` 루프에 `role === "tool"` 분기를 추가하여 `toolCallId`, `toolStatus`, `toolResult`, `toolArgs`, `durationMs`를 `ConversationItem`으로 매핑
2. **[즉시] History 모드 테스트 추가** — `isLive: false` + tool role 메시지 포함 시나리오로 위 수정 사항 검증
3. **[단기] `summarizeToolResult` 경계값 테스트 보완** — 단수 배열, 빈 객체, 단일 키 객체, ≤80자 문자열, `number`/`boolean` 타입 분기 커버
4. **[단기] `ToolStatusIcon` 및 키보드 인터랙션 테스트 추가** — 세 가지 status 아이콘 렌더 단언, `Enter`/`Space` 키 이벤트 검증
5. **[단기] `baseProps`에 `conversationMessages: []` 기본값 추가** — 필수 prop 누락으로 인한 잠재적 타입 오류 예방
6. **[중기] `SummaryView` dispatch 패턴 통일** — `ToolCompactLine` 등 타입별 컴포넌트로 분리하여 `map` 콜백을 단순 dispatch로 정리
7. **[중기] 매직 넘버 `80`/`40` 상수화** — `SUMMARY_STRING_MAX`, `SUMMARY_VALUE_MAX`로 분리하고 테스트에서 동일 상수 참조
8. **[참고] 멀티라인 주석 정리** — CLAUDE.md의 "one short line max" 규정에 맞게 축약 또는 삭제