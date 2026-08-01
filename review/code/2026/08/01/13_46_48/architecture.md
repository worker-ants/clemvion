# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** `recordAudit` private wrapper 가 4개 서비스에 사실상 동일한 형태로 복제됨 (기존 `auth-configs.service.ts` 까지 포함하면 5회째).
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239-254`, `codebase/backend/src/modules/schedules/schedules.service.ts:141-154`, `codebase/backend/src/modules/triggers/triggers.service.ts:209-224`, `codebase/backend/src/modules/workflows/workflows.service.ts:174-189`
  - 상세: 4개 서비스 모두 "named params 로 positional swap 방지" 라는 동일한 근거 주석("auth-configs W-1 과 동일 근거")을 달고, `resourceType` 상수만 다른 채 `auditLogsService.record()` 를 감싸는 동일 shape 의 private 메서드를 갖는다. DRY 관점에서는 보일러플레이트이지만, 각 서비스가 서로 다른 `details` 페이로드(kind/type 등)를 갖고 있어 완전한 단일 헬퍼로의 통합은 트레이드오프가 있고, 기존 코드베이스 관례(auth-configs)를 의도적으로 답습한 것이라 이번 PR이 새로 만든 문제는 아니다.
  - 제안: 반복이 6번째 모듈로 더 늘어나기 전에, `resourceType` 과 도메인별 `details` 셰이프만 주입받는 공용 팩토리(`createAuditRecorder(auditLogsService, resourceType)` 또는 제네릭 mixin)로 추출을 고려. named-object 시그니처(스왑 방지 목적)는 그대로 유지 가능.

- **[WARNING]** 각 서비스 `recordAudit` 의 `action` 파라미터가 도메인으로 좁혀지지 않고 시스템 전체 34개 액션의 합집합 타입을 받는다 — `resourceType` ↔ `action` prefix 정합성이 타입 시스템이 아니라 주석으로만 보장된다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242` (`action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];`), 동일 패턴이 `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` 에 반복. `resourceType` 상수 선언부: `model-config.service.ts:28`, `schedules.service.ts:23`, `triggers.service.ts:61`, `workflows.service.ts:59` (각각 "액션 prefix 와 동일 어휘를 쓴다" 라고 주석으로만 명시).
  - 상세: 예를 들어 `ModelConfigService.recordAudit()` 의 `action` 타입은 `model_config.*` 4종이 아니라 `AUDIT_ACTIONS` 전체(34개 액션)를 허용한다. 따라서 복붙 실수로 `AUDIT_ACTIONS.SCHEDULE_CREATED` 를 넘겨도 컴파일 타임에 잡히지 않고, `resourceType: 'model_config'` + `action: 'schedule.created'` 처럼 내부적으로 앞뒤가 안 맞는 audit row 가 조용히 기록될 수 있다. `AuditLogsService.record()` 자체도 `resourceType` 과 `action` prefix 의 일치를 검증하지 않는다. 이 패턴은 이번 PR이 새로 만든 게 아니라 기존 `auth-configs.service.ts` 의 `action: AuditAction` 관례를 그대로 답습한 것이고, 각 서비스의 유닛 테스트가 정확한 문자열 리터럴을 단언(`expect(auditLogs.record).toHaveBeenCalledWith({action: 'schedule.created', ...})`)하고 있어 현재 시점 실제 오용 사례는 없다 — 다만 이 PR로 동일 취약 패턴이 4곳 더 늘어 표면적이 커졌다.
  - 제안: `Extract<AuditAction, \`model_config.${string}\`>` 류의 템플릿 리터럴 타입으로 도메인별 서브유니온을 뽑아 각 `recordAudit` 의 `action` 파라미터를 좁히면, cross-domain 오용을 컴파일 타임에 차단할 수 있다.

- **[INFO]** `TriggersService`(1,335줄)는 이미 CRUD·chat-channel adapter 오케스트레이션·secret rotation(notification/bot-token 2종)·cron cleanup·응답 sanitize 등 다중 책임을 지고 있는데, 이번 PR이 감사 로깅이라는 cross-cutting 관심사를 같은 클래스에 추가로 얹었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (클래스 전체, 특히 `recordAudit` 추가 지점 209-224 및 호출부 262-268/342-348/876-882)
  - 상세: 감사 기록은 "트랜잭션 커밋 직후·부수효과(BullMQ/secret store/adapter 호출) 이전" 이라는 정밀한 순서 요구사항이 있어(코드 내 주석 다수가 이를 설명), NestJS Interceptor 같은 선언적 AOP로 완전히 대체하기 어렵다는 정당한 이유가 있다. 다만 이미 다중 책임을 가진 서비스가 계속 커지는 추세이며, 이번처럼 새 cross-cutting 관심사가 추가될 때마다 SRP 위반이 누적되어 향후 단위 테스트 격리·리팩터링 비용이 커진다.
  - 제안: 당장 강제할 사안은 아니나, 다음 리팩터링 사이클에서 chat-channel 오케스트레이션(setup/teardown/rotate 계열)을 별도 `TriggerChatChannelService` 로 추출하는 것을 검토할 가치가 있다 — 감사 로깅 호출부는 그대로 두더라도 클래스 크기 자체를 줄이면 부담이 준다.

- **[INFO]** `WorkflowsService.duplicate()`/`importWorkflow()` 가 별도 액션을 신설하지 않고 `AUDIT_ACTIONS.WORKFLOW_CREATED` 를 재사용하며 `details.duplicatedFrom`/`details.imported` 로만 구분한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:397-403` (duplicate), `582-588` (importWorkflow)
  - 상세: `resourceType=workflow AND action=workflow.created` 로만 필터링하면 일반 생성/복제/가져오기를 구분할 수 없고 `details` JSONB 안을 들여다봐야 한다. 이는 `audit-action.const.ts` 의 "리소스 기준으로 충분하며 verb 시제는 도메인별 일관 유지" 철학과 일치하는 의도적 설계(액션 폭발 방지)이며, 코드 주석에 근거가 명시돼 있어 결함이 아니라 트레이드오프로 판단한다 — 별도 조치 불요.

## 요약

`AuditLogsModule` 은 다른 도메인 모듈로 역참조되지 않는 순수 leaf 모듈로 유지되어 순환 의존이 없고, 4개 소비 모듈(ModelConfig/Schedules/Triggers/Workflows) 모두 동일한 방식(`imports: [..., AuditLogsModule]`)으로 배선되어 모듈 경계가 명확하다. 각 서비스는 컨트롤러가 `@CurrentUser('sub')` 로 추출한 행위자 정보를 받아 상태 변경(create/update/remove 등)이 실제 커밋된 **직후**, 실패 가능한 외부 호출(BullMQ 등록, secret store, chat-channel adapter) **이전**에 감사를 기록하도록 일관되게 설계되어 있으며, 이 순서 불변식은 코드 주석과 서비스별 테스트(`schedules.service.spec.ts` 의 "W6 순서 고정" 테스트 등)로 뒷받침된다. `AUDIT_ACTIONS` const 를 통해 액션 문자열을 닫힌 union 으로 강제하는 반면 API 응답 DTO(`action: string`)는 레거시 자유문자열 값을 허용하는 열린 타입을 써 쓰기 경로/읽기 경로의 요구사항 차이를 잘 분리했다. 다만 (1) `recordAudit` 보일러플레이트가 5개 서비스에 반복되는 점, (2) 각 `recordAudit` 의 `action` 타입이 도메인으로 좁혀지지 않아 `resourceType`↔`action` prefix 정합성이 주석에만 의존하는 점, (3) 이미 다중 책임을 지닌 `TriggersService` 가 더 커지는 점은 이번 PR이 새로 만든 결함이라기보다 기존 관례의 반복·확산이며, 기능적 정합성에는 문제가 없으나 다음 확장(신규 리소스군 감사 추가) 시점에 개선을 고려할 가치가 있다.

## 위험도
LOW
