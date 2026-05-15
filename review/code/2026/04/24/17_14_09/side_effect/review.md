## 발견사항

---

### [WARNING] 레거시 메시지 렌더 시 `candidates` undefined 런타임 크래시
- **위치**: `candidate-picker.tsx:80`, `collectPickerEntries` (assistant-message.tsx)
- **상세**: DB에 이미 저장된 구 `tool_result` JSON의 `pendingUserConfig` 항목들은 `candidates` 필드가 없다. `CandidatePicker`의 `field.candidates.length === 0` 라인은 `candidates`가 `undefined`일 때 `TypeError: Cannot read properties of undefined`를 던진다. 채팅 히스토리 rehydrate 시 구 메시지가 포함된 세션에서 패널이 완전히 망가질 수 있다.
- **제안**: `CandidatePicker`에서 guard 추가. `const candidates = field.candidates ?? [];` 로 방어하거나, `collectPickerEntries`에서 `Array.isArray(field.candidates)` 체크 후 false면 항목 제외.

---

### [WARNING] `evaluateReviewGuard` — 모든 노드 대상 N×M DB 쿼리 (핫패스)
- **위치**: `workflow-assistant-stream.service.ts:1301–1331`
- **상세**: `finish` 호출마다 `evaluateReviewGuard` 내부에서 스냅샷의 모든 노드를 `Promise.all`로 순회하며 `collectPendingUserConfigWithCandidates`를 호출한다. 각 노드는 `CandidateLookupService.fillCandidates`를 실행하고, pending 필드 수만큼 (최대 4개) DB 쿼리를 병렬 발사한다. 20개 노드 워크플로에서 selector가 빈 노드가 5개뿐이더라도 20번의 `collectPendingUserConfig` 실행 + 빈 pending 미스는 early-return 되지만, selector가 채워지지 않은 노드가 많으면 수십 개 동시 DB 쿼리가 발생한다. Self-review round가 여러 차례 돌 수 있음을 고려하면 p99 지연이 크게 늘 수 있다.
- **제안**: trigger 제외 후 `collectPendingUserConfig` (sync)로 먼저 후보가 필요한 노드를 추려내고, 그 노드에 대해서만 `fillCandidates`를 호출한다. 대부분의 노드는 selector 필드가 채워져 있으므로 `pending.length === 0` early-return이 발동하겠지만, 이 필터링을 DB 쿼리 이전에 명시적으로 수행하면 의도가 명확해지고 불필요한 `fillCandidates` 호출 자체를 없앨 수 있다.

---

### [WARNING] DB 장애 시 `candidates: []` 로 degrade → 리뷰 가드 오발동
- **위치**: `candidate-lookup.service.ts:85–97`, `review-workflow.ts:659–666`
- **상세**: `lookup`에서 DB 오류 발생 시 `warn` 로그 후 `[]`를 반환한다. `review-workflow.ts`의 필터 `!Array.isArray(f.candidates) || f.candidates.length === 0`는 이 결과를 "등록된 리소스 없음" 신호로 해석해 `PENDING_USER_CONFIG_UNMENTIONED` 체크리스트 항목을 생성한다. 즉, Integration DB가 일시 장애일 때 LLM이 실제론 있는 리소스가 없다는 잘못된 안내 메시지를 내보내도록 유도된다.
- **제안**: 조회 실패와 "조회했으나 없음"을 구분하기 위한 세 번째 상태(`candidates: null = 조회 실패, candidates: [] = 없음, candidates: [...] = 있음`)를 도입하거나, 혹은 review 가드에서 조회 실패 케이스를 `candidates`가 없는 legacy 행과 동일하게 "mention 필요" 처리하는 현 동작을 유지하되, warn 로그 메시지에 "리뷰 가드가 오발동할 수 있음"을 명시한다.

---

### [WARNING] `evaluateReviewGuard` 시그니처 변경 — `private` 이지만 파라미터 2개 추가
- **위치**: `workflow-assistant-stream.service.ts:1275–1286`
- **상세**: `workspaceId`, `currentWorkflowId` 두 파라미터가 추가되어 sync → async로 전환됐다. `private` 메서드이므로 외부 호출자는 없으나, 해당 메서드를 spy/stub하는 단위 테스트가 존재한다면 타입 불일치로 컴파일 실패한다.
- **제안**: 현재 spec 내에서는 문제 없으나, 통합 테스트에서 이 메서드를 직접 참조하는 경우를 확인할 것.

---

### [INFO] `CandidatePicker.confirmed` 상태와 Undo 간 비동기화
- **위치**: `candidate-picker.tsx:56–58`, `editor-store.ts:471–488`
- **상세**: 사용자가 Confirm 하면 `setConfirmed(true)` (컴포넌트 로컬 상태)와 `updateNodeConfigField` (store, Undo 스택 push)가 동시에 실행된다. 이후 사용자가 Ctrl+Z로 Undo하면 store의 config는 복구되지만 picker의 `confirmed` 상태는 여전히 `true`로 남아 "✓ 설정됨" 뷰가 유지된다. 메시지 버블은 리렌더되지 않으므로 실제 config 값과 picker 표시가 불일치한다.
- **제안**: 허용 가능한 UX 트레이드오프라면 현행 유지. 정밀도가 필요하다면 `currentValue` prop이 store를 구독해 실시간 변경을 반영하도록 하고, `confirmed`를 derived state로 전환.

---

### [INFO] `workflow-selector` SETTINGS_HREF 매핑 미스매치
- **위치**: `assistant-message.tsx:22`
- **상세**: `"workflow-selector": "/workflows"` — 서브워크플로가 없을 때 안내하는 경로가 워크플로 목록 페이지다. 사용자 입장에서 "Settings"라는 문맥과 다른 페이지로 이동할 수 있다. 다른 3개 위젯(`/integrations`, `/llm-configs`, `/knowledge-bases`)은 모두 Settings 하위 경로다.
- **제안**: Settings 구조에 따라 `/settings/workflows` 등으로 통일하거나, 문구를 "목록으로 이동"처럼 일반화.

---

### [INFO] `lookupIntegrations`의 이중 슬라이스
- **위치**: `candidate-lookup.service.ts:105–113`
- **상세**: `query.limit = MAX_CANDIDATES`로 DB에 20건을 요청한 뒤 `result.data.slice(0, MAX_CANDIDATES)`를 한 번 더 적용한다. DB가 limit을 정확히 준수하는 한 무해하지만, `IntegrationsService.findAll`이 limit을 무시하거나 추가 항목을 붙이는 경우 안전 장치 역할을 한다.
- **제안**: 의도적인 방어 코드라면 주석 추가. 그렇지 않다면 둘 중 하나 제거.

---

## 요약

이번 변경의 핵심 부작용 위험은 세 가지다. 첫째, 레거시 DB 메시지의 `candidates` 필드 부재로 인한 프런트엔드 런타임 크래시 가능성(즉각 수정 필요). 둘째, `finish` 리뷰 가드가 async로 전환되면서 모든 노드 대상 DB 쿼리를 매 라운드 발사하는 성능 부작용(워크플로 규모에 따라 지연 증가). 셋째, DB 장애 시 `candidates: []` degrade가 리뷰 가드의 오발동으로 이어지는 의미 혼동. 나머지 발견사항은 INFO 수준의 UX 불일치 또는 코드 명확성 문제이며 동작 정확성에는 영향을 주지 않는다.

## 위험도

**MEDIUM**