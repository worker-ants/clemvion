# 유지보수성(Maintainability) 리뷰

## 발견사항

### **[INFO]** `_drop` 변수명이 의도를 충분히 표현하지 못함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings` 내 구조분해 라인
- 상세: `const { timezone: _drop, ...rest } = nextSettings;` 에서 `_drop` 은 "의도적으로 제거" 임을 나타내지만, 팀 컨벤션에 따라 `_removed` 또는 단순히 `_` 가 더 명확할 수 있다. `_drop` 이 완전히 나쁜 것은 아니나, 해당 패턴 사용 시 주석이 없으면 처음 보는 독자에게 "이 키를 삭제한다는 의도"가 바로 오지 않을 수 있다.
- 제안: `const { timezone: _removed, ...rest } = nextSettings;` 또는 `Object.assign` 후 `delete nextSettings.timezone` 으로 변경해 의도를 명시하거나, 기존 인라인 주석이 바로 위에 있으므로 현 상태도 허용 가능 수준임.

### **[INFO]** `isValidIanaTimezone` 함수가 `workspaces.service.ts` 파일 모듈 수준에 노출됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/workspaces.service.ts` 상단
- 상세: 타임존 검증 유틸리티 함수가 `export function` 으로 서비스 파일 최상위에 배치되어 있다. 기능 자체는 재사용 가능한 유틸임에도 `workspaces.service.ts`에 묶여 있으면, 다른 모듈(`schedules.service.ts` 등)에서 재사용하려 할 때 `WorkspacesService` 의존을 통하지 않고도 import 하긴 하지만 의존 방향이 불명확해진다. 현재 `schedules.service.ts`는 `resolveTimezone` 내에서 DB 조회만 하고 IANA 검증을 별도로 하지 않아 중복이 없으나, 향후 IANA 검증이 추가 위치에서 필요해지면 `workspaces.service.ts`를 import 해야 하는 상황이 생긴다.
- 제안: `codebase/backend/src/common/utils/timezone.util.ts` 같은 공통 유틸 위치로 이동을 장기적으로 검토. 현재 PR 범위에서는 영향이 크지 않으므로 INFO 수준.

### **[INFO]** `resolveTimezone`의 `explicit` 파라미터명이 약간 모호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/schedules/schedules.service.ts` — `resolveTimezone` 메서드 시그니처
- 상세: `explicit: string | undefined` 라는 파라미터명은 "명시된 값"을 뜻하나, `dtoTimezone` 또는 `requestedTimezone` 처럼 출처를 암시하는 이름이 호출 시 의도를 더 명확히 한다. 현재 JSDoc 코멘트(`§2.2`)가 동반되어 있어 맥락은 파악 가능하다.
- 제안: `resolveTimezone(workspaceId: string, dtoTimezone: string | undefined)` 로 변경하면 호출부에서 읽기가 조금 더 자연스럽다. 현재 코드도 허용 범위.

### **[INFO]** `update` 메서드에서 `dto.timezone` 의 timezone 폴백 로직이 `create`와 비대칭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/schedules/schedules.service.ts` — `update` 메서드 (라인 약 607)
- 상세: `create`는 `await this.resolveTimezone(workspaceId, dto.timezone)` 를 통해 워크스페이스 fallback을 적용하지만, `update` 에서는 `if (dto.timezone) schedule.timezone = dto.timezone;` 로 단순 직접 대입한다. PATCH에서 timezone 필드를 명시적으로 보내지 않으면 기존 값을 유지하므로 대부분의 경우 올바르지만, "타임존을 명시적으로 제거하고 워크스페이스 기본값으로 되돌리고 싶다"는 유스케이스가 스펙에 추가될 경우 이 비대칭이 문제가 된다. 현재 스펙 범위 내에서는 의도된 설계일 수 있으나, 두 메서드 간 처리 방식 차이를 JSDoc에 언급해 두면 향후 혼란을 방지할 수 있다.
- 제안: `update` 메서드의 timezone 처리 블록에 `// PATCH: timezone 미제공 시 기존 값 유지 (create 와 달리 workspace fallback 재조회 없음)` 와 같은 짧은 설명 추가.

### **[INFO]** 테스트 파일 내 `as never` 타입 캐스팅 반복 사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `create — timezone fallback` describe 블록 내 여러 `as never` 캐스팅
- 상세: `service.create('ws-1', { ...baseDto } as never)` 패턴이 3회 반복된다. `as never` 는 DTO 타입 체크를 완전히 우회하는 캐스팅으로, 이미 파일 내 다른 테스트 (`findAll sort/order`)에서 `as never`를 사용하는 기존 패턴을 따른 것으로 보인다. 일관성 측면에서는 기존 패턴과 동일하나, 더 구체적인 `Partial<CreateScheduleDto> as unknown as CreateScheduleDto` 캐스팅이 타입 안전성을 높인다.
- 제안: 타입 우회 방식을 `{ ...baseDto } as unknown as CreateScheduleDto` 로 통일 검토. 기존 코드베이스 패턴과의 일관성이 더 중요하므로 현재 상태도 수용 가능.

### **[INFO]** `getWorkspaceSettings` 반환 타입과 JSDoc 코멘트 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/workspaces.service.ts` — `getWorkspaceSettings` 메서드 JSDoc (라인 약 2231)
- 상세: JSDoc 코멘트가 "interactionAllowedOrigins 만 반환" 이라고 기술되어 있지만 실제 반환 타입은 `{ interactionAllowedOrigins: string[]; timezone?: string }` 으로 변경되었다. 코멘트가 이 PR 변경을 반영하지 않아 독자에게 혼동을 줄 수 있다.
- 제안: JSDoc을 "interactionAllowedOrigins 와 timezone(설정된 경우)을 반환한다" 로 업데이트.

---

## 요약

이번 변경은 스케줄 타임존 fallback 로직을 하드코딩 `'Asia/Seoul'` 에서 "워크스페이스 설정 → 기본값" 순으로 계층화하는 §2.2 구현이다. 전반적으로 코드 구조가 명확하고, `resolveTimezone` 의 단일 책임 분리, `isValidIanaTimezone` 의 유틸 함수화, 허용 값 화이트리스트 기반 SQL injection 차단 등 유지보수성 관점의 긍정적인 패턴이 돋보인다. 발견된 사항은 모두 INFO 등급으로, Critical 또는 Warning 수준의 문제는 없다. 주요 개선 가능 지점은 `getWorkspaceSettings` JSDoc 코멘트의 구현 현행화, `update` 메서드와 `create` 메서드 간 timezone 처리 비대칭에 대한 명시적 코멘트 추가 정도이다.

## 위험도

NONE
