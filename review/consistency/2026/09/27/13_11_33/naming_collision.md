# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-prep, patch-omit-undefined)

## 검토 범위 요약

target 은 `spec/2-navigation/` 영역(워크플로우 목록·트리거 목록·스케줄 등) 이며, 이번 impl-prep 대상 작업은
`plan/in-progress/patch-omit-undefined.md` — PATCH 부분 본문이 보내지 않은 필드를 덮어쓰던 결함을
`workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts` 세 곳에서 기존 헬퍼
`codebase/backend/src/common/utils/omit-undefined.ts` (`omitUndefined`) 로 고치는 code-only 수정이다
(`spec_impact: none`). 이 작업이 **새로 도입하는 식별자**가 있는지부터 확인했다.

## 새로 도입되는 식별자 인벤토리

- **요구사항 ID**: 없음. 새 spec ID·요구사항 번호 없음 (spec 변경 없음).
- **엔티티/타입/DTO**: 없음. 기존 `WorkflowDto` / `NodeDto` / `AuthConfigDto` / `WorkflowSettingsDto` 를
  그대로 사용하며 새 클래스·인터페이스를 추가하지 않는다.
- **API endpoint**: 없음. `PATCH /api/workflows/:id`, `PATCH /api/nodes/:id`, `PATCH /api/auth-configs/:id`
  는 모두 기존 endpoint 다.
- **이벤트/메시지명**: 없음.
- **환경변수·설정키**: 없음. `settings.maxConcurrentExecutions` 는 이미 `spec/2-navigation/1-workflow-list.md`
  §3.2 · Rationale §2 에 정의된 기존 키다.
- **파일 경로**: 신규 파일 2건
  - `codebase/backend/test/patch-partial-body.e2e-spec.ts` (신규, untracked)
  - (단위 테스트는 기존 `*.service.spec.ts` 에 케이스 추가 예정 — 신규 파일 아님)

## 발견사항

- **[INFO]** 신규 e2e 파일명이 형제 명명 컨벤션에서 의도적으로 벗어남
  - target 신규 식별자: `codebase/backend/test/patch-partial-body.e2e-spec.ts`
  - 기존 사용처: `codebase/backend/test/*.e2e-spec.ts` 전수(예: `trigger-update-save-window.e2e-spec.ts`,
    `schedule-trigger.e2e-spec.ts`, `workflow-crud.e2e-spec.ts`, `folder-crud.e2e-spec.ts`)는 모두
    `<도메인>-<시나리오>` 패턴을 쓴다.
  - 상세: `patch-partial-body`는 도메인이 아니라 "결함 클래스"를 이름으로 쓴다 — 워크플로·노드·인증설정
    세 도메인에 걸친 단일 파일이라는 점에서 형제 파일들과 명명 축이 다르다. 다만 이는 plan 본문
    (`plan/in-progress/patch-omit-undefined.md` §2 "e2e")에 "형제 명명 `<도메인>-<시나리오>` 대신 결함
    클래스 이름 — 세 도메인에 걸친다"로 **이미 자각·명시**된 결정이며, grep 결과 기존 파일과 이름이
    겹치거나 혼동을 부를 만큼 유사한 파일도 없다(실제 충돌 없음).
  - 제안: 충돌은 아니므로 차단 사유 아님. 다만 컨벤션 문서(`spec/conventions/`)에 "결함 클래스 축 명명"을
    허용 예외로 남기지 않을 경우, 다음 사람이 이 파일을 "도메인 누락"으로 오인할 수 있다 — plan 의 근거
    문장을 파일 상단 JSDoc(이미 있음, L15-24)에 유지하는 것으로 충분해 보인다.

- **[NONE]** `omitUndefined` 헬퍼 재사용 — 충돌 없음
  - target 신규 식별자: 없음(기존 헬퍼 재사용). `omit-undefined.ts` 는 `b55e14f77`(#1415, 폴더 PR)에서
    이미 도입되었고, 이번 target 은 그 헬퍼를 `triggers.service.ts`·`folders.service.ts` 에 이어
    `workflows.service.ts`/`nodes.service.ts`/`auth-configs.service.ts` 세 곳에 추가로 배선할 뿐이다.
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:622`,
    `codebase/backend/src/modules/folders/folders.service.ts:75`.
  - 상세: 동일 의미로 일관되게 재사용되므로 충돌 대상 아님.

## 요약

target(`spec/2-navigation/`) 영역과 이번에 --impl-prep 대상인 `patch-omit-undefined` 작업을 대조한 결과,
새로 부여되는 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수/설정키는 없다. 유일한 신규 산출물은
e2e 테스트 파일 `patch-partial-body.e2e-spec.ts` 하나이며, 이는 기존 `<도메인>-<시나리오>` 명명 컨벤션과
축이 다르지만(결함 클래스 명) 실제 파일명 충돌·혼동 사례는 없고 plan 문서에 그 이탈이 이미 근거와 함께
자각되어 있다. 재사용되는 `omitUndefined` 헬퍼도 기존 사용처(`folders.service.ts`, `triggers.service.ts`)와
동일 의미로 일관된다. 신규 식별자 충돌 관점에서 차단 사유는 없다.

## 위험도

NONE
