## 발견사항

### [CRITICAL] `_multiTurnState` → `_resumeState` 필드명 변경으로 인한 인-플라이트 실행 중단
- **위치**: `ai-agent.handler.ts` 모든 waiting/resume 분기
- **상세**: 기존에 `_multiTurnState`로 persist 된 실행 상태가 있으면, 재개 시 엔진이 `_resumeState`를 찾지 못해 컨텍스트 없이 새 턴을 시작하게 된다. `information-extractor.handler.ts`에도 동일한 필드명 변경이 적용되어 있다. 배포 시점에 대기 중인 모든 multi-turn 세션이 손상된다.
- **제안**: 엔진의 resume 경로에서 `_resumeState ?? _multiTurnState` 폴백 읽기 추가, 또는 실행 중인 세션이 없음을 배포 전 확인하는 마이그레이션 절차 필수.

---

### [CRITICAL] 컨테이너 출력 구조 변경 (flat array → `{ items/iterations/mapped, count }`)
- **위치**: `execution-engine.service.ts`, `spec/4-nodes/1-logic-nodes.md`
- **상세**: ForEach는 `[]` → `{ items, count }`, Loop는 `[]` → `{ iterations, count }`, Map은 `[]` → `{ mapped, count }`로 변경된다. 기존 워크플로우에서 `$node["ForEach"].output[0]` 또는 `$node["ForEach"].output.someField` 형태로 접근하는 표현식이 전부 깨진다. 마이그레이션 스크립트(`migrate-node-output-refs.ts`)가 이 변환을 처리하는지 확인이 필요하다.
- **제안**: 마이그레이션 스크립트가 컨테이너 출력 참조(`$node["X"].output`)를 `$node["X"].output.items[i]` / `.iterations[i]` / `.mapped[i]` 로 자동 변환하는 로직 포함 여부를 검증할 것.

---

### [CRITICAL] `output.extracted` → `output.result.extracted` 경로 변경 (Information Extractor)
- **위치**: `information-extractor.handler.ts`, `information-extractor.schema.ts`, `node-output-schema-enrichers.ts`
- **상세**: 기존 워크플로우에서 `$node["X"].output.extracted.orderNumber` 형태로 저장된 표현식이 모두 깨진다. `expression-resolver.service.ts`의 legacy shim은 `{ output: flat }` 구조로 돌아가므로 flat cache에 저장된 pre-migration 실행 결과에 대한 접근은 가능하지만, 새로운 structured path는 `output.result.extracted`로 바뀐다.
- **제안**: 마이그레이션 스크립트에서 `$node["X"].output.extracted` → `$node["X"].output.result.extracted` 변환 커버리지 확인.

---

### [WARNING] `isLegacyPortSelector` 브랜치 제거
- **위치**: `handler-output.adapter.ts` L18-32 (삭제된 코드)
- **상세**: `{ port, data, ...rest }` 형태를 반환하는 핸들러가 프로덕션에 잔존하면, 이제 bare-object 브랜치로 빠져 `output`에 전체 객체(`{ port, data }` 포함)가 들어간다. `port` 필드가 두 번 해석될 수 있고, `data` 내용이 output에 노출되지 않는다. 코드베이스 전체에서 이 구조를 반환하는 핸들러가 없는지 확인이 필요하다.
- **제안**: `grep -r '{ port.*data.*}' backend/src/nodes` 로 잔존 핸들러 스캔 권고.

---

### [WARNING] `workflow.handler.ts` - 예외를 `error` 포트로 흡수
- **위치**: `workflow.handler.ts` `buildSubWorkflowError` 메서드
- **상세**: 기존에는 `executeInline`/`executeAsync` 예외가 상위로 전파되어 실행 엔진이 execution을 `failed` 상태로 기록했다. 이제 `{ port: 'error' }` 반환으로 바뀌었는데, 해당 노드의 `error` 포트에 아무것도 연결되지 않은 워크플로우에서는 오류가 조용히 무시된다. 이전에는 실패로 처리되던 케이스가 "정상 완료(데드엔드)"로 기록될 수 있다.
- **제안**: 엔진의 dead-end 감지 로직이 `error` 포트 라우팅 실패를 올바르게 처리하는지 확인. 미연결 `error` 포트 도달 시 execution 실패 처리 보장.

---

### [WARNING] `send-email.handler.ts` - `output.error.code` 항상 `EMAIL_SEND_FAILED`
- **위치**: `send-email.handler.ts` L164-167
- **상세**: `const code = err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED'` — 두 분기가 동일한 값을 반환한다. `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE` 등의 구분이 `details.integrationCode`로만 내려가고 `output.error.code`에는 반영되지 않는다. 에러 포트에 연결된 다운스트림 노드가 `$node["X"].output.error.code`로 분기하면 모두 동일하게 처리된다.
- **제안**: `IntegrationError`인 경우 `output.error.code`에 `err.code` 또는 도메인별 코드를 사용할 것. 예: `INTEGRATION_TYPE_MISMATCH` → `EMAIL_INTEGRATION_TYPE_MISMATCH`.

---

### [WARNING] `database-query.handler.ts` - 에러 코드 변경 (`QUERY_FAILED` → `DB_QUERY_FAILED`)
- **위치**: `database-query.handler.ts` 에러 경로
- **상세**: 기존에 `QUERY_FAILED` 코드를 의존하는 모니터링, 알림, 다운스트림 조건 분기가 조용히 누락된다.
- **제안**: 릴리즈 노트에 breaking change 명시. 모니터링/알림 쿼리 업데이트 필요.

---

### [WARNING] `form.handler.ts` - `output: null` → `output: {}`
- **위치**: `form.handler.ts` execute 반환값
- **상세**: `null`은 falsy, `{}`는 truthy다. `if (output)` 조건으로 form 출력을 확인하는 downstream 코드 또는 엔진 내 null-guard 로직이 있으면 동작이 달라진다. 특히 `toEngineFlatShape`에서 `output`이 `null`일 때의 처리 경로가 달라질 수 있다.
- **제안**: `toEngineFlatShape`와 관련 엔진 코드에서 `null` vs `{}` 처리 경로 확인.

---

### [WARNING] `http-request.handler.ts` - 비 2xx 응답 구조 변경
- **위치**: `http-request.handler.ts` L273-310
- **상세**: 기존 비 2xx 응답은 `{ output: { response: responseData } }` 였으나, 이제 `{ output: { response: responseData, error: { code, message, details } } }`로 변경된다. 이전에 `$node["X"].output.response`로 에러 응답 바디를 읽던 표현식은 계속 동작하지만, `output`에 `error` 필드가 추가되는 것은 구조적 변경이다. 또한 성공 응답은 `res.ok` 체크로 먼저 반환되고 비성공만 `error` 필드를 가지므로, 기존에 `port === 'success'`로만 분기하던 로직은 영향 없다.
- **제안**: 비 2xx 응답 바디를 처리하는 기존 워크플로우에서 `output.response`와 `output.error`의 공존 관계 문서화 필요.

---

### [INFO] `presentation handlers` - `type` 디스크리미네이터 제거
- **위치**: `carousel/chart/table/template.handler.ts`
- **상세**: `output.type` (`'carousel'`, `'chart'`, `'table'`, `'template'`)이 제거된다. 프론트엔드에서 이 필드로 렌더러를 선택하는 코드가 있으면 영향을 받는다. `presentation-renderers.tsx`에서 `TemplateContent`가 `data.rendered`를 사용하도록 이미 업데이트되었지만, `output.type`을 직접 참조하는 다른 프론트엔드 코드가 있는지 검색이 필요하다.
- **제안**: `grep -r "output\.type.*carousel\|chart\|table\|template" frontend/src` 로 잔존 참조 확인.

---

### [INFO] `carousel/chart/table.handler.ts` - `meta.durationMs: 0` 하드코딩
- **위치**: `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts` - buttons 분기
- **상세**: waiting 상태에서 `meta: { interactionType: 'buttons', durationMs: 0 }`으로 `durationMs`가 항상 0으로 기록된다. 실제 처리 시간을 반영하지 않는다.
- **제안**: `execute` 진입 시점 타임스탬프 캡처 후 실제 소요 시간 사용. 허용 가능한 수준이면 INFO로 유지.

---

## 요약

이번 변경은 노드 출력 구조를 `NodeHandlerOutput({ config, output, meta, port, status })`로 통일하는 대규모 리팩터링이다. 가장 중요한 부작용 위험은 세 가지다: (1) `_multiTurnState` → `_resumeState` 필드명 변경으로 인-플라이트 멀티턴 세션이 재개 불가가 될 수 있고, (2) ForEach/Loop/Map의 컨테이너 출력이 배열에서 `{ items/iterations/mapped, count }` 객체로 바뀌어 기존 워크플로우 표현식이 파손되며, (3) Information Extractor의 `output.extracted` → `output.result.extracted` 경로 변경이 동일한 파손을 야기한다. 이 세 가지 모두 마이그레이션 스크립트(`migrate-node-output-refs.ts`)의 커버리지에 의존하나, 스크립트가 컨테이너 출력 재구조화를 처리하는지 여부가 diff에서 확인되지 않는다. 에러 코드 변경(`QUERY_FAILED` → `DB_QUERY_FAILED`)과 예외 흡수 패턴(workflow/send-email)은 모니터링과 에러 전파 측면에서 부수적 위험을 가진다.

## 위험도

**HIGH**