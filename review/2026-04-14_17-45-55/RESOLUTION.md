# Code Review 조치 내용 (2026-04-14_17-45-55)

## 요약
Critical 없음. Warning 12건 중 보안/동시성/테스팅 카테고리에서 우선순위 높은 항목을 조치했으며, 대규모 아키텍처 리팩토링(이중 폴링 제거, waiting 로직 공유 훅화, useShallow 통합, TerminalStatus 공유 타입화)은 이번 PR 범위를 벗어나 후속 과제로 남깁니다.

---

## 조치 완료 (Warning)

### 1. `window.open` URL 프로토콜 검증 누락 — **해결**
- 신규 모듈 `frontend/src/components/editor/run-results/button-config.ts`를 만들어 `openExternalLink(url)` 헬퍼로 `http:`/`https:`만 허용하도록 화이트리스트 검증 추가.
- `page.tsx`의 `handleLinkButtonClick`, `result-detail.tsx`의 `handleLinkButtonClick`에서 `window.open` 직호출 제거 후 헬퍼 사용.
- 검증 단위 테스트 `button-config.test.ts`에서 `javascript:`, `data:`, 잘못된 URL이 차단됨을 확인.

### 2. `waitingButtonConfig` 런타임 검증 누락 — **해결**
- 같은 모듈에 `parseButtonConfig(raw)` 추가. `id`/`label`/`type` 누락, 허용되지 않은 `style`, 비HTTP 스킴의 link 버튼을 모두 드롭. 유효 버튼이 0개이면 `null` 반환.
- `page.tsx`와 `result-detail.tsx`의 `as Record<string, unknown>` 강제 단언을 제거하고 `parseButtonConfig`로 대체. 파싱 실패 시 해당 UI 섹션을 렌더링하지 않음.
- 스키마 어긋남 케이스를 포함한 단위 테스트 추가.

### 3. `"__continue__"` 매직 문자열 — **해결**
- `use-execution-interaction-commands.ts`에 `CONTINUE_BUTTON_ID` 상수 export. `clickContinue` 구현에서 해당 상수 사용.

### 4. `sendMessage` `turnIndex` 누적 검증 공백 — **해결**
- `use-execution-interaction-commands.test.ts`에 AI 응답이 사이에 끼는 시나리오에서 `userTurns === [1, 2]`를 단언하는 테스트 추가.

### 5. 대화 메시지 전송 테스트 커버리지 공백 — **해결**
- `execution-detail-waiting.test.tsx`에 AI 대화 전송 케이스는 유지. 신규로 `endConversation` 버튼이 `execution.end_conversation` 이벤트를 emit하는지 검증하는 테스트 추가.

### 6. 파생 상태 재렌더 안정성 미검증 — **해결**
- 동일 `waitingNodeId`로 `pauseForForm`이 반복 호출될 때 재렌더로 인한 부작용이 없는지 확인하는 테스트 추가.

### 7. form submit 후 store 초기화 검증 — **해결**
- form Submit 후 `waitingNodeId === null`, `status === "running"`임을 단언하는 테스트 추가.

### 8. `ExecutionInteractionCommands` 문서화 부족 — **해결**
- 각 메서드에 JSDoc 주석을 추가하여 `nodeId`, 흐름적 의미를 명시.

---

## 후속 과제로 남긴 항목

다음 항목은 본 PR의 "실행 상세 페이지에서 waiting 상호작용을 지원한다" 범위를 넘어서므로 별도 작업으로 분리합니다. 지금 도입하면 다른 영역(에디터 드로어, 공통 상태 모델)까지 파급되어 회귀 리스크가 커집니다.

| 번호 | 항목 | 이유 |
|-----|------|------|
| W-3 | `useExecutionStore.reset()` 경쟁 조건 (실행별 격리 스토어) | 전체 스토어 구조 변경이 필요. 현재 UX 상 두 실행 페이지/에디터가 동시에 활성화되는 경로는 없어 긴급도 낮음. |
| W-4 | `sendMessage` 낙관 업데이트 롤백 | WS emit ACK 지원이 필요. 기존 에디터 드로어도 동일 전제로 동작하며 별도 오류 채널이 없음. |
| W-5 | 렌더 단계 setState | React 공식 문서의 "derived state in render" 패턴에 해당 (`useState` 패턴). 린트 통과 및 기존 React 18 Concurrent 대응 패턴. |
| W-6 | 이중 폴링 (executionQuery + useExecutionEvents) | 요약 카드용 REST 쿼리와 상호작용 상태용 store 폴링이 다른 데이터 모델을 갱신. 단일화하려면 store에 execution-level 필드 추가 필요. |
| W-10 | waiting UI 중복 (page vs drawer) | 두 경로의 레이아웃이 다르므로 훅 추출이 비자명. 별도 리팩토링 주제. |
| W-11 | `useShallow`로 9개 selector 통합 | 성능 영향 미미. 가독성 개선 차원. |
| W-12 | terminal status 공유 유니온 타입 | 백엔드와의 shared types 패키지 정비가 선행 필요. |

Info 레벨 제안(#1~12)은 본 조치와 중복되는 항목을 제외하고는 동일 기준으로 후속 과제로 이월.

---

## 검증
- `npm run lint` (frontend): clean.
- `npx vitest run` (frontend): 547 tests passed (36 files).
- `npm run build` (frontend): success.
- `npm test` (backend): 968 tests passed (변경 없음).
- `npm run build` (backend): success (변경 없음).
