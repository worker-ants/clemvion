### 발견사항

---

**[WARNING]** `integrations.service.ts` - `reauthorize` 메서드의 OAuth 설정 하드코딩
- 위치: `integrations.service.ts` (oauthConfigs 객체)
- 상세: `slack`, `google`, `github`의 OAuth URL과 스코프가 코드에 하드코딩되어 있음. 지원하는 OAuth 서비스 목록, 필요한 환경 변수(`SLACK_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL`) 문서화 없음
- 제안: README 또는 `.env.example`에 필요한 환경 변수 문서화 추가

---

**[WARNING]** `schedules.service.ts` - `getPreviewFromExpression`의 `timezone` 기본값 불명확
- 위치: `schedules.service.ts:138`
- 상세: `timezone` 기본값이 `'Asia/Seoul'`로 하드코딩되어 있으나 이에 대한 주석이나 문서가 없음. 글로벌 서비스에서 혼란 유발 가능
- 제안: 기본값 선택 이유를 인라인 주석으로 명시하거나 환경 변수로 분리

---

**[WARNING]** `statistics.service.ts` - `getNodeStats` 메서드의 SQL 캐스팅 로직
- 위치: `statistics.service.ts` (getNodeStats 쿼리)
- 상세: `COALESCE(AVG(...) FILTER ... )::float`, `ROUND(COUNT(*) FILTER (...)::numeric / ... * 100, 2)::float` 등 복잡한 PostgreSQL 전용 쿼리가 주석 없이 사용됨. PostgreSQL 의존성 명시 없음
- 제안: 해당 쿼리에 "PostgreSQL-specific syntax" 인라인 주석 추가, README에 DB 요구사항 명시

---

**[WARNING]** `workflows.service.ts` - `exportWorkflow`의 `TODO` 주석 미제거
- 위치: `workflows.service.ts:158` (diff context)
- 상세: 기존 코드에 `// TODO: Include nodes and edges in export` 주석이 있었으나 이번 변경에서 실제 구현됨. 해당 TODO는 제거됨 — 확인 필요 (diff 상 제거 확인됨). 양호
- 제안: 해당 없음 (이미 처리됨)

---

**[INFO]** `import-workflow.dto.ts` - DTO 클래스에 JSDoc 없음
- 위치: `backend/src/modules/workflows/dto/import-workflow.dto.ts`
- 상세: `ImportWorkflowDto`, `ImportNodeDto`, `ImportEdgeDto` 클래스에 설명이 없음. `containerId`가 `number | null`인 이유(index-based reference), `sourceNodeIndex`/`targetNodeIndex`의 의미 등이 불명확
- 제안:
  ```ts
  /** Index-based reference to the node in the `nodes` array. Used to resolve edges after import. */
  @IsNumber()
  sourceNodeIndex: number;
  ```

---

**[INFO]** `slide-drawer.tsx` - `h-[calc(100%-65px)]` 매직 넘버
- 위치: `slide-drawer.tsx:54`
- 상세: `65px`는 헤더 높이를 의미하나 주석 없이 사용됨
- 제안: `{/* 65px = header height (py-4 * 2 + h5 line height) */}` 인라인 주석 추가

---

**[INFO]** `run-results-drawer.tsx` - `slice(0, 50)` 매직 넘버
- 위치: `run-results-drawer.tsx:38`
- 상세: 테이블 결과 50행 제한에 대한 이유 설명 없음
- 제안: `// Limit rows rendered for performance` 주석 추가

---

**[INFO]** `dashboard.service.ts` - `runs7dChangePercent` 계산식 설명 없음
- 위치: `dashboard.service.ts:72-78`
- 상세: `* 10000 / 100` 패턴(소수점 2자리 반올림)이 직관적이지 않음
- 제안:
  ```ts
  // Round to 2 decimal places: (diff / prev) * 100, rounded to .01
  Math.round(((runs7dResult - runs7dPrevious) / runs7dPrevious) * 10000) / 100
  ```

---

**[INFO]** `auth-configs.controller.ts` - `GET :id/usage` 엔드포인트 순서
- 위치: `auth-configs.controller.ts:56`
- 상세: `GET :id/usage`가 `POST :id/regenerate` 앞에 추가됨. REST 컨벤션상 문제없으나 Swagger/OpenAPI 데코레이터 (`@ApiOperation`, `@ApiResponse`)가 없어 API 문서 자동생성이 누락됨. 다른 엔드포인트도 동일한 상황
- 제안: Swagger 데코레이터 추가 또는 최소한 API 명세 문서 별도 관리

---

**[INFO]** `frontend/package.json` - `test`, `test:watch` 스크립트 추가됐으나 README 미갱신
- 위치: `frontend/package.json:8-9`
- 상세: 프론트엔드에 vitest 테스트 환경이 추가되었으나 루트 README에 프론트엔드 테스트 실행 방법이 업데이트되지 않은 것으로 추정됨
- 제안: README에 `cd frontend && npm run test` 명령 추가

---

**[INFO]** `trigger-detail-drawer.tsx` - `TriggerHistoryEntry.triggeredAt` 필드명 불일치 가능성
- 위치: `trigger-detail-drawer.tsx:26`, `triggers.service.ts:101`
- 상세: 백엔드 `getHistory`는 `startedAt`을 반환하지만 프론트엔드 `TriggerHistoryEntry` 인터페이스는 `triggeredAt`을 사용. 런타임에서 `undefined` 렌더링 발생 가능
- 제안: 인터페이스를 `startedAt`으로 통일하거나, 백엔드에서 `triggeredAt` alias 추가

---

### 요약

전반적으로 코드 변경사항은 기능적으로 잘 구현되어 있으나, 문서화 측면에서 일부 미흡한 점이 있습니다. 가장 주목할 사항은 새로 추가된 환경 변수(`*_CLIENT_ID`, `APP_URL`)에 대한 `.env.example` 및 README 업데이트 누락, NestJS Swagger 데코레이터 부재로 인한 API 문서 자동화 기회 손실입니다. 또한 프론트엔드 `TriggerHistoryEntry`와 백엔드 반환값 간의 필드명 불일치(`triggeredAt` vs `startedAt`)는 런타임 버그로 이어질 수 있어 즉시 확인이 필요합니다. 복잡한 쿼리와 매직 넘버에 대한 인라인 주석 보완, 그리고 테스트 스크립트 추가에 따른 README 갱신을 권장합니다.

### 위험도
**MEDIUM** (필드명 불일치로 인한 런타임 버그 가능성, 환경 변수 문서화 누락)