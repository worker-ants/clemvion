# 변경 범위(Scope) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 새 e2e 스펙 파일의 JSDoc 주석이 존재하지 않는 plan 경로를 인용
  - 위치: `codebase/backend/test/cross-workspace-references.e2e-spec.ts:14`
  - 상세: `옮겼다(`plan/complete/cross-workspace-refs.md` §실측 — 고치기 전 코드에서 이 파일의 18케이스가 전부 RED)` 문구가 `plan/complete/cross-workspace-refs.md` 를 인용하는데, 이 worktree 에 그 경로는 존재하지 않는다(`find plan -iname '*cross-workspace-refs*'` 결과 실재하는 것은 `plan/in-progress/cross-workspace-refs.md` 뿐). 같은 PR 의 여러 `--impl-prep`/`--spec` 컨시스턴시 라운드가 정확히 같은 오기 패턴(spec 문서 쪽 `plan/complete/cross-workspace-refs.md` 완료형 인용)을 Critical/WARNING 으로 잡아 커밋 `18f235a81` 로 정정했지만, 코드 주석 안의 이 인스턴스는 그 스윕 대상에 들지 않아 남았다. 범위 이탈은 아니고(주석 내용 자체는 이 PR 의 의도와 정확히 일치하는 설명) 순수 참조 정확성 결함이라 CRITICAL/WARNING 이 아니지만, 다음 사람이 그 경로를 따라가면 깨진다.
  - 제안: `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로 정정(구현 plan 이 `plan/complete/` 로 옮겨지면 자동으로 유효해지므로, 이동 시점에 맞춰 고치거나 지금 in-progress 경로로 미리 고쳐도 무방).

## 점검 결과 요약 (문제 없음 확인)

- **파일 범위**: `git diff --stat origin/main...HEAD` 기준 93개 파일, 전부 `codebase/backend/{src,test}/**`, `spec/**`, `plan/**`, `review/**`, `CHANGELOG.md` 안에 있다. `package.json`·`tsconfig`·eslint·CI 설정·frontend 등 무관 영역은 0건.
- **핵심 로직 변경 (`reference-in-scope.ts` 신설 + 10개 서비스 배선)**: CHANGELOG·spec(`1-data-model.md` §1.1)이 명시하는 "쓰기 요청 본문의 참조 id 전수 조사" 그대로 트리거·스케줄·알림 규칙·폴더·워크플로·노드·엣지·지식 베이스·어시스턴트 세션에 같은 패턴을 배선한 것이라, 손댄 자리 수가 많아도 하나의 결함(저장 전 소속 검사 누락)에 대한 전수 처방이다 — over-engineering 이나 범위 이탈이 아니다.
- **`folders.service.ts` 의 기존 `findOne` 기반 부모 존재 검사를 제거하고 `assertParentInWorkspace`/`assertReferenceInScope` 로 교체**한 부분은 무관한 리팩토링이 아니라, 새 공용 검증기로 교체하면서 중복 로직을 제거한 것 — 같은 PR 이 도입하는 패턴의 직접 적용이다.
- **`edges.module.ts`/`workflows.module.ts`/`triggers.module.ts` 의 `TypeOrmModule.forFeature([...])` 배열에 `Node`/`Folder`/`Workflow` 추가**(및 그에 따른 멀티라인 재포맷)는 새로 주입하는 리포지토리에 필요한 최소 변경이며, 포매팅은 배열 항목 추가에 따른 prettier 결과일 뿐 무관한 스타일 변경과 섞여 있지 않다.
- **테스트 파일들의 `mockWorkflowRepo`/`mockNodeRepo`/`workflowRepo` mock provider 추가**(`edges.service.spec.ts`, `triggers.service.spec.ts` 8곳, `schedules.service.spec.ts`, `triggers.web-chat.spec.ts`, `nodes.service.spec.ts`, `folders.service.spec.ts`)는 새 생성자 의존성 때문에 기계적으로 필요한 변경이고, 새로 추가된 assertion 은 모두 이번 기능(소속 검사)의 양성/음성 케이스에 대응한다.
- **spec 변경**(`1-data-model.md` §1.1 신설, `2-navigation/1-workflow-list.md`, `3-workflow-editor/0-canvas.md`, `data-flow/11-workflow.md`, `data-flow/12-workspace.md`)은 같은 작업의 project-planner 턴이 만든 동일 규칙의 문서화이며, 커밋 이력(`a8bfd1492`~`18f235a81`)이 보여주듯 여러 차례 `--spec`/`--impl-prep` 게이트를 거쳐 정합성 검토를 통과했다. SDD 워크플로 상 정상 범위다.
- **`review/consistency/2026/09/27/**` 다수 디렉터리**(19_43_46 ~ 21_03_31, 8회차)는 이 작업의 `--impl-prep`/`--spec` 게이트 실행이 남긴 process 산출물이며, CLAUDE.md 가 명시한 저장 위치(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 규약을 그대로 따른다 — 무관한 파일이 아니라 이 PR 자체의 게이트 이력이다.
- **CHANGELOG.md**: 신규 항목 1건만 추가, 기존 "PATCH null" 항목 등 다른 내용은 건드리지 않았다.
- **임포트**: 새로 추가된 모든 import(`assertReferenceInScope`, `throwInvalidReferences`, `InvalidReference`, `Node`, `Folder`, `Workflow`, `LlmService`, `In`)는 각 파일에서 실제로 사용되는 것을 확인했다. 미사용 임포트나 불필요한 정리는 발견되지 않았다.
- **주석**: 새로 추가된 주석은 전부 "왜 이 검사가 필요한가"를 설명하는 신규 JSDoc/inline 이며, 기존 주석을 무관하게 삭제·수정한 사례는 없다(위 INFO 1건 제외 — 내용 자체는 이 기능 설명이라 "불필요한 주석"은 아니고 참조 정확성 문제).
- **설정 변경**: 없음.
- **뮤테이션 규약 준수**: 이 리뷰 중 저장소 파일을 수정하지 않았다(`git status --short` 로 확인 — 본 세션이 쓴 `review/code/2026/09/27/21_43_01/` 산출물 외 변경 없음). 원복 불필요.

## 요약

이 변경은 "쓰기 요청 본문의 참조 id 가 다른 워크스페이스/워크플로를 가리키면 400 으로 거부한다"는 단일 목표를 중심으로, 그 목표가 요구하는 10여 개 서비스에 동일 패턴(`assertReferenceInScope`/`throwInvalidReferences`)을 일관되게 배선한 것이다. 손댄 파일 수가 많지만 전부 CHANGELOG·spec(§1.1)이 명시한 전수 조사 범위 안에 있고, 모듈 배선·mock 추가는 새 DI 의존성에 따른 기계적 파생 변경이며, `folders.service.ts` 리팩토링도 같은 패턴으로의 교체다. spec/plan/review 산출물 역시 이 작업의 SDD 게이트 이력으로서 정상 범위다. 유일하게 지적할 점은 새 e2e 스펙 파일 주석이 이미 다른 곳에서 정정된 것과 동일한 깨진 plan 경로(`plan/complete/cross-workspace-refs.md`)를 여전히 인용한다는 것인데, 이는 범위 이탈이 아니라 참조 정확성의 사소한 잔여 결함이다. 설정 파일, 프런트엔드, 무관 모듈에 대한 변경은 없었다.

## 위험도

LOW
