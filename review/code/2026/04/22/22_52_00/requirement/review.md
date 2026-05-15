### 발견사항

- **[WARNING]** 누출 JSON + 편집 도구 동시 호출 시 상태 불일치 가능
  - 위치: `workflow-assistant-stream.service.ts`, 복구 블록 (`planForTurn === null && assistantText` 조건)
  - 상세: LLM이 plan JSON을 텍스트로 누출하는 동시에 편집 도구(`add_node` 등)도 호출하면, 편집이 먼저 shadow에 적용된 뒤 누출 plan이 복구됩니다. 결과적으로 plan은 `approvedAt` 없이 "승인 대기" 상태이지만 캔버스에는 이미 노드/엣지가 추가된 불일치 상태가 됩니다. `PLAN_AWAITING_APPROVAL` 차단은 `planForTurn && !planForTurn.approvedAt`에 의존하는데, 누출의 경우 tool call 처리 시점에 `planForTurn`이 여전히 `null`이므로 차단이 발동하지 않습니다.
  - 제안: 현재 발생 가능성이 낮더라도, 복구 시 `pendingToolCalls`에 성공한 편집이 있으면 경고 로그 추가 또는 복구를 건너뛰는 조건(`editThisTurn && leak` → skip) 고려. 최소한 코드 주석에 이 예외 케이스를 명시.

- **[WARNING]** SSE 테스트에서 `openQuestions` 필드 미검증
  - 위치: `workflow-assistant-stream.service.spec.ts`, `"emits a synthetic plan SSE event"` 테스트
  - 상세: `leakedPlan` 픽스처에 `openQuestions: ['이메일 Integration ID 를 선택해 주세요.']`가 포함되어 있으나, SSE `plan` 이벤트의 `data.openQuestions` 필드가 검증되지 않습니다. 서비스 코드는 `planForTurn.openQuestions`를 yield에 올바르게 포함하지만 계약이 테스트로 고정되지 않음.
  - 제안: `expect(planEvent!.data).toMatchObject({ openQuestions: ['이메일 Integration ID 를 선택해 주세요.'] })` 추가

- **[WARNING]** `recoverLeakedPlan` 스캔 복잡도
  - 위치: `recover-leaked-plan.ts`, `recoverLeakedPlan` 함수
  - 상세: 모든 `{` 위치에서 `findMatchingBrace`를 호출하므로 최악의 경우 O(n²). 어시스턴트 응답에 코드 예시나 JSON 설명이 많을수록 `{` 수가 늘고 스캔이 반복됩니다. 실제 응답 길이는 제한적이어서 현재는 허용 범위이나 사전 필터링 없음.
  - 제안: `text.includes('"title"') && text.includes('"steps"')` 사전 조건으로 대부분의 비-plan 텍스트를 조기 탈출. 실제 성능 문제가 관측될 경우 적용.

- **[INFO]** `findMatchingBrace`의 단일 따옴표 문자열 처리
  - 위치: `recover-leaked-plan.ts`, `findMatchingBrace` 함수 (`if (c === '"' || c === "'")` 분기)
  - 상세: JSON 표준은 단일 따옴표 문자열을 지원하지 않으나, 함수가 `'`를 문자열 경계로 처리합니다. `tryParseObject`가 `JSON.parse`를 사용하므로 단일 따옴표 JSON은 파싱 실패 → `null` 반환으로 실질적 문제는 없습니다. 단, `"it's done"` 같은 일반 문자열 내 `'` 처리 시 depth 카운팅이 의도치 않게 영향받을 수 있는 극단적 케이스가 이론상 존재합니다.
  - 제안: 허용 가능. 현 상태 유지.

- **[INFO]** `assistantText.replace(leak.matched, '')` — 첫 번째 발생만 제거
  - 위치: `workflow-assistant-stream.service.ts`, 복구 블록
  - 상세: 동일한 JSON 블록이 `assistantText`에 두 번 이상 등장하면 첫 번째만 제거됩니다. 발생 가능성은 극히 낮고 두 번째 블록은 prose로 남아 사용자에게 보입니다.
  - 제안: 현 상태 허용. 필요시 `replaceAll`로 교체.

- **[INFO]** 마크다운 코드 펜스 테스트의 방어적 파싱 패턴
  - 위치: `recover-leaked-plan.spec.ts`, `"recovers a JSON payload wrapped in a markdown code fence"` 테스트
  - 상세: 테스트가 `result!.matched`에서 코드 펜스 마커를 제거하는 정규식을 적용하지만, 구현상 `matched`는 `{`부터 시작하므로 펜스 마커를 포함하지 않습니다. 방어적 교체는 무해하나 `matched`의 실제 경계에 대한 오해를 유발할 수 있습니다.
  - 제안: `expect(result!.matched.trim().startsWith('{'))` assertion 추가로 경계를 명시적으로 고정.

---

### 요약

이번 변경은 실제 관측된 "propose_plan JSON 누출" 이슈를 프롬프트 방어(Option A)와 서버 복구(Option B)의 이중 계층으로 대응하는 의도를 충실히 구현합니다. `recoverLeakedPlan`의 shape 검증이 충분히 엄격하고(title + steps 구조 + 각 step 필드 + action allowlist), 서비스 통합 코드의 실행 경로(error/tool-loop 이후의 clean-exit에만 복구 적용)도 설계 의도와 일치합니다. 다만, LLM이 plan JSON 누출과 편집 도구 호출을 동시에 수행하는 이론적 엣지 케이스에서 plan은 "승인 대기"이지만 canvas에는 이미 편집이 적용되는 상태 불일치가 발생할 수 있으며, 이에 대한 방어 코드 또는 명시적 문서화가 권장됩니다.

### 위험도

**LOW**