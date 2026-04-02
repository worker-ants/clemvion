## 발견사항

### **[WARNING]** ESLint 규칙 억제 주석 과도 제거
- **위치**: `execution-engine.service.spec.ts`, 기존 576~579행, 644~647행
- **상세**: `(service as any)['contextService']` 코드에서 `no-unsafe-member-access`와 `no-explicit-any` 억제 주석이 제거됨. `eslint-disable-next-line`은 바로 다음 줄(`const contextService = (service as any)[`)에만 적용되므로, 해당 줄의 `as any` 캐스트와 `any` 타입의 프로퍼티 접근이 여전히 노출되어 있음. 프로젝트에 해당 규칙이 활성화되어 있다면 lint 단계에서 실패 발생 가능.
- **제안**: `no-unsafe-assignment` 외에 `no-unsafe-member-access`, `no-explicit-any`도 함께 억제하거나, `(service as unknown as { contextService: ExecutionContextService }).contextService` 형태로 리팩터링.

---

### **[WARNING]** React `key={i}` 인덱스 사용으로 인한 DOM 조정 오류
- **위치**: `presentation-configs.tsx`, static 모드의 items 렌더링 블록
- **상세**: `items.map((item, i) => <div key={i} ...>)`에서 인덱스를 key로 사용. `removeItem(i)` 호출 시 배열에서 항목이 삭제되면 key가 재지정되어 React가 잘못된 DOM 노드를 재사용할 수 있음. 예: [A, B, C]에서 B를 삭제하면 [A, C]가 key [0, 1]로 렌더링되고, React는 이전 B의 DOM 노드를 C로 재사용할 가능성이 있어 입력 포커스나 중간 상태가 엉킬 수 있음.
- **제안**: 각 item에 고유 `id` 필드 부여 (`addItem` 시 `crypto.randomUUID()` 등으로 생성) 후 `key={item.id}` 사용.

---

### **[WARNING]** 모드 전환 시 config에 불필요한 필드 잔존
- **위치**: `presentation-configs.tsx`, `SelectField` onChange 핸들러
- **상세**: `onChange({ ...config, mode: v })`로 모드를 변경할 때 이전 모드의 필드가 config에 그대로 남음 (static → dynamic 전환 시 `items` 잔존, dynamic → static 전환 시 `titleField`, `descriptionField` 등 잔존). 백엔드 핸들러는 `mode`로 분기하므로 실행 오류는 없지만, 불필요한 데이터가 저장/전송되며 추후 다른 핸들러나 유효성 검사 로직이 추가될 경우 혼동을 줄 수 있음.
- **제안**: 모드 전환 시 이전 모드 전용 필드를 명시적으로 제거. 예: static→dynamic 전환 시 `items` 필드 삭제, dynamic→static 전환 시 `titleField`, `descriptionField`, `imageField`, `maxItems` 제거.

---

### **[INFO]** `execute` 메서드의 `async` 제거 및 `Promise.resolve()` 래핑
- **위치**: `carousel.handler.ts`, `execute` 메서드
- **상세**: `async execute`에서 `execute`로 변경 후 `return Promise.resolve(...)`로 대체. `NodeHandler` 인터페이스의 `Promise<unknown>` 반환 타입은 그대로 충족하므로 호환성 문제 없음. 단, 향후 내부 로직이 `await` 구문을 필요로 하는 경우 `async` 재추가를 잊을 수 있음.

---

### **[INFO]** `renderHtml` private 메서드 시그니처 타입 강화
- **위치**: `carousel.handler.ts`, `renderHtml` 메서드
- **상세**: 파라미터 타입이 `{ title: unknown; ... }` → `{ title: string; ... }`으로 강화됨. private 메서드이며 호출부도 이미 `string` 타입이 보장된 상태로 전달하므로 외부 영향 없음.

---

## 요약

이번 변경의 핵심은 Carousel 노드에 Static/Dynamic 이중 모드를 추가한 것으로, 기존 dynamic 동작의 하위호환성은 적절히 유지되어 있다. 백엔드 핸들러(`carousel.handler.ts`)의 실행 로직과 유효성 검증은 모드별 분기가 명확하며 XSS 이스케이프도 유지된다. 주요 위험은 테스트 파일에서 ESLint 억제 주석을 과도하게 제거한 점(lint 실패 가능)과 프론트엔드 React 컴포넌트에서 인덱스 key 사용으로 인한 UI 상태 오류 가능성이다. 런타임 크래시나 데이터 손상 수준의 치명적 부작용은 없으나, React key 문제는 사용자 경험에 직접 영향을 미칠 수 있으므로 수정이 권장된다.

## 위험도

**LOW**