# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

target 은 `spec/data-flow/` 스코프의 impl-done 검토이나, `origin/main...HEAD` diff 를 실측한 결과
실제 변경분은 두 코드 파일뿐이다 (`spec/data-flow/15-external-interaction.md` 자체는 diff 에 없음 —
번들에 포함된 나머지 `spec/data-flow/*.md` 전부는 관련 컨텍스트로만 첨부된 것으로 확인):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `CHANGELOG.md` (Unreleased 항목 2건 추가, ID 없는 서술형 제목)

변경 내용은 `IdempotencyInterceptor` 의 캐시 손상(엔트리/embedded payload) 방어를 보강하는
리팩터로, 새 API endpoint·엔티티·이벤트·ENV var·spec 파일은 도입하지 않는다. 따라서 신규
식별자 충돌 표면은 diff 가 module-private 로 새로 추가한 함수/상수/필드로 한정된다.

## 신규 식별자 인벤토리 및 충돌 검사

diff 가 `idempotency.interceptor.ts` 에 새로 도입한 식별자를 저장소 전체(`codebase/`, `spec/`)에서
`git grep` 으로 재검색해 다른 의미의 기존 사용처가 있는지 확인했다 (worktree HEAD 기준):

| 신규 식별자 | 종류 | 기존 사용처 재검색 결과 |
| --- | --- | --- |
| `MIN_HTTP_STATUS_CODE` / `MAX_HTTP_STATUS_CODE` | module-scope `const` | 해당 파일에만 존재. 다른 모듈에 동명 상수 없음 |
| `isIdempotencyEntry()` | module-private type guard | 해당 파일에만 존재 |
| `isHttpStatusCode()` | module-private type guard | 해당 파일에만 존재. 유사 목적 함수로 `execution-failure-classifier.ts` 의 `extractStatusCode()` 가 있으나 이름·역할이 달라 충돌 아님 |
| `describeShape()` | module-private helper | 해당 파일에만 존재 |
| `discardCorruptEntry()` | private 인스턴스 메서드 (`IdempotencyInterceptor`) | 해당 클래스에만 존재. 다른 인터셉터/서비스에 동명 메서드 없음 |
| 로그 문자열 `cache 엔트리 손상 …` / `cache payload 손상` | 로그 메시지 | 저장소 내 다른 곳에서 재사용되지 않음 |

모든 신규 식별자가 파일 스코프(`function`) 또는 클래스 `private` 로 캡슐화돼 있어 export 되지
않으며, 다른 모듈에서 import 해 쓸 수 없는 구조다 — 네임스페이스 충돌 가능성이 구조적으로
낮다.

## 그 외 충돌 관점 점검

- **요구사항 ID**: diff 는 기존 `Spec EIA §R8`(캐시 키 스코프) 를 참조만 하며 새 ID(§R11 등)를
  부여하지 않는다. `CHANGELOG.md` 의 두 Unreleased 항목도 번호 없는 서술형 제목 — 기존 컨벤션과
  일치, ID 충돌 없음.
- **엔티티/DTO/인터페이스명**: `IdempotencyEntry` 인터페이스는 기존 정의를 그대로 사용(diff 에서
  필드 변경 없음). 새 인터페이스 도입 없음.
- **API endpoint**: 컨트롤러/라우트 변경 없음 — 인터셉터 내부 로직만 수정.
- **이벤트/메시지명**: webhook·큐·SSE 이벤트 이름 변경/추가 없음.
- **환경변수·설정키**: `process.env` 참조 추가 없음(grep 결과 0건).
- **파일 경로**: 두 파일 모두 기존 경로를 수정한 것이며 신규 파일·이름 변경 없음.

## 발견사항

없음 — 위 인벤토리 전 항목이 기존 사용처와 겹치지 않는다.

## 요약

이번 target 은 `IdempotencyInterceptor` 의 캐시 손상 방어를 보강하는 순수 내부 리팩터로, 새로
도입된 식별자(`isIdempotencyEntry`·`isHttpStatusCode`·`describeShape`·`discardCorruptEntry`·
`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`)는 전부 해당 파일/클래스에 스코프가 갇혀 있고
저장소 전체 재검색 결과 다른 의미로 이미 쓰이는 곳이 없다. 새 요구사항 ID·엔티티·API
endpoint·이벤트명·ENV var·spec 파일 경로도 도입되지 않아 신규 식별자 충돌 관점에서 지적할
사항이 없다.

## 위험도

NONE
