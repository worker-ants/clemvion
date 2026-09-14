# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위와 전제

- target scope(`spec/conventions/`) 의 `origin/main` 대비 델타는 **0개 파일**이다. 이 브랜치는 spec 문서를 바꾸지 않았다 — 델타 0 자체를 근거로 CRITICAL 을 내지 않는다(프롬프트 명시 지침).
- 실제 변경은 `codebase/` 6개 파일 / diff 기준 345 삽입 · 23 삭제 (신규 2, 수정 4) 이며, 전부 `trigger`/`schedule` 도메인의 **테스트·가드 코드**다. 신규 식별자 충돌 여부를 이 코드 diff 기준으로 점검했다 — HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)를 절대경로로 직접 읽고 grep 했다.

신규로 등장하는 식별자:

| 식별자 | 종류 | 위치 |
|---|---|---|
| `CANONICAL_SOURCE`, `CANONICAL_CONST` | export const (문자열 리터럴) | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` |
| `MIRROR_SOURCES`, `MIRROR_CONST` | export const | 〃 |
| `readStringArrayConst`, `readAllTriggerSecretColumnLists` | export function | 〃 |
| `trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts` | 신규 파일 경로 | `codebase/backend/src/repo-guards/__tests__/` |
| (docstring 번호 표기 ①②③→1,2,3 치환) | 문서 표기 변경, 식별자 아님 | `trigger-workflow-ref.spec.ts` |

## 점검 결과 (관점별)

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 export 는 `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`/`readStringArrayConst`/`readAllTriggerSecretColumnLists` 6개, 전부 신규 파일(`trigger-secret-columns-guard.ts`) 로컬 스코프다. `codebase/backend/src/repo-guards/__tests__/` 하위 기존 가드 14개(`audit-action-binding-guard.ts`, `dto-class-name-collision-guard.ts`, `redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts` 등)를 grep 했으나 `CANONICAL_SOURCE`/`MIRROR_SOURCES` 등 동일 이름의 export 는 없다 — 파일 스코프 상수라 모듈 간 충돌도 없다. `TRIGGER_SECRET_COLUMNS`(값 문자열, `MIRROR_CONST` 가 가리키는 대상 이름)는 이미 `schedule-trigger-ref.ts`·`trigger-workflow-ref.ts` 두 곳에 **기존** 상수로 존재하며, 신규 가드는 그 기존 이름을 값으로만 참조할 뿐 재선언하지 않는다. `TRIGGER_RESPONSE_STRIP_COLUMNS` 도 `triggers.service.ts` 의 기존 상수를 `CANONICAL_CONST` 값으로 참조만 한다 — 충돌 없음, 오히려 3중 사본 정합을 강제하는 목적에 부합.
3. **API endpoint 충돌** — 신규 endpoint 없음. `schedule-trigger.e2e-spec.ts` 에 추가된 `expectTriggerWorkflowRef(...)` 호출 3곳은 기존 `PATCH /api/triggers/:id`·목록 조회 응답을 검증하는 것으로 새 endpoint 를 도입하지 않는다.
4. **이벤트/메시지명 충돌** — 해당 변경 없음.
5. **환경변수·설정키 충돌** — 해당 변경 없음.
6. **파일 경로 충돌** — 신규 파일 2개(`trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`)는 기존 파일과 겹치지 않으며, 같은 디렉토리의 `<주제>-guard.ts` + 소비 `.spec.ts` 분리 관례(`redis-fail-open-catalog-guard.ts`/`masked-reject-callers-guard.ts` 선례)를 그대로 따른다 — 컨벤션 이탈 없음. spec 문서 신규 파일은 없다(델타 0).

## 부가 확인 — spec 쪽 기존 참조와의 정합

`grep -rl "TRIGGER_SECRET_COLUMNS\|TRIGGER_RESPONSE_STRIP_COLUMNS" spec/` 결과 `spec/conventions/secret-store.md:70`, `spec/5-system/14-external-interaction-api.md:935` 두 곳이 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`TriggersService` 소속)를 언급한다. 신규 가드의 `CANONICAL_CONST = 'TRIGGER_RESPONSE_STRIP_COLUMNS'` 값·소속 파일(`modules/triggers/triggers.service.ts`)이 이 두 spec 문서의 서술과 정확히 일치한다 — 새 식별자가 spec 이 이미 알고 있는 이름을 다른 의미로 재정의하는 사례는 없다.

## 발견사항

없음. target 이 spec 신규 식별자를 도입하지 않았고(델타 0), 구현 diff 가 새로 만든 6개 식별자·2개 파일은 모두 기존 이름을 값으로만 참조하거나 파일 스코프에 국한돼 기존 사용처와 의미 충돌이 없다.

## 요약

이번 변경은 spec/conventions 에 신규 식별자를 도입하지 않았고(diff 0), 실제 코드 변경도 트리거 비밀 컬럼 목록 3중 사본을 정적으로 대조하는 신규 테스트 가드 1쌍(+기존 e2e 확장)에 그친다. 신규 export(`CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`/`readStringArrayConst`/`readAllTriggerSecretColumnLists`)는 모두 새 파일 로컬 스코프이며, 값으로 참조하는 기존 상수명(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `TRIGGER_SECRET_COLUMNS`)은 spec 문서(§secret-store.md, §14-external-interaction-api.md)의 기존 서술과 정확히 일치한다. 신규 파일 경로도 같은 디렉토리의 기존 `<주제>-guard.ts`/`.spec.ts` 분리 관례를 따르며 기존 파일과 겹치지 않는다. 요구사항 ID·API endpoint·이벤트명·환경변수 축에서도 신규 도입이 없어 충돌 표면 자체가 존재하지 않는다.

## 위험도

NONE
