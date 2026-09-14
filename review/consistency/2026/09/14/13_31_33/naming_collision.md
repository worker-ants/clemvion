# 신규 식별자 충돌 검토 — trigger-canary-hardening (impl-done, scope=spec/conventions/)

## 검토 범위 확인

- **`spec/conventions/` 델타: 0 파일.** 이 브랜치는 spec 영역을 변경하지 않았다 — 정상이며 그
  자체로는 결함 신호가 아니다.
- **실제 구현 diff (6 파일 / 548줄, `git diff origin/main...HEAD -- codebase/`)**:
  - `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (신규)
  - `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (신규)
  - `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (docstring 번호 표기 정정만 — 신규 식별자 없음)
  - `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` (주석 추가만)
  - `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 `expectTriggerWorkflowRef` 호출 3건 추가 — 신규 식별자 없음)
  - `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (docstring 갱신만)
- 나머지 diff(`plan/**`, `review/**`)는 전부 트래커·리뷰 산출물 프로즈이며 신규 프로덕션/스펙
  식별자를 도입하지 않는다.

이 배치는 harness 테스트/가드 하드닝(§0 workflow 예외 대상)이라 신규 요구사항 ID·엔티티·
endpoint·이벤트·ENV 표면이 원천적으로 없다. 아래는 실제로 신규 도입된 식별자 4종 + 파일 경로
2개에 대한 충돌 실측이다.

## 신규 식별자별 충돌 실측

| 신규 식별자 | 종류 | 정의 위치 | 전체 코드베이스 grep | 전체 spec grep | 판정 |
|---|---|---|---|---|---|
| `CANONICAL_SOURCE` | export const | `trigger-secret-columns-guard.ts` | 정의 파일 + 소비 spec(같은 페어)만 매치 | 0건 | 충돌 없음 |
| `CANONICAL_CONST` | export const | 〃 | 〃 | 0건 | 충돌 없음 |
| `MIRROR_SOURCES` | export const | 〃 | 〃 | 0건 | 충돌 없음 |
| `MIRROR_CONST` | export const | 〃 | 〃 | 0건 | 충돌 없음 |
| `readStringArrayConst` | export function | 〃 | 〃 | 0건 | 충돌 없음 |
| `readAllTriggerSecretColumnLists` | export function | 〃 | 〃 | 0건 | 충돌 없음 |

- `TRIGGER_SECRET_COLUMNS` / `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 이 신규 가드가 **읽기만** 하는
  기존 상수(각각 `schedule-trigger-ref.ts`/`trigger-workflow-ref.ts`, `triggers.service.ts`)로,
  이번 diff 가 새로 선언한 것이 아니다. `spec/conventions/secret-store.md:70` 과
  `spec/5-system/14-external-interaction-api.md:935` 가 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를
  동일 의미로 이미 인용하고 있어 코드·스펙 명명이 일치한다 — 충돌 아님.

### 파일 경로

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` +
  `trigger-secret-columns.spec.ts` — 같은 디렉토리의 기존 12쌍(`dto-class-name-collision-*`,
  `masked-reject-callers-*`, `redis-fail-open-catalog-*`, `user-entity-exposure-*` 등)과 동일한
  `<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션을 따른다. 기존 파일과 겹치지 않고, 컨벤션도
  깨지 않는다.

### 엔티티/DTO/인터페이스명

- 이번 diff 는 신규 엔티티·DTO·인터페이스를 도입하지 않는다 (테스트 헬퍼 함수·상수뿐).

### API endpoint / 이벤트·메시지명 / 환경변수·설정키

- 해당 없음 — 이번 diff 에 신규 endpoint, webhook/queue/sse 이벤트명, ENV var, config key 가
  없다.

## 요약

target(`spec/conventions/`) 은 이번 브랜치에서 변경되지 않았고, 실제 구현 diff는 트리거 비밀
컬럼 3중 사본을 정적으로 대조하는 신규 harness 가드(`trigger-secret-columns-{guard,spec}.ts`)
와 기존 `expectTriggerWorkflowRef` 호출 확장(테스트 3건 추가)·docstring 번호 표기 정정으로
한정된다. 신규로 도입된 export 식별자 6개(`CANONICAL_SOURCE`/`CANONICAL_CONST`/
`MIRROR_SOURCES`/`MIRROR_CONST`/`readStringArrayConst`/`readAllTriggerSecretColumnLists`) 는
전체 코드베이스·spec 코퍼스 grep 상 이 신규 파일 페어 밖에서 재사용되지 않아 기존 사용처와
충돌하지 않으며, 새 파일 경로도 같은 디렉토리의 기존 `<name>-guard.ts`/`<name>.spec.ts` 명명
컨벤션을 그대로 따른다. 가드가 참조하는 기존 상수(`TRIGGER_SECRET_COLUMNS`,
`TRIGGER_RESPONSE_STRIP_COLUMNS`)도 spec 문서의 기존 인용과 의미가 일치한다. 신규 식별자
충돌 관점에서 발견사항 없음.

## 위험도

NONE
