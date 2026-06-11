# 문서화(Documentation) 리뷰 결과

## 발견사항

### **[INFO]** `isRefreshCapable` JSDoc — 함수 계약 문서 완비
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` (파일 내 `isRefreshCapable` 함수, 약 1530행)
- 상세: `isCafe24RefreshCapable`에서 `isRefreshCapable`로 리네임되면서 JSDoc도 함께 재작성됐다. cafe24·makeshop 두 provider의 동작 차이 (큐 enqueue 유무), 빈 문자열 edge case, 향후 확장 지침까지 명시돼 있다. 문서 품질이 높다.
- 제안: 해당 없음.

### **[INFO]** `integration-status-reason.ts` — 신규 슬러그 `token_expired` 인라인 주석 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/integrations/integration-status-reason.ts` (L1604)
- 상세: 슬러그 옆에 "refresh_token 없는 provider 의 token_expires_at 만료 → status=expired (connected-expiry 0d). spec/2-navigation/4-integration.md §11.2" 가 인라인 주석으로 기록됐다. 사유·진입경로·spec 참조가 한 줄에 담겨 있어 충분하다.
- 제안: 해당 없음.

### **[INFO]** spec 문서 업데이트 완료 확인
- 위치: `spec/2-navigation/4-integration.md` §11.1 표·의사코드·MakeShop note, `spec/data-flow/5-integration.md` 잡 테이블, `spec/1-data-model.md` `status_reason` 행
- 상세: 세 spec 파일 모두 §11.2 채택 결과를 반영했다. `status_reason` 설명에 `INTEGRATION_STATUS_REASONS` union 참조와 `unknown_error` fallback 명시가 추가됐으며, `token_expired`의 네임스페이스 충돌 주의사항(JWT 만료 `TOKEN_EXPIRED` 및 WebSocket `auth.token_expired` 와 별개임)도 data-model spec에 기록됐다.
- 제안: 해당 없음.

### **[INFO]** e2e 테스트 코드 내 고정 숫자 문서화 전략
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/test/system-status.e2e-spec.ts` (L1951–1953)
- 상세: `EXPECTED_QUEUE_NAMES` 배열이 소스 상수를 직접 import하지 않는 이유("e2e jest 모듈 해석 실패" — 전이 로드 문제)가 주석으로 명시돼 있다. 이 전략적 결정이 문서화돼 있어 향후 유지보수자가 "왜 하드코딩인가"를 이해할 수 있다.
- 제안: 해당 없음.

### **[WARNING]** `system-status.constants.ts` — 큐 추가 시 갱신 안내 주석이 `data-flow/0-overview.md §4`만 가리킴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/system-status/system-status.constants.ts` (L1815–1817: `MONITORED_QUEUES` 바로 위 주석)
- 상세: 주석 "큐 추가/삭제 시 data-flow/0-overview.md §4 카탈로그를 먼저 갱신하고 본 표를 동기화한다."는 e2e `EXPECTED_QUEUE_NAMES` 하드코딩 목록도 동기화해야 함을 누락하고 있다. 이번에 makeshop 큐 추가 시 실제로 e2e도 함께 갱신했으나, 주석이 그 의무를 안내하지 않아 다음 기여자가 e2e 갱신을 빠뜨릴 여지가 있다.
- 제안: 주석에 "e2e `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 함께 갱신할 것" 을 추가한다.

### **[INFO]** `plan/in-progress/integration-expiry-fixes.md` — 작업 이력 및 결정 근거 기록 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/plan/in-progress/integration-expiry-fixes.md`
- 상세: V-01·V-07·V-15 각 항목의 문제 원인, fix 방향, spec 참조, 커밋 SHA가 모두 기록됐다. 사용자 결정(§11.2 채택)의 날짜와 이유도 명시됐다. plan 문서로서 변경 이력 역할을 충실히 수행한다.
- 제안: 해당 없음.

### **[INFO]** 테스트 파일 인라인 주석 — spec 섹션 참조 일관성
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` (각 테스트 케이스 describe 블록 바로 위 주석들)
- 상세: `§11.1`, `§11.2` 참조가 변경된 테스트 케이스들에 일관되게 추가됐다. 새로 추가된 makeshop 케이스(V-01 라벨 포함)도 주석으로 동작 의도가 설명돼 있다. 테스트를 스펙 섹션에 추적 가능하게 연결한다.
- 제안: 해당 없음.

### **[INFO]** `system-status.constants.spec.ts` — 신규 테스트 파일 모듈 수준 JSDoc
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/system-status/system-status.constants.spec.ts` (L1703–1709)
- 상세: `describe` 블록 바로 위에 spec 참조와 V-15 회귀 방지 의도가 JSDoc 형식으로 기록돼 있다. 향후 유지보수자가 이 테스트의 존재 이유를 즉시 파악할 수 있다.
- 제안: 해당 없음.

## 요약

이번 변경은 문서화 관점에서 전반적으로 높은 완성도를 보인다. `isRefreshCapable` 함수 JSDoc 재작성, `token_expired` 슬러그 인라인 주석, spec 세 파일(data-model·navigation·data-flow) 동기 업데이트, plan 파일의 결정 근거 기록이 모두 충실하다. 유일한 개선 기회는 `system-status.constants.ts`의 큐 추가 안내 주석이 e2e 하드코딩 목록 갱신 의무를 언급하지 않는 점으로, WARNING 수준의 경미한 누락이다. 나머지는 코드·spec·테스트 간 추적 가능성이 잘 유지되어 있다.

## 위험도

LOW
