# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `recordAudit` private 헬퍼가 5개 서비스에 거의 동일한 형태로 중복됨 (이번 diff 로 4곳 신설, 기존 auth-configs 포함 총 5곳)
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:239` (`private recordAudit`)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:141`
    - `codebase/backend/src/modules/triggers/triggers.service.ts:209`
    - `codebase/backend/src/modules/workflows/workflows.service.ts:174`
    - (기존, 이번 diff 밖) `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:78`
  - 상세: 네 서비스 모두 `AuditLogsService` 주입 → `<RESOURCE>_RESOURCE_TYPE` 상수 선언 → `private recordAudit(params): Promise<void>` 메서드(named 필드 인자, "positional 이면 컴파일러가 못 잡는 순서 스왑" 이라는 동일 rationale 을 각 파일에 재서술)까지 구조가 사실상 동일하다. 이번 diff 는 이 패턴을 4개 파일에 **새로** 복제했다(model-config/schedules/triggers/workflows). `details` 필드 타입만 서비스별로 다르다(`kind: ModelConfigKind` 필수 / `type: string` 필수 / 없음 / `details?: Record<string, unknown>` optional). 이 형태 자체는 향후 6번째 리소스에 audit 을 추가할 때도 동일하게 손으로 재작성될 가능성이 높고, "auth-configs W-1 과 동일 근거" 라는 doc 코멘트가 5곳에 흩어져 있어 근거 문구를 고치려면 5곳을 동기화해야 한다.
  - 제안: `AuditLogsService` 를 감싸는 공용 팩토리(예: `common/audit/make-audit-recorder.ts` 의 `makeAuditRecorder<TExtra>(auditLogsService, resourceType)`)로 추출해 `resourceType` 상수 + `recordAudit` 본문 + doc 코멘트를 한 곳으로 모으는 것을 검토할 만하다. 단, `details` 스키마가 서비스마다 갈리는 지점(필수 단일 필드 vs optional 자유 객체)은 제네릭으로 흡수 가능하므로 "axes 발산으로 인한 unification 보류" 사유는 약하다 — 순수 보일러플레이트에 가깝다.

- **[INFO]** `WorkflowsService.recordAudit` 의 `details` 타입이 형제 서비스들과 다르게 느슨함
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:179` (`details?: Record<string, unknown>`)
  - 상세: `model-config.service.ts` 의 `kind: ModelConfigKind`, `triggers.service.ts` 의 `type: string` 은 필수·구체 타입인 반면, `workflows.service.ts` 만 `Record<string, unknown>` optional 로 열어뒀다(`duplicatedFrom`/`imported` 두 다른 키를 담기 위함). 의도는 이해되나, 같은 이름의 private 메서드가 파일마다 타입 엄격도가 달라 위 WARNING 항목의 통합 헬퍼를 만들 때 이 비대칭이 설계에 영향을 준다.
  - 제안: 향후 통합 헬퍼를 만들 때 `details` 를 판별 유니온(`{ duplicatedFrom: string } | { imported: true } | undefined`)으로 좁히는 것을 고려.

- **[INFO]** 감사 로깅 추가로 이미 길었던 `TriggersService.create`/`update` 가 더 길어짐 (신규 도입 이슈 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:226`(`async create`), `:286`(`async update`)
  - 상세: 두 메서드는 이번 diff 이전에도 검증·config 병합·secret 마이그레이션·chatChannel setup 등 다수 책임을 가진 60~80줄 메서드였다. 이번 변경은 각 메서드에 `recordAudit` 호출 1개(+ 순서 관련 주석)만 추가했으므로 이번 diff 자체가 복잡도를 유의미하게 늘리진 않지만, cross-cutting 관심사(감사 로깅)가 계속 같은 메서드에 누적되는 추세다.
  - 제안: 지금 당장 조치 불필요. 향후 리팩터링 라운드에서 "저장 후 부수효과 오케스트레이션" 을 별도 private 메서드로 뽑는 것을 고려할 수 있다.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` 4개 리소스에 CRUD 감사 로깅을 추가하는 작업으로, 네이밍(`<resource>.<verb>` 일관 규약), 커밋-후-기록 순서 원칙, 트랜잭션 롤백 시 미기록 보장, named-params 를 통한 인자 순서 스왑 방지 등 기존 `auth-configs` 선례를 충실히 재현하며 4개 모듈에 걸쳐 매우 일관되게 적용됐다. 각 서비스의 `recordAudit` 도입부·순서 관련 주석은 "왜 이 위치에 두는지" 를 리뷰 라운드 이력까지 포함해 명확히 설명하고 있어 가독성이 높고, 대응하는 스펙 문서(`audit-action.const.ts` 상단 주석, `AuditLogDto` 설명)도 함께 갱신되어 드리프트를 스스로 경계하는 서술을 담고 있다. 유일한 실질적 아쉬움은 `recordAudit` private 헬퍼가 이제 5개 서비스에서 거의 동일한 형태로 반복된다는 점으로, 순수 보일러플레이트 중복에 가까워 공용 팩토리로 추출할 여지가 있다. 함수 길이·중첩·매직 넘버·명명 컨벤션 등 다른 관점에서는 새로 도입된 결함이 없다.

## 위험도

LOW
