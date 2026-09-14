# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- target scope: `spec/conventions/` — `origin/main` 대비 **델타 0 파일** (이 브랜치는 spec/conventions 를 바꾸지 않았다). 델타 0 은 코드 전용 PR 이면 정상이며 그 자체로 CRITICAL 근거가 아니다.
- 실제 구현 diff: `codebase/` 6개 파일 / 380줄(+357/-23), 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)에서 `git diff origin/main...HEAD -- codebase/` 로 직접 재확인했다 (prompt 번들의 diff 섹션은 예산 절단으로 비어 있었음).
- 신규 파일: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`. 나머지는 기존 파일에 대한 doc-comment 정정(원문자→아라비아 숫자 표기 통일) 및 e2e 케이스 추가.

## 신규 식별자 전수 목록과 충돌 검사

| 신규 식별자 | 종류 | 충돌 검사 방법 | 결과 |
|---|---|---|---|
| `CANONICAL_SOURCE` / `CANONICAL_CONST` | exported const (파일 경로/상수명 문자열) | `git grep` 저장소 전체 | 이 파일 밖 0건 — 충돌 없음 |
| `MIRROR_SOURCES` / `MIRROR_CONST` | exported const | 상동 | 상동 |
| `readStringArrayConst` / `readAllTriggerSecretColumnLists` | exported 함수 | 상동 | 상동 (다른 모듈의 동명 함수·재정의 없음) |
| `trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts` | 파일 경로 | 기존 `repo-guards/__tests__/*-guard.ts` + `*.spec.ts` 형제 목록(예: `redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`, `dto-class-name-collision-guard.ts` 등) 대조 | 기존 명명 컨벤션(`<주제>-guard.ts` + `<주제>.spec.ts` 짝)을 그대로 따름. 경로 중복 없음 |

`TRIGGER_RESPONSE_STRIP_COLUMNS`(정본, `triggers.service.ts`)와 `TRIGGER_SECRET_COLUMNS`(사본, `schedule-trigger-ref.ts` / `trigger-workflow-ref.ts`)는 이 PR 이 **새로 도입한 식별자가 아니다** — `origin/main` 시점에 이미 존재했고(`git show origin/main:codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 확인), 신규 가드 파일이 그 두 값을 문자열 상수(`CANONICAL_CONST`/`MIRROR_CONST`)로 **참조**할 뿐이다. 따라서 요구사항 ID·엔티티·API·이벤트·ENV·파일경로 6개 관점 중 실질적으로 해당하는 것은 "파일 경로"와 "식별자(함수/상수명)" 뿐이며, 둘 다 위 표에서 충돌 0건으로 확인됐다.

## 6개 관점별 점검

1. **요구사항 ID 충돌** — 신규 요구사항 ID 부여 없음 (spec 델타 0, plan 문서 내부의 `C-2`/`G`/`H` 라벨은 기존 e2e 케이스 표기를 가리키는 plan 서술이며 신규 ID 발급이 아님).
2. **엔티티/타입명 충돌** — 신규 DTO·엔티티·interface 없음. 신규 타입은 `readStringArrayConst`/`readAllTriggerSecretColumnLists`의 인자·반환 타입(`string[] | null`, `Record<string, string[] | null>`) 뿐이며 명명된 타입 선언이 아니다.
3. **API endpoint 충돌** — 신규 endpoint 없음. 기존 `PATCH /api/triggers/:id` 등 경로에 대한 e2e 단언(`expectTriggerWorkflowRef`) 추가일 뿐 — 이 헬퍼 자체는 `origin/main`에 이미 존재.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 위 표 참고. 기존 `repo-guards/__tests__/` 명명 컨벤션(정적 AST 파서 `-guard.ts` + 소비 `.spec.ts` 짝, 예: `redis-fail-open-catalog-guard.ts`/`redis-fail-open-catalog.spec.ts`)을 그대로 따르며 파일명 중복·컨벤션 이탈 없음.

## 요약

이 PR 은 spec/conventions 를 변경하지 않았고(델타 0), 구현 diff 는 트리거 비밀 컬럼 목록 3중 사본 정합을 검증하는 신규 repo-guard 테스트 2개 파일(+기존 파일 doc-comment/e2e 케이스 보강)로 국한된다. 신규로 도입된 exported 식별자(`CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`/`readStringArrayConst`/`readAllTriggerSecretColumnLists`)와 신규 파일 경로 2개 모두 저장소 전수 grep 으로 타 위치와의 충돌이 0건임을 확인했고, 기존 `repo-guards/__tests__/` 명명 컨벤션(`-guard.ts`/`.spec.ts` 짝)을 그대로 따른다. `TRIGGER_RESPONSE_STRIP_COLUMNS`·`TRIGGER_SECRET_COLUMNS`는 이 PR 이전부터 존재하던 상수이며 신규 가드가 이를 이름(문자열)으로 참조할 뿐 재정의하지 않는다. 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키 도입도 없다. 신규 식별자 충돌 관점에서 이 PR 은 위험이 없다.

## 위험도

NONE
