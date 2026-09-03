# 테스트(Testing) 리뷰

## 개요

이번 diff 는 (1) TypeORM 엔티티 8개 nullable 컬럼의 TS 타입을 `| null` 로 넓히는 배치 3(`plan/in-progress/entity-nullable-column-type-mismatch.md`), (2) 1R 리뷰에서 지적된 W1(`AuthConfigDto.ipWhitelist` Swagger 계약 불일치) 수정, (3) `folders.controller.ts` 의 불필요한 `as Partial<Folder>` 캐스트 제거, (4) 두 spec 파일의 낡은 `null as unknown as T` 캐스트 제거로 구성된다. 순수 타입 레벨 변경이며 런타임 로직·쿼리·라우트는 바뀌지 않는다는 것이 저자의 주장이고, 실제 소비 코드(`auth-configs.service.ts:356` `ac.ipWhitelist?.length`, `workflows.service.ts:733` `e.condition ?? null`, `workflow-versions.service.ts:112` `changeSummary || undefined` 등)를 직접 열어 대조한 결과 그 주장은 사실이다 — 전부 이미 null-safe 하게 짜여 있었다.

## 발견사항

- **[INFO]** `AuthConfigDto.ipWhitelist` 가 `null` 을 그대로 응답 바디로 내보내는 경로를 직접 단언하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27`(diff 게이트) — 소비처 `codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`, `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`
  - 상세: `auth-configs.controller.spec.ts` 는 `@Roles` 메타데이터와 `userId`/`req.ip` 전파만 검증하고, `auth-configs.service.spec.ts` 도 `ipWhitelist` 를 항상 배열 값(`['10.0.0.0/8']`, `[]`)으로만 설정한다 — `ipWhitelist === null` 인 엔티티를 넣고 서비스/컨트롤러가 그대로 `null` 을 통과시키는지 확인하는 테스트는 저장소 전체에서 찾지 못했다. `ac.ipWhitelist?.length` 가드가 `null` 에 대해서도 안전하다는 것은 optional chaining 문법상 자명하지만, 이번 fix(W1)가 고친 것은 정확히 "엔티티가 null 일 수 있는데 DTO 가 non-null 이라고 문서화했던" 계약 불일치라 회귀를 잡는 테스트가 있으면 향후 누군가 DTO 를 다시 좁혀도(또는 매핑 계층이 생겨도) 즉시 RED 로 드러난다.
  - 제안: `auth-configs.service.spec.ts` 나 `auth-configs.controller.spec.ts` 에 `ipWhitelist: null` fixture 로 `findById`/`findAll` 응답이 `null` 을 그대로 보존하는 회귀 테스트 1건 추가 고려. 이번 PR 을 막을 사유는 아니다(동작 변경 없음이 목적이므로).

- **[INFO]** `FoldersController.update()` 가 `dto` 를 변형 없이 `foldersService.update(id, workspaceId, dto)` 로 그대로 위임하는지 직접 단언하는 테스트가 없다 (선재 갭 재확인).
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:114` ↔ `codebase/backend/src/modules/folders/folders.controller.spec.ts`
  - 상세: `folders.controller.spec.ts` 는 `@Roles` 데코레이터 메타데이터만 `it.each` 로 검증하고 핸들러 호출/인자 전파는 테스트하지 않는다. 이번 diff 가 `dto as Partial<Folder>` 캐스트를 제거했는데, 그 캐스트는 애초에 런타임 검증이 아니라 컴파일러를 속이던 assertion 이었으므로 제거 자체는 안전하다(`UpdateFolderDto.parentId?: string | null` 과 `Folder.parentId: string | null` 구조 일치, `tsc` 0 오류로 확인됨). 다만 이 갭이 있으면 향후 누군가 `update()` 본문에서 `dto` 를 실수로 변형해도 컨트롤러 레벨에서는 안 잡힌다. 1R 리뷰(`review/code/2026/09/03/18_30_53/testing.md` INFO#6 상당)에서 이미 지적되었고 RESOLUTION 에서 "선재 갭, 낮은 우선순위"로 처리된 항목과 동일 — 새로 도입된 리스크는 아니다.
  - 제안: `foldersService.update` mock 으로 인자 위임을 확인하는 테스트 1건 추가(낮은 우선순위, 이번 PR 스코프 밖 유지 가능).

- **[INFO]** `auth.service.spec.ts`/`folders.service.spec.ts` 의 캐스트 제거는 안전하고, 회귀 검증 방법(대조군)이 명시적이라 신뢰할 만하다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts:58`, `codebase/backend/src/modules/folders/folders.service.spec.ts:14`
  - 상세: `lockedUntil: null as unknown as Date` → `lockedUntil: null`, `parentId: null as unknown as string` → `parentId: null`. `auth.service.ts` 를 grep 하면 `lockedUntil` 을 참조하는 로직이 없어(fixture 전용 필드) 이 캐스트 제거는 순수 정직화다. `folders.service.spec.ts` 쪽 fixture 는 `update — parentId 재검증 (V-04)` describe 블록에서 폭넓게 재사용되며(루트 이동·순환 검증·깊이 검증 등 다수 케이스가 `parentId: null` 을 실제로 exercise) 이미 null 케이스에 대한 커버리지가 두텁다. RESOLUTION.md 가 밝힌 대조군 검증(엔티티를 되돌리면 각각 오류 7건/2건)도 방법론적으로 타당하다.
  - 제안: 조치 불필요.

- **[INFO]** 엔티티 전용 타입 변경(`AuditLog.ipAddress`, `Edge.condition`, `WorkflowVersion.changeSummary`, `WorkspaceMember.joinedAt`) 자체에 대한 신규 단위 테스트는 없으나, 엔티티 클래스는 통상 직접 단위 테스트 대상이 아니고 소비 서비스 쪽에서 이미 null-safe 패턴(`?? null`, `?.`, `|| undefined`)으로 다뤄지고 있음을 직접 확인했다. `tsc` 비-spec 오류 0 도 이 사실을 뒷받침한다.
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:43`, `codebase/backend/src/modules/edges/entities/edge.entity.ts:57`, `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:33`, `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:40`
  - 제안: 조치 불필요.

## 요약

핵심 코드 변경은 이미 null-safe 하게 짜인 소비 코드에 타입만 정직하게 맞추는 배치이고, 두 spec 파일의 캐스트 제거는 실제로 exercise 되는 fixture 에 대한 정직한 정정이며 저자가 대조군(엔티티 되돌리기 시 오류 재현)으로 유효성을 확인했다. 남은 갭은 전부 이 PR 이 새로 만든 것이 아니라 이미 1R 에서 드러나 "선재/낮은 우선순위"로 처리된 것들의 재확인이며, 유일하게 이번 라운드에서 새로 볼 만한 지점은 W1 수정(`AuthConfigDto.ipWhitelist` nullable 화)이 "동작 변경 없음"을 표방하면서도 그 무변경을 직접 단언하는 회귀 테스트가 없다는 점이다 — 위험도는 낮지만 향후 드리프트 방지용으로 테스트 1건을 권장한다. 회귀 관점에서 기존 테스트는 모두 유효하며 테스트 격리·가독성 문제는 발견되지 않았다.

## 위험도

LOW
