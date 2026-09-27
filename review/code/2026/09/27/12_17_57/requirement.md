# 요구사항(Requirement) 리뷰 — folders-contract-e2e (2R)

## 검증 방법

diff 32개 중 기능 코드/테스트 7개(`omit-undefined.{ts,spec.ts}`, `folder-response.dto.{ts,spec.ts}`,
`folders.service.{ts,spec.ts}`, `triggers.service.ts`, `swagger-dto-contract.spec.ts`,
`folder-crud.e2e-spec.ts`)와 plan 2개(`folders-contract-e2e.md`, `spec-draft-nullable-notation-followups.md`)를
직접 대조했다. 나머지 다수는 1R 코드 리뷰(`review/code/2026/09/27/11_53_51/**`)·1R consistency-check
(`review/consistency/2026/09/27/10_39_26/**`) 산출물 자체가 이번 diff 에 포함된 것이라 — 그 산출물이 판정한
내용을 재판정하지 않고, "1R 에서 지적된 W1/W2 가 실제로 해소됐는가" 만 새로 확인했다.

diff 밖에서 직접 열어 대조한 파일: `folders.controller.ts`(역할·DTO 배선), `update-folder.dto.ts`(tri-state 요청
계약), `folder.entity.ts` 대신 `spec/1-data-model.md §2.5 Folder`(컬럼 default), `spec/5-system/2-api-convention.md
§5.4`(부재 표현 규약 본문), `spec/conventions/swagger.md §1-6`(`type: String` 명시 관례), `spec/2-navigation/1-workflow-list.md
§3.1`(폴더 API 계약), `codebase/backend/tsconfig.json`(`target: ES2023` → `useDefineForClassFields` 확인).
저장소는 읽기만 했다 — `git status --short` 로 뮤테이션 없음을 확인(세션 산출물 디렉터리 외 변경 0).

## 발견사항

- **[INFO]** 1R WARNING #2(트래커의 `plan/complete/folders-contract-e2e.md` 앞선 인용)가 이번 라운드에도 아직
  미해소 상태로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 문장은 이번 diff 의 unified diff 상
    게이트 없는 컨텍스트 라인 — `grep -n "plan/complete/folders-contract-e2e.md"` 로 직접 확인한 실제 줄은
    1398행)
  - 상세: 1R RESOLUTION(`review/code/2026/09/27/11_53_51/RESOLUTION.md` W2)은 "이 PR 의 마무리 커밋(`git mv`)이
    그 경로를 만든다 — push 전 확인"이라고 처분했다. 그런데 이번 diff 에도 여전히 `plan/in-progress/folders-contract-e2e.md`
    체크리스트의 `/ai-review`·`--impl-done` 두 항목이 미체크이고(직접 `tail` 로 확인), `plan/complete/folders-contract-e2e.md`
    는 저장소에 존재하지 않는다. 즉 W2 의 "마무리 커밋"이 아직 일어나지 않았고, 그 사실 자체를 이번 diff(1R RESOLUTION 반영
    커밋들)가 알고 있었다 — 새로 발견한 결함이 아니라 **아직 실행되지 않은 처분**이다.
  - 제안: 기존 처분대로 — push 전 마무리 커밋(체크리스트 완료 + `git mv`)을 실행하고, `git show HEAD:plan/complete/folders-contract-e2e.md`
    로 실재를 확인. 이번 라운드에서 코드 관점의 조치는 불요.

## 기능/비즈니스 로직 대조 (2R 증분 — 헬퍼 추출 이후 새로 확인한 항목)

- **`omitUndefined` 헬퍼 추출**(`692f1e8fd`, W1 처분): `codebase/backend/src/common/utils/omit-undefined.ts`
  의 구현(`Object.entries(obj).filter(([, v]) => v !== undefined)`)은 1R 에서 검증한 인라인 로직과 **바이트 단위로
  동일한 필터 술어**다 — `null`/`0`/`false`/`''` 는 전부 남기고 `undefined` 만 뺀다. `folders.service.ts`
  `update()`(`Object.assign(folder, omitUndefined(data))`)와 `triggers.service.ts` `update()`
  (`const defined = omitUndefined(rest)`) 양쪽 호출부를 직접 열어, 추출 전후 동작이 바뀌지 않았음을 확인했다.
  plan 의 헬퍼 뮤턴트 표(H1~H4)도 각 호출부·헬퍼 자체를 독립적으로 가른다 — 예측대로 KILLED 이고 과장 없음.
- **`update()` 의 `data.parentId !== undefined` 가드**: 헬퍼 추출 뒤에도 이 가드는 여전히 **원본 `data`**(필터 전)를
  검사한다 — `omitUndefined` 호출은 그 아래 `Object.assign` 줄에만 적용된다. 재검증 트리거 조건이 헬퍼 추출로
  영향받지 않음을 재확인했다.
- **DTO 선언(§5.4) — 재확인**: `FolderDto.parentId`
  `@ApiProperty({ type: String, format: 'uuid', nullable: true })` + `parentId: string | null` 은
  `spec/5-system/2-api-convention.md` §5.4 "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` +
  `field: T | null`" 행과 line-level 로 일치. `type: String` 명시는 `spec/conventions/swagger.md §1-6`의
  "패스스루 → `field: string` + `@ApiProperty({ type: String, ... })`" 관용구와 같은 문제(디자인 타입이 `Object`
  로 새는 것 방지)를 겨냥한 것으로, §5.4·§1-6 어느 쪽 위반도 아니다.
- **데이터 모델 대조**: `spec/1-data-model.md §2.5 Folder` — `parent_id UUID?`, `sort_order Integer(기본 0)`.
  `FolderDto`(`id`/`workspaceId`/`name`/`parentId`/`sortOrder`/`createdAt`/`updatedAt`)·`update()`/`create()`
  구현과 필드·기본값 불일치 없음.
- **`spec/2-navigation/1-workflow-list.md §3.1`**: `PATCH /api/folders/:id` 행의 "`parentId: null` 로 루트 이동은
  항상 허용" 서술과 `validateParentChange`(`newParentId === null` 즉시 return)·`omitUndefined`(null 은 안 거름) 조합이
  일치한다.
- **e2e/단위 신규 커버리지 재확인**: `folders.service.spec.ts` 의 "빈 본문이면 로드한 값을 그대로 저장한다"(추가된
  경계 테스트)를 직접 읽어, `save` 호출 인자가 로드된 엔티티와 완전히 같음(`toHaveBeenLastCalledWith(loaded)`)을
  단언하는 것을 확인했다 — plan 이 스스로 "이 테스트는 어느 뮤턴트도 단독으로 가르지 않는다"고 적은 것과 실제
  테스트의 성격(경계 문서화용, 회귀 그물 아님)이 일치한다(과장 없음).
- **TODO/FIXME/HACK/XXX**: 2R 증분(`692f1e8fd`, `55aaf0e1e`, `1b3cb2543`)에도 미완성을 시사하는 주석 없음.
- **에러 시나리오/반환값**: `omitUndefined` 는 모든 입력(빈 객체 포함)에서 객체를 반환하고 예외를 던지지 않는다 —
  호출부의 에러 처리 경로(`NotFoundException`/`BadRequestException`)는 헬퍼 도입으로 영향받지 않는다.

## 요약

2R 증분(헬퍼 추출 리팩터 + 1R 리뷰 처분 반영 + 그 산출물 자체의 커밋)은 1R 이 검증한 핵심 로직(undefined 필드만
거르는 PATCH 병합, `FolderDto.parentId` §5.4 기본형 선언)의 동작을 바꾸지 않았고, 헬퍼 추출 전후 필터 술어가
동일함을 직접 대조로 확인했다. spec 본문(`§5.4`·`§2.5 Folder`·`§3.1 폴더 관리 API`)과 구현의 line-level 불일치는
없다. 유일한 발견사항은 1R WARNING #2 로 이미 지적·처분된 "트래커의 `plan/complete/` 앞선 인용"이 이번 라운드에도
아직 실행 전 상태로 남아 있다는 것뿐이며, 이는 코드 결함이 아니라 예정된 마무리 커밋(push 전 실행)의 미착수
상태다.

## 위험도

NONE
