# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `REASON_TO_DETAIL` 맵 이중 조회 — 현재 코드는 구조 분해를 통해 단일 조회하도록 이미 수정되어 있음 (이전 SUMMARY INFO #8 이 적용됨을 확인)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L78–80
  - 상세: `const { code, message } = REASON_TO_DETAIL[e.reason];` 형태로 구조 분해 단일 조회가 적용돼 있다. 이전 RESOLUTION에서 이미 조치됨.
  - 제안: 해당 없음 — 이미 해결됨.

- **[INFO]** `hooks.service.spec.ts` 인라인 response 타입 중복 — 두 테스트 케이스 모두 `{ code: string; details: TriggerParameterErrorDetail[] }` 형태로 캐스팅하고 있으나, 이 diff 에서는 `TriggerParameterErrorDetail` import를 추가하여 재사용하고 있음 (RESOLUTION INFO #9 적용 확인)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.spec.ts` L450–490 범위
  - 상세: `TriggerParameterErrorDetail` import 추가가 diff에 포함되어 있어, 타입 재사용 의도가 명확하다.
  - 제안: 해당 없음 — 이미 해결됨.

- **[INFO]** e2e B3 에서 `db.query('UPDATE node SET config = $1 ...')` 직접 DB 조작 — 스키마 변경 시 조용히 깨질 수 있으며, 다른 e2e 테스트의 API 기반 셋업 패턴과 이질적이다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` (B3 케이스 내 db.query 블록)
  - 상세: 직접 SQL UPDATE로 노드 config를 주입하는 방식은 컬럼명·JSON 구조 변경에 무언의 취약점을 가진다. `manual_trigger` 노드 파라미터를 API로 설정하는 경로가 없다면 불가피하지만, 최소한 헬퍼 함수(`setupNodeWithParameters`)로 추출해 의도를 명시하고 변경 지점을 단일화해야 한다.
  - 제안: `setupNodeWithParameters(db, wfId, parameters)` 헬퍼를 e2e 공통 헬퍼 모듈로 추출. 불가피한 직접 DB 접근이라면 함수 내 주석으로 API 대안 부재 이유를 명시한다.

- **[INFO]** `TriggerParameterDefinition` / `TriggerParameterValidationError` 기존 인터페이스에 JSDoc 없음 — 신규 추가된 `TriggerParameterErrorDetail`에는 JSDoc이 있으나 기존 두 인터페이스는 없어 일관성이 깨진다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L1–13 (기존 코드)
  - 상세: 같은 파일 내에서 신규 추가 인터페이스만 JSDoc이 있고 기존 인터페이스에는 없다. 일관성 관점에서 기존 두 인터페이스에도 간단한 JSDoc을 추가하는 것이 바람직하다.
  - 제안: `TriggerParameterDefinition`·`TriggerParameterValidationError` 두 인터페이스에 간단한 한 줄 JSDoc 추가(후속 작업 수준, 차단 아님).

- **[INFO]** `workflows.controller.ts` 인라인 주석의 spec 참조가 `manual-trigger §6` 으로만 기재되어 있고 파일 경로가 없어 추적이 어렵다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/workflows/workflows.controller.ts` (INVALID_TRIGGER_PARAMETERS throw 직전 주석)
  - 상세: `hooks.service.ts`의 대응 주석과 비교하면 spec 참조 형식이 상이하다. `hooks.service.ts`는 `spec 12-webhook §5.2`로 경로 포함, `workflows.controller.ts`는 `manual-trigger §6`으로 경로 미포함.
  - 제안: `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 형식으로 통일(필수 아님).

- **[INFO]** `toTriggerParameterErrorDetails` JSDoc에 `invalid_schema`가 런타임 webhook·manual 경로에서 실제 도달하지 않는다는 점이 명시되어 있지 않다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L65–73
  - 상세: `REASON_TO_DETAIL`에 `invalid_schema` 매핑이 있으나 이는 저장 시점 검증용이며, runtime webhook/manual 트리거 경로에서는 도달하지 않는다. 독자가 오해할 수 있다.
  - 제안: JSDoc에 "@note `invalid_schema` is included for completeness; it is only reachable via schema validation at save-time, not at runtime trigger invocation" 추가(선택적 문서 보강).

## 요약

이번 변경은 내부 `errors` 키를 공식 봉투 `details[]` 로 교체하는 소규모 집중 변경이다. 신규 추가된 `toTriggerParameterErrorDetails` 함수는 단일 책임, 짧은 함수 길이, `Record` 타입을 통한 컴파일 타임 완전성 보장 등 유지보수성 기준을 잘 충족한다. `REASON_TO_DETAIL` 상수 맵을 통한 매핑 분리, 구조 분해 단일 조회, `TriggerParameterErrorDetail` 타입 재사용 모두 긍정적이다. 남은 개선 사항은 모두 INFO 수준으로 — e2e 직접 DB 조작 헬퍼 추출, 기존 인터페이스 JSDoc 일관성, spec 참조 경로 통일 — 이 차단 없는 후속 작업으로 적합하다.

## 위험도

LOW
