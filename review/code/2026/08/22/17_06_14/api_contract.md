# API 계약(API Contract) 리뷰

### 발견사항

- **[WARNING]** `POST /executions/:id/re-run` 의 최상위 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 즉시 rename — 하위 호환성 breaking, 마이그레이션 유예(dual-emit) 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:510` (diff 게이트 510) / Swagger 서술 `codebase/backend/src/modules/executions/executions.controller.ts:274`
  - 상세: `resolveTriggerParametersRejectingMasked` 검증 실패 시 던지던 최상위 `code: 'INVALID_INPUT'` 이 `'INVALID_TRIGGER_PARAMETERS'` 로 바뀐다. 이 엔드포인트는 워크스페이스 JWT 만 있으면 공식 UI 밖에서도 호출 가능한 내부 REST API 라, 저장소 밖 서드파티 클라이언트가 이 값으로 분기했을 가능성은 grep 으로 배제할 수 없다(plan 이 스스로 "관측 범위 미발견"이라고 정직하게 적어 뒀다 — "부재 확인"이 아님). rollout 시점에 구 코드가 완전히 사라지므로 그 순간 그런 클라이언트가 있다면 즉시 깨진다. deprecated alias/dual-emission 은 검토됐으나 `error.code` 가 단일 필드라 기술적으로 불가하다고 plan 이 판단했고, `error.details[].code`(세부 사유 코드)는 이번 변경으로 값이 바뀌지 않는다.
  - 제안: (이미 상당 부분 완화됨 — 지적이 아니라 리스크 등급 확인용) `spec/conventions/error-codes.md §5` 신규 행에 이미 "가장 리스크 등급이 높은 행"으로 명시돼 있고 사용자 결정으로 인수됐다. 이 상태로 진행 가능하나, 배포 노트/CHANGELOG 에도 breaking notice 를 남기는 것을 권장(사내 API consumer 가 spec 문서를 상시 구독하지 않을 수 있음).

- **[INFO]** `error-codes.md §5` Rename 이력 신규 행의 `PR` 컬럼이 placeholder(`#TBD_PR`)로 남아 있음
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: plan 은 "이 작업의 실제 PR 번호를 쓴다"고 명시했으나 현재 커밋 시점엔 아직 PR 번호가 채번되지 않아 placeholder 다. 이력 레지스트리 표가 이 상태로 머지되면 추후 추적이 끊긴다.
  - 제안: PR 생성/머지 직전에 `#TBD_PR` 을 실제 PR 번호로 치환.

- **[INFO]** 응답 형식·HTTP 상태 코드는 자매 엔드포인트(`POST /workflows/:id/execute`, `POST /workflows/:id/save`)와 완전히 동형화됨 — 문제 없음, 확인 목적 기재
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:503-520` / `codebase/backend/src/modules/workflows/workflows.controller.ts:319-324` (rename 전에는 다른 코드였음)
  - 상세: 세 경로 모두 `TriggerParameterValidationException` 을 `BadRequestException`(400) + `code: 'INVALID_TRIGGER_PARAMETERS'` + `details: toTriggerParameterErrorDetails(err.errors)` 로 동일하게 감싼다. `GlobalExceptionFilter`(`http-exception.filter.ts`)는 `details` 필드만 읽으므로 봉투 스키마도 일치한다. 이번 변경은 기존에 존재하던 3-엔드포인트 간 최상위 코드 drift 를 없애는 방향이라 시스템 전체 관점에서는 일관성이 개선된다.
  - 제안: 없음(정보성).

- **[INFO]** 프런트엔드 소비처는 이 코드로 분기하지 않음을 코드로 확인 — breaking 영향 범위가 실측대로 좁음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:90-101,446`
  - 상세: `ERROR_CODE_TO_KEY` 매핑 테이블은 `RERUN_*` 4종만 키로 갖고 있고 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 는 매핑돼 있지 않아 미매핑 시 generic fallback 으로 떨어진다. 즉 사내 프런트는 최상위 코드 값으로 분기하지 않는다. plan 의 impact grep 주장과 일치함을 직접 확인했다.
  - 제안: 없음(정보성). 위 CRITICAL/WARNING 판단의 근거로만 사용.

- **[INFO]** API 버전 관리: 해당 프로젝트는 URL 버저닝이 없는 단일 버전 운영 정책(`spec/5-system/2-api-convention.md:31`)이라 이번 breaking rename 에 버전 분기가 적용되지 않는 것은 기존 컨벤션과 일치함
  - 위치: `spec/5-system/2-api-convention.md:31`
  - 상세: 버저닝이 없는 정책 하에서는 breaking change 를 문서화된 rename 이력(§5)으로 관리하는 것이 이 프로젝트의 표준 절차이며, 이번 변경은 그 절차를 그대로 따랐다(선례 3건과 같은 패턴).
  - 제안: 없음(정보성).

### 요약

핵심 변경은 `POST /executions/:id/re-run` 의 최상위 `error.code` 를 `INVALID_INPUT` 에서 `INVALID_TRIGGER_PARAMETERS` 로 rename 하여, 같은 검증 실패(`resolveTriggerParameters`)를 감싸는 3개 엔드포인트(`execute`/`save`/`re-run`) 간 최상위 에러 코드 drift 를 없애는 것이다. 이는 기술적으로 명백한 breaking change 이지만, (1) 사내 프런트/위젯 전체 grep 으로 이 값에 대한 분기 코드가 없음을 확인했고, (2) HTTP 상태 코드·응답 봉투(`code`/`message`/`details`) 형식은 자매 엔드포인트와 완전히 동일하게 유지되며, (3) 더 세밀한 `error.details[].code`(필드별 사유 코드)는 이번 변경으로 값이 바뀌지 않고, (4) `spec/conventions/error-codes.md §5` 에 rename 이력과 잔여 위험(내부 REST 엔드포인트라 저장소 밖 서드파티 분기 가능성을 코드로 완전히 배제할 수 없다는 점)을 명시적으로 등재해 사용자 결정으로 인수했다는 점에서 절차적으로 충분히 다뤄졌다. 나머지 변경(Swagger 서술, 테스트 단언, 유저 가이드 mdx)은 이 rename 을 일관되게 반영하는 부수 변경이며 별도 계약 리스크는 없다. 유일한 실무 잔여 항목은 §5 표의 `PR` 컬럼 placeholder(`#TBD_PR`)를 실제 PR 번호로 채워야 한다는 것.

### 위험도

MEDIUM
