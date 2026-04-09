### 발견사항

---

**[WARNING] `_selectedPort` 다운스트림 입력 제거 — breaking change 가능성**
- 위치: `execution-engine.service.ts` (diff hunk 1), `execution-engine.service.spec.ts`
- 상세: 기존에 다운스트림 노드 입력에 `_selectedPort` 필드가 포함되었으나, 이번 변경으로 제거됨. 만약 기존 워크플로우 중 다운스트림 노드가 `{{ $node["Switch"].output._selectedPort }}` 형태로 이 필드를 참조하는 경우, 해당 표현식이 `undefined`를 반환하게 됨.
- 제안: `_selectedPort`를 의도적으로 제거하는 것이라면, 스펙 문서에 "internal field, not exposed downstream"을 명시하고, 기존 워크플로우 마이그레이션 가이드 필요. 제거가 의도된 동작이라면 스펙(spec)에 해당 breaking change를 명시해야 함.

---

**[WARNING] `buttonConfig`가 다운스트림 입력에 유지됨 — 계약 구조 변경**
- 위치: `execution-engine.service.ts` (`delete cleanNodeOutput.buttonConfig` 제거)
- 상세: 기존에는 `buttonConfig`가 `cleanNodeOutput`에서 제거되었으나, 이번 변경으로 유지됨. 따라서 다운스트림 노드는 이제 `buttonConfig: { buttons: [...], buttonItemMap: {...}, ... }` 구조를 입력으로 수신하게 됨. 이는 다운스트림 노드의 입력 스키마에 예상치 못한 필드가 추가되는 것으로, 노드가 `$input.buttonConfig`를 참조하면 내부 렌더링 메타데이터가 노출됨.
- 제안: `buttonConfig`를 execution detail 페이지 렌더링 목적으로 유지한다면, 노드 output과 분리된 별도 메타데이터 채널(예: `_meta.buttonConfig`)로 관리해야 함. 현재 구조는 내부 렌더링 계약이 노드 I/O 계약으로 누출되는 문제.

---

**[WARNING] 아이템 버튼의 `selectedPort` 라우팅 변경 — 엣지 매핑 계약 변경**
- 위치: `execution-engine.service.ts` (L1594–1598 hunk)
- 상세: 동적 아이템 버튼 ID가 `{defId}__item_{idx}` 형태일 때, `selectedPort`를 `{defId}` (base definition ID)로 resolve함. 이는 에디터 캔버스의 엣지가 `{defId}` 포트에 연결되어 있어야 정상 동작함을 의미. 만약 `carousel.handler.ts`가 반환하는 `allButtons`에 `{defId}__item_0`, `{defId}__item_1` 형태의 ID가 포함되어 클라이언트(에디터)에 노출된다면, 에디터는 실제 존재하지 않는 포트에 엣지를 그릴 위험이 있음.
- 제안: 클라이언트가 수신하는 `buttonConfig.buttons`의 ID와 에디터 포트 ID 매핑이 일치하는지 명시적인 계약 문서 필요. `buttonItemMap`을 통한 역참조 메커니즘은 적절하나, 이 계약이 spec에 문서화되어야 함.

---

**[WARNING] `executionsApi.getById` 반환 타입 변경 — 프론트엔드 내부 breaking change**
- 위치: `frontend/src/lib/api/executions.ts`, `frontend/src/lib/websocket/use-execution-events.ts`
- 상세: `getById`가 기존 `Promise<AxiosResponse<ExecutionData>>` → `Promise<ExecutionData>` 반환으로 변경됨. `use-execution-events.ts`는 `response.data` 패턴을 `execution` 직접 접근으로 수정하여 내부 일관성은 유지됨. 그러나 이 API를 사용하는 다른 위치가 있다면 silent breakage 발생 가능.
- 제안: `getByWorkflow`는 `PaginatedExecutions`를 직접 반환하는 반면, `getById`는 `unwrap()` 헬퍼를 통해 `{ data: T }` 중첩을 처리함. 두 메서드의 정규화 방식이 다름(하나는 `unwrap`, 하나는 직접 캐스트). `getByWorkflow`도 `unwrap`을 통해 일관되게 처리하거나, 두 방식 모두 명시적으로 문서화 필요.

---

**[INFO] `ExecutionListParams.sort` 값과 백엔드 파라미터 네이밍 불일치 가능성**
- 위치: `frontend/src/lib/api/executions.ts` (L39–43)
- 상세: `sort?: "started_at" | "finished_at" | "status" | "duration_ms"` — 이전 리뷰(파일 10, `api_contract/review.md`)에서도 지적되었듯, 백엔드 API가 `sort`와 `sort_by` 중 어느 파라미터명을 사용하는지, 값이 snake_case를 수용하는지 타입 정의만으로는 보장되지 않음. 이번 변경으로 타입은 리터럴 유니온으로 정의되었으나 백엔드 스펙과의 동기화 여부는 미확인.
- 제안: 백엔드 컨트롤러의 `@Query` 파라미터 데코레이터와 타입을 비교하여 일치 여부 검증 필요.

---

**[INFO] `carousel.handler.ts`의 `source` 표현식 처리 방식 불명확**
- 위치: `carousel.handler.ts` (dynamic mode `sourceData` 처리)
- 상세: 주석에 "source is resolved by the expression engine before reaching the handler"라고 명시되어 있으나, `const sourceData = config.source`로 이미 resolve된 값을 사용하는 방식. 표현식 엔진이 언제/어디서 resolve하는지가 핸들러 코드 내에서 보장되지 않음. 만약 표현식이 resolve되지 않은 채로 핸들러에 도달하면 `inputArray`가 빈 배열이 되어 silent failure.
- 제안: `source` 필드가 resolve된 배열인지 런타임 타입 검증 추가, 또는 핸들러 validate 단계에서 `source` 형식 검증 포함.

---

### 요약

이번 변경의 핵심 API 계약 이슈는 두 가지다. 첫째, `_selectedPort` 제거와 `buttonConfig` 유지로 인한 다운스트림 노드 입력 스키마 변경이다 — 이 두 변경은 서로 반대 방향으로 내부 필드 노출 정책이 적용되어 일관성이 없으며, 기존 워크플로우에서 `_selectedPort`를 참조하던 노드는 silent breakage가 발생한다. 둘째, 프론트엔드 `executionsApi`의 반환 타입 변경은 내부적으로 처리되었으나 `getById`와 `getByWorkflow`의 정규화 방식이 상이하여 계약 일관성이 부족하다. 아이템 버튼의 포트 라우팅 계약(`{defId}__item_{idx}` → `{defId}`)은 에디터-실행엔진 간 암묵적 계약으로 spec에 명문화가 필요하다.

### 위험도
**MEDIUM**