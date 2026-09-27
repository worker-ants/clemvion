# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `FoldersService.update()` 가 DTO 대신 `Partial<Folder>`(엔티티 형태)를 매개변수 타입으로 받는다
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:63` (함수 시그니처 `data: Partial<Folder>`)
  - 상세: 이번 diff 의 수정(`Object.fromEntries(...).filter(([, v]) => v !== undefined)`)은 `undefined` 값만 걸러내며, `data` 에 어떤 키가 들어 있는지는 걸러내지 않는다. 컨트롤러 쪽 `UpdateFolderDto`(이 diff 에 포함되지 않음)가 `whitelist: true` 로 미선언 필드를 실제로 제거하는지는 이 변경분만으로 확인할 수 없다. 만약 컨트롤러가 검증되지 않은 원본 바디를 그대로 서비스에 넘긴다면 `id`·`workspaceId`·`createdAt` 같은 필드까지 PATCH 로 갱신될 수 있는 mass-assignment 여지가 이론상 있다. 이 PR 이 만든 문제는 아니고(기존 시그니처), 이번 fix 로 인해 새로 노출되는 표면도 아니다.
  - 제안: 별도 확인/후속 항목으로만 — `UpdateFolderDto` 의 whitelist 검증 여부를 점검. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `GET /folders` 가 페이지네이션 없이 배열을 그대로 반환한다
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:19` (`findAll`)
  - 상세: 이 PR 이 도입한 변경이 아니라 기존 설계이며, 이미 동봉된 consistency-check 산출물(`review/consistency/2026/09/27/10_39_26/SUMMARY.md` INFO#1)이 "비-페이징 고정 컬렉션" 범주로 별도 스윕 대상으로 추적 중이다. 이번 PR 의 e2e(B)도 이 배열 형태를 그대로 전제하고 있어 새 이슈는 아니다.
  - 제안: 조치 불필요(이미 추적 중). 참고로만 기재.

- **[INFO]** 서비스가 `FolderDto` 매핑 없이 TypeORM `Folder` 엔티티를 그대로 반환한다(entity passthrough)
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` (`findAll`/`findById`/`create`/`update` 전부 리포지토리 반환값을 그대로 돌려줌), 컨트롤러는 이 diff 에 없음
  - 상세: 현재는 `find`/`findOne` 에 `relations` 가 없어 관계 필드 유출은 없지만, `spec/conventions/swagger.md` §5-1 이 명시하는 entity-passthrough 실패 패턴과 구조가 같다. 이번 PR 의 e2e 가 응답 키 집합을 `FolderDto` 계약과 대조하므로(대조 실패 시 RED) 우발적 필드 추가는 잡히지만, 근본적으로는 DTO 매핑이 아니라 "우연히 필드가 일치하는" 상태다. 동봉된 `convention_compliance.md` 가 이미 INFO 로 별도 추적 중.
  - 제안: 조치 불필요(이미 추적 중). 이 PR 의 축이 아니다.

## 이번 변경의 API 계약 관점 평가 (긍정)

- **PATCH 부분 본문 응답 버그 수정** (`folders.service.ts` `update()`): 기존 `Object.assign(folder, data)` 는 DTO 인스턴스가 보내지 않은 optional 필드를 `undefined` own-property 로 갖는다는 사실(`useDefineForClassFields`) 때문에, 저장된 값(로드된 엔티티)을 `undefined` 로 덮어썼다. 그 결과 PATCH 응답에서 `sortOrder`(non-nullable) 는 키가 사라지고, `parentId`(nullable) 는 TypeORM 이 저장 후 채우는 거짓 `null` 이 실렸다 — DB 자체는 무사했다(GET 은 항상 맞았음). `Object.entries(data).filter(([, v]) => v !== undefined)` 로 고친 것은 REST PATCH 의 부분 갱신 시맨틱(미전송 필드는 유지, 명시적 `null` 은 반영)과 정확히 일치한다. `data.parentId !== undefined` 체크(재부모화 검증 트리거)와도 일관된 처리다.
- **`FolderDto.parentId` 선언 정정**: `@ApiPropertyOptional({ nullable: true })` + `parentId?: string | null` → `@ApiProperty({ type: String, format: 'uuid', nullable: true })` + `parentId: string | null`. 이것은 §5.4 금지 조합(optional+nullable)을 기본형(required+nullable)으로 좁힌 것으로, **breaking change 가 아니다** — plan 의 실측(e2e 뮤턴트 M1)에 따르면 응답은 원래도 모든 라우트(생성 포함)에서 이 키를 항상 실었고, 선언만 넓었다. 선언을 실제 런타임 형태에 맞춘 것이므로 하위 호환성 문제가 없고, 오히려 OpenAPI 생성 클라이언트가 "키가 없을 수도 있다"고 오인하던 상태를 정정한다.
- **회귀 방지 계층**: 단위(`folders.service.spec.ts` 신규 케이스), DTO 선언 캐너리(`folder-response.dto.spec.ts` 신규), 래칫 정정(`swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 해당 행 제거), e2e 계약 대조(`folder-crud.e2e-spec.ts` A~E, 5개 라우트 전부와 `assertMatchesContract` 대조) 가 각 실패 모드를 서로 다른 층에서 잡도록 설계돼 있다 — 특히 E 는 계약 대조만으론 못 잡는 "거짓 null"(옛 코드에서 여전히 `nullable` 선언을 통과)을 별도 값 단언(`toStrictEqual`)으로 잡는다는 점이 견고하다.
- **HTTP 상태 코드/URL**: POST 201, GET 200, PATCH 200, DELETE 204/이후 404 — 관례에 맞고 이번 diff 에서 라우트/URL 설계 변경은 없다.
- **인증/인가**: 이번 diff 는 `@Roles` 등 인가 로직을 건드리지 않는다. spec 의 RBAC 매트릭스(§3.2)에 Folder 행이 없다는 지적은 이미 동봉된 consistency-check 산출물(WARNING#1)이 별도로 다루고 있으며 spec 문서 쓰기라 developer 권한 밖 — 이 코드 리뷰의 신규 지적사항은 아니다.

## 요약

이번 변경은 `PATCH /folders/:id` 가 부분 본문을 보낼 때 저장된 값을 `undefined` 로 덮어써 응답에서 필드가 사라지거나(`sortOrder`) 거짓 `null` 이 실리던(`parentId`) 실제 API 계약 결함을 고치고, `FolderDto.parentId` 의 OpenAPI 선언을 실제 런타임 형태(항상 존재·nullable)에 맞게 좁힌다. 선언 축소는 실측(e2e 뮤턴트)으로 반증된 대로 런타임 동작 변화가 없어 하위 호환성 문제가 없고, 단위·DTO 선언 캐너리·래칫·e2e 계약 대조가 각 실패 축을 분담해 회귀를 잡도록 잘 설계돼 있다. 발견된 사항은 모두 이번 diff 가 새로 만든 문제가 아니라 기존에 존재했고 이미 별도로 추적 중인 항목(엔티티 그대로 반환, `GET /folders` 페이지네이션 미기술, `Partial<Folder>` 타입)에 대한 참고성 INFO 뿐이며 착수를 저지할 사유는 없다.

## 위험도

LOW
