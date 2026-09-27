# 요구사항(Requirement) 리뷰 — folders-contract-e2e

## 검증 방법

diff 7개 코드/테스트 파일(CHANGELOG, `folder-response.dto.{ts,spec.ts}`, `folders.service.{ts,spec.ts}`,
`swagger-dto-contract.spec.ts`, `folder-crud.e2e-spec.ts`) 과 plan 2개(`folders-contract-e2e.md`,
`spec-draft-nullable-notation-followups.md`)를 대상으로 했다. `review/consistency/2026/09/27/10_39_26/**`
(10~17번 파일)는 이미 별도 consistency-checker 5종이 산출한 리포트이므로 중복 판정을 반복하지 않고, 그 결과(BLOCK: NO,
WARNING 3건 — RBAC 매트릭스 미등재·e2e frontmatter 미등재·인접 tracker 항목 비인지)를 전제로 코드 쪽 요구사항 충족만 별도로 봤다.
저장소는 읽기만 했고 뮤테이션은 하지 않았다(`git status --short` 로 확인, 변경 없음).

추가로 diff 밖의 관련 파일을 직접 열어 대조했다: `update-folder.dto.ts`(tri-state 요청 계약), `folders.controller.ts`
(전역 `ValidationPipe`·`@Roles` 배선), `folder.entity.ts`(컬럼 default), `triggers.service.ts`(선례 검증),
`spec/5-system/2-api-convention.md` §5.4(부재 표현 규약 본문).

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 아직 완료되지 않은 작업을 이미 `plan/complete/`
  로 이동한 것처럼 인용한다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1396행(diff 게이트 기준, `> **진행
    (2026-09-27 재측정 …)**: 닿은 것 — … `FolderDto`(`plan/complete/folders-contract-e2e.md` — 폴더 e2e 신설…`)
  - 상세: 같은 diff 에 포함된 `plan/in-progress/folders-contract-e2e.md` 자신의 체크리스트(105~106행)는
    `- [ ] /ai-review` · `- [ ] --impl-done` 이 아직 미체크다 — 즉 그 plan 은 아직 `plan/in-progress/`에 있고
    `plan/complete/folders-contract-e2e.md` 는 저장소에 존재하지 않는다(`ls` 확인). 트래커 문서가 링크를 미래
    시점(리뷰·impl-done 통과 후 이동될 경로)으로 앞서 써 둔 것으로 보이나, 지금 시점 기준으로는 존재하지 않는
    경로를 인용하는 댕글링 참조다. `CLAUDE.md` 관례상 "체크박스 체크"와 "`complete/` 이동"은 한 동작으로 묶이므로,
    두 문서가 같은 PR 에서 서로 다른 완료 상태를 주장하는 셈이다.
  - 제안: 이번 PR 이 실제로 머지되어 `folders-contract-e2e.md` 가 `plan/complete/` 로 이동하는 시점에 맞춰 경로가
    유효해지므로 기능적으로 치명적이지는 않다. 다만 링크 검증 가드가 있다면 머지 순서(트래커 커밋이 plan 이동
    커밋보다 먼저 병합되는 경우)에 따라 일시적으로 깨진 링크가 남을 수 있으니, 이동 커밋과 함께 확인할 것.

## 기능/비즈니스 로직 대조 (문제 없음으로 확인한 항목)

- **`update()` 핵심 수정** (`folders.service.ts`): `Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))`
  로 `undefined` 필드만 제거한다. `null`(명시적 루트 이동)·`0`/`false`류 falsy 값은 `!== undefined` 조건을 통과해 정상
  반영된다 — `??` 계열의 falsy-혼동 버그 없음을 확인했다. `data.parentId !== undefined` 가드로 재검증 분기도 그대로
  유지돼 있어 이번 필터링이 `validateParentChange` 트리거 조건을 건드리지 않는다.
- **요청측 tri-state 계약과의 정합**: `update-folder.dto.ts` 의 `parentId?: string | null`(빈 문자열→null 변환,
  `useDefineForClassFields` 로 미전송 시 `undefined` own-property)를 직접 열어 확인했다 — 서비스의 필터 로직이 이
  DTO 형태를 정확히 전제하고 있다. `spec/5-system/2-api-convention.md` §5.4 상단 "적용 범위 — 응답 바디…요청 바디는
  대상이 아니다…PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정)의 tri-state" 서술과 구현이 정확히
  일치한다.
- **`FolderDto.parentId` 선언 변경**: `@ApiProperty({ type: String, format: 'uuid', nullable: true })` + `parentId: string | null`
  이 §5.4 표의 "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`" 행과
  line-level 로 일치한다. `type: String` 추가는 스키마 생성기가 `string | null` 을 `type: object` 로 새게 하지 않기
  위한 구현상 필요 조치이며 §5.4 위반이 아니다.
- **선례 인용 검증**: plan·주석이 인용하는 `triggers.service.ts` 의 동일 `Object.assign`+`undefined` 결함/처방을
  실제로 열어 대조했다 — 같은 원인(`useDefineForClassFields`)·같은 처방(정의된 필드만 골라 `Object.assign`) 패턴이
  실재한다. 근거 날조 없음.
- **POST 전제 반증(M1) 처리**: `create()` 에 `parentId: data.parentId ?? null` 을 넣었다가 e2e 뮤턴트로 반증하고
  되돌린 이력(`bf56ee982`)이 plan 에 실측 로그 경로와 함께 정확히 남아 있고, 실제 diff 에도 그 라인이 없다 — 서술과
  구현이 일치한다.
- **RBAC/화이트리스트**: 컨트롤러가 `@Body() dto: UpdateFolderDto` 로만 받고 전역 `APP_PIPE: CustomValidationPipe`
  가 걸려 있어(app.module.ts), `Partial<Folder>` 타입이 서비스 시그니처에서 넓어 보여도 실제로 `id`/`workspaceId`
  등 엔티티 전용 필드가 필터를 통과해 덮어쓸 경로는 없다(DTO 화이트리스트가 선행).
- **e2e 커버리지**: A(POST 루트 `parentId: null` 양성 고정) · C/E(PATCH 부분 본문 응답의 `parentId`·`sortOrder`
  회귀 가드, GET 을 응답 단언보다 먼저 둬 "DB 는 무사했다"는 plan 의 주장과 정합) · D(삭제 후 404) 모두 의도한
  시나리오를 실제로 검증한다. 단위 테스트(`보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다`)도 mock 흐름을
  따라가 봤을 때 실제로 필터 로직을 가른다(vacuous 아님).
- **래칫 정합**: `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 `folder-response.dto.ts:FolderDto.parentId` 를 제거한
  뒤 해당 파일에 다른 잔여 참조가 없음을 grep 으로 확인 — 고아 참조 없음.
- **TODO/FIXME/HACK/XXX**: diff 전체에서 미완성을 시사하는 주석 없음.
- **에러 시나리오/반환값**: `update()` 모든 분기(재검증 실패 시 `BadRequestException`, `findById` 실패 시
  `NotFoundException`, 정상 시 저장된 `Folder`)가 이번 변경으로 영향받지 않고 그대로 유지됨을 확인했다.

## 요약

핵심 결함 수정(`update()` 의 `undefined` 필드 덮어쓰기 제거)과 DTO 선언 정정(`parentId` optional+nullable → 기본형
required+nullable)은 spec `§5.4` 본문과 line-level 로 정확히 일치하고, 단위·e2e·정적 래칫 3계층이 실제로 회귀를
가른다는 것을 뮤테이션 표로 실측했으며 그 실측 주장들을 직접 재확인해도 근거가 실재한다. `create()` 쪽 선제
수정을 e2e 뮤턴트로 반증하고 되돌린 처리도 코드·plan 서술이 일치한다. 유일하게 발견한 것은 트래커 문서가 아직
`in-progress` 인 plan 을 `plan/complete/` 경로로 앞서 인용하는 댕글링 참조(INFO)뿐이며, 이는 머지·이동 순서가
맞춰지면 해소되는 문서 정합성 문제로 기능적 결함은 아니다. spec 자체의 결함(RBAC 매트릭스 미등재 등)은 이미
`review/consistency/2026/09/27/10_39_26` 이 WARNING 으로 잡아 plan 에 반영 예정으로 처분돼 있어 중복 지적하지 않는다.

## 위험도

NONE
