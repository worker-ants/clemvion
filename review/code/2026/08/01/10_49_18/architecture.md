# 아키텍처(Architecture) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅, 2차 라운드)

## 검토 방법

`review/code/2026/08/01/10_05_53/`(1차 라운드) 의 `architecture.md`·`RESOLUTION.md` 를 먼저 읽어 이전에 무엇이
지적됐고 어떻게 처리됐는지 확인한 뒤, 현재 워크트리의 `codebase/backend/src/modules/{audit-logs,model-config,
schedules,triggers,workflows}/**` 를 `Read`/`grep` 으로 직접 열어 대조했다. 프롬프트 번들에서 크기 제한으로 diff 가
생략된 `workflows.service.ts` 는 전문을 직접 읽었다. 모듈 그래프(순환 의존 여부)는 5개 모듈의 `*.module.ts` 를
전수 확인했다.

## 1차 라운드 대비 상태 확인

- **수정 확인**: 1차 라운드 WARNING("`TriggersService.create`/`update` 내부 `recordAudit` 가 `chatChannel` 분기별로
  2회씩 호출")은 `result` 변수로 단일화되어 해소됐다 — `grep -n "recordAudit(" triggers.service.ts` 로 호출 지점이
  파일당 정확히 3곳(create/update/remove, CRUD 액션 수와 일치)임을 재확인했다.
- **의도적 유예로 확인**: 1차 라운드 WARNING 두 건("`recordAudit` 헬퍼가 5개 서비스에 구조적으로 반복", "`WorkflowsService`
  가 자신이 선언한 범위 안에서도 `saveCanvas`/`importWorkflow`/`restoreVersion` 을 놓쳐 감사 커버리지가 불완전")은
  `RESOLUTION.md`(W4·W3)에서 각각 "6번째 리소스 추가 시점"·"이번 PR 선언 범위(서비스 CRUD 4메서드) 밖"이라는 근거로
  명시적으로 유예되었고, `plan/in-progress/spec-sync-auth-gaps.md` §"§4.1 구현 후속" 에 후속 항목으로 등재돼 있다.
  근거 자체는 타당하고(도메인마다 `details` 셰이프가 달라 조기 추상화가 위험, PR 이 스스로 범위를 CRUD 로 좁혔다고
  명시) 추적도 되고 있어 재차 WARNING 으로 올리지 않는다 — 다만 아래 새 WARNING/INFO 에서 관련 구조적 원인을
  한 번 더 짚는다.

## 발견사항

### [WARNING] `recordAudit` 의 `action` 파라미터가 자신의 리소스 타입으로 좁혀지지 않아, 다른 리소스의 액션 상수를 실수로 넘겨도 컴파일이 통과한다

- 위치:
  - `codebase/backend/src/modules/model-config/model-config.service.ts:242`
  - `codebase/backend/src/modules/schedules/schedules.service.ts:144`
  - `codebase/backend/src/modules/triggers/triggers.service.ts:212`
  - `codebase/backend/src/modules/workflows/workflows.service.ts:177`
  - (비교 대상 — 이번 PR 이 근거로 인용하는 기존 선례) `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:79`
- 상세: 4개 서비스 모두 `private recordAudit(params: { …; action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]; … })`
  형태로 `action` 을 타입 선언한다. 이 타입은 `audit-action.const.ts` 가 export 하는 `AuditAction` 과 동일한, **시스템
  전체 33개 액션의 union** 이다. 즉 `TriggersService.recordAudit()` 은 개념적으로 "이 트리거에 대한 감사만 남긴다"는
  책임을 지지만, 타입 시스템은 `action: AUDIT_ACTIONS.MODEL_CONFIG_CREATE` 같은 **전혀 다른 리소스의 액션**을 넘겨도
  막지 못한다. `resourceType` 은 각 서비스가 소유한 상수(`TRIGGER_RESOURCE_TYPE` 등)로 항상 고정되므로, 이런 실수가
  실제로 나면 `audit_log` 에 `resource_type='trigger'` 인데 `action='model_config.create'` 인 row 가 조용히
  기록된다 — DB 제약도, 런타임 검증도 없다(`AuditLogsService.record()` 는 넘어온 값을 그대로 저장). 이 설계의 아이러니는,
  바로 이 `recordAudit` 패턴 자체가 "positional 인자면 동일 타입 string 순서 스왑을 컴파일러가 못 잡는다"(코드 주석,
  `auth-configs W-1` 인용)는 문제를 막으려고 named-parameter 객체로 설계됐다는 점이다 — 그런데 인접한 다른 종류의
  실수(엉뚱한 리소스의 액션 상수 재사용, 예: 4개 서비스에서 `create()` 를 서로 참고해 복붙하다 액션만 안 바꾸는 경우)는
  같은 설계가 막지 못한다. 현재 13개 신규 호출부는 모두 자기 리소스의 액션만 정확히 쓰고 있음을 직접 대조해
  확인했다(회귀는 아님) — 다만 이 타입은 `auth-configs.service.ts:79` 의 기존 패턴을 그대로 물려받아 서비스
  1곳→5곳, 액션 5개→33개로 표면적만 넓힌 것이라, 향후 6번째·7번째 리소스가 추가될 때(RESOLUTION 이 이미 W4 로
  예고한 시나리오) 같은 복붙 실수가 날 가능성도 함께 늘어난다.
- 제안: 서비스마다 `action` 타입을 자신의 액션만으로 좁힌다. 가장 손이 적게 가는 방법은 템플릿 리터럴 타입으로
  `Extract<AuditAction, \`trigger.${string}\`>` 처럼 접두사로 제한하는 것이고, 더 명시적으로 하려면
  `(typeof AUDIT_ACTIONS)['TRIGGER_CREATED' | 'TRIGGER_UPDATED' | 'TRIGGER_DELETED']` 처럼 리터럴 union 을 각
  서비스 파일에 정의해도 된다. 5곳(auth-configs 포함) 모두 같은 패턴이므로 한 번에 고치면 향후 6번째 리소스 추가 시
  그대로 복제할 템플릿이 된다 — 위에서 유예된 "`recordAudit` 공통화" 항목과 함께 처리하면 비용이 줄어든다.

### [INFO] 신규 mutating 메서드 추가 시 `recordAudit` 호출 여부를 강제하는 구조적 장치가 없음 — 전적으로 수동 규율에 의존

- 위치: 4개 서비스의 `create`/`update`/`remove`(+`setDefault`/`duplicate`) 전체 — 위 WARNING 과 원인을 공유.
- 상세: 현재 패턴은 "개발자가 새 mutating 메서드를 추가할 때 `recordAudit` 호출을 잊지 않고 올바른 위치(커밋 직후)에
  넣는다"는 수동 규율에 전적으로 의존한다. 이번 PR 의 2차 라운드에서 `WorkflowsService.saveCanvas`/`importWorkflow`
  가 바로 이 실패 모드의 실례였다(1차 라운드 WARNING, 현재는 의도적 범위 제외로 재분류·추적 중). 데코레이터
  (`@Audited(action, resourceType)`)나 인터셉터 기반으로 감사 기록을 선언적으로 걸 수 있다면, "이 메서드가 리소스를
  변경하는데 감사가 빠졌다"는 사실이 코드 리뷰에서 훨씬 눈에 띄기 쉬워진다(현재는 메서드 본문 끝까지 읽어야만 알 수
  있다). 다만 이 코드베이스는 지금까지 이런 선언적 장치 없이 명령형 호출 패턴을 5개 서비스에서 일관되게 써왔고, 그
  일관성 자체에도 가치가 있다(추적하기 쉬움, 매직이 없음) — 그래서 이건 지금 당장의 결함이라기보다, 리소스 수가
  더 늘어날 때(6번째+) 위 WARNING 의 "공통 팩토리" 논의와 함께 검토할 방향성 메모다.
- 제안: 조치 불요. 6번째 리소스 추가 시점에 `recordAudit` 공통화(이미 plan 에 추적 중)를 검토하면서, 데코레이터/
  인터셉터 방식도 대안으로 함께 저울질할 것을 권장.

### [INFO] `AuditLogsService` 가 read(`findAll`)와 write(`record`)를 한 클래스로 노출 — 5개 소비 서비스는 `record()`만 필요

- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:18`(`findAll`)·`:72`(`record`). 소비측:
  `model-config.service.ts`·`schedules.service.ts`·`triggers.service.ts`·`workflows.service.ts`·
  `auth-configs.service.ts` 생성자에 `AuditLogsService` 전체가 주입됨.
  - 상세: 인터페이스 분리 관점에서 보면 `AuditLogsController`(조회 API 용)만 `findAll` 을, 5개 도메인 서비스는
  `record` 만 필요로 하는데, 현재는 구체 클래스 `AuditLogsService` 전체가 두 그룹 모두에 노출된다. 실질적 위험은
  낮다 — `findAll` 은 부작용이 없는 조회 메서드라 오용해도 데이터 훼손으로 이어지지 않고, 이 코드베이스는
  `WorkspacesService`/`ModelConfigService` 등 다른 곳에서도 일관되게 구체 클래스를 그대로 주입하는 스타일을
  써왔다(인터페이스·토큰 기반 DI 를 쓰지 않음) — 그러니 이 패턴만 따로 인터페이스로 쪼개는 것은 코드베이스 전체
  관례에서 벗어난 지역적 예외가 된다.
  - 제안: 조치 불요. 코드베이스가 전반적으로 인터페이스 기반 DI 로 전환하는 시점이 오면 함께 고려할 사항으로만
  남긴다.

## 확인된 양호한 설계 (positive findings)

- **순환 의존 없음**: `AuditLogsModule`(`audit-logs.module.ts`) 은 `TypeOrmModule.forFeature([AuditLog])` 외
  다른 feature 모듈을 import 하지 않는 순수 leaf 모듈이다. `model-config`/`schedules`/`triggers`/`workflows`
  4개 모듈이 모두 이를 import 하지만 역방향 참조가 없어 다이아몬드 형태로만 수렴하고 순환이 생기지 않는다 — 5개
  `*.module.ts` 를 전수 확인해 검증했다. `WorkflowsModule → ModelConfigModule` 처럼 기존에 있던 모듈 간 의존도
  이번 변경으로 방향이 바뀌지 않았다.
- **레이어 책임 분리 유지**: 컨트롤러는 `@CurrentUser('sub') userId` 를 추출해 그대로 서비스에 전달할 뿐 감사
  대상·시점을 결정하지 않는다. "무엇을 언제 감사할지"는 전부 서비스(비즈니스 레이어)가 결정 — 프레젠테이션
  레이어로의 로직 누수가 없다.
- **명명 파라미터 객체로 인자 순서 스왑 방지**: `recordAudit(params: {...})` 형태가 4개 서비스에 일관되게 적용돼,
  같은 타입(string) 인자가 여럿인 상황에서 흔한 실수(포지셔널 인자 순서 뒤바뀜)를 컴파일 타임에 원천 차단한다 —
  기존 `auth-configs.service.ts` 의 검증된 패턴을 그대로 재사용해 일관성도 유지된다.
- **트랜잭션 경계 존중**: `model-config.setDefault`/`workflows.create`/`workflows.duplicate` 는 감사 기록을
  트랜잭션 커밋 뒤로 명시적으로 위치시켜(`workflows.service.ts:219`, `:395` 주석) 롤백된 작업이 감사에 남는 것을
  막는다. `triggers`/`schedules` 도 이번 2차 라운드 수정으로 "커밋 직후, 실패 가능한 외부 호출(secret store,
  BullMQ) 이전" 원칙을 4개 지점 모두에 통일했다.

## 요약

이번 PR 은 이미 `auth-configs.service.ts` 에서 검증된 "resourceType 을 고정한 private `recordAudit` 래퍼 +
트랜잭션 커밋 뒤 기록 + named 파라미터로 인자 스왑 방지" 패턴을 model-config/schedules/triggers/workflows 4개
모듈에 일관되게 확장했고, 신규로 추가된 `AuditLogsModule` 의존은 5개 모듈 모두 단방향이라 순환 참조가 없으며
레이어 책임도 깨끗하게 유지된다. 1차 라운드에서 지적된 "`TriggersService` 의 `recordAudit` 중복 호출"은 `result`
변수 단일화로 정확히 수정됐음을 호출 지점 개수 대조로 재확인했고, "`recordAudit` 5중 반복"·"`WorkflowsService`
감사 커버리지가 `saveCanvas`/`importWorkflow` 를 놓침" 두 건은 근거를 갖춰 의도적으로 유예되었으며 plan 에
추적되고 있어 재차 차단 사유로 삼지 않는다. 이번 라운드에서 새로 발견한 것은, `recordAudit` 의 `action` 파라미터
타입이 자신의 리소스로 좁혀지지 않아(4곳 모두 시스템 전체 33개 액션의 union 을 그대로 받음) 향후 리소스가 늘 때
"엉뚱한 리소스의 액션 상수를 복붙" 하는 실수를 컴파일러가 잡지 못하는 gap 이다 — 이는 `auth-configs.service.ts`
의 기존 패턴을 그대로 물려받은 것이라 이번 PR 이 새로 만든 결함은 아니지만, 서비스 1곳→5곳으로 표면적을 넓히면서
같이 넓어졌고, 정확히 이 클래스의 실수(순서 스왑)를 막으려던 설계 의도와 대비된다는 점에서 지금 짚어둘 가치가
있다. 현재 13개 호출부 자체는 전부 올바르게 자기 리소스의 액션만 쓰고 있어 활성 버그는 아니다.

## 위험도

LOW
