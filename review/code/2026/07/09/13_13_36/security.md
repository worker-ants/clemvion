# 보안(Security) Review

## 발견사항

- **[INFO]** 신규 저장 시점 검증 게이트(`skipParamSchemaValidation`)는 공개 API 경로에서 조작 불가 — 확인 완료
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas`/`validateManualTrigger` (line 388-619), `codebase/backend/src/modules/workflows/workflows.controller.ts` (line 447-480)
  - 상세: `skipParamSchemaValidation` 플래그는 `restoreVersion` 내부에서만 하드코딩된 `true` 로 호출되고(line 497), 공개 컨트롤러(`POST /:id/save`)는 인자 없이 기본값 `false` 로 `saveCanvas` 를 호출한다(controller line 453). 즉 사용자가 요청 바디/쿼리로 이 플래그를 조작해 저장 시점 검증을 우회할 경로가 없다. 인가 우회 리스크 없음.
  - 제안: 조치 불필요(참고용 검증 결과).

- **[INFO]** 인젝션 벡터 없음 — 모든 신규/변경 DB 조회가 파라미터 바인딩을 사용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:33-35` (TypeORM `findOne({ where: { workflowId, type } })`), `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:74-81` (raw SQL `SELECT ... WHERE execution_id = $1 AND node_id = $2`)
  - 상세: `category` 기반 조회를 `type` 기반으로 바꾼 변경(파일 5)은 여전히 TypeORM `where` 절 객체 바인딩을 사용해 SQL 인젝션 표면을 넓히지 않는다. 신규 e2e 헬퍼의 raw `pg` 쿼리도 `$1`/`$2` placeholder 로 파라미터화되어 있다. XSS·커맨드 인젝션·경로 탐색에 해당하는 신규 코드 경로도 없음(프론트 `trigger-configs.tsx` 는 `dangerouslySetInnerHTML` 없이 React 텍스트 노드로만 렌더링).
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff (파일 1-15)
  - 상세: 신규 e2e 스펙은 `registerAndLogin`/`createTeamWorkspace` 헬퍼로 테스트별 유니크 계정을 런타임에 생성하며(`uniqueEmail('mtdefault')`), API 키·비밀번호·토큰 리터럴이 코드에 직접 포함되지 않았다. `BASE_URL` 도 env var 기본값(`http://backend-e2e:3011`)일 뿐 자격증명이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 엔진 재진입 시 durable input 재사용은 테넌트/인가 경계를 넘지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`input: {} → savedExecution.inputData ?? {}`, 3개소), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (의도적으로 미변경, 주석만 추가)
  - 상세: 이 변경은 `Execution.inputData`(이미 해당 execution 레코드에 durable 하게 저장돼 있던 원본 트리거 입력)를 재진입 dispatch 시 재사용하도록 고친 버그 수정이다. 새로 노출되는 데이터는 없다 — 동일 `executionId` 에 대해 최초 실행 시점부터 이미 DB 에 영속돼 있던 값을 동일 실행 컨텍스트 내에서 다시 읽는 것뿐이며, 다른 워크스페이스/사용자/실행의 데이터를 끌어오지 않는다. `retry-turn.service.ts` 는 의도적으로 이 fallback 을 쓰지 않도록 남겨졌고(AI multi-turn retry 경로에서 진입 트리거가 재실행되지 않으므로 무관), 그 근거가 주석으로 명시돼 인가/데이터 격리 관점의 회귀는 없다.
  - 제안: 조치 불필요.

- **[INFO]** 에러 응답(`INVALID_TRIGGER_PARAMETERS`)의 `details` 는 요청자 자신이 제출한 필드명만 반영 — 정보 노출 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:606-617`, `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:55-62` (`toTriggerParameterErrorDetails`)
  - 상세: 400 응답의 `details[]` 는 `{field, code, message}` 형태로, `field` 는 요청 바디에 사용자가 직접 넣은 파라미터 이름(또는 인덱스)이고 `code`/`message` 는 고정된 enum 매핑(`REASON_TO_DETAIL`)에서 나온다. 스택 트레이스, 내부 경로, DB 스키마 등 민감 정보는 포함되지 않는다. 요청자 자신이 이미 알고 있는 자신의 입력을 그대로 되돌려주는 표준 검증 에러 패턴이다.
  - 제안: 조치 불필요.

- **[INFO]** 암호화/전송 계층 변경 없음
  - 위치: 전체 diff
  - 상세: 해시/암호화 알고리즘, TLS/평문 전송 설정을 건드리는 변경이 없다. `resolveTriggerParameters`/`validateTriggerParameterSchema` 는 순수 구조 검증 로직이며 자격증명 처리와 무관하다.
  - 제안: 조치 불필요.

- **[INFO]** 의존성 변경 없음
  - 위치: `package.json` 변경 없음(diff 목록에 포함되지 않음)
  - 상세: 이번 변경은 신규 npm 패키지를 추가하지 않는다(`pg`, `supertest`, `@jest/globals` 등은 기존 e2e 테스트 인프라에서 이미 사용 중인 패키지).
  - 제안: 조치 불필요.

## 요약

이번 diff 는 Manual Trigger `defaultValue` 버그 수정(엔진 재진입 시 durable input 재사용, 노드 조회를 `category`→`type` 기준으로 교정, 저장 시점 파라미터 스키마 검증 추가)과 그에 대한 프론트 인라인 검증·테스트·문서로 구성된다. 새 DB 조회는 모두 ORM 바인딩/파라미터화 쿼리를 사용해 인젝션 벡터가 없고, 하드코딩된 시크릿이나 평문 전송·약한 암호화 도입도 없다. 신규 저장 시점 검증 우회 플래그(`skipParamSchemaValidation`)는 공개 API 에서 도달 불가능함을 컨트롤러 코드로 확인했고, 에러 응답의 `details` 는 요청자 자신의 입력만 반영해 정보 노출 리스크가 없다. 엔진 재진입 시 `savedExecution.inputData` 를 재사용하는 변경도 동일 execution 의 기존 durable 데이터를 재사용할 뿐이라 테넌트 격리를 해치지 않는다. 전반적으로 보안 관점에서 새로 도입된 취약점은 발견되지 않았으며, 오히려 저장 시점 검증 추가는 malformed 데이터의 조용한 영속을 막는 방어적 개선이다.

## 위험도

NONE
