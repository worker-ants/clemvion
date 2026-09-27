# 변경 범위(Scope) 리뷰 — cross-workspace-refs

검증 방법: 프롬프트에 첨부된 unified diff 전체 확인 + 크기 제한으로 생략된 항목은 `git diff 67303d179c708705209a93d8314aaeaf12768ed9..HEAD -- <path>` 로 직접 열어 대조(저장소 파일은 읽기만 했고 뮤테이션 없음 — `git status --short` 확인 결과 세션 자신의 리뷰 디렉터리(`review/code/2026/09/27/22_36_12/`, untracked)만 존재).

## 점검 개요

- 변경 파일 전수(126개)를 카테고리로 분류: `codebase/backend/src/**`(24) · `codebase/backend/test/**`(1, 신규 e2e) · `CHANGELOG.md`(1) · `spec/**`(5) · `plan/**`(4) · `review/code/**`·`review/consistency/**`(나머지 대부분, 이전 두 번의 `/ai-review` 라운드와 일곱 번의 `/consistency-check` 라운드의 산출물).
- `git diff --stat` 을 위 다섯 카테고리(`review/`, `plan/`, `spec/`, `codebase/backend/src`, `codebase/backend/test`, `CHANGELOG.md`) 로 전부 걸러낸 뒤 나머지 pathspec 으로 재실행한 결과 **출력 0건** — 이 다섯 범주 밖의 파일은 손대지 않았다.
- `codebase/backend/src` 변경 24개 파일 전부가 CHANGELOG 항목이 명시한 표면(트리거·스케줄 `workflowId`, 캔버스 저장 `nodes[i].id`·`containerId`·`toolOwnerId`·엣지 끝점, 알림 규칙 `workflowId`, 워크플로 `folderId`, 폴더 `parentId`, 어시스턴트 세션 `llmConfigId`, 지식 베이스 `extractionLlmConfigId`·`rerankConfigId`·`rerankLlmConfigId`)와 1:1 대응한다. 크기 제한으로 생략됐던 `folders.service.spec.ts`·`nodes.service.spec.ts`·`triggers.service.spec.ts`·`workflows.service.spec.ts`·`workflows.service.ts` 를 직접 열어 대조했고, 전부 같은 검증 헬퍼(`assertReferenceInScope`/`throwInvalidReferences`) 도입에 필요한 최소 변경(신규 DI 의존성 주입 보일러플레이트 + 그에 맞춘 기존 mock 갱신 + 신규 테스트)이었다.

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이 PR 범위 밖으로 명시적으로 미루는 항목("교차 워크스페이스 참조 후속" — 트리거 `config` 안의 비밀 참조, 이미 저장된 교차 행, OAuth `mode=new`, 검증 헬퍼 통합, 폴더 생성 이중 조회)이 새로 추가됐다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 불릿 "교차 워크스페이스 참조 후속")
  - 상세: 코드 변경은 아니고, 이번 구현이 다루지 않은 잔여 표면을 트래커에 등재하는 문서 작업이다. 프로젝트 관례("유예한 항목은 그 턴에 plan/")와 일치하며, 실제로 `codebase/`에는 그 항목들에 대응하는 코드가 하나도 없다(범위를 넓히지 않았다는 증거).
  - 제안: 조치 불요 — 오히려 스코프를 지킨 근거로 유리하게 작용.

- **[INFO]** `review/code/**`·`review/consistency/**` 아래 다수 파일(이전 2회 코드 리뷰 라운드 + 7회 consistency-check 라운드 산출물)이 diff 에 포함되어 있어 파일 수가 크게 부풀어 있다
  - 위치: `review/code/2026/09/27/21_43_01/**`, `review/code/2026/09/27/22_11_22/**`, `review/consistency/2026/09/27/{19_43_46,20_05_26,20_21_21,20_35_40,20_45_35,20_56_04,21_03_31}/**`
  - 상세: 이 프로젝트 컨벤션상 리뷰·일관성 검토 산출물은 각각 `review/code/**`·`review/consistency/**` 에 커밋되는 정상 워크플로 부산물이며, 코드 스코프(`codebase/backend/src`)와는 무관하다. "변경 범위" 관점에서 문제되는 코드·설정 변경은 아니다.
  - 제안: 조치 불요(정보 제공 목적). 다만 이 라운드(22_36_12) 자체는 이 누적 산출물을 포함한 전체 diff 를 대상으로 돌고 있어, 이전 두 라운드에서 이미 수용/수렴 예외로 처분된 항목(예: 22_11_22 RESOLUTION 의 W2/W3)이 이번 라운드에서 다시 지적될 경우 재처분 근거를 그 RESOLUTION.md 로 대조할 것.

- 그 외 임포트·포맷팅·주석 관련 소견: 없음 — 모든 신규 import(`Workflow`/`Node`/`Folder` 엔티티, `In`, `assertReferenceInScope`/`throwInvalidReferences`)가 실제로 소비되고 있음을 확인했고(`grep` 대조), 기존 로직을 걷어낸 자리(`FoldersService.validateParentChange` 의 인라인 `findOne`+`BadRequestException` 블록)는 새 헬퍼 호출로 정확히 1:1 치환됐을 뿐 무관한 재포맷팅이 섞여 있지 않다. `edges.module.ts`/`workflows.module.ts`/`triggers.module.ts` 의 `TypeOrmModule.forFeature([...])` 배열이 여러 줄로 재포맷된 것은 새 엔티티 원소 추가에 따른 자연스러운 결과(prettier)이며 그 자체가 의미 있는 변경과 분리되지 않은 것도 아니다.

## 요약

핵심 코드 변경(`codebase/backend/src`, 24개 파일 + 신규 e2e 1개)은 CHANGELOG 에 선언된 "요청 본문의 교차 워크스페이스/교차 워크플로 참조를 저장 전에 거부한다"는 단일 의도에 정확히 대응하며, 각 서비스에 필요한 최소한의 DI 주입·검증 호출·테스트 갱신만 포함한다. 넓은 diff pathspec 대조 결과 `codebase/backend/src`·`test`·`CHANGELOG.md`·`spec/`·`plan/`·`review/` 다섯 범주 밖의 파일은 전혀 건드리지 않았고, 범주 안에서도 spec/plan 변경은 이번 기능의 근거·후속 추적 문서화에 국한된다. 리팩터링·기능 확장·무관한 포맷팅·불필요한 임포트·주석 변경·설정 변경 등 스코프 이탈 징후는 발견되지 않았다.

## 위험도
NONE
