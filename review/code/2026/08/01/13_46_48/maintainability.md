# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `recordAudit()` 의 `action` 파라미터 타입이 이미 export 된 `AuditAction` 을 쓰지 않고 4개 파일에서 각자 인라인으로 재정의됨
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:242`
    - `codebase/backend/src/modules/schedules/schedules.service.ts:144`
    - `codebase/backend/src/modules/triggers/triggers.service.ts:212`
    - `codebase/backend/src/modules/workflows/workflows.service.ts:177`
  - 상세: `audit-action.const.ts` 는 이미 `export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];` (파일 1, 91번째 줄)를 공개하고 있고, 기존 `auth-configs.service.ts` 는 `import { AuditAction } from './audit-action.const'` 로 이 타입을 그대로 재사용한다(`action: AuditAction;`). 그런데 이번 변경으로 새로 추가된 4개 서비스의 `recordAudit()` 는 동일한 유니온 타입 표현식 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 을 4곳에서 각각 손으로 다시 써서 정의한다. 기능적으로는 지금 동일하지만, 향후 `AuditAction` 정의(예: deprecated 액션 제외, 브랜딩 타입 추가 등)가 바뀌면 4곳을 전부 찾아 동기화해야 하며, 하나라도 놓치면 타입 드리프트가 생긴다. 이미 확립된 코드베이스 컨벤션(`auth-configs.service.ts`)과도 어긋난다.
  - 제안: 4곳 모두 `import { AuditAction } from '../audit-logs/audit-action.const';` 후 `action: AuditAction;` 으로 교체한다.

- **[INFO]** `recordAudit()` 사설 래퍼 메서드 + 근거 주석이 5개 서비스에 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:78`(기존), `codebase/backend/src/modules/model-config/model-config.service.ts:239`, `codebase/backend/src/modules/schedules/schedules.service.ts:141`, `codebase/backend/src/modules/triggers/triggers.service.ts:209`, `codebase/backend/src/modules/workflows/workflows.service.ts:174`
  - 상세: "named 필드 — positional 이면 동일 타입(string) 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다 (auth-configs W-1 과 동일 근거)." 문구가 schedules/workflows 두 곳에 토씨까지 동일하게 복제되어 있고, model-config/triggers 도 구조가 동일한(단지 `details` 필드 설명만 추가된) 변형이다. 메서드 시그니처(`workspaceId/userId/action/resourceId(+details)` → `auditLogsService.record()` 위임)도 5곳 모두 동형이다. 근거 문구나 계약(예: best-effort 여부, 실패 처리 정책)이 바뀌면 5곳을 손으로 동기화해야 하는 드리프트 위험이 있다.
  - 제안: 즉시 강제하기보다, `AuditLogsService` 쪽에 `forResource(resourceType)` 같은 스코프드 헬퍼를 하나 두고 각 서비스는 `resourceType` 과 선택적 `details` 매퍼만 넘기는 방식으로 다음에 6번째 리소스가 추가될 때 추출을 고려할 만하다(현재 5회 반복은 "손으로 짠 primitive 반복" 임계선에 가깝다).

- **[INFO]** `recordAudit()` 의 `action` 타입이 리소스별로 좁혀지지 않아, 컨트롤러의 named-field 안전장치 취지가 일부 무력화됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239-254` (`triggers.service.ts:209-224`, `schedules.service.ts:141-154`, `workflows.service.ts:174-189` 동일 패턴)
  - 상세: 각 서비스의 `recordAudit()` 는 `action` 파라미터로 `AUDIT_ACTIONS` 전체 유니온(모든 리소스의 모든 액션)을 받는다. 예컨대 `ModelConfigService.recordAudit()` 에 `AUDIT_ACTIONS.WORKFLOW_CREATED` 를 실수로 넘겨도 컴파일 타임에 걸리지 않는다. 바로 위 주석이 "포지셔널 인자 스왑을 컴파일러가 못 잡는다"를 이유로 named 필드를 강제한 것과 같은 동기인데, `action` 자체는 여전히 리소스 스코프로 좁혀져 있지 않다.
  - 제안: 급하지 않음(현재 호출부는 전부 올바른 상수만 사용). 필요 시 `Extract<AuditAction, \`model_config.${string}\`>` 형태로 리소스별 서브타입을 만들어 `action` 파라미터에 적용하면 실수 유입을 컴파일 타임에 차단할 수 있다.

- **[INFO]** "행위자(userId) 배선" 검증 describe 블록 + JSDoc 근거 문단이 컨트롤러 spec 3개 파일에 거의 동일하게 반복됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` (전체, 특히 18-62번째 줄), `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:88-134`, `codebase/backend/src/modules/workflows/workflows.controller.spec.ts:692-758` 부근
  - 상세: 세 파일 모두 `describe('...Controller — 행위자(userId) 배선', ...)` 블록 안에 동일한 구조(WS/USER 상수, `jest.fn()` 서비스 mock, "위치까지 고정한다 — objectContaining 으로는 스왑을 못 잡는다." 주석, create/update/remove 단위 테스트)를 갖고 있고, 상단 JSDoc 근거 문단("`create(workspaceId, dto, userId)` 는 1·3번째 인자가 둘 다 string 이라 스왑해도 컴파일이 통과한다…")도 표현만 살짝 다를 뿐 사실상 동일한 내용이다. `model-config.controller.spec.ts` 는 같은 취지의 검증을 개별 CRUD `describe` 안에 흩어 넣는 다른 구조를 쓰고 있어, 4개 컨트롤러 spec 사이에 조직 방식이 통일돼 있지 않다.
  - 제안: 시급하지 않음. 근거 문단이 또 한 번 바뀌거나(예: 실측 재검증) 5번째 컨트롤러가 이 패턴을 채택할 때는 공용 텍스트/헬퍼로 추출을 고려. 최소한 `model-config.controller.spec.ts` 도 나머지 3개와 같은 "행위자(userId) 배선" 전용 `describe` 블록으로 재구성하면 향후 이 패턴을 찾는 리뷰어의 탐색 비용이 준다.

- **[INFO]** `audit-action.const.ts` 상단 JSDoc 이 52줄로 매우 큼(파일 본문 37줄보다 김)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:1-52`
  - 상세: naming 규약·인증 액션 귀속·workspace.deleted 미구현 사유·1:1 결합 리소스 규칙·`workflow.executed` 미구현 사유 등 여러 결정이 한 블록에 누적되어 있다. 내용 자체는 정확하고 근거가 탄탄하지만(리뷰 라운드마다 유실 방지를 위해 명문화한 이력이 보임), 새 액션을 추가하러 온 개발자가 관련 없는 과거 결정까지 모두 읽어야 파일을 이해할 수 있는 구조다.
  - 제안: 급하지 않음. 이미 `SoT: spec/5-system/1-auth.md §4.1` 을 상단에 명시하고 있으므로, 향후 더 늘어나면 리소스별 결정 근거를 spec 쪽 `## Rationale` 로 옮기고 이 파일에는 "naming 규약 + 리소스군 목록 + spec 링크"만 남기는 정리를 고려할 만하다.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` 4개 리소스에 감사 로깅을 일괄 추가하는 작업으로, 기존 `auth-configs.service.ts` 에서 확립된 "named-field `recordAudit()` 래퍼 + 커밋 직후 기록 + 트랜잭션 순서 보존" 패턴을 충실히 그대로 재현하고 있어 코드베이스 전반의 일관성은 높다. 각 서비스의 주석은 왜 그 시점에 기록하는지(트랜잭션 커밋 후, BullMQ/secret-store 등 실패 가능한 외부 호출 이전)를 근거와 함께 명확히 남기고 있어 가독성도 양호하다. 다만 그 일관성이 "복제-붙여넣기" 방식으로 달성되어, 이미 공개된 `AuditAction` 타입을 재사용하지 않고 4곳에서 재정의한 점(WARNING)과, `recordAudit()` 래퍼 자체가 5개 서비스에 걸쳐 구조·주석까지 거의 동일하게 반복되는 점(INFO)이 향후 컨벤션 변경 시 동기화 비용으로 남는다. 테스트 쪽도 "행위자 배선" 검증이 3개 파일에 유사 구조로 반복되어 있다. 모두 지금 당장 기능적 위험은 없고 대부분 손쉽게 고칠 수 있는 항목들이다.

## 위험도

LOW
