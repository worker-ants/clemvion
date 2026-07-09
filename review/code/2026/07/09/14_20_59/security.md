# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 저장 시점 파라미터 스키마 검증 추가는 방어적 강화(긍정적)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger`
  - 상세: 이전에는 `saveCanvas` 가 `config.parameters` 구조를 전혀 검증하지 않아 malformed 데이터(빈 이름 슬롯 등)가 조용히 영속됐다. 이번 변경으로 이름 정규식(`^[A-Za-z_][A-Za-z0-9_]*$`) 미충족·중복·타입 불일치를 저장 시점에 `400 INVALID_TRIGGER_PARAMETERS` 로 차단한다. 정규식은 단순 anchored 패턴으로 ReDoS(재앙적 백트래킹) 위험 없음. `skipParamSchemaValidation` 파라미터는 클라이언트가 제어할 수 있는 DTO 필드가 아니라 내부 메서드 시그니처 전용 플래그이며 기본값이 `false`(secure default)로, `restoreVersion` 내부 호출에서만 명시적으로 `true` 를 전달한다 — 외부에서 검증을 우회할 진입점 없음.
  - 제안: 없음(이미 안전하게 구현됨). 참고로 `restoreVersion` 은 과거 스냅샷 호환을 위해 이 게이트를 skip 하지만, 이는 이 PR 이전부터 존재하던(무검증) 기준선보다 약화된 것이 아니라 오히려 `save` 경로에만 새 게이트를 추가한 것이므로 신규 공격 표면이 아님.

- **[INFO]** 엔진 재진입 시 `Execution.inputData` 재사용은 동일 실행(execution) 컨텍스트 내 재사용이라 테넌트 경계 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `reentryWorkflowInput` 및 3개 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive` 경로)
  - 상세: 변경 전 `input: {}` → 변경 후 `input: savedExecution.inputData ?? {}`. `savedExecution` 은 이미 해당 호출 스코프에서 workspace/executionId 로 로드된 동일 레코드이므로, 이번 변경은 그 객체의 다른 필드를 읽는 것뿐이며 새로운 크로스 테넌트 데이터 노출 경로를 만들지 않는다. `inputData` 는 원래 해당 실행을 시작시킨 트리거 입력(`{ parameters, __triggerSource, ... }`)으로, 이미 최초 실행 시 진입 노드에 전달됐던 값을 재진입 시 다시 전달하는 것뿐이라 민감정보 노출 범위 확장이 없다.
  - 제안: 없음.

- **[INFO]** 프론트 인라인 에러 메시지는 React 자동 이스케이프 경로만 사용, XSS 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx`
  - 상세: `nameErr` 문자열은 `{nameErr}` JSX 표현식으로만 렌더링되며 `dangerouslySetInnerHTML` 등 raw HTML 삽입 경로가 없다. 검증은 클라이언트 편의용(즉시 피드백)이고 서버(`validateTriggerParameterSchema`/`validateManualTrigger`)가 권위 있는 검증을 별도로 수행하므로, 클라이언트 검증 우회(devtools 로 직접 API 호출 등)는 서버 게이트에서 여전히 차단된다.
  - 제안: 없음.

- **[INFO]** 트리거 노드 조회 방식 변경(`category=TRIGGER` → `type='manual_trigger'`)은 인가 경계 변화 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts`
  - 상세: TypeORM `findOne({ where: { workflowId, type } })` 형태로 파라미터가 바인딩되어 SQL 인젝션 위험 없음(TypeORM 이 파라미터화 처리). `workflowId` 스코프는 그대로 유지되어 조회 대상 범위가 넓어지지 않았다(같은 workflow 내에서 조회 필드만 category→type 으로 변경).
  - 제안: 없음.

- **[INFO]** e2e 테스트가 raw SQL(`db.query`) 로 `node_execution`/`execution` 테이블을 직접 조작
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`
  - 상세: 파라미터 바인딩(`$1`, `$2`)을 사용하는 pg 클라이언트 쿼리로, 테스트 전용 DB 에 대해서만 동작하며 SQL 인젝션 벡터가 아니다(고정 쿼리 문자열 + 바인딩 값은 코드 내부에서 생성된 `executionId`/`triggerId`). 프로덕션 코드 경로가 아니므로 위험 없음.
  - 제안: 없음.

- **[INFO]** 새 i18n 문자열(`errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`) 및 CHANGELOG/plan 문서에 시크릿·자격증명 없음
  - 위치: `codebase/frontend/src/lib/i18n/dict/{en,ko}/nodeConfigs.ts`, `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/07/09/11_08_21/RESOLUTION.md`
  - 상세: 하드코딩된 API 키/비밀번호/토큰 패턴 없음. 에러 메시지도 필드명·코드만 노출하며 스택트레이스나 내부 경로 등 민감정보 유출 없음.
  - 제안: 없음.

## 요약

이번 변경은 Manual Trigger `defaultValue` 미적용 버그를 세 지점(엔진 재진입 시 durable input 재사용, 트리거 노드 조회 방식을 `type` 기준으로 교정, 저장 시점 파라미터 스키마 검증 추가)에서 수정한 것으로, 보안 관점에서는 오히려 이전에 없던 저장 시점 입력 검증(파라미터 이름 정규식·중복 검사)을 추가해 방어 수준을 높였다. 모든 DB 접근은 TypeORM/파라미터화된 쿼리를 사용하고, 프론트 에러 표시는 React 자동 이스케이프 경로만 쓰며, 새로 도입된 `skipParamSchemaValidation` 우회 플래그는 클라이언트가 제어할 수 없는 내부 전용 파라미터로 기본값이 안전하게 설정되어 있다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 민감정보 노출 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도

NONE
