# 보안(Security) 코드 리뷰

리뷰 대상: PR-A3 — user-defined variables durable park 영속 + rehydration 복원
커밋: 18fc07f7b2ec5afea3d0635f396e0b088b3c47e7

---

## 발견사항

### [INFO] JSONB 컬럼에 사용자 정의 변수 무제한 저장
- **위치**: `codebase/backend/migrations/V085__execution_user_variables.sql` L79, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `stageDurableResumeSnapshot`
- **상세**: `execution.user_variables JSONB NULL` 컬럼에 사용자 정의 변수 전체를 저장한다. 현재 코드에는 저장 가능한 키 수, 값 크기, 전체 JSONB 객체 크기에 대한 상한 제한이 없다. 악의적이거나 실수로 생성된 거대한 변수 셋(수천 개 키, 대용량 문자열·바이너리 값 등)이 반복 park 되면 DB 행 크기가 무제한 증가할 수 있다.
- **제안**: park 시 `context.variables` 크기(키 수 및/또는 직렬화 바이트 수)에 대한 상한을 `stageDurableResumeSnapshot` 내에 추가하거나, PostgreSQL JSONB 컬럼에 CHECK 제약을 설정한다. `pg_column_size()` 기반 제약 또는 애플리케이션 레이어 가드 중 하나면 충분하다.

---

### [INFO] `rehydrateUserVariables`의 `Object.entries` 호출 — 프로토타입 체인 오염 방어
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L394
- **상세**: `Object.entries(raw as Record<string, unknown>)` 는 `raw` 가 순수 plain object 일 때는 안전하다. TypeORM JSONB 역직렬화 결과는 일반적으로 plain object 이므로 실 운영 위험도는 낮다. 그러나 만약 `raw` 가 `Object.create(maliciousProto)` 또는 `__proto__` 키를 포함한 JSON 이라면, 표준 `Object.entries` 는 own properties 만 반환하므로 프로토타입 체인 오염으로 이어지지 않는다. 따라서 현재 구현은 prototype pollution 관점에서 안전하다. 단, `__proto__` 라는 문자열 자체는 `__` prefix 필터에 의해 제거되므로 이중으로 방어된다.
- **제안**: 현재 구현은 적절하다. 추가 조치 불요.

---

### [INFO] `userVariables` 컬럼이 API 응답 DTO 에서 제외됨 — 민감 정보 노출 방지 확인
- **위치**: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L460-461 주석 "API 응답 DTO 미포함 — 내부 rehydration 전용"
- **상세**: 주석에 "API 응답 DTO 미포함"이라고 명시되어 있다. 사용자 정의 변수에는 민감한 값(토큰, 비밀번호, PII 등)이 포함될 가능성이 있으므로 이 배제가 실제로 모든 API 응답 경로(Execution 조회 API, WebSocket 이벤트 등)에서 일관되게 적용되는지 확인이 필요하다. 현재 diff만으로는 DTO 변환 계층의 배제 여부를 직접 확인할 수 없다.
- **제안**: `ExecutionResponseDto` 및 관련 직렬화 코드에서 `userVariables` 필드가 `@Exclude()` 데코레이터 또는 명시적 매핑 생략을 통해 실제로 제외됨을 한 번 검증한다. 이 검증이 이미 완료되어 있다면 INFO 수준으로 유지된다.

---

### [INFO] 시스템 변수 `__*` 필터 우회 가능성 — 유사 접두사 미고려
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L380, L395
- **상세**: `__` (언더스코어 2개) prefix를 기준으로 시스템 변수를 필터링한다. 현재 설계 의도에서 이 prefix는 엔진 내부 전용으로 예약되어 있다. 그러나 사용자가 워크플로 노드에서 `__custom_var` 같이 `__` prefix를 갖는 이름의 변수를 선언할 경우, park 시 해당 변수가 영속 대상에서 제외(손실)된다. 이는 데이터 손실로 이어지며, 사용자가 `__`로 시작하는 변수를 생성하지 못하도록 Variable Declaration 노드에서 입력 검증이 이루어지는지 확인이 필요하다.
- **제안**: Variable Declaration/Modification 노드에서 `__` prefix 변수명을 거부하는 입력 검증이 이미 존재하는지 확인한다. 없다면 노드 레벨 또는 context 레이어에서 `__` prefix 변수명 생성을 차단하는 가드를 추가한다.

---

## 요약

이번 PR(A3)은 실행 엔진의 park/rehydration 경로에 사용자 정의 변수를 JSONB로 영속하는 기능을 추가한다. 핵심 보안 설계인 시스템 변수(`__*`) 분리, 방어적 정규화(`rehydrateUserVariables`의 비객체 → `{}` 처리), 시스템 변수 우선 재주입(user vars 먼저 spread, `__*`가 override)은 모두 올바르게 구현되어 있다. SQL 인젝션·XSS·커맨드 인젝션·하드코딩된 시크릿·인증 우회 등 주요 OWASP 항목에 해당하는 취약점은 이번 diff에서 발견되지 않는다. `userVariables` API 응답 DTO 배제 여부와 변수 크기 상한 부재, 그리고 `__` prefix 변수명 생성 방지 여부 세 가지가 확인 권장 사항으로 도출되나 모두 INFO 수준이다.

---

## 위험도

LOW

STATUS: OK
