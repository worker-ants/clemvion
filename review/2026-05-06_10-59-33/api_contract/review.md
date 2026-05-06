이제 분석을 완료할 수 있는 충분한 정보를 확보했습니다.

---

### 발견사항

- **[WARNING]** `$today` → `$now` 표현식 변수 교체 — 기존 저장된 워크플로우의 하위 호환성 미보장
  - 위치: `expression-constants.ts:31`, `ROOT_VARIABLES` 배열
  - 상세: `$today`가 `ROOT_VARIABLES`에서 제거되고 `$now`로 대체되었습니다. 이미 DB에 저장된 워크플로우 노드 설정에 `$today`가 포함된 표현식이 있다면, 런타임에서 미정의 변수로 처리되어 평가 실패 또는 `undefined` 반환이 발생합니다. 표현식 언어는 프론트엔드-백엔드가 공유하는 계약이므로 이는 **묵시적 Breaking Change**에 해당합니다.
  - 제안: 백엔드 `ExpressionResolverService`에 `$today` fallback alias를 추가하거나, DB 마이그레이션 스크립트로 기존 표현식을 일괄 변환하고 버전을 명기해야 합니다.

---

- **[WARNING]** `/triggers/{id}/history` 응답 형식 이중 처리 — 계약 불명확
  - 위치: `trigger-detail-drawer.tsx:72-74`
  - 상세: `Array.isArray(responseData) ? responseData : responseData.items ?? []` 패턴은 백엔드가 배열과 `{ items }` 래퍼 두 가지 형식 모두를 반환할 가능성에 대한 방어 코드입니다. 이는 `/history` 엔드포인트의 응답 스키마가 정해지지 않았거나 버전 간 불일치가 있음을 시사합니다.
  - 제안: 백엔드의 `/triggers/:id/history` 응답을 단일 형식(예: `{ items: [], total: number }`)으로 고정하고, OpenAPI 스펙에 명문화해야 합니다.

---

- **[WARNING]** `/workflows` 목록 API 응답 이중 처리 — 계약 불명확
  - 위치: `schedules/page.tsx:559`, `triggers/page.tsx:135`
  - 상세: `res.data.data ?? res.data` 패턴이 `/workflows` 엔드포인트에서 일관되게 나타납니다. 이는 응답 envelope(`{ data: [...] }` vs 직접 배열)이 통일되지 않았다는 신호입니다.
  - 제안: 백엔드의 모든 목록 API 응답을 `{ data: T[], meta?: PaginationMeta }` 형식으로 통일하고 클라이언트의 이중 처리 코드를 제거해야 합니다.

---

- **[INFO]** Calendar 뷰에서 `GET /schedules?limit=200` — 전용 미페이지네이션 엔드포인트 부재
  - 위치: `schedules/page.tsx:531-538`
  - 상세: 코드 주석에서도 인정하듯(`A dedicated unpaginated endpoint would be cleaner`), 달력 뷰는 `limit=200`으로 우회합니다. 스케줄이 200개를 초과하면 달력 뷰가 불완전해집니다.
  - 제안: `GET /schedules/all` (또는 `?unpaginated=true`) 전용 엔드포인트를 추가하거나, 달력이 필요한 범위만 쿼리하도록 `GET /schedules?month=2026-05` 형태의 파라미터를 설계하는 것이 바람직합니다.

---

- **[INFO]** 웹훅 URL의 포트 하드코딩 — 환경 의존성
  - 위치: `trigger-detail-drawer.tsx:228`, `triggers/page.tsx:201`
  - 상세: `window.location.origin.replace(/:\d+$/, ":3011")`으로 백엔드 포트를 3011로 고정합니다. 프로덕션 환경(포트 80/443)이나 도커 환경에서 이 로직이 깨집니다.
  - 제안: 웹훅 베이스 URL을 환경 변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`)로 분리하거나, 백엔드 API가 웹훅 URL을 `endpointPath` 대신 완성된 URL로 반환하도록 계약을 변경해야 합니다.

---

- **[INFO]** `POST /schedules/{id}/run-now` — 요청 바디 없음
  - 위치: `schedules/page.tsx:644`
  - 상세: 바디 없이 POST를 전송합니다. 현재는 문제없으나, 향후 `parameterValues`를 run-now 시점에 오버라이드하는 요구가 생기면 API 변경이 필요합니다. 예측 가능한 확장점을 미리 설계해두는 것이 좋습니다.
  - 제안: 즉시 문제는 아니나, 스펙에 `run-now`의 request body가 `{}` (빈 객체 허용)임을 명기해두면 향후 확장 시 하위 호환 유지가 용이합니다.

---

### 요약

이번 변경의 핵심인 `$today` 제거는 표현식 엔진의 공용 계약을 변경하는 **잠재적 Breaking Change**로, 기존 저장된 워크플로우에 마이그레이션 전략 없이 적용하면 런타임 오류를 유발할 수 있습니다. 그 외 `/triggers/:id/history`와 `/workflows` 목록 API의 응답 형식 불일치, 달력 뷰의 `limit=200` 우회, 웹훅 URL 포트 하드코딩이 API 계약 관점에서 정비가 필요한 사항으로 확인됩니다.

### 위험도

**MEDIUM**