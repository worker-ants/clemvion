# API 계약 리뷰 — 워크플로우 목록 폴더 필터 (신규 프런트엔드 typed API)

대상 diff: `origin/main...HEAD` (HEAD=6279d01b6)
주요 파일:
- `codebase/frontend/src/lib/api/folders.ts` (신규)
- `codebase/frontend/src/app/(main)/workflows/page.tsx`
- `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`

## 발견사항

- **[INFO]** `foldersApi.list()` 가 프로젝트 공용 `unwrap()` 헬퍼를 쓰지 않고 자체 언랩 인라인 구현
  - 위치: `codebase/frontend/src/lib/api/folders.ts:23` (`const { data } = await apiClient.get("/folders"); return data.data ?? [];`)
  - 상세: `codebase/frontend/src/lib/api/unwrap.ts` 는 "역사적으로 일부는 `data.data`, 일부는 `data?.data ?? data` 로 직접 풀고 있었는데, 이 유틸을 통해 두 패턴 모두를 허용하며 중앙화한다" 는 목적으로 만들어졌다. 신규 파일이 그 유틸을 참조하지 않고 또 다른 ad-hoc 언랩(`data.data ?? []`)을 추가해, 정확히 그 유틸이 통합하려던 파편화 패턴을 한 곳 더 늘렸다. 동작 결과는 백엔드 `TransformInterceptor`(항상 `{ data: T }` 로 래핑, 배열도 예외 없음)와 일치하므로 기능적 결함은 아니다.
  - 제안: `import { unwrap } from "./unwrap"; return unwrap<FolderData[]>(await apiClient.get("/folders")) ?? [];` 형태로 통일하면 향후 언랩 정책 변경(예: 배열 루트 응답 legacy 처리) 시 단일 지점에서 관리 가능. 없어도 현재 계약상 문제는 없음(low priority).

- **[INFO]** `apiClient.get("/folders")` 호출에 응답 타입 제네릭 미지정
  - 위치: `codebase/frontend/src/lib/api/folders.ts:23`
  - 상세: `workflows.ts` 등 기존 클라이언트 다수는 `apiClient.get<{ data: X[] }>(...)` 형태로 응답 타입을 명시해 `data.data` 접근에 타입 체크가 걸린다. 신규 `folders.ts` 는 제네릭 없이 호출해 `data`가 `any` 로 추론되어 `data.data ?? []` 라인이 컴파일 타임에 무검증으로 통과한다(백엔드 DTO 필드명이 바뀌어도 타입 에러로 못 잡음).
  - 제안: `apiClient.get<{ data: FolderData[] }>("/folders")` 로 제네릭 명시.

## 계약 일치성 검증 결과 (결함 없음)

- **응답 래핑**: `FoldersController.findAll()` → `FoldersService.findAll()` 은 `Promise<Folder[]>` 반환(페이지네이션 없음, 배열 그대로) → `TransformInterceptor` 가 `data && typeof data === "object" && "data" in data` 아니므로(배열은 `"data" in array` 가 false) `{ data: Folder[] }` 로 래핑. 프런트 `data.data ?? []` 는 이 형태와 정확히 일치. `@ApiOkWrappedArrayResponse(FolderDto)` swagger 문서화도 동일 스키마(`{ data: FolderDto[] }`)를 선언해 일관.
- **필드 매핑**: `FolderDto`(및 엔티티 `Folder`) 의 `id / name / parentId? / sortOrder` 필드가 프런트 `FolderData` 인터페이스와 이름·타입 모두 일치(camelCase 그대로, snake_case 변환 없음 — TypeORM 컬럼 `@Column({ name: 'parent_id' })` 등은 DB 컬럼명일 뿐 직렬화 키는 프로퍼티명 `parentId`/`sortOrder` 유지). 프런트가 소비하지 않는 `workspaceId / createdAt / updatedAt` 은 추가 필드로 존재하나 TS 구조적 타이핑상 무해(초과 필드 무시).
  - `parentId` nullability: 백엔드 `@ApiPropertyOptional({ nullable: true })`, 엔티티 컬럼 `nullable: true` → 실제 값은 `string | null` 이 올 수 있고, `undefined` 는 오지 않음(항상 필드 존재, 루트면 `null`). 프런트 타입 `parentId?: string | null` 은 `?`(undefined 허용)까지 포함해 실제보다 넓게 잡았을 뿐 좁혀서 깨지는 방향은 아니라 안전.
  - `sortOrder`: 항상 number(`default: 0`), optional 아님 — 프런트도 `sortOrder: number` non-optional 로 일치.
- **folderId 쿼리 파라미터 검증**: `QueryWorkflowDto.folderId` 는 `@IsOptional() @IsUUID() @Transform(value === "" ? null : value)`. 프런트는 `if (folderId) params.folderId = folderId;` 로 빈 문자열(전체 선택)일 때 파라미터 자체를 아예 보내지 않고, 폴더 선택 시에는 `foldersApi.list()` 로 받은 실제 UUID(`f.id`)만 전송 — `@IsUUID()` 검증과 100% 호환. 빈 문자열이 서버로 갈 여지가 없어 `Transform` empty-string 처리 분기와도 충돌 없음.
- **다른 API 클라이언트와의 일관성**: 언랩 방식(위 INFO 항목 제외)·에러 처리·axios 인스턴스 사용은 기존 패턴과 동일. `apiClient` 전역 인터셉터(인증 토큰, workspace-id 헤더, 401 재시도)를 그대로 상속받아 별도 인증 처리 불필요 — `FoldersController` 는 `@ApiBearerAuth('access-token')` 선언, 인증 실패 시 `401` 문서화(`@ApiUnauthorizedResponse`)로 클라이언트 401 인터셉터와 계약 일치.
- **하위 호환성/버전관리**: 이번 diff 는 프런트 신규 소비 코드 추가만이며 백엔드 API 변경 없음(기존 `GET /folders` 엔드포인트 그대로 사용) → breaking change 없음.
- **URL/RESTful 설계·페이지네이션**: `GET /folders` 는 목록 전체 반환(페이지네이션 없음)이고 이는 기존 계약(`@ApiOkWrappedArrayResponse`, PaginatedResponseDto 미사용) 그대로이며 이번 변경이 페이지네이션 정책을 건드리지 않음. 폴더 수가 워크스페이스당 소규모로 예상되는 도메인 특성상(계층 구조, 트리 렌더링 목적) 무페이지네이션 자체는 기존 설계 범위이므로 이번 리뷰의 새로운 지적 대상이 아님.

## 요약

신규 `foldersApi.list()` 는 백엔드 `GET /folders` 의 실제 응답 스키마(`{ data: FolderDto[] }`, camelCase `id/name/parentId/sortOrder`)와 필드명·타입·nullability 모두 정확히 일치하며, `workflowsApi.list` 에 붙이는 `folderId` 쿼리 파라미터도 `QueryWorkflowDto` 의 `@IsUUID()` 검증과 충돌 없이 호환된다(빈 값 미송신 설계로 검증 분기 자체를 회피). 유일한 아쉬운 점은 프로젝트가 이미 보유한 중앙화 `unwrap()` 유틸을 쓰지 않고 새로운 ad-hoc 언랩 패턴(`data.data ?? []`)과 무타입 `apiClient.get` 호출을 추가한 것으로, 기능적 결함은 아니나 유지보수성 관점의 INFO 사항이다. Critical/Warning 급 계약 위반은 발견되지 않았다.

## 위험도

LOW
