### 발견사항

---

**[INFO] 기존 보안 리뷰(`security/review.md`)의 [WARNING] 항목들은 적절히 식별됨**
- 위치: `review/.../security/review.md`
- 상세: Open Redirect, 라우트 파라미터 미검증, 서버 에러 메시지 노출, JsonViewer 민감 데이터 노출, totalPages DoS 등 핵심 이슈가 이미 포착됨. 추가로 검토할 항목을 아래에 기술함.

---

**[WARNING] `_selectedPort` 내부 메타데이터의 클라이언트 노출 가능성**
- 위치: `spec/5-system/4-execution-engine.md` — `_selectedPort` 메타데이터 처리 섹션
- 상세: `_selectedPort`는 내부 라우팅 메타데이터로 다운스트림 입력 시 제거된다고 명시되어 있으나, `NodeExecution.output_data`에 저장된 후 실행 내역 페이지의 `JsonViewer`를 통해 그대로 노출될 가능성이 있음. 프레젠테이션 노드의 버튼 클릭 정보(어떤 버튼을 눌렀는지)가 포트 라우팅 내부 구조와 함께 외부에 노출됨.
- 제안: `NodeExecution.output_data` 저장 전 `_selectedPort` 필드를 제거하거나, 실행 내역 API 응답에서 해당 필드를 필터링

---

**[WARNING] Carousel `itemButtons`의 동적 ID 생성 시 예측 가능성**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — `itemButtons` 정의
- 상세: 런타임에 아이템별 고유 ID가 `{btnId}__item_{index}` 형태로 생성됨. 인덱스가 단순 순번이므로 사용자가 클라이언트에서 ID를 예측하여 다른 아이템의 포트 라우팅을 임의로 트리거할 수 있는 가능성이 있음. 특히 포트 버튼 클릭 API 요청이 서버 측에서 소유권 검증 없이 처리될 경우 위험.
- 제안: 버튼 클릭 처리 시 서버에서 `buttonId`가 해당 실행의 `buttonConfig`에 실제로 존재하는지 검증 필요

---

**[WARNING] `selectedItem` 출력 데이터에 민감 정보 포함 가능성**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — 버튼 포트 출력 형식
- 상세: 아이템 버튼 클릭 시 `selectedItem: { "title": "...", "description": "..." }` 전체가 출력에 포함됨. Dynamic 모드에서 소스 데이터에 API 키, 토큰, PII 등 민감 필드가 포함된 경우 해당 데이터 전체가 `NodeExecution.interaction_data`에 저장되어 실행 내역에 영구 기록됨.
- 제안: `itemButtons` 설정 시 `selectedItemFields`를 지정하여 출력에 포함될 필드를 제한하는 옵션 추가 고려. 또는 백엔드에서 민감 필드 마스킹 정책 적용

---

**[WARNING] `NodeExecution.error` 에러 정보 보존의 정보 노출 위험**
- 위치: `spec/5-system/3-error-handling.md` — Skip Node 정책 변경
- 상세: 신규 추가된 `NodeExecution.error = { message: "..." }` (에러 정보 보존) 항목으로 인해 Skip Node 정책으로 처리된 노드의 에러 메시지가 `NodeExecution` 레코드에 저장됨. 이 정보가 실행 내역 페이지의 노드 결과 패널에 노출될 경우, 내부 시스템 정보(DB 쿼리, 파일 경로, 외부 서비스 응답 등)가 사용자에게 그대로 보임.
- 제안: Skip Node의 에러 정보를 내부 로그에만 기록하고 API 응답에서는 일반화된 메시지만 반환하거나, 에러 메시지 길이 및 내용에 대한 sanitization 정책 적용

---

**[INFO] 실행 내역 API에 인증/인가 명시 부재**
- 위치: `spec/2-navigation/14-execution-history.md` — API 엔드포인트 섹션
- 상세: `/api/executions/workflow/:workflowId` 및 `/api/executions/:id` 엔드포인트에 대한 인증/인가 요구사항이 스펙에 명시되지 않음. 워크플로우 실행 데이터는 민감한 비즈니스 데이터를 포함할 수 있어 소유권 검증이 필수적임.
- 제안: 스펙에 "워크스페이스 소유권 검증 필수" 조건을 명시. 다른 워크스페이스의 실행 ID를 직접 조회할 수 없도록 백엔드에서 `workspaceId` 기반 필터링 강제 적용 여부 확인

---

**[INFO] `adjacentQuery` limit:100 정보 과다 노출**
- 위치: `spec/2-navigation/14-execution-history.md` — 이전/다음 실행 네비게이션
- 상세: prev/next 탐색을 위해 실행 목록 100건을 일괄 조회하면, 클라이언트가 필요 이상으로 많은 실행 데이터를 수신함. 각 실행 레코드에 `inputData`, `outputData`가 포함될 경우 민감 데이터의 불필요한 전송이 발생.
- 제안: adjacent 전용 API(`/executions/:id/adjacent`)에서는 `id`와 `status`만 반환하도록 응답 필드를 제한

---

### 요약

리뷰 대상 파일들은 주로 스펙 문서와 코드 리뷰 결과물이며, 실제 구현 코드가 아니다. 기존 `security/review.md`에서 Open Redirect, 파라미터 미검증, 에러 메시지 노출, JsonViewer 민감 데이터 노출 등 핵심 보안 이슈를 적절히 식별하였다. 이번 스펙 변경에서 추가로 주목할 사항은 `_selectedPort` 내부 메타데이터의 클라이언트 노출 가능성, Carousel `itemButtons`의 예측 가능한 동적 ID를 통한 서버 측 검증 우회, `selectedItem` 출력에 포함되는 소스 데이터 전체 노출, 그리고 Skip Node 정책 변경으로 인한 내부 에러 정보 저장 문제다. 전반적으로 React/Next.js 기본 XSS 방어로 인젝션 공격은 차단되나, 서버 응답 데이터를 클라이언트에서 무검증 사용하는 패턴과 실행 데이터에 포함될 수 있는 민감 정보의 범위 제한이 미흡하다.

### 위험도

**MEDIUM**