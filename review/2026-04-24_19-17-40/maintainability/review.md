## 유지보수성 코드 리뷰 — ED-AI-40

### 발견사항

---

**[WARNING] `RECOVERABLE` Set이 함수 내부에 정의됨**
- 위치: `tool-call-badge.tsx` — `mergeRecoveryGroups` 함수 내부
- 상세: `const RECOVERABLE = new Set(["PORT_NOT_FOUND", "NODE_NOT_FOUND"])` 가 함수 본문에 있어 `groupToolCalls` 호출마다 Set 인스턴스를 새로 생성한다. 이 값은 런타임에 변하지 않는 불변 상수다.
- 제안: 모듈 최상위로 이동. 기존 코드베이스의 `CONTAINER_LOOPBACK_PORTS` (shadow-workflow.ts), `FAILED_LABEL_WINDOW` 등 상수 관리 패턴과도 일치한다.

```typescript
// 모듈 최상위
const RECOVERABLE_ERROR_CODES = new Set(["PORT_NOT_FOUND", "NODE_NOT_FOUND"]);

function mergeRecoveryGroups(groups: ToolCallGroup[]): ToolCallGroup[] {
  // RECOVERABLE 제거하고 RECOVERABLE_ERROR_CODES 사용
```

---

**[WARNING] 테스트에서 동일 변환 헬퍼 함수가 두 번 정의됨**
- 위치: `shadow-workflow.spec.ts` — diff의 두 `@@ ... @@` 블록
- 상세: `toDesc = (ids: string[]) => ids.map((id) => ({ id }))` 와 `ids = (xs: string[]) => xs.map((id) => ({ id }))` 가 서로 다른 describe 스코프에서 이름만 다를 뿐 완전히 동일한 로직이다. 추후 `ShadowRuntimePort` shape에 필드가 추가되면 두 곳을 모두 수정해야 한다.
- 제안: `toDesc`를 describe 최상위 (또는 테스트 파일 최상위)로 올리고, 두 번째 `ids`를 제거하여 `toDesc`로 통일.

```typescript
// describe 블록 밖 또는 describe 최상위에서 한 번만
const toDesc = (ids: string[]) => ids.map((id) => ({ id }));
```

---

**[INFO] React optional prop에 불필요한 conditional spread 사용**
- 위치: `tool-call-badge.tsx` — `ToolCallBadge` 컴포넌트 반환부
- 상세: `{...(title ? { title } : {})}` 는 React에서 `title={title}` 과 동일하다. `undefined`를 prop으로 전달하면 React가 HTML attribute를 생략해주므로 spread가 불필요하다. 파일 내 다른 곳(`message.streaming && ...`, `RESUMABLE_ERROR_CODES.has(...)`)에서는 직접 prop 전달 패턴을 사용한다.
- 제안:

```tsx
<div
  className={`...${color}`}
  title={title}
>
```

---

**[INFO] `isSameEditTarget`에서 `add_node`의 label 기반 매칭이 묵시적 가정에 의존**
- 위치: `tool-call-badge.tsx` — `isSameEditTarget` 함수
- 상세: `add_node` 브랜치에서 `id`가 없으면 label로 매칭하는데, ShadowWorkflow가 label 유일성을 강제하므로 백엔드에서는 안전하지만, 프런트엔드 클라이언트는 이 불변식을 인식하지 못한다. 이 의존 관계가 코드에 드러나 있지 않아 향후 이 함수만 보고 수정할 때 오해할 수 있다. 현재 주석이 "add_node는 arguments.id가 없는 게 정상"만 설명하고, 왜 label 매칭이 안전한지는 설명하지 않는다.
- 제안: 주석 한 줄 보강:

```typescript
// add_node 는 `arguments.id` 가 없는 게 정상. label 기반으로 매칭.
// ShadowWorkflow 의 LABEL_CONFLICT 가드가 label 유일성을 보장하므로 안전.
```

---

**[INFO] `mergeRecoveryGroups`의 조건 체인 가독성**
- 위치: `tool-call-badge.tsx` — `mergeRecoveryGroups` 내 if 블록 (6개 조건)
- 상세: 6개 조건이 `&&`로 연결된 구조는 함수 자체의 JSDoc이 매우 잘 작성되어 있어 이해하는 데 크게 무리가 없다. 다만 `errorCodeOf(fail.representative) ?? ""` 가 두 번 호출되는 점은 미미한 중복이다 (한 번은 `RECOVERABLE.has(...)`, 한 번은 `retriedFromError`).
- 제안: 로컬 변수로 분리하면 `errorCodeOf` 호출을 1회로 줄이고 의도도 명확해진다.

```typescript
const failCode = errorCodeOf(fail.representative);
if (
  next &&
  fail.count === 1 &&
  isFailedCall(fail.representative) &&
  !isFailedCall(next.representative) &&
  failCode !== null &&
  RECOVERABLE_ERROR_CODES.has(failCode) &&
  isSameEditTarget(fail.representative, next.representative)
) {
  out.push({ ..., retriedFromError: failCode });
```

---

### 요약

변경 범위가 넓음에도 불구하고 전반적인 유지보수성 품질은 높다. 인터페이스(`ShadowRuntimePort`, `ResolvedNodePorts`)·상수(`RUNTIME_PORTS_MAX_PER_SIDE`)·메서드(`buildRuntimePorts`) 분리가 명확하고, JSDoc 주석이 "왜" 이 변경이 있었는지(ED-AI-40 §4.3.2)를 스펙 참조와 함께 설명하고 있어 향후 수정자가 맥락을 잃지 않는다. 식별된 이슈는 모두 WARNING 이하이며, `RECOVERABLE` Set의 함수 내 정의와 테스트의 동일 헬퍼 중복이 실질적인 개선 포인트다. 나머지는 스타일·명확성 개선이다.

### 위험도

**LOW**