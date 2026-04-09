### 발견사항

---

**[WARNING]** `executionsApi.getById` 반환 타입 Breaking Change
- 위치: `frontend/src/lib/api/executions.ts` — `getById` 구현
- 상세: `getById`가 기존 `AxiosResponse<ExecutionData>` (즉, `{ data: ExecutionData }`)에서 `Promise<ExecutionData>`로 변경됨. 이미 `use-execution-events.ts`와 테스트(`mockGetById.mockResolvedValue(createMockExecution())`)는 새 API에 맞게 수정되었지만, 이 API를 사용하는 다른 모든 소비자가 누락 없이 업데이트되었는지 보장이 필요함. 특히 `response.data` 패턴을 사용하던 코드는 `undefined`를 조용히 반환할 수 있음.
- 제안: 변경 전후 모든 호출부 grep 확인 필요. 현재 diff 내 `use-execution-events.ts`는 수정되었으나, 다른 파일에서의 사용은 확인 불가.

---

**[WARNING]** `getById`와 `getByWorkflow`의 응답 언래핑 전략 불일치
- 위치: `frontend/src/lib/api/executions.ts` L53–68
- 상세: `getById`는 `unwrap<T>(data)`를 적용하여 `{ data: T }` 래핑을 벗기는 반면, `getByWorkflow`는 `data as PaginatedExecutions`로 직접 캐스팅하여 언래핑 없이 반환함. 백엔드가 `{ data: PaginatedExecutions }` 형태로 응답한다면 `getByWorkflow` 호출자는 `undefined`를 받을 수 있음. 또한 `unwrap` 함수의 조건 (`!Array.isArray(data.data)`)으로 인해 배열 형태의 응답은 언래핑하지 않는데, `PaginatedExecutions.data`가 배열이기 때문에 `getById`에서도 `{ data: [...] }` 구조가 오면 예상치 못한 동작이 발생할 수 있음.
- 제안: 두 메서드에 동일한 언래핑 전략 적용. 백엔드 응답 스키마를 명시적으로 문서화하고, 일관된 axios 인터셉터 레벨 처리 도입.

---

**[WARNING]** `buttonConfig.buttons` 내용 변경 — 기존 소비자 Breaking Change 가능성
- 위치: `backend/src/modules/execution-engine/handlers/presentation/carousel.handler.ts` L195–214
- 상세: 기존에는 `buttonConfig.buttons`에 글로벌 버튼만 포함되었으나, 변경 후에는 아이템별 버튼까지 모두 포함된 `allButtons`가 반환됨. `buttonConfig.buttons`를 순회하며 글로벌 버튼 수를 기준으로 동작을 결정하는 소비자(예: 프론트엔드 버튼 렌더러)는 예상보다 많은 버튼을 받게 됨. `buttonItemMap`이 구분자 역할을 하지만, 기존 소비자가 이를 인식하지 못하면 UI 중복 렌더링이 발생함.
- 제안: 글로벌 버튼과 아이템 버튼을 분리된 필드로 유지(`globalButtons`, `itemButtons`)하거나, 기존 `buttons` 필드는 글로벌만 유지하고 아이템 버튼은 별도 필드로 추가하는 방향이 하위 호환성에 더 안전함.

---

**[WARNING]** 버튼 ID 컨벤션 `{defId}__item_{idx}` 암묵적 계약
- 위치: `carousel.handler.ts` L167, `execution-engine.service.ts` L1607–1611
- 상세: 동적 아이템 버튼은 `${btn.id}__item_${itemIdx}` 형태의 ID를 가지며, 실행 엔진은 `__item_` 구분자를 기준으로 포트 ID를 추출함. 이 컨벤션이 API 계약으로 문서화되지 않아, 프론트엔드 에디터의 포트 라우팅 로직(`custom-node.tsx`)과 실행 엔진 간 암묵적 결합이 발생함. `__item_` 문자열이 버튼 정의 ID에 포함되면 파싱이 오작동함.
- 제안: 버튼 ID 컨벤션을 스펙 문서에 명시하고, 유효성 검증에서 `__item_` 포함 여부를 금지하는 규칙 추가.

---

**[INFO]** `_selectedPort` 다운스트림 제거 — 묵시적 계약 변경
- 위치: `execution-engine.service.spec.ts` L1194–1199, `execution-engine.service.ts`
- 상세: 테스트가 명시적으로 `_selectedPort`가 다운스트림 노드 입력에서 제거됨을 검증함. 만약 다운스트림 노드 로직 또는 표현식에서 `$input._selectedPort`를 참조하는 기존 워크플로우가 있다면 동작이 변경됨. 변경 자체는 의도적이나 하위 호환성 문서화가 필요함.
- 제안: 릴리즈 노트 또는 마이그레이션 가이드에 해당 변경 명시.

---

**[INFO]** `ExecutionListParams.sort` 값과 백엔드 파라미터 동기화 미검증
- 위치: `frontend/src/lib/api/executions.ts` L37–43
- 상세: `sort` 필드가 `"started_at" | "finished_at" | "status" | "duration_ms"` snake_case 리터럴 유니온으로 정의됨. 백엔드 컨트롤러가 실제로 이 값들을 수용하는지, 필드명이 `sort`인지 `sort_by`인지 코드 내 검증이 없음. 이전 코드 리뷰에서도 동일 이슈가 지적되었으나 해결 여부가 불명확함.
- 제안: 백엔드 `ExecutionsController`의 쿼리 파라미터 DTO와 대조하여 일치 여부 확인.

---

### 요약

이번 변경의 핵심 API 계약 리스크는 두 가지다. 첫째, `executionsApi.getById`의 반환 타입이 `AxiosResponse<ExecutionData>`에서 `ExecutionData`로 변경되어 기존 소비자에 대한 breaking change가 발생했으며, `getById`와 `getByWorkflow` 간 언래핑 전략의 불일치로 인해 한쪽이 잘못된 구조를 반환할 가능성이 있다. 둘째, 캐러셀 핸들러의 `buttonConfig.buttons`가 이제 글로벌 버튼과 아이템 버튼을 모두 포함하도록 변경되어, 이를 인식하지 못하는 기존 프론트엔드 소비자에서 예상치 못한 동작이 발생할 수 있다. 버튼 ID의 `__item_` 컨벤션은 핸들러와 실행 엔진 간 암묵적 계약으로 문서화가 필요하다.

### 위험도
**MEDIUM**