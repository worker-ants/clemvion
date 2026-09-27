# 부작용(Side Effect) 리뷰

검증 방법: 실제 파일을 절대경로로 직접 `Read`/`grep` 해 프롬프트 diff 게이트와 대조했다(`folders.service.ts`,
`triggers.service.ts`, `folder-response.dto.ts`, `swagger-dto-contract.spec.ts`, 프런트엔드 `folders.ts` API 클라이언트).
저장소 트리에는 아무것도 쓰지 않았다 — 조회만 수행(`Read`/`grep`/`sed -n`). 뮤턴트 표(`plan/in-progress/folders-contract-e2e.md`
§뮤턴트, M1~M5·H1~H4)는 이미 실측돼 있어 재현하지 않고 근거로 인용만 했다.

## 발견사항

- **[INFO]** `FoldersService.update()` 의 병합 semantics 가 바뀐다 — `undefined` 필드가 더는 로드된 값을 덮지 않음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `update()` (현재 파일 66~74행, `Object.assign(folder, omitUndefined(data))`)
  - 상세: `Object.assign(folder, data)` → `Object.assign(folder, omitUndefined(data))`. 함수 시그니처(`update(id, workspaceId, data: Partial<Folder>): Promise<Folder>`)는 그대로라 컴파일 타임 호출자 영향은 없지만, **런타임 의미가 바뀐다** — 이전엔 DTO 인스턴스의 `undefined` own-property(보내지 않은 optional 필드, `useDefineForClassFields`)가 로드된 엔티티 값을 지워 PATCH 응답에서 `sortOrder` 키가 사라지거나 `parentId` 가 거짓 `null` 로 실렸다(결함). 지금은 `undefined` 만 걸러지고 `data.parentId === null` 같은 **명시적** null 은 그대로 반영된다(`null !== undefined`) — "루트로 이동" 케이스가 깨지지 않는지는 `folders.service.spec.ts` "allows moving to root" + 신규 e2e C 가 값으로 확인한다. 의도된 버그 수정이며 단위·e2e·뮤턴트 표(M5, H1~H3)로 뒷받침된다. `data.parentId !== undefined` 재검증 트리거 가드는 이 필터보다 먼저 평가되므로 영향받지 않는다.
  - 제안: 조치 불요 — 검증 충분. 같은 형태(`Object.assign(엔티티, DTO)`)가 남은 `workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts` 의 `update()` 는 이번 diff 밖이며 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이미 별도 항목으로 등재돼 있다(실측 전제, 헬퍼는 존재 — 중복 지적 불필요).

- **[INFO]** `triggers.service.ts` 의 인라인 필터가 공용 헬퍼 호출로 치환됐다 — 동작 불변, 리팩터만
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`const defined = omitUndefined(rest);`, 현재 파일 `update()` 내 617행 부근)
  - 상세: 이전 `Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))` 와 `omitUndefined()` 의 구현(`v !== undefined` 필터, `codebase/backend/src/common/utils/omit-undefined.ts` 12~15행)을 직접 대조했다 — 필터 조건이 기계적으로 동일해 순수 추출이다. 이 지점은 advisory lock(창 1) **이전**의 순수 병합 준비 구간이라, 이번 치환이 락 범위·트랜잭션 경계·`setupChatChannel` 같은 외부 호출 순서에 영향을 주지 않는다(주석이 명시하는 "이 구간에 외부 호출이 없다" 전제와 일치, 코드로 재확인함).
  - 제안: 조치 불요.

- **[INFO]** `FolderDto.parentId` 의 공개 OpenAPI 계약이 optional → required(+nullable) 로 좁혀진다
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts:18-21`
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true }) parentId?: string | null;` → `@ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null;`. 공개 인터페이스(OpenAPI 스키마) 변경이지만 **좁히는 방향**(키가 없을 수도 있음 → 항상 존재)이라 이 스키마를 읽는 기존 소비자를 깨뜨리지 않는다 — required 로의 narrowing 은 "필드가 있다고 믿었는데 없는" 실패를 만들지 "필드가 없다고 믿었는데 있는" 실패를 만들지 않는다. 프런트엔드는 이 DTO 를 codegen 하지 않고 `codebase/frontend/src/lib/api/folders.ts:16` 에 수기 타입(`parentId?: string | null`)을 별도로 유지하므로, 이번 좁힘은 프런트엔드 타입과 즉시 연동되지 않는다(직접 확인함) — 실제 런타임 응답은 plan 의 e2e 뮤턴트(M1) 실측대로 애초에 항상 키를 실었으므로 동작 변경도 아니다. `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열에서 `'folder-response.dto.ts:FolderDto.parentId'` 한 행만 제거됐고 주변 다른 항목은 무변경임을 직접 확인했다(377~382행 부근).
  - 제안: 조치 불요 — 실측대로 위험 낮음. OpenAPI 를 codegen 하는 외부(서드파티) 클라이언트가 향후 생기면 재생성 시 타입 변화가 있을 수 있다는 점만 참고로 남긴다.

- **[INFO]** 신설 e2e(`folder-crud.e2e-spec.ts`)가 환경변수를 읽고 외부 프로세스(백엔드 컨테이너·Postgres)로 네트워크 호출을 연다
  - 위치: `codebase/backend/test/folder-crud.e2e-spec.ts:28`(`process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'`), `:41-47`(`createDbClient()`/`db.connect()`, `registerAndLogin`, `createTeamWorkspace`)
  - 상세: `.e2e-spec.ts` 명명 관례로 일반 `jest`(unit) 실행 경로에는 섞이지 않고, 형제 e2e(`workflow-crud.e2e-spec.ts` 등)와 동일한 하네스 패턴이다. 프로덕션 코드 경로에 새로 도입된 부작용이 아니라 테스트 하네스 범위의 기대된 I/O 다.
  - 제안: 조치 불요.

## 확인했으나 새 이슈로 보지 않은 항목

- `omit-undefined.ts` (`codebase/backend/src/common/utils/omit-undefined.ts`) 는 순수 함수다 — 인자를 변경하지 않고 얕은 사본을 반환한다(스펙 `omit-undefined.spec.ts` "입력을 바꾸지 않는다" 테스트로 확인). 전역 상태·환경 변수·파일시스템 접근 없음.
- `folder-response.dto.spec.ts`·`folders.service.spec.ts`·`swagger-dto-contract.spec.ts` 변경은 전부 테스트/픽스처이며 프로덕션 부작용 표면이 아니다.
- `plan/**`·`review/**`·`CHANGELOG.md` 편집은 문서이며 부작용 관점의 표면이 아니다. `review/consistency/2026/09/27/10_39_26/**`·`review/code/2026/09/27/11_53_51/**` 산출물이 기능 커밋과 함께 실린 점은 이 저장소의 `--impl-prep`/`/ai-review` 의무 산출물 보관 관례(CLAUDE.md 저장 위치 표)와 일치하며 새 부작용이 아니다.
- `update()` 의 `Object.assign(folder, omitUndefined(data))` 은 키 화이트리스트를 하지 않지만(mass-assignment 형태), 컨트롤러가 타입 있는 `UpdateFolderDto` 로만 호출하고(`folders.controller.ts:114-116` 직접 확인) 전역 `CustomValidationPipe` 의 whitelist 가 방어한다 — 이 지점은 security/api_contract 리뷰가 이미 INFO 로 적시했고 이번 diff 가 새로 연 표면이 아니라 동의한다.

## 요약

이번 변경의 핵심 부작용 표면은 두 곳이다 — (1) `FoldersService.update()` 의 병합 semantics 변경(의도된 버그 수정, 명시적 `null` 보존을 단위·e2e 로 확인)과 (2) `FolderDto.parentId` OpenAPI 선언의 optional→required 좁힘(런타임 무변화, 프런트엔드는 별도 수기 타입이라 연동되지 않음). 둘 다 시그니처나 호출자 코드를 깨지 않고, 숨은 전역 상태 변경·예상 밖 파일시스템 쓰기·의도치 않은 네트워크 호출·이벤트/콜백 변경은 발견되지 않았다. `triggers.service.ts` 쪽 변경은 순수 리팩터(동일 필터 로직을 공용 헬퍼로 추출)로 동작 불변임을 코드 대조로 확인했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 상당 — Read/grep 전용 세션).

## 위험도

LOW
