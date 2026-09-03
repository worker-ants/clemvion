# 변경 범위(Scope) 리뷰 — entity nullable 타입 정합 배치 2

대상 커밋: `63d9e87b8` (`refactor(entity): 배치 2 — 한 파일 안에서 같은 조건인데 다르게 선언된 30필드`)
대상 파일 11개 — `execution.entity.ts` · `knowledge-base.entity.ts` · `node-execution.entity.ts` ·
`node.entity.ts` · `notification.entity.ts` · `schedule.entity.ts` · `trigger.entity.ts` ·
`user.entity.ts` · `workflow.entity.ts` · `redact-stored-error.ts` · `plan/in-progress/entity-nullable-column-type-mismatch.md`.

## 방법

`git show --stat 63d9e87b8` 로 실제 커밋의 파일 목록·라인 증감을 프롬프트의 diff 와 대조했다.
저장소 트리는 건드리지 않았다(`git status --short` 로 작업 전후 clean 확인, untracked
`review/code/2026/09/03/16_45_35/` 만 존재). Prettier 설정(`.prettierrc`, printWidth 기본 80)을
읽어 재포맷 라인들이 실제로 80자를 넘는지 계산해 대조했다.

## 발견사항

### INFO — 변경 범위가 plan 문서의 선언된 기준과 정확히 일치한다

- 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` (배치 2 섹션, "넓힌 필드 30
  (column 24 · relation 6)")
- 상세: 이 PR 은 별도 plan (`entity-nullable-column-type-mismatch.md`) 이 이미 "배치 2" 로
  선언해 둔 기계적 기준("한 엔티티 파일 안에 `nullable: true` 인데 일부는 넓혀지고 일부는 안
  넓혀진 것", 9파일 30필드)의 집행이다. 커밋 diff 의 실제 필드 변경 수를 세면:
  execution 10 · knowledge-base 1 · node-execution 5 · node 3 · notification 3 · schedule 1 ·
  trigger 2 · user 3 · workflow 2 = **정확히 30**, 파일 수도 정확히 9(entity) + fallout 1
  (`redact-stored-error.ts`) + plan 문서 1 = 11 로 프롬프트의 "리뷰 대상 파일" 목록과 완전히
  일치한다. `git show --stat` 결과도 diff 와 파일 집합·증감 라인 수가 동일해 별도로 스테이징된
  숨은 변경은 없다.
- 제안: 없음(정보성) — scope 판정의 근거로만 기록.

### INFO — `type:` 추가 여부가 문서화된 예외 규칙과 자기일관적이다

- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:36`
  (`triggerId`), `:84`(`executedBy`), `:91`(`parentExecutionId`) — `@JoinColumn` 이 동일 컬럼명을
  참조하는 관계가 있어 `type:` 을 추가하지 않은 세 자리.
- 상세: plan 이 "관계가 타입을 공급하는 컬럼 — `@JoinColumn({ name })` 과 컬럼명이 정확히 일치할
  때만 면제" 라는 규칙을 배치 1 에서 명시했는데, 배치 2 에서도 이 규칙이 정확히 지켜졌다.
  `triggerId`↔`trigger`(`trigger_id`), `executedBy`↔`executor`(`executed_by`),
  `parentExecutionId`↔`parentExecution`(`parent_execution_id`) 모두 `@JoinColumn` 명이 일치해
  `type:` 미부여가 정당하다. 반대로 `durationMs`(execution/node-execution), `resourceType`
  (notification), `endpointPath`(trigger), `avatarUrl`/`oauthProvider`/`oauthProviderId`(user)
  는 상응하는 relation 이 없어 `type:` 이 새로 추가됐다 — 규칙과 실제 변경이 전 필드에서
  일관된다.
- 제안: 없음(정보성).

### INFO — 멀티라인 재포맷은 Prettier printWidth(80, `.prettierrc` 확인) 초과에 의한 기계적 결과

- 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts` `resourceType`
  컬럼, `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` `endpointPath` 컬럼,
  `codebase/backend/src/modules/users/entities/user.entity.ts` `oauthProvider`/`oauthProviderId`
  컬럼.
- 상세: 이 네 자리만 한 줄에서 여러 줄로 재포맷됐고, 나머지(`avatarUrl` 등)는 한 줄로 유지됐다.
  `type: 'varchar'` 추가 후 각 줄 길이를 직접 계산하면 재포맷된 네 자리는 81~86자로 기본
  printWidth(80, 저장소 `.prettierrc` 에 override 없음)를 넘고, 한 줄로 유지된 `avatarUrl` 은
  79자로 넘지 않는다 — 재포맷이 임의 drive-by 가 아니라 `type:` 추가의 불가피한 부산물임을
  실측으로 확인했다. 실질 변경(널러블 타입 확장)과 무관한 포맷팅 변경은 없다.
- 제안: 없음(정보성).

### INFO — `redact-stored-error.ts` 의 docstring 정정·시그니처 확장은 이번 배치의 필연적 fallout

- 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` `maskIfPresent` 함수,
  `redactNodeExecutionRowForResponse` 제네릭 제약.
- 상세: `NodeExecution.inputData`/`outputData`/`error` 를 `| null` 로 넓히자 이 파일의 docstring 이
  스스로 명시했던 전제("엔티티가 두 컬럼을 non-null 로 선언하므로 정적으로는 null 이 올 수
  없다")가 깨졌고 `tsc` 가 실제로 2건을 잡았다(커밋 메시지에 실측 기재). 원문을 취소선으로
  **보존**한 채 정정문을 날짜·측정과 함께 추가했고, 시그니처 확장은 그 2건의 컴파일 오류를
  해소하는 데 필요한 최소 범위(`maskIfPresent` 파라미터/반환 타입, 제네릭 제약 3필드)로
  국한된다 — 관련 없는 다른 함수·로직은 손대지 않았다.
- 제안: 없음(정보성) — 다만 이 파일은 `spec/` 이 아니라 `codebase/` 코드 주석이므로
  "자기-반증형 소정정"(spec 전용 예외) 절차 대상은 아니고, `developer` 의 통상 `codebase/**`
  쓰기 권한 범위 내 정정이다.

### INFO — plan 문서 체크박스·본문 갱신이 실제 완료 상태와 일치

- 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` 신규 "## 배치 2 — 비대칭 해소
  (완료)" 섹션, 체크리스트 `- [x] 배치 2 기준`, `- [x] (d) Schedule.lastRunAt`.
- 상세: 체크된 두 항목은 실제로 이번 커밋에서 완료된 작업(9파일 30필드, `Schedule.lastRunAt`
  포함)과 일치하고, 아직 안 끝난 "배치 3 기준"·"공용 walker 추출" 항목은 체크되지 않은 채
  남아 있다. 문서 갱신이 코드 변경과 분리된 별도 관심사(스코프 이탈)가 아니라 이 배치 자체를
  기록하는 필수 문서화다.
- 제안: 없음(정보성).

## 발견되지 않은 것

- 요청 범위(9엔티티 파일의 "파일 내 비대칭" 필드 30개 + 그로 인한 컴파일 fallout)를 벗어난
  추가 수정, 무관한 리팩토링, 기능 확장, 무관한 파일·설정 변경은 발견되지 않았다.
- import 변경, 실질 변경과 섞인 무의미한 포맷팅, 불필요한 주석 추가/삭제는 없다 — 유일한 주석
  변경(`redact-stored-error.ts`)은 이번 타입 확장이 스스로 무너뜨린 전제의 정정으로, 원문
  보존 방식이라 오히려 모범적이다.

## 요약

이 PR 은 별도로 이미 문서화된 plan(`entity-nullable-column-type-mismatch.md`)의 "배치 2"를
그대로 집행한 것으로, 선언된 기준(파일 내 비대칭 nullable 필드)·측정치(9파일·30필드)·`type:`
부여 예외 규칙(관계가 타입을 공급하는 컬럼)이 실제 diff 와 필드 단위로 완전히 일치한다.
`git show --stat` 대조 결과 프롬프트에 없는 숨은 변경도 없고, 유일한 "부수" 변경인
`redact-stored-error.ts` 의 시그니처/문서 정정도 이번 타입 확장이 직접 깨뜨린 컴파일 전제를
고치는 필연적 fallout으로 범위 내다. 재포맷된 네 컬럼도 Prettier printWidth 초과라는 기계적
사유로 전부 설명된다. 범위 이탈·과잉엔지니어링·무관 수정의 징후를 찾지 못했다.

## 위험도

NONE
