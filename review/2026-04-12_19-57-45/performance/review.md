## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `DatabaseQueryHandler`: 매 실행마다 새 DB 연결 생성**
- 위치: `database-query.handler.ts` — `execute()` 내 `new PgClient(...)` + `client.connect()`
- 상세: 각 노드 실행마다 TCP 핸드셰이크를 포함한 새 PostgreSQL 연결을 열고, 쿼리 후 즉시 닫습니다. 워크플로우 내에서 동일 integration을 참조하는 DB 노드가 여러 개이거나, 짧은 간격으로 반복 실행될 경우 연결 생성 오버헤드가 누적됩니다.
- 제안: `pg.Pool`을 통한 연결 풀링 적용. `integrationId` 단위로 Pool 인스턴스를 캐싱하여 재사용하거나, 최소한 실행 컨텍스트 범위(`executionId`) 내에서는 동일 연결을 공유하는 방식을 검토하세요.

---

**[WARNING] `SendEmailHandler`: 매 실행마다 Nodemailer Transporter 재생성**
- 위치: `send-email.handler.ts` — `buildTransport()` 호출 + `transporter.close()`
- 상세: SMTP 연결은 생성 비용이 큰 자원입니다. `buildTransport()`가 매 실행마다 호출되고 `finally`에서 즉시 닫힙니다. SMTP 서버에 따라 TLS 핸드셰이크 비용이 수십~수백 ms에 달할 수 있습니다.
- 제안: `IntegrationHandlerBase`에 transporter 인스턴스 캐시를 두거나(credential hash 키), 혹은 `pooling: true` 옵션을 Nodemailer에 전달하여 SMTP 연결을 재사용하세요.

---

**[WARNING] `SlackHandler`: 매 실행마다 `new WebClient(token)` 생성**
- 위치: `slack.handler.ts` — `execute()` 내 `const client = new WebClient(token)`
- 상세: Slack WebClient는 내부적으로 `p-queue` 기반의 rate-limit 큐와 axios 인스턴스를 초기화합니다(`package-lock.json`의 `@slack/web-api` 의존성 참고). 매 실행마다 이 객체를 새로 생성하면 rate limit 상태가 공유되지 않아 실제로 API rate limit에 걸릴 가능성이 높아지고, 메모리 할당도 불필요하게 반복됩니다.
- 제안: `token`을 키로 하는 `Map<string, WebClient>` 캐시를 핸들러 인스턴스 레벨에 유지하세요.

---

**[WARNING] `IntegrationSelector` (프론트엔드): `staleTime`이 짧고 렌더링마다 API 호출 가능**
- 위치: `integration-selector.tsx` — `staleTime: 30_000`
- 상세: 30초 stale time은 에디터 패널에서 설정 항목을 자주 클릭할 경우 불필요한 재호출을 유발할 수 있습니다. integration 목록은 변경 빈도가 낮습니다.
- 제안: `staleTime: 5 * 60 * 1000`(5분) 정도로 늘리거나, 별도의 전역 쿼리 키로 올려 에디터 전체에서 단일 캐시를 공유하세요.

---

**[INFO] `getForExecution`: DB 조회 캐싱 없음**
- 위치: `integrations.service.ts` — `getForExecution()`
- 상세: 동일 워크플로우 실행 내에서 같은 `integrationId`를 참조하는 노드가 여럿 있으면(예: 여러 Slack 노드), 매번 DB 쿼리가 발생합니다. TypeORM의 First-level cache나 실행 컨텍스트 범위의 Map 캐시로 완화 가능합니다.
- 제안: `ExecutionEngineService`에서 실행 단위 integration 캐시(`Map<integrationId, Integration>`)를 관리하여 `getForExecution` 중복 호출을 제거하세요.

---

**[INFO] `paramsSerializer` — URLSearchParams 직렬화는 적절하나 매 요청마다 클로저 생성**
- 위치: `client.ts` — `paramsSerializer.serialize`
- 상세: 함수 자체는 O(n) 단순 구현으로 문제 없습니다. 다만 axios 인스턴스 생성 시점에 인라인 함수로 선언되어 있어, 실제로는 한 번만 생성되므로 큰 문제는 아닙니다.
- 제안: 가독성을 위해 named function으로 분리하는 것만 권장하며, 성능상 변경 필요는 없습니다.

---

**[INFO] `resolveUrl` — 정규식을 매 호출마다 인라인 생성**
- 위치: `http-request.handler.ts` — `/^https?:\/\//i`
- 상세: 함수 내부에 정규식 리터럴이 있어 실행마다 RegExp 객체가 생성됩니다. 이는 JS 엔진이 대부분 최적화하지만, 모듈 상수로 추출하면 명확합니다.
- 제안: `const ABSOLUTE_URL_RE = /^https?:\/\//i;`를 모듈 상단에 선언하세요.

---

### 요약

이번 변경의 핵심 성능 리스크는 **연결 자원(DB Connection, SMTP Transporter, Slack WebClient)을 매 노드 실행마다 생성·폐기**하는 패턴에 있습니다. 특히 루프 컨테이너(`ForEachExecutor`, `LoopExecutor`) 안에서 DB 노드나 Slack 노드가 실행될 경우, 반복 횟수만큼 연결 오버헤드가 선형으로 증가합니다. Integration 자원(WebClient, PgPool, SMTP transporter)을 `integrationId` 단위로 캐싱하는 것이 가장 우선순위가 높은 개선입니다. 나머지 항목(getForExecution 캐싱, 프론트엔드 staleTime)은 낮은 트래픽에서는 허용 가능하나, 운영 환경에서는 보완이 필요합니다.

### 위험도
**MEDIUM**