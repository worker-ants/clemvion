## 보안 코드 리뷰

### 발견사항

---

**[WARNING] `buttonId` 파싱을 통한 포트 라우팅 — 신뢰되지 않은 입력 처리**
- 위치: `execution-engine.service.ts` — `buttonId.includes('__item_')` 분기
- 상세: 클라이언트가 제출한 `buttonId`를 `split('__item_')[0]`로 파싱하여 포트를 결정하는 로직이 있음. `__item_` 구분자가 악용될 경우, 버튼 정의에 없는 임의의 포트 ID로 라우팅을 유도하려는 시도가 가능함. 현재 이후에 `buttonId` 존재 여부 검증이 있으나, `buttonId.split('__item_')[0]`로 추출된 `selectedPort`가 실제로 유효한 포트인지 별도로 검증되지 않음.
- 제안: `selectedPort`가 노드에 정의된 실제 포트 목록에 속하는지 화이트리스트 검증 추가.

---

**[WARNING] `sanitizeUrl` — 프로토콜 화이트리스트 미적용**
- 위치: `carousel.handler.ts` — `sanitizeUrl` 함수 (diff에 직접 보이지 않으나 기존 함수 참조)
- 상세: `item.image` 및 버튼 `url` 필드에 `sanitizeUrl`을 적용하고 있음. 함수의 구현 내용은 diff에 없으나, 반환값이 빈 문자열이면 `undefined`로 처리하는 패턴(`sanitizeUrl(...) || undefined`)을 보면 방어적 처리가 있음. 다만 `javascript:`, `data:`, `vbscript:` 프로토콜에 대한 명시적 차단 여부가 diff에서 확인되지 않음.
- 제안: `sanitizeUrl`에서 `https:` / `http:`만 허용하는 프로토콜 화이트리스트를 적용하고 있는지 확인 및 강화.

---

**[WARNING] `buttonItemMap` — 배열 인덱스 범위 검증 미흡**
- 위치: `execution-engine.service.ts` — `itemIndex` 및 `selectedItem` 추출 로직
- 상세: `buttonItemMap[buttonId]`로 얻은 `itemIndex`가 `outputItems` 배열 범위 내인지 검증하지 않음. 정상적으로는 불가능하지만, 상태 불일치나 악의적인 데이터 조작 시 `outputItems[itemIndex]`가 `undefined`를 반환할 수 있음. 현재 `selectedItem !== undefined` 체크가 있어 전파는 차단되나, 음수 인덱스(`outputItems[-1]`)에 대한 명시적 가드가 없음.
- 제안: `itemIndex >= 0 && itemIndex < outputItems.length` 조건을 명시적으로 추가.

---

**[INFO] `run-results-drawer.tsx` — `workflowId` 미검증 URL 삽입**
- 위치: `run-results-drawer.tsx` — `href={/workflows/${workflowId}/executions}`
- 상세: `useParams()`에서 얻은 `workflowId`를 검증 없이 `href`에 직접 삽입. `<a>` 태그의 `href`는 React가 자동으로 이스케이프하지 않는 일부 케이스(`javascript:` 등)에서 XSS 위험이 있음. 단, Next.js 라우터에서 온 파라미터이므로 실제 공격 가능성은 낮음.
- 제안: `workflowId`가 UUID 형식인지 렌더링 전 확인: `/^[0-9a-f-]{36}$/i.test(workflowId)`.

---

**[INFO] `unwrap<T>` 함수 — 타입 안전성 우회**
- 위치: `executions.ts` — `unwrap` 헬퍼
- 상세: `eslint-disable @typescript-eslint/no-explicit-any`와 함께 `data?.data`의 타입을 `T`로 단순 캐스팅. 런타임 타입 검증 없이 서버 응답을 신뢰함. 중간자 공격(MITM) 또는 백엔드 응답 이상 시 런타임 오류로 이어질 수 있음.
- 제안: `zod` 등을 활용한 런타임 스키마 검증 도입 검토 (단기적으로는 필수 필드 존재 여부 확인 정도로 완화 가능).

---

**[INFO] `dashboard/page.tsx` — `router.push` 에 서버 데이터 직접 삽입**
- 위치: `dashboard/page.tsx` — `router.push(/workflows/${execution.workflowId}/executions/${execution.id})`
- 상세: API 응답의 `workflowId`/`id` 값을 검증 없이 라우팅에 사용. 앞선 보안 리뷰(파일 21)에서 지적된 Open Redirect 패턴과 동일 유형. 백엔드가 신뢰되는 환경이라면 위험도는 낮으나, 방어적 코딩 관점에서 보완 필요.
- 제안: UUID 형식 검증 후 `router.push` 호출.

---

**[INFO] `execution-engine.service.ts` — `cleanNodeOutput`에 `buttonConfig` 유지**
- 위치: `execution-engine.service.ts` — `delete cleanNodeOutput.buttonConfig` 제거
- 상세: 기존에는 `buttonConfig`를 다운스트림에서 제거했으나, 이번 변경으로 `buttonConfig`가 다운스트림 노드 입력에 포함됨. `buttonConfig`에 버튼 URL, 타임아웃 설정 등 내부 구성 정보가 포함되어 있어 의도치 않게 다운스트림 노드에 노출될 수 있음.
- 제안: `buttonConfig`는 실행 상세 페이지 렌더링 목적이므로, 다운스트림 전달 시에는 `cleanNodeOutput`에서 제거 유지하고 별도 필드(예: `_executionMeta`)로 보존하는 방식 검토.

---

### 요약

이번 변경의 보안 수준은 전반적으로 양호하다. 하드코딩된 시크릿, SQL 인젝션, 전통적인 XSS 경로는 발견되지 않았다. 가장 주목할 이슈는 `buttonId` 파싱을 통한 포트 라우팅 로직으로, 클라이언트가 제출한 `buttonId`에서 `__item_` 구분자를 파싱하여 포트를 결정하는 구조가 신뢰되지 않은 입력 처리 원칙에 위배된다. 추출된 `selectedPort`의 유효성을 포트 정의 목록과 대조 검증해야 한다. 또한 `buttonConfig`가 다운스트림 노드 입력에 포함된 것은 내부 구성 정보 노출 관점에서 재검토가 필요하다. 프론트엔드 측의 서버 응답 데이터를 라우팅에 직접 사용하는 패턴(UUID 미검증)은 이전 리뷰에서도 지적된 사항으로, 일관된 입력 검증 정책 수립이 권장된다.

### 위험도

**LOW**