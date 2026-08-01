# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `recordAudit` private wrapper(+ 동일 JSDoc)가 4개 서비스 파일에 거의 동일한 형태로 중복됐다.
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:239` (JSDoc 은 232행부터)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:141`
    - `codebase/backend/src/modules/triggers/triggers.service.ts:209`
    - `codebase/backend/src/modules/workflows/workflows.service.ts:174`
    - (참고: 이 패턴의 원본은 기존 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:78` — 이번 PR 로 사실상 5곳에 동일 shape 이 존재하게 됨)
  - 상세: 네 파일 모두 "`<resource>.*` 감사 기록. named 필드 — positional 이면 동일 타입(string) 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다 (auth-configs W-1 과 동일 근거)." 라는 문구를 그대로 복사하고, `auditLogsService.record({...})` 로 위임하는 몸체도 형태가 동일하다(차이는 `resourceType` 상수 값과 `details` 필드 구성뿐). 이는 axes 가 발산하는 보일러플레이트(예: cafe24/makeshop 미러)와 달리 **진짜 동일한 shape** 이라 프로젝트가 이미 채택한 "진짜 동일 보일러플레이트만 추출" 기준(reaper/engine DRY 선례)에 부합하는 후보다. 향후 이 rationale 이 바뀌거나(예: 인자 순서 가드를 더 강화) 버그가 발견되면 5곳을 손으로 동기화해야 하며, 실제로 이미 한 번 어긋난 전례(문서 §4.1 정합성 코멘트가 반복적으로 stale 해졌던 것과 같은 클래스의 위험)가 있다.
  - 제안: `resourceType` 과 (선택적) `details` shape 만 파라미터화한 공용 헬퍼(예: `common/audit/create-audit-recorder.ts` 의 `createAuditRecorder(auditLogsService, resourceType)` 팩토리, 또는 `AuditingService` 믹스인)로 추출하고 JSDoc 은 그 헬퍼 한 곳에만 남긴다. 각 서비스는 `private readonly recordAudit = createAuditRecorder(this.auditLogsService, WORKFLOW_RESOURCE_TYPE)` 형태로 재사용.

- **[INFO]** `recordAudit` 래퍼의 `details` 파라미터 shape 이 파일마다 제각각이다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:174`(제네릭 `details?: Record<string, unknown>`) vs `codebase/backend/src/modules/triggers/triggers.service.ts:209`(고정 필드 `type: string` → `details: { type }`) vs `codebase/backend/src/modules/model-config/model-config.service.ts:239`(고정 필드 `kind: ModelConfigKind` → `details: { kind }`) vs `codebase/backend/src/modules/schedules/schedules.service.ts:141`(`details` 자체 없음).
  - 상세: 각 도메인이 실제로 필요한 필드만 받는 설계라 개별로는 합리적이지만, "동일 패턴"으로 보이는 4곳이 실제로는 서로 다른 인터페이스라 위 WARNING 의 공용 헬퍼 추출을 그대로 적용하기 어렵다(예: workflows 는 이미 제네릭이라 이 shape 을 기준으로 통일하면 나머지 3곳도 자연스럽게 흡수 가능).
  - 제안: 공용 헬퍼로 추출할 때는 workflows 의 제네릭 `details?: Record<string, unknown>` shape 을 기준으로 통일하고, 호출부에서 `details: { kind }` / `details: { type }` 를 넘기는 형태로 맞추면 추출과 동시에 shape 불일치도 해소된다.

- **[INFO]** `TriggersService.create`/`update` 에서 이른 반환을 미루기 위해 가변 지역변수 `let result = saved;` 를 새로 도입했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:271`, `codebase/backend/src/modules/triggers/triggers.service.ts:357`
  - 상세: 리뷰 W6(감사 기록을 실패 가능한 외부 호출보다 먼저 남겨야 한다) 를 만족시키기 위해 기존 `if (refreshed) return ...; return ...;` 형태의 이른 반환을 `let result` 재할당 + 단일 `return` 으로 바꿨다. 의도와 근거는 주변 주석으로 충분히 설명돼 있어 당장 가독성 저해는 크지 않지만, 두 메서드에 동일한 3줄짜리 "재조회 후 stale 응답 방지" 패턴(273~282행, 358~367행)이 그대로 반복되어 있다.
  - 제안: 현 상태로도 무방하나, 이 재조회-후-치환 패턴이 세 번째로 필요해지면(예: chat-channel 관련 다른 mutating 엔드포인트) `resolveResponseTrigger(saved, chatChannel, workspaceId)` 같은 private 헬퍼로 추출해 두 메서드 간 중복을 없앨 수 있다.

## 요약

이번 변경은 4개 리소스(workflow/trigger/schedule/model_config)에 감사 로깅을 추가하는 반복적 CRUD 배선 작업으로, 각 파일의 명명(`<RESOURCE>_RESOURCE_TYPE` 상수, `recordAudit` 메서드명)과 트랜잭션 커밋 이후 기록 원칙("W6")이 4개 모듈 전체에 걸쳐 매우 일관되게 지켜져 있고, 순서·orphan 상태(삭제 전 필드 캡처 등) 관련 주석도 근거가 명확해 가독성 자체는 양호하다. 다만 `recordAudit` 래퍼 + 그 JSDoc 이 사실상 동일한 형태로 4개 파일(기존 auth-configs 까지 포함하면 5개)에 손으로 복제되어 있어, 이는 axes 가 갈리는 의도된 중복이 아니라 진짜 보일러플레이트 중복에 해당하며 공용 헬퍼로 추출할 여지가 있다. 그 외 함수 길이·중첩·매직 넘버 관련 새로운 문제는 발견되지 않았다(기존 긴 함수인 `duplicate`/`importWorkflow` 등은 이번 diff 로 새로 길어진 것이 아니라 audit 호출 한 블록만 덧붙은 것).

## 위험도

LOW
