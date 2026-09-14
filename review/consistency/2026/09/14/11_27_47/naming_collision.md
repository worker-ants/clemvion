# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- target scope: `spec/conventions/` — `origin/main` 대비 **델타 0개 파일**. 이 브랜치(`trigger-canary-hardening`)는 spec/conventions 문서를 전혀 수정하지 않았다 (plan frontmatter `spec_impact: none` 과 일치, `plan/in-progress/trigger-canary-hardening.md` 확인).
- 실제 구현 diff(6파일/434줄)는 전부 `codebase/backend` 테스트·가드 코드다:
  - 신규: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`
  - 수정: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (docstring 표기만, 로직 무변경), `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts` (주석 보강 + `expectTriggerWorkflowRef` 어서션 추가)
- 신규 식별자 충돌 관점에서 문제가 되는 것은 "target(spec/conventions)이 새로 부여하는 식별자"인데, target 델타가 0이므로 이 축에서는 검토 대상 자체가 없다. 아래는 구현 diff 가 spec/conventions 에 이미 정의된 식별자(감사 액션·API endpoint·환경변수·파일 경로 컨벤션 등)와 충돌하는지를 절대경로 기준으로 직접 대조한 결과다.

## 발견사항

검토 관점 1~6 각각에 대해 대조한 결과, 충돌 없음.

- **요구사항 ID / 엔티티·타입명**: 신규로 도입된 식별자는 `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`(상수)와 `readStringArrayConst`/`readAllTriggerSecretColumnLists`(함수)뿐이며, 전부 `trigger-secret-columns-guard.ts` 모듈 내부 export 로 스코프가 좁다. `git grep` 결과 이 이름들을 쓰는 다른 정의는 없다(`grep -rn "CANONICAL_SOURCE\|CANONICAL_CONST\|MIRROR_SOURCES\|MIRROR_CONST\|readStringArrayConst\|readAllTriggerSecretColumnLists" codebase/backend/src` → 신규 파일 2개 외 매치 없음). `spec/conventions/`에 이 이름의 엔티티·DTO 정의도 없다.
- **API endpoint**: 이번 diff 는 신규 endpoint 를 추가하지 않는다(테스트 코드가 기존 `POST/PATCH /api/triggers`, `GET /api/triggers/:id` 를 호출할 뿐).
- **이벤트/메시지명**: webhook·queue·sse 이벤트 신설 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: 신규 파일 `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` + `trigger-secret-columns.spec.ts` 는 같은 디렉토리의 기존 관례(`<name>-guard.ts` + `<name>.spec.ts`, 예: `redis-fail-open-catalog-guard.ts`/`redis-fail-open-catalog.spec.ts`, `masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts`)를 그대로 따르고, `ls`로 확인한 디렉토리 목록에 동일 파일명이 이미 존재하지 않는다 — 충돌 없음.
- **참조된 기존 상수명**: 신규 가드가 문자열로 다시 적는 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`modules/triggers/triggers.service.ts`)와 `TRIGGER_SECRET_COLUMNS`(`shared/testing/schedule-trigger-ref.ts`, `shared/testing/trigger-workflow-ref.ts`)는 **이번 diff 이전부터 이미 존재하던 상수**이며 diff 는 이들의 값을 새로 만들지 않고 3중 사본 정합만 정적으로 검증한다. 신규 정의가 아니므로 충돌 대상이 아니다.

## 요약

target(`spec/conventions/`)은 이번 브랜치에서 델타 0이라 새로 부여하는 식별자가 없다. 구현 diff(6파일)도 순수 테스트·정적 가드 코드로, 신규 도입 식별자(`CANONICAL_SOURCE` 등 4개 상수 + 2개 함수, 신규 파일 2개)는 모두 `repo-guards/__tests__/` 모듈 내부에 스코프가 좁혀져 있고 기존 명명 컨벤션을 그대로 따르며, spec/conventions 가 정의하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로 규약 어느 것과도 충돌하지 않는다. 코드가 참조하는 기존 상수명(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `TRIGGER_SECRET_COLUMNS`)도 diff 이전부터 있던 것으로 재정의가 아니다.

## 위험도

NONE
