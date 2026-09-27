# 변경 범위(Scope) 리뷰 — cross-workspace-refs (2R)

## 발견사항

- **[INFO]** 코드 변경(`codebase/**`)은 25개 파일·1426(+)/63(-)줄이며 전부 "쓰기 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로) 행을 가리키면 저장 전 거부" 한 가지 결함으로 수렴한다. 신규 공유 유틸 `codebase/backend/src/common/utils/reference-in-scope.ts`(`assertReferenceInScope`/`throwInvalidReferences`)를 8개 서비스(`alerts`·`edges`·`folders`·`knowledge-base`·`nodes`·`schedules`·`triggers`·`workflow-assistant-session`·`workflows`)가 재사용하는 구조라, 서비스마다 검증 로직을 다르게 손으로 짜지 않고 한 곳으로 모았다. `edges.module.ts`/`triggers.module.ts`/`workflows.module.ts`의 `TypeOrmModule.forFeature` 추가(각각 `Node`·`Workflow`·`Folder`)는 그 서비스의 새 생성자 주입(`assertEndpointsInWorkflow`·`assertReferenceInScope`·`assertFolderInWorkspace`)이 요구하는 최소 배선이다. `codebase/frontend/**` 등 무관한 영역은 건드리지 않았다(실측: `git diff --stat <merge-base> HEAD -- codebase/` 로 25개 파일 전수 확인, 전부 위 8개 서비스 + 신규 유틸 + 신규 e2e 파일).
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts`, `codebase/backend/src/modules/{alerts,edges,folders,knowledge-base,nodes,schedules,triggers,workflow-assistant,workflows}/*`, `codebase/backend/test/cross-workspace-references.e2e-spec.ts`
  - 상세: 각 서비스 diff(`assertPlacementInWorkflow`·`assertEndpointsInWorkflow`·`assertParentInWorkspace`·`assertModelConfigRefsInWorkspace`·`assertLlmConfigInWorkspace`·`validateCanvasReferences`·`assertNewNodeIdsUnused`)를 개별 확인한 결과 전부 "이 필드가 가리키는 행이 요청자 소속인가"만 검사하고, 부수적 리팩토링(무관한 메서드 시그니처 변경, 기존 로직 재배열)은 없었다. 기존 `folders.service.ts`의 `findOne` 기반 인라인 검사를 새 헬퍼 `assertParentInWorkspace` 호출로 교체한 것(중복 코드 20줄 삭제)만 유일한 "리팩토링"인데, 이는 새로 도입한 검증 규칙과 정확히 같은 검사를 신설 공용 유틸로 옮긴 것이라 범위 안이다.
  - 제안: 없음(정보 제공).

- **[INFO]** 테스트 파일 diff(`*.spec.ts`)에 등장하는 기존 mock 배선 변경(예: `folders.service.spec.ts`의 `findOne` 시퀀스 단축, `triggers.service.spec.ts`의 `getRepositoryToken(Workflow)` provider 반복 추가)은 프로덕션 코드의 새 생성자 인자·새 조회 경로에 맞춘 기계적 追従이다.
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts`, `codebase/backend/src/modules/triggers/triggers.service.spec.ts`, `codebase/backend/src/modules/nodes/nodes.service.spec.ts`, `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
  - 상세: `folders.service.spec.ts`에서 `mockRepository.findOne.mockResolvedValueOnce(parent)` 호출들이 사라진 자리는 새 `assertParentInWorkspace`가 `findOne` 대신 `exists`를 쓰기 때문이며, 테스트 기대값도 그에 맞춰 `mockRepository.exists`로 옮겨졌다(로직 변경 없음, mock 형태만 대응). 다른 관점(테스트 품질)의 영역이라 여기서는 스코프 이탈이 아님만 확인.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(사전 존재하던 별도 백로그 트래커) 수정은 이 PR이 새로 만든 문서가 아니라 기존 항목("PATCH null 후속 — 교차 워크스페이스 참조")의 진행 상황을 갱신하고, **이번 PR이 의도적으로 넘기는 두 항목**(트리거 `config` JSONB 안의 비밀 참조, 이미 저장된 교차 행에 대한 실행 시점 방어선/운영 점검, OAuth `mode=new`)을 새 체크박스로 등재한 것이다. 두 항목 모두 이번 PR에서 구현하지 않고 후속으로 명시적으로 미룬다 — 기능을 조용히 확장한 것이 아니라 오히려 범위를 좁게 유지하고 남은 조사 결과를 유실 없이 트래커로 넘기는 절차(plan lifecycle 관례)다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 항목 "교차 워크스페이스 참조 후속")
  - 제안: 없음(범위 확장이 아니라 축소 근거의 기록).

- **[INFO]** `review/consistency/2026/09/27/{19_43_46,20_05_26,20_21_21,20_35_40,20_45_35,20_56_04,21_03_31}/**` 와 `review/code/2026/09/27/21_43_01/**`(1라운드 코드 리뷰 산출물 14개 파일)까지 합쳐 diff에 잡힌 리뷰/일관성 산출물 디렉터리가 7+1개로 매우 많다. 이는 CLAUDE.md가 강제하는 `--spec`/`--impl-prep` 게이트를 spec draft가 두 차례(`spec-draft-cross-workspace-refs.md`→`-2.md`) 정정될 때마다 재실행한 결과이며(로그: `20_05_26` convention_compliance WARNING → `20_21_21` impl-prep 재실행 Critical → `20_35_40` spec draft 2 → `20_45_35`/`20_56_04`/`21_03_31` 후속 재검증), 각 세션 산출물은 `review/consistency/**` 컨벤션에 따라 정식으로 커밋 대상이다. 코드 스코프 이탈은 아니지만 diff 볼륨의 대부분(111개 변경 파일 중 65개 이상)이 이 문서/산출물 층에서 나온다는 점은 리뷰어가 인지해 둘 필요가 있다.
  - 위치: `review/consistency/2026/09/27/**`, `review/code/2026/09/27/21_43_01/**`
  - 제안: 없음(프로젝트 컨벤션에 따른 정상 산출물이며 조치 불요).

## 요약

핵심 코드 변경은 "쓰기 요청 본문의 교차 워크스페이스/교차 워크플로 참조 id를 저장 전에 거부한다"는 단일 목적에 정확히 수렴한다 — 8개 서비스의 검증 로직을 공용 유틸(`reference-in-scope.ts`)로 통일하고, 그에 필요한 최소한의 모듈 DI 배선·단위 테스트·e2e 테스트만 추가했다. 무관한 리팩토링, 포맷팅 뒤섞임, 사용하지 않는 임포트, 기능 과확장, 설정 파일의 의도치 않은 변경은 발견하지 못했다(`git diff --stat`으로 `codebase/`·`spec/`·기존 플랜 파일의 변경 폭을 전수 대조). 테스트 파일의 mock 배선 변경은 전부 프로덕션 코드의 새 인자/새 조회 경로에 대한 기계적 추종이다. diff에 잡힌 파일 수(111개)의 대부분은 이 프로젝트가 강제하는 spec-consistency 게이트 재실행 산출물과 1라운드 코드 리뷰 산출물이며, 이는 컨벤션상 정상적으로 커밋되는 부산물이지 코드 스코프 이탈이 아니다. 유일하게 손댄 사전 존재 트래커(`spec-draft-nullable-notation-followups.md`)도 이번 조사에서 나온 두 후속 항목을 명시적으로 "이 PR 밖"으로 넘기는 기록일 뿐 새 기능 구현이 아니다.

## 위험도

NONE
