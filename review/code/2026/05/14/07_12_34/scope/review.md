### 발견사항

- **[WARNING]** 프론트엔드 리소스 목록 중복 선언
  - 위치: `integration-configs.tsx:248-266` `CAFE24_RESOURCES` 배열
  - 상세: 백엔드 `metadata/types.ts`의 `CAFE24_RESOURCES`/`CAFE24_RESOURCE_LABELS`와 동일한 18개 리소스 목록이 프론트엔드에 하드코딩되어 있음. 두 목록은 독립적으로 유지보수되어야 하므로 백엔드에서 리소스가 추가·삭제될 때 프론트엔드가 자동으로 반영되지 않음.
  - 제안: `/api/nodes/cafe24/metadata` 엔드포인트를 통해 프론트엔드가 리소스 목록을 가져오거나, 이번 PR 범위 내라면 TODO 주석으로 추적 항목임을 명시. 현재 스코프를 벗어나는 작업이므로 즉시 수정보다는 spec 또는 follow-up plan에 기록 권장.

- **[WARNING]** `Cafe24Config`의 Operation 필드가 자유 텍스트 입력
  - 위치: `integration-configs.tsx:318-323` `ExpressionInput` for `operation`
  - 상세: 백엔드에는 18개 리소스 × N개 operation의 완전한 메타데이터가 존재함에도 불구하고 프론트엔드는 operation을 자유 텍스트(`ExpressionInput`)로 입력받음. 존재하지 않는 operation ID를 입력하면 런타임까지 검증이 미뤄짐.
  - 제안: 이번 PR 범위 내에서 완성하지 못한 것이라면 `hint`에 "invalid ids will fail at runtime" 경고를 추가하고 follow-up 항목으로 등록. 의도적 설계라면 spec에 근거를 명시.

- **[INFO]** `mcp-capable-service-types.ts` 신규 유틸리티 파일 — 소규모 리팩토링 포함
  - 위치: `services/mcp-capable-service-types.ts`
  - 상세: 이전에 `candidate-lookup.service.ts`에 인라인으로 있던 `['mcp']` 배열을 상수로 추출하고 `MCP_CAPABLE_SERVICE_TYPES_LIST` (mutable) 추가 export를 포함함. `cafe24` 추가를 위해 반드시 필요한 추출이지만 `_LIST` 파생은 현재 사용처가 명확하지 않아 미래 용도를 위한 코드임.
  - 제안: 현재 사용처가 없다면 `MCP_CAPABLE_SERVICE_TYPES_LIST`를 제거하고, 필요해질 때 추가. 단, 코드량이 미미하여 우선순위 낮음.

- **[INFO]** `candidate-lookup.service.ts`에 `sublabel` 필드 추가
  - 위치: `candidate-lookup.service.ts:174` `sublabel: i.serviceType`
  - 상세: `CandidateEntry` 반환 객체에 `sublabel` 필드가 추가됨. Cafe24와 MCP를 구분하는 UI 배지용으로 보이나, 이 필드를 소비하는 프론트엔드 코드가 이번 PR에 포함되어 있지 않아 현재는 dead field임.
  - 제안: 이 `sublabel`을 실제로 사용하는 프론트엔드 UI 변경이 이번 PR 또는 다음 PR에 포함되어야 함. 없다면 필요 시점에 추가.

- **[INFO]** `integration.dto.ts`의 printable-ASCII 정규식 주석 — 적절한 보안 맥락
  - 위치: `integration.dto.ts:268-273`, `283-288`
  - 상세: `clientId`, `clientSecret`에 CRLF/control-char injection 방어 목적의 `@Matches` 데코레이터와 주석이 추가됨. SSRF 방어(`mallId`의 `/^[a-z0-9-]{3,50}$/`)와 함께 의도된 보안 강화로 판단. 스코프 내.

---

### 요약

변경 집합 전체는 Cafe24 통합 구현이라는 명확한 목적 아래 잘 집중되어 있다. 50개 파일 모두 Cafe24 OAuth 흐름, API 클라이언트, 메타데이터 테이블, 노드 컴포넌트, MCP 브리지, 프론트엔드 UI의 한 구현 단위에 속하며 관련 없는 파일 수정이나 불필요한 리팩토링은 발견되지 않는다. 다만 프론트엔드의 `CAFE24_RESOURCES` 중복 선언(백엔드 types.ts와 동기화 위험)과 Operation ID의 자유 텍스트 입력(런타임 검증 지연)은 중장기적 유지보수 부담으로 작용할 수 있어 follow-up으로 추적이 필요하다.

### 위험도

**LOW**