# 신규 식별자 충돌 검토 — spec/2-navigation (impl-done)

## 검토 범위 요약

- scope(`spec/2-navigation`) 의 spec 델타는 0개 파일 — 이 브랜치는 코드 전용 변경(9개 파일 / 611줄, `codebase/backend/src/modules/{triggers,workflows,workspaces}/**` + 신규 e2e 스펙 2개)이다. 신규 식별자는 diff 에서 직접 확인했다(워킹트리 `git diff origin/main...HEAD`).
- 변경 내용: 워크플로우/워크스페이스 동시 DELETE 시 두 번째 요청이 403/500 으로 새던 것을 404 로 고정하는 버그 수정(`spec/2-navigation/1-workflow-list.md` §2.6, `2-trigger-list.md` §4.4 트리거 삭제의 "두 번째 요청은 404" 대칭을 워크플로우·워크스페이스 삭제 경로에도 맞춘 것).

## 신규 식별자 목록과 충돌 확인 결과

1. **`LockedParentTriggers`** (신규 interface, `trigger-resource-release.ts`) — `git grep` 결과 이 diff 이전에는 존재하지 않았고, 코드베이스 전체에서 동일 이름의 다른 정의 없음. 충돌 없음.
2. **`parentPresence: 'present' | 'absent'`** (신규 필드/유니온) — 코드베이스 전체에서 이 필드명을 다른 의미로 쓰는 곳 없음. `'present'`/`'absent'` 라는 문자열 자체는 cafe24/makeshop 의 constraint-validator 테스트 설명문에 영어 단어로 등장하지만 별개 도메인의 서술적 문자열일 뿐 동일 타입·식별자가 아니다. 충돌 없음. (plan 문서(`plan/in-progress/dup-delete-audit.md`)도 종전 필드명 `parent` 를 `parentPresence` 로 이미 정정해 코드와 동기화됨 — SUMMARY#2, 커밋 `c3607d907`.)
3. **에러 코드 `RESOURCE_NOT_FOUND`** (workflow 삭제 경로에서 신규로 던지는 자리) — 기존에 이미 `nodes.service.ts`·`triggers.service.ts`·`workflow-ownership.util.ts`·`schedules.service.ts`·`integrations.service.ts` 등 다수 모듈이 "리소스 없음(404)" 의미로 재사용하는 프로젝트 표준 generic 코드([`spec/5-system/3-error-handling.md`](spec/5-system/3-error-handling.md), `error-response.dto.ts`). 이번 diff 는 그 기존 의미를 그대로 재사용한 것이라 충돌 아님(신규 의미 부여 없음).
4. **에러 코드 `WORKSPACE_NOT_FOUND`** (workspace 삭제 경로에서 신규로 던지는 자리) — `workspaces.service.ts` 자체가 이미 이 코드를 워크스페이스 CRUD 전역에서 "워크스페이스 없음" 의미로 8곳 이상 사용 중이던 기존 코드([`spec/conventions/error-codes.md`](spec/conventions/error-codes.md) 도 `WORKSPACE_NOT_FOUND` 를 "직접 추가·관리 경로(§1.9, `workspaces.service.ts`)의 UPPER_SNAKE" generic 코드로 이미 등재). 초대 흐름의 lowercase `workspace_not_found` 와는 spec 이 이미 "별개 wire 코드"로 명시 구분해 뒀다. 충돌 없음.
5. **신규 파일 `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`** — 기존 `execution-concurrency-cap.e2e-spec.ts`, `integration-rotate-concurrency.e2e-spec.ts` 와 동일한 `<주제>-concurrency.e2e-spec.ts` 명명 컨벤션을 따르고, 동일 이름의 기존 파일 없음. 충돌 없음.

## 점검 관점별 결과

1. 요구사항 ID 충돌 — 해당 없음(신규 요구사항 ID 부여 없음, 기존 §2.6/§4.4 절 확장).
2. 엔티티/타입명 충돌 — `LockedParentTriggers` 신설, 충돌 없음(§1 참고).
3. API endpoint 충돌 — 신규 endpoint 없음(기존 `DELETE /api/workflows/:id`, `DELETE /api/workspaces/:id` 의 내부 동작만 수정).
4. 이벤트/메시지명 충돌 — 신규 webhook/queue/sse 이벤트 없음.
5. 환경변수·설정키 충돌 — 신규 ENV/설정 키 없음.
6. 파일 경로 충돌 — 신규 e2e 파일 2개, 기존 명명 컨벤션 준수·기존 파일과 이름 겹침 없음(§5 참고).

## 요약

이번 변경은 워크플로우/워크스페이스 동시 DELETE 버그 수정을 위한 코드 전용 PR(spec/2-navigation 델타 0)이며, 신규로 도입되는 식별자는 `LockedParentTriggers` 인터페이스, `parentPresence` 필드(`'present' | 'absent'`), 신규 e2e 스펙 파일 2개뿐이다. 재사용된 에러 코드 `RESOURCE_NOT_FOUND`/`WORKSPACE_NOT_FOUND` 는 각각 해당 모듈에서 이미 확립된 동일 의미의 기존 코드이며, 신규 인터페이스·필드명·파일명 모두 기존 코드베이스 전체를 grep 한 결과 다른 의미로 이미 쓰이는 동일 식별자를 찾지 못했다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
