### 발견사항

이 변경은 `web-chat-page.test.tsx` 테스트 파일에 한정된 수정이다. `findByText` 단일 매칭 호출을 `findAllByText` 다중 매칭 호출로 교체하는 것이 전부이며, 프로덕션 코드는 변경되지 않았다.

- **[INFO]** 테스트 픽스처 데이터는 실제 시크릿이 아닌 더미값 사용
  - 위치: WEBHOOK_INSTANCE / WEBHOOK_INSTANCE_2 / NON_INTERACTION_WEBHOOK 상수
  - 상세: `id: "t-1"`, `workflowId: "wf-1"`, `endpointPath: "endpoint-uuid-123"` 등은 테스트 전용 더미 식별자이며, 실제 API 키·토큰·인증서가 아니다.
  - 제안: 현행 유지. 테스트 픽스처는 의도된 더미값이다.

- **[INFO]** mock 처리된 API 클라이언트 — 실제 네트워크 호출 없음
  - 위치: `vi.mock("@/lib/api/client", ...)` 블록
  - 상세: 모든 API 호출은 `apiGetMock` / `apiPatchMock` 으로 대체되어 있어 실제 엔드포인트 노출 없음. 테스트 격리가 적절히 구현되어 있다.
  - 제안: 현행 유지.

- **[INFO]** 에러 메시지 처리 — 민감 정보 미포함
  - 위치: `Promise.reject(new Error("boom"))` 및 `mockRejectedValue(new Error("server error"))`
  - 상세: 더미 에러 메시지만 사용하며, 실제 스택 트레이스나 내부 상태가 테스트 어설션에 노출되지 않는다.
  - 제안: 현행 유지.

- **[INFO]** 의존성 보안 — 이번 diff 에서 신규 의존성 추가 없음
  - 위치: import 구문 (`vitest`, `@testing-library/react`, `@tanstack/react-query`)
  - 상세: 기존 테스트 라이브러리 버전 취약점 여부는 이번 변경 범위 밖이다.
  - 제안: 정기적인 `npm audit` 로 기존 의존성 취약점 모니터링 권장.

### 요약

이 변경은 프로덕션 코드에 영향을 주지 않는 순수 테스트 파일 수정이다. `findByText` 를 `findAllByText` 로 교체한 것은 DOM 렌더링 구조 변경(단일 위치 → 목록+상세 헤더 이중 렌더)에 대응하는 테스트 적응이며, 보안 관점에서 새로운 공격 표면을 도입하지 않는다. 픽스처 데이터는 모두 더미값이고, API 호출은 전부 mock 처리되어 있으며, 하드코딩된 시크릿·인젝션 취약점·인증 우회 가능성이 없다.

### 위험도

NONE
