## 발견사항

### [WARNING] `width: 0` / `height: 0` 값 처리 미검증
- **위치:** `workflow-view.ts:53`, `workflow-assistant-stream.service.ts:744`, `workflow-view.spec.ts` 전체
- **상세:** `typeof n.width === 'number'` 조건은 `0`을 통과시킨다. 0px 노드가 LLM에 전달되면 `x = predecessor.x + 0 + 32`가 되어 오히려 노드가 겹치는 레이아웃 오류를 유발할 수 있다. 현재 세 파일 어디에도 이 케이스가 테스트되지 않는다.
- **제안:** `workflow-view.spec.ts`에 `width: 0`인 노드를 포함한 케이스를 추가하고, 동작 의도(포함 vs 제외)를 명시적으로 고정하라.

---

### [WARNING] `width: NaN` 값이 LLM 프롬프트 JSON을 오염시킬 수 있음
- **위치:** `workflow-assistant-stream.service.ts:744`, `dto/assistant-message-request.dto.ts:58`
- **상세:** `typeof NaN === 'number'`는 `true`이므로 DTO에서 `@IsNumber()` + spread 조건 모두 통과한다. `JSON.stringify({ width: NaN })`는 `{"width":null}`을 생성해 LLM이 측정값이 있다고 오해하면서 `null` 기반 계산을 시도하게 된다. `@IsNumber()` 기본 옵션은 NaN을 허용하지 않지만(`allowNaN: false`가 기본값), 프론트엔드에서 `n.width`가 NaN으로 넘어올 수 있는 경로가 있다.
- **제안:** DTO에 `@IsPositive()` 또는 `@Min(1)`을 추가해 0과 음수·NaN을 구조적으로 차단하고, 해당 케이스 테스트를 추가하라.

---

### [WARNING] DTO 유효성 검증 테스트 부재
- **위치:** `dto/assistant-message-request.dto.ts:58-72` (신규 필드)
- **상세:** `width`/`height`에 대한 `@IsOptional()`, `@IsNumber()` 동작을 확인하는 단위 테스트가 없다. 문자열이나 배열이 들어올 때 400 응답이 발생하는지, 생략 시 정상 통과하는지 검증되지 않는다. 기존 DTO 필드들도 별도 e2e/validation 테스트가 없다면 회귀 위험이 있다.
- **제안:** `class-validator`와 `plainToInstance`를 이용한 DTO 유닛 테스트를 작성하라.

---

### [INFO] 서비스 테스트의 async 스타일 불일치
- **위치:** `workflow-assistant-stream.service.spec.ts:1542, 1586`
- **상세:** 첫 번째 신규 테스트(`forwards optional width/height...`)는 `async/await`를 사용하고, 두 번째(`omits width/height...`)는 `return collect(...).then(...)` 패턴을 사용한다. 같은 PR에 두 스타일이 혼재해 가독성이 낮다.
- **제안:** 두 번째 테스트도 `async/await`로 통일하라.

---

### [INFO] `as never` 타입 캐스트 사용
- **위치:** `workflow-assistant-stream.service.spec.ts:1559, 1597`
- **상세:** `dto as never`는 TypeScript 컴파일러를 무력화하는 방식이다. 테스트가 통과하더라도 실제 타입 불일치를 숨길 수 있다.
- **제안:** `as unknown as AssistantMessageRequestDto`로 변경하거나, 테스트 픽스처를 DTO 타입에 맞게 정확히 구성하라.

---

### [INFO] `toShadowSnapshot`이 private 메서드로 직접 단위 테스트 불가
- **위치:** `workflow-assistant-stream.service.ts:733`
- **상세:** width/height 전달 경로의 핵심 로직이 private 메서드 안에 있어, `streamMessage` 전체를 통해서만 검증 가능하다. 이번처럼 LLM mock을 세팅하고 시스템 프롬프트 문자열을 regex로 검사하는 방식은 작동하지만, 리팩토링에 취약하다.
- **제안:** `toShadowSnapshot`을 standalone 순수 함수로 추출하면 테스트 격리성이 향상된다.

---

### [INFO] React Flow v11/v12 이중 경로 추출 로직 미테스트
- **위치:** `frontend/src/components/editor/assistant-panel/assistant-panel.tsx:103-110`
- **상세:** `measured?.width ?? legacy.width` 분기가 프론트엔드 컴포넌트 내에서만 존재하며, 이 로직에 대한 단위/통합 테스트가 없다. `measured.width`가 `undefined`이고 `legacy.width`가 유효한 숫자인 케이스(v11 호환 경로)가 실제로 동작하는지 검증되지 않는다.
- **제안:** `snapshot` useMemo를 순수 함수로 추출하고 별도 단위 테스트를 추가하라.

---

### [INFO] 시스템 프롬프트 검증이 문자열 regex에 의존
- **위치:** `workflow-assistant-stream.service.spec.ts:1570-1572`
- **상세:** `expect(systemPrompt).toMatch(/"width":\s*240/)` 형태의 검사는 JSON 키 순서나 공백 변경에 민감하다. 의도 자체는 명확하나, JSON을 파싱해서 구조적으로 검증하는 방식이 더 안정적이다.
- **제안:** 시스템 프롬프트에서 JSON 블록을 추출해 `JSON.parse`로 파싱 후 구조 비교를 수행하라.

---

## 요약

핵심 동작 경로(width/height가 있는 경우 포함, 없는 경우 필드 누락)는 `workflow-view.spec.ts` 3개 케이스와 서비스 스펙 2개 테스트로 충분히 커버된다. 그러나 `width: 0`, `width: NaN`, 음수 등의 경계값이 시스템 전체를 통과할 수 있으며 이 경우 LLM에 잘못된 측정값이 전달될 위험이 있다. DTO 레이어에서 `@IsPositive()` 제약을 추가하고 해당 케이스 테스트를 보완하면 위험도는 크게 낮아진다.

## 위험도

**LOW**