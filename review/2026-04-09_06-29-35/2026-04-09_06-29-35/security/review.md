## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] URL 경로에 API 응답 데이터 직접 삽입 (Open Redirect 위험)**
- 위치: `page.tsx` (execution detail) — `adjacentQuery` 결과를 `router.push()`에 직접 사용
- 상세: `adjacentQuery.data.prev` / `.next`는 서버 API 응답에서 온 `id` 값입니다. 서버가 악의적인 `id`(예: `../../admin` 또는 절대경로)를 반환하거나 응답이 중간에 조작될 경우, 의도하지 않은 경로로 리다이렉트될 수 있습니다.
- 제안: `id`가 UUID/alphanumeric 형식인지 클라이언트에서도 검증 후 사용
  ```ts
  const isValidId = (id: unknown): id is string =>
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
  
  if (isValidId(adjacentQuery.data?.prev)) {
    router.push(`/workflows/${workflowId}/executions/${adjacentQuery.data.prev}`);
  }
  ```

---

**[WARNING] `workflowId`, `executionId`의 클라이언트 측 검증 부재**
- 위치: 두 `page.tsx` 파일 모두 — `use(params)`로 얻은 라우트 파라미터를 API 호출에 무검증 사용
- 상세: 라우트 파라미터가 URL에서 직접 오므로, 사용자가 비정상적인 값(예: 매우 긴 문자열, 특수문자)을 넣을 수 있습니다. 클라이언트 측 검증이 없어 불필요한 API 요청이 발생하며, 백엔드의 에러 메시지가 그대로 노출될 수 있습니다.
- 제안:
  ```ts
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(workflowId) || !UUID_REGEX.test(executionId)) {
    router.push("/404");
    return null;
  }
  ```

---

**[WARNING] 서버 에러 메시지 직접 렌더링**
- 위치: `execution-detail page.tsx:253` — `execution.error.message`, 각 노드 에러 메시지
- 상세: 에러 메시지가 백엔드에서 그대로 오는 경우 내부 시스템 정보(스택 트레이스, DB 쿼리, 파일 경로 등)가 UI에 노출될 수 있습니다. React의 JSX 렌더링은 기본적으로 XSS를 방지하지만, 정보 노출(Information Disclosure) 위험은 남습니다.
- 제안: 에러 메시지 길이 제한 및 백엔드에서 사용자용 에러 메시지를 별도 필드로 관리

---

**[WARNING] `JsonViewer`에서 임의 데이터 렌더링**
- 위치: `page.tsx` (execution detail) — `JsonViewer` 컴포넌트, `selectedNode.inputData` / `outputData` / `error`
- 상세: 워크플로우 노드의 입출력 데이터가 그대로 렌더링됩니다. 현재 `<pre><code>` 태그 내 텍스트로 렌더링되므로 XSS 자체는 방지되지만, 노드가 민감한 데이터(API 키, 사용자 PII, 인증 토큰)를 처리한 경우 해당 데이터가 UI에 완전히 노출됩니다. 접근 권한이 있는 모든 사용자가 볼 수 있게 됩니다.
- 제안: 민감 필드 마스킹 처리 또는 백엔드에서 민감 데이터 제거 후 응답

---

**[INFO] `as any` 타입 캐스팅으로 인한 런타임 안전성 저하**
- 위치: 두 `page.tsx` — `(data as any).data ?? data`
- 상세: 타입 안전성이 우회되어 예상치 못한 구조의 응답이 들어올 때 런타임 오류나 예기치 않은 동작이 발생할 수 있습니다. 보안 이슈라기보다 방어적 코딩 문제입니다.
- 제안: API 응답에 대한 런타임 타입 검증(zod 등) 도입

---

**[INFO] 테스트에서 실제 에러 메시지 문자열 하드코딩**
- 위치: `execution-detail-page.test.tsx:168` — `"Connection timeout"`
- 상세: 보안 취약점은 아니나, 테스트가 에러 메시지 문자열에 의존하면 메시지 변경 시 테스트가 깨지고 보안 관련 에러 처리 로직 변경을 놓칠 수 있습니다.

---

**[INFO] 페이지네이션 `totalPages`를 신뢰하여 버튼 무제한 렌더링**
- 위치: `executions/page.tsx` — `Array.from({ length: totalPages })`
- 상세: `totalPages`가 서버 응답 값이므로 비정상적으로 큰 값(예: 10000)이 오면 DOM에 엄청난 수의 버튼이 렌더링되어 브라우저 성능 저하(DoS-like) 문제가 발생할 수 있습니다.
- 제안:
  ```ts
  const safeTotalPages = Math.min(totalPages, 100); // 상한선 설정
  ```

---

### 요약

이 코드셋은 React/Next.js의 기본 XSS 방어(JSX 자동 이스케이핑)에 의해 주요 인젝션 공격은 차단되며, 하드코딩된 시크릿이나 암호화 취약점은 없습니다. 주요 보안 우려사항은 **서버 응답 데이터를 클라이언트에서 검증 없이 라우팅·렌더링에 사용**하는 패턴으로, URL 조작이나 악의적 서버 응답에 의한 정보 노출 및 리다이렉트 위험이 존재합니다. 특히 워크플로우 노드의 입출력 데이터를 무제한 노출하는 `JsonViewer` 구조는 민감한 비즈니스 데이터가 처리되는 워크플로우 환경에서 정보 노출 위험을 높입니다. 전반적으로 보안 수준은 양호하나, 입력 파라미터 검증과 민감 데이터 마스킹을 보강하면 더욱 견고해집니다.

### 위험도

**MEDIUM**