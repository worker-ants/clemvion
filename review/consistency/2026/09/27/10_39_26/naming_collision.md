# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-prep)

## 스코프 요약

검토 모드는 `--impl-prep`(scope=`spec/2-navigation/`)이며, 실제로 "새로 도입"되는 식별자의 출처는
target 스펙 번들 자체(§1-workflow-list.md §3.1 폴더 API 등)가 아니라 **함께 번들된 진행 중 plan**
`plan/in-progress/folders-contract-e2e.md` 다. 그 plan 은 `spec_impact: none` 으로 명시돼 있고
(§5.4 API 규약을 따르는 구현 정정), 실측 결과 스펙 본문(§3.1 폴더 API)은 기존 그대로이며 신규
requirement ID·엔티티명·endpoint·이벤트명·ENV 는 도입하지 않는다. 이번 PR 이 실제로 새로 만드는
식별자는 코드/테스트 파일 3종뿐이다: (1) `folders.e2e-spec.ts`(신설 e2e), (2)
`folder-response.dto.spec.ts`(신설 단위 캐너리), (3) `FolderDto.parentId` 의 타입 시그니처 변경
(`string | undefined` → `string | null`, optional+nullable → required+nullable). 아래는 이 세
식별자 및 spec §3.1 이 이미 쓰고 있는 `Folder`/`FolderDto`/API 경로를 기존 코드베이스·spec 전체와
대조한 결과다.

## 발견사항

- **[INFO]** `folders.e2e-spec.ts` 파일명은 두 하위 컨벤션 중 "도메인 전체 e2e" 계열에 속한다
  - target 신규 식별자: `codebase/backend/test/folders.e2e-spec.ts` (plan §"e2e 신설")
  - 기존 사용처: `codebase/backend/test/` 아래 두 계열이 공존한다 — (a) 도메인명 단독형
    (`auth.e2e-spec.ts` · `health.e2e-spec.ts` · `knowledge-base.e2e-spec.ts` ·
    `audit-logs.e2e-spec.ts` · `system-status.e2e-spec.ts`), (b) `<도메인>-<시나리오>` 형
    (`workflow-crud.e2e-spec.ts` · `trigger-workflow-ref.e2e-spec.ts` ·
    `schedule-trigger.e2e-spec.ts` 등, 트리거·스케줄·워크플로 모두 이쪽)
  - 상세: `folders.e2e-spec.ts` 는 (a) 계열과 이름 형태가 같지만, 트리거·스케줄·워크플로 등
    "폴더" 와 같은 계층(§2-navigation, 계층형 CRUD 리소스)의 형제 도메인은 전부 (b) 계열
    (`workflow-crud` 처럼 시나리오 접미사를 붙임)을 쓴다. 실제 코드 충돌은 없으나(동일 이름의
    기존 파일 없음), 같은 spec 문서가 묶는 형제 도메인들과 명명 형태가 갈린다.
  - 제안: 폴더 CRUD 전체 커버리지라는 성격상 (a) 계열(`folders.e2e-spec.ts`)도 근거는 있다
    (모듈명이 `folders.controller.ts` 로 이미 복수형). 다만 트리거·스케줄 계열과 나란히 두려면
    `folder-crud.e2e-spec.ts` 로 (b) 계열에 맞추는 대안도 고려할 것 — 강제 사항 아님(경고 아님,
    참고용 제안).

- **[INFO]** "폴더" 라는 한글 단어가 문서 전역에서 다의적으로 쓰임 — 실제 식별자 충돌 아님
  - target 신규 식별자: 없음 (기존 `Folder`/`FolderDto` 엔티티, spec §3.1 에 이미 정의됨)
  - 기존 사용처: `spec/4-nodes/4-integration/_product-overview.md:123` (`KB-DC-03 | 문서를
    컬렉션(폴더)으로 그룹화`), `spec/1-data-model.md` 의 파일시스템 디렉터리 의미(`0-overview.md`
    "카테고리별 폴더"), `spec/data-flow/0-overview.md` 의 "본 폴더"(문서 디렉터리) 등
  - 상세: 이들은 전부 일반 한국어 명사("디렉터리/그룹")로 쓰인 것이지, `2-navigation` 의 `Folder`
    엔티티(워크플로 계층 폴더, `spec/1-data-model.md §2.5`)를 가리키지 않는다. `KB-DC-03` 의
    "폴더" 는 지식 베이스 문서 컬렉션이라는 별개 개념이며 현재 전용 엔티티명(`Collection` 등)이
    없다 — 향후 지식 베이스 쪽에 별도 "폴더" 개념이 formal 엔티티로 도입되면 그때 `Folder`(워크플로
    계층)와 이름이 겹칠 잠재 위험이 있다는 점만 기록해 둔다.
  - 제안: 현재는 조치 불필요(둘 다 formal 식별자가 아니거나 한쪽만 formal). 지식 베이스 쪽에
    "폴더"를 엔티티로 승격하는 plan 이 나오면 그때 `Folder` 와의 명명 충돌을 재검토할 것.

## 대조 확인 (충돌 없음, 근거만 기록)

- `FolderDto` — `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts` 단일
  정의. 다른 모듈·spec 어디에도 동명의 다른 의미 `FolderDto` 없음 (grep 전수, 4개 참조 모두
  folders 모듈 내부 또는 그 계약을 대조하는 `swagger-dto-contract.spec.ts`).
- `folder-response.dto.spec.ts` — 기존 컨벤션(`workflow-response.dto.spec.ts` ·
  `execution-response.dto.spec.ts` · `workflow-version-response.dto.spec.ts` 등, `<dto파일명>.spec.ts`
  형제 배치)과 정확히 일치. 기존 동명 파일 없음(신규).
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 의 키 `'folder-response.dto.ts:FolderDto.parentId'` 는 이미
  존재(`swagger-dto-contract.spec.ts:381`) — plan 은 이 기존 항목을 제거하는 것이지 새 키를 만들지
  않는다.
- API endpoint — 이번 PR 은 `GET/POST/PATCH/DELETE /api/folders(/:id)` 기존 5개 라우트를 그대로
  쓴다 (`folders.controller.ts`). spec §3.1 에 이미 문서화돼 있고 새 endpoint 추가 없음.
- 요구사항 ID·이벤트명·ENV/config 키 — plan·target 번들 어디에도 신규 도입 없음.

## 요약

이번 검토 대상(spec/2-navigation/ 번들 + 함께 묶인 `plan/in-progress/folders-contract-e2e.md`)이
실제로 새로 만드는 식별자는 `folders.e2e-spec.ts`, `folder-response.dto.spec.ts`, 그리고
`FolderDto.parentId` 타입 시그니처 조정뿐이며, 셋 다 기존 코드베이스·spec 전역과 대조했을 때
동일 이름의 다른 의미 사용처가 없다. 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키 축
모두 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 유일한 관찰은 `folders.e2e-spec.ts` 파일명이
형제 도메인(트리거·스케줄·워크플로)의 `<도메인>-<시나리오>` 명명 관례와 약간 다른 형태를 취한다는
것과, "폴더" 라는 한글 단어가 지식 베이스 영역에서 비-formal 의미로도 쓰인다는 것인데 둘 다 INFO
수준이다.

## 위험도

NONE
