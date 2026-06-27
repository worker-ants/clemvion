# Testing Review

## 발견사항

### [INFO] `listModels` 단위 테스트에 `type='embedding'` 경로 미검증
- 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — `listModels` describe 블록 (L60-77)
- 상세: 현재 단위 테스트는 `type='chat'` 과 `type=undefined` 두 케이스만 검증한다. `type='embedding'` 경로는 위임 로직이 동일하므로 실제 버그 가능성은 낮지만, `MODEL_TYPE_ENUM` 에 선언된 두 허용값 모두를 단위 테스트가 명시적으로 확인하지 않는다. 특히 `MODEL_TYPE_ENUM` 의 키와 값이 달라지는 경우(현재는 동일하지만 향후 변경 시) 테스트가 탐지하지 못한다.
- 제안: `type='embedding'` 케이스를 추가하거나, `Object.values(MODEL_TYPE_ENUM)` 을 순회하는 테이블 기반 테스트로 전환해 enum 값 전체를 자동으로 커버한다.

### [WARNING] `ParseEnumPipe` 경계값 케이스가 e2e 에서 누락
- 위치: `/codebase/backend/test/workspace-rbac.e2e-spec.ts` — 케이스 H (L960-964)
- 상세: `?type=bogus` (완전히 다른 문자열) 를 검증하는 e2e 테스트는 추가됐다. 그러나 `ParseEnumPipe` 가 `{ optional: true }` 로 설정된 상태에서 다음 경계값들이 검증되지 않았다.
  - `?type=` (빈 문자열) — `optional: true` 가 빈 문자열을 `undefined` 로 취급하는지, 아니면 유효하지 않은 값으로 400 을 반환하는지 NestJS 버전별로 다를 수 있다.
  - `?type=CHAT` (대소문자 불일치) — `ParseEnumPipe` 는 기본적으로 대소문자를 구분하므로 400 을 반환해야 하지만 테스트가 없다.
  - `?type=chat,embedding` (복수 값) — 쿼리 파라미터에 배열식 전달 시 동작
- 이 검증들은 pipe wiring 특성상 단위 테스트에서 우회되므로 e2e 가 유일한 검증 계층이다. 특히 빈 문자열 동작은 프레임워크 버전에 의존하므로 회귀 위험이 있다.
- 제안: `?type=` 케이스를 최소한 하나 e2e 에 추가해 `optional: true` 의 빈 문자열 처리를 명시적으로 고정한다.

### [WARNING] `invalidType` e2e 단언이 독립 테스트 케이스가 아닌 케이스 H 내부에 임베드
- 위치: `/codebase/backend/test/workspace-rbac.e2e-spec.ts` — L500-507 (케이스 H 마지막)
- 상세: `ParseEnumPipe` 검증을 위한 `invalidType` 요청이 케이스 H (`POST :id/test — viewer 403, editor 가드 통과; GET :id/models 는 viewer 통과`) 의 마지막에 붙어 있다. 케이스 H 내 앞선 `viewerModels.status === 404` 단언이 실패하면 이 400 검증은 실행되지 않는다. 테스트 격리 원칙(각 관심사가 독립적으로 실패/통과)에서 벗어난 구조다.
- 제안: `ParseEnumPipe` 400 검증을 별도의 `it('I. GET :id/models — 규격 외 type 파라미터는 400', ...)` 케이스로 분리해 선행 단언 실패에 영향받지 않도록 한다. 단, 이 분리는 새로운 `owner/ws/viewer` 셋업이 필요하므로 비용이 있다.

### [INFO] `PROVIDER_PROBE_THROTTLE` 상수에 대한 메타데이터 수준 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
- 상세: `@Roles` 데코레이터는 `ROLES_KEY` 를 통해 메타데이터를 명시적으로 검증하는 테스트가 있다. 반면 `PROVIDER_PROBE_THROTTLE` 의 TTL/limit 값은 테스트로 고정되지 않아, 향후 상수값이 실수로 변경되어도 단위 테스트가 탐지하지 못한다. 스로틀 정책은 과금 보호 목적이므로 상수 변경은 보안/비용 관련 회귀로 이어질 수 있다.
- 제안: `Reflect.getMetadata` 또는 NestJS `ThrottlerGuard` 메타데이터 키를 이용해 세 핸들러 모두에 `{ default: { ttl: 60_000, limit: 10 } }` 가 적용됐음을 단언하는 테스트를 추가한다.

### [INFO] 단위 테스트가 pipe 를 우회하는 이유를 명시한 점은 올바른 설계 결정
- 위치: `/codebase/backend/test/workspace-rbac.e2e-spec.ts` L501-502 (코멘트)
- 상세: `ParseEnumPipe` 검증을 e2e 로만 수행하는 이유("단위 테스트는 pipe wiring 을 우회하므로")를 코멘트로 명시한 점은 테스트 구조 결정의 근거를 문서화한 좋은 사례다. 이로 인해 단위 테스트에서 해당 검증이 없는 것이 의도적임을 명확히 한다.

## 요약

이번 변경의 핵심은 `GET /api/model-configs/:id/models` 의 `type` 쿼리 파라미터에 `ParseEnumPipe` 를 적용한 것이다. 테스트 전략 자체는 적절하다: 파이프 와이어링은 단위 테스트에서 우회되므로 e2e 에서 검증하고, 위임·역할 메타데이터는 단위 테스트가 담당한다. 이 구분 근거도 코멘트로 문서화돼 있다. 그러나 세 가지 갭이 존재한다. 첫째, `ParseEnumPipe` 의 빈 문자열 및 대소문자 불일치 경계값이 e2e 에서 검증되지 않아, `optional: true` 의 프레임워크 의존적 동작이 회귀 없이 변경될 수 있다. 둘째, `invalidType` 단언이 기존 테스트 케이스에 임베드되어 있어 선행 실패 시 실행되지 않는다. 셋째, 보안·비용 관련 스로틀 상수가 메타데이터 수준에서 고정되지 않는다. 이 갭들은 기능 동작에 즉각적 위험을 주지 않으므로 전체 위험도는 낮다.

## 위험도

LOW
