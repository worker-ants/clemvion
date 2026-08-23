# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ExecuteWorkflowDto.input` 에 추가된 `deprecated: true` 는 순수 OpenAPI 스키마 메타데이터이며 런타임 부작용이 없다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66` (`@ApiPropertyOptional` 의 `deprecated: true`)
  - 상세: `ExecuteWorkflowDto` 는 `WorkflowsController.execute` 의 `@Body()` 파라미터 타입이 아니라 `@ApiBody({ type: ExecuteWorkflowDto })` 로만 참조된다(`codebase/backend/src/modules/workflows/workflows.controller.ts:256`). 전역 `CustomValidationPipe` 는 `metatype` 이 `Object` 일 때 검증을 건너뛰므로(파일 자체 docstring, `workflows-execute-body.spec.ts` 캐너리로 고정) 데코레이터 메타데이터 변경은 생성되는 `swagger.json` 문서에만 반영되고 요청 처리 로직·응답 스키마·검증 동작에는 전혀 영향을 주지 않는다. 프런트엔드/백엔드 어디에도 swagger.json 을 소비하는 codegen 파이프라인이 없음을 확인했다(grep 결과 없음) — 따라서 "deprecated" 표시가 어떤 클라이언트 생성 코드에 경고를 전파할 경로도 없다.
  - 제안: 없음(의도한 대로 비침습적).

- **[INFO]** `spec/conventions/swagger.md` §3 규칙 완화(DTO `description` 강제 → 지향)는 코드로 강제되는 게이트가 아니라 순수 문서이며, 이를 파싱해 검증하는 자동 스크립트가 저장소에 없다
  - 위치: `spec/conventions/swagger.md` §3 (`### §3 DTO 길이는 왜 강제가 아닌가`), `### §3 보안·정책 캐비엇 — 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가`
  - 상세: `.claude/skills`, `.claude/tools`, `.claude/hooks`, `codebase/**` 전수 grep 결과 `swagger.md` 의 수치(10~40, 50~150 등)를 프로그램적으로 읽어 게이트로 쓰는 스크립트는 없다. 즉 이 규약 개정은 향후 사람/AI 리뷰어의 판단 기준만 바꿀 뿐, CI·hook·lint 등 어떤 자동화 경로에도 부작용을 전파하지 않는다.
  - 제안: 없음. (단, 앵커명 변경(`#3-보안정책-캐비엇-예외--...` → `#3-보안정책-캐비엇--...`)은 문서 내부 상호링크 문제로 RESOLUTION.md 가 `check-doc-links.py` 로 이미 검증했다고 밝혔으므로 이 리뷰 범위에서는 재확인만 함.)

- **[INFO]** 리뷰 진행 중 공유 worktree 에서 `execute-workflow.dto.ts` 가 일시적으로 `deprecated: true` 없이 관측되고 `execute-workflow.dto.ts.orig` 임시 파일이 나타났다가 사라졌다 — 동시 실행 중인 다른 서브에이전트(testing 리뷰어로 추정, RESOLUTION.md 가 "testing 리뷰어가 뮤테이션을 직접 재현" 이라 명시)의 뮤테이션 테스트 재현으로 판단됨
  - 위치: 소스 다이어그램 밖 — 워크트리 파일시스템 관측(`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`, 임시 `*.orig`)
  - 상세: `git status`/`git diff HEAD` 를 두 차례 연속 실행한 결과, 1차에서는 `deprecated: true` 가 제거된 미커밋 diff + untracked `.orig` 백업이 관측됐고, 수 초 뒤 2차 실행에서는 원상 복구되어 작업트리가 클린했다. 이는 이 diff 자체가 일으키는 부작용이 아니라 **같은 review 라운드의 다른 sub-agent 가 공유 worktree 에서 mutation testing(제거→검증→cp 복원)을 수행하는 동안의 정상 과도 상태**로 판단된다(swagger-decisions.md `## 뮤테이션` 절이 이 절차를 명시). 다만 이 절차는 파일시스템을 진짜로 변형하는 짧은 창(window)을 만들며, 그 창에서 동시 진행 중인 다른 프로세스(다른 리뷰어, 백그라운드 lint/typecheck, 파일 watcher 등)가 미완성/롤백-전 상태를 관측하거나 그 상태에 대해 작업할 위험이 있다(과거 기록: `feedback_reviewer_mutates_shared_worktree.md`).
  - 제안: 코드 변경 자체에는 조치 불요. 다만 프로젝트의 뮤테이션 테스트 관행이 "커밋 후 `cp` 백업/복원" 을 표준으로 삼고 있다면, 공유 worktree 를 사용하는 병렬 리뷰 세션에서는 복원 완료를 파일 잠금(lock) 또는 즉시-순차 실행으로 보장하는 편이 device 간 관측 오염을 줄인다. (신규 결함 아님 — 기존에 문서화된 패턴의 재확인.)

- **[INFO]** `review/code/2026/08/23/12_22_08/**` (12개 파일)과 `review/consistency/2026/08/23/11_59_11/**` (7개 파일)가 신규 파일로 diff 에 포함됨 — 예상된 산출물이며 부작용 아님
  - 위치: `review/code/2026/08/23/12_22_08/*`, `review/consistency/2026/08/23/11_59_11/*`
  - 상세: 이는 이전 리뷰/일관성 검토 라운드의 표준 산출물(`SUMMARY.md`, `RESOLUTION.md`, 각 reviewer `.md`, `meta.json`, `_retry_state.json` 등)이며 저장소 컨벤션상 `review/**` 는 커밋되는 산출 위치다. 새 전역 상태·환경 변수·네트워크 호출 등은 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 실질 런타임 코드 변경은 `ExecuteWorkflowDto.input` 에 `@ApiPropertyOptional({ deprecated: true })` 를 추가한 것 하나뿐이며, 이 DTO 가 `@Body()` 파라미터 타입이 아니라 `@ApiBody({ type })` 로만 쓰인다는 사실(자체 docstring + 캐너리 테스트로 고정됨)에 의해 요청 처리·검증·응답 스키마에는 어떤 영향도 없이 생성되는 OpenAPI 문서 메타데이터만 바뀐다. 신규 유닛 테스트는 그 스키마 플래그만 단언하는 순수 assertion 이고, `plan/**`·`review/**`·`spec/conventions/swagger.md` 변경은 모두 문서/트래커/스펙 텍스트이며 이를 프로그램적으로 소비해 게이트로 삼는 자동화가 저장소에 없어(grep 확인) 부작용 전파 경로가 없다. 전역 변수·환경 변수·네트워크 호출·공개 함수 시그니처·이벤트/콜백 어느 항목도 변경되지 않았다. 유일하게 흥미로운 관측은 리뷰 도중 공유 worktree 에서 동시 실행 중인 다른 sub-agent 의 뮤테이션 테스트로 인한 일시적 파일 변형(`deprecated: true` 제거 + `.orig` 백업)이었는데, 이는 diff 자체의 결함이 아니라 이미 문서화된 "병렬 리뷰어의 공유 worktree 오염" 패턴의 재확인이며 수 초 내 자가 복구됐다.

## 위험도

NONE
