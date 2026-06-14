# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] SchedulesService가 WorkspacesModule 엔티티를 직접 소유 — 모듈 경계 위반
- 위치: `codebase/backend/src/modules/schedules/schedules.module.ts:44`, `schedules.service.ts:463-464`
- 상세: `SchedulesModule`이 `TypeOrmModule.forFeature([Workspace])`로 `Workspace` 엔티티를 자체 소유한다. NestJS에서 `forFeature()`로 등록하면 해당 모듈이 그 엔티티의 Repository를 "소유"하는 것으로 간주된다. `Workspace`는 `WorkspacesModule`의 도메인이고, `SchedulesModule`은 크로스-도메인 의존이 필요한 경우 `WorkspacesModule`을 `imports`에 추가하고 `WorkspacesService`를 DI받거나, `WorkspacesModule`이 `WorkspacesService`를 `exports`하는 방식으로 모듈 경계를 지켜야 한다. 현재 구조에서는 `Workspace` 리포지토리 접근 로직이 두 모듈(WorkspacesModule, SchedulesModule)에 분산될 위험이 있다.
- 제안: `WorkspacesModule`에서 `WorkspacesService`(혹은 timezone 조회만 담당하는 최소 인터페이스)를 `exports`하고, `SchedulesModule`이 `WorkspacesModule`을 `imports`에 추가하여 `WorkspacesService`를 주입받도록 리팩터링. `SchedulesService.resolveTimezone`은 `WorkspacesService`에 위임 호출로 대체할 수 있다.

### [WARNING] isValidIanaTimezone 유틸 함수가 WorkspacesService 파일에 export — 잘못된 위치
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:1913-1920`
- 상세: `isValidIanaTimezone`은 순수 유틸리티 함수(외부 의존 없음, side effect 없음)인데 서비스 클래스 파일 최상단에 `export function`으로 노출된다. 이는 SRP를 경미하게 위반하며(서비스 파일이 도메인 로직과 유틸 함수를 동시에 제공), `SchedulesService` 등 다른 모듈에서 재사용 시 `workspaces` 모듈에 대한 불필요한 의존을 유발할 수 있다. 타임존 유효성 검증이 향후 여러 곳에서 필요해질 경우 공통 유틸 모듈로 이동하는 것이 자연스럽다.
- 제안: `codebase/backend/src/common/utils/timezone.ts` 등 공통 유틸 파일로 이동. 현재 사용처(`WorkspacesService`, 잠재적으로 `SchedulesService`)가 모두 import할 수 있는 위치에 배치.

### [INFO] SchedulesService.resolveTimezone이 update 경로에는 적용되지 않음 — 일관성 갭
- 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:608`
- 상세: `create()`는 `resolveTimezone()`을 통해 workspace fallback을 적용하지만, `update()`는 `if (dto.timezone) schedule.timezone = dto.timezone;`로 명시값만 처리한다(라인 608). PATCH 시 `timezone`을 생략하면 기존값이 유지되므로 기능상 큰 문제는 없으나, 만약 사용자가 timezone을 제거하거나 초기화하려는 의도(`timezone: null` 혹은 `""`)가 있을 경우 workspace fallback으로 재해석되는 동작과 불일치가 발생할 수 있다. 정책을 명시적으로 문서화하거나 `update()`에도 동일한 resolveTimezone 적용을 고려해야 한다.
- 제안: 코드 주석에 "PATCH에서 timezone 생략은 '현행 유지'로 처리하며 workspace fallback을 재적용하지 않는다"는 의도를 명확히 기술. 또는 `update()`에서도 `dto.timezone === undefined && dto.cronExpression` 시나리오(cron 변경으로 nextRunAt 재계산 시 timezone이 이미 저장된 값 기준)에 대한 동작을 명시.

### [INFO] workspace.settings가 untyped Record — 타입 안전성 부재
- 위치: `workspaces.service.ts`의 `updateWorkspaceSettings` 및 `getWorkspaceSettings` 전반
- 상세: `workspace.settings`는 런타임에서 `Record<string, unknown>`으로 캐스팅되어 처리된다. `settings.timezone`, `settings.interactionAllowedOrigins` 등에 접근할 때 옵셔널 체이닝과 타입 가드(`typeof tz === 'string' && tz.length > 0`)를 사용하고 있어 당장 버그는 없지만, 설정 키가 늘어날수록 유지보수 부담이 증가하고 타입 오류가 런타임에만 발견된다. 주석에서도 "향후 settings 다중 키 동시 쓰기가 생기면 jsonb `||` 원자 머지 전환 고려"를 언급하고 있어 확장 가능성이 있다.
- 제안: `WorkspaceSettings` 인터페이스를 별도 타입 파일로 정의하고, `Workspace.settings`를 `WorkspaceSettings`로 타입 지정. DTO→서비스 경계에서의 타입 안전성 확보.

### [INFO] getWorkspaceSettings 반환 타입이 설정 필드를 낱개로 나열 — 확장성 저하
- 위치: `workspaces.service.ts:2238`
- 상세: 반환 타입이 `{ interactionAllowedOrigins: string[]; timezone?: string }`로 설정 키를 개별 나열한다. 설정 필드가 추가될 때마다 반환 타입 시그니처와 구성 로직을 함께 수정해야 한다(OCP 경미 위반). `WorkspaceSettings` 타입과 연동하면 반환 타입이 자동으로 동기화될 수 있다.
- 제안: `WorkspaceSettings` 타입 정의 후 `Promise<WorkspaceSettings>`로 반환 타입 통일. `interactionAllowedOrigins`의 기본값(`[]`) 처리는 서비스 내 변환 로직에서 유지.

---

## 요약

이번 변경의 핵심은 스케줄 타임존 결정 로직에 워크스페이스 설정 기반 fallback(§2.2)을 추가한 것으로, 전체 흐름(DTO 검증 → 서비스 업데이트 → 조회 반환 → Schedule 생성 시 적용)이 일관되게 구현되었다. 그러나 아키텍처 관점에서 가장 주목할 점은 `SchedulesModule`이 `Workspace` 엔티티를 `forFeature()`로 직접 등록함으로써 `WorkspacesModule`의 도메인 경계를 침범한 것이다. NestJS 모듈 설계에서 각 모듈은 자신의 엔티티만 소유하고, 타 도메인 데이터가 필요할 경우 해당 모듈의 서비스를 DI받는 것이 레이어/모듈 경계 원칙에 부합한다. 유틸 함수(`isValidIanaTimezone`)의 위치 선정과 `settings` 필드의 타입 미정의도 확장성·유지보수성 측면에서 개선 여지가 있으나, 현 규모에서 즉각적 장애를 유발하는 수준은 아니다. `update()` 경로에서의 타임존 fallback 미적용은 기능 일관성 측면에서 명시적 문서화 또는 정렬이 필요하다.

## 위험도

MEDIUM
