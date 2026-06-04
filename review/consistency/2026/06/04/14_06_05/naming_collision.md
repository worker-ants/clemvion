# 신규 식별자 충돌 검토 — naming_collision

**대상**: `spec/5-system/4-execution-engine.md` (worktree: `impl-exec-concurrency-cap`)
**검토 모드**: `--impl-prep`
**검토일**: 2026-06-04

---

## 발견사항

### [WARNING] `EXECUTION_TIME_LIMIT_EXCEEDED` 와 `EXECUTION_TIMEOUT` 의 명칭 근접성

- **target 신규 식별자**: `EXECUTION_TIME_LIMIT_EXCEEDED`
- **기존 사용처**:
  - `spec/4-nodes/5-data/2-code.md` — Code 노드 스크립트 타임아웃 에러 코드로 정의
  - `spec/5-system/3-error-handling.md` — 에러 카탈로그에 `EXECUTION_TIMEOUT` 등재
  - `spec/5-system/14-external-interaction-api.md` — webhook 실패 분류에 참조
  - `spec/conventions/chat-channel-adapter.md` — 채널 어댑터 실패 분류에 참조
  - `codebase/backend/.../code.handler.ts` — 런타임 처리 코드
  - `codebase/backend/.../chat-channel/shared/execution-failure-classifier.ts` — 실패 분류 로직
  - 프론트엔드 문서 다수 (`run-results.mdx`, `data.mdx` 등 한/영 양면)
- **상세**: `EXECUTION_TIMEOUT` (Code 노드 스크립트 단위 타임아웃)과 `EXECUTION_TIME_LIMIT_EXCEEDED` (엔진 레벨 누적 활성 실행 시간 초과)는 의미가 다르다. spec 본문(`spec/5-system/3-error-handling.md` 갱신 포함)에서 명시적으로 구분하고 있으나, 두 식별자가 `EXECUTION_T*` 접두어를 공유하므로 로그 분석·에러 분류 코드 작성 시 혼동 가능성이 있다. 특히 `execution-failure-classifier.ts` 처럼 두 코드를 동시에 다루는 코드에서 `EXECUTION_TIME*` prefix 로 검색하면 두 항목이 함께 노출된다.
- **제안**: 명칭을 더 명확히 구분하거나, 코드 주석·에러 카탈로그에 "Code 노드 스크립트 타임아웃(`EXECUTION_TIMEOUT`)과 혼동 금지" 경고를 명시한다. 또는 신규 코드를 `EXECUTION_WALL_TIME_LIMIT_EXCEEDED` 또는 `EXEC_ACTIVE_TIME_EXCEEDED` 로 변경해 prefix 중복을 없앤다. 현재 spec(`3-error-handling.md`) 에 구분 설명이 이미 추가되어 있어 차단 수준은 아니다.

---

### [INFO] `§4.x` 비표준 섹션 번호 suffix

- **target 신규 식별자**: 섹션 `§4.x waiting_for_input park`
- **기존 사용처**: `spec/5-system/4-execution-engine.md` 내 `§4.1`, `§4.2`, `§4.3`, `§4.4` (정수 번호 체계)
- **상세**: 기존 `§4` 하위 섹션은 모두 정수 suffix(`§4.1`~`§4.4`)를 사용한다. 신규 섹션이 `§4.x` (문자 `x`)를 사용하면 cross-reference 시 "4.x는 무슨 번호인가" 혼동이 생기고, 자동 문서 파싱·ToC 생성 도구에서 예외 처리가 필요해질 수 있다.
- **제안**: `§4.x` → `§4.5` 로 변경하여 기존 정수 번호 체계를 유지한다.

---

## 충돌 없음 확인 항목

| 신규 식별자 | 검토 결과 |
|---|---|
| BullMQ 큐 이름 `execution-run` | 기존 spec·codebase 어디에도 사용 없음. 충돌 없음. |
| ENV `EXECUTION_RUN_WORKER_CONCURRENCY` | 기존 환경변수 목록에 없음. 충돌 없음. |
| Redis 키 `exec:run:seq:<executionId>` | 기존 Redis 키 패턴과 겹치지 않음. 충돌 없음. |
| 클래스 `ExecutionRunProcessor` | 기존 코드베이스에 없음. 충돌 없음. |
| 메서드 `runExecutionFromQueue` | 기존 코드베이스에 없음. 충돌 없음. |
| 함수 `resolveExecutionRunWorkerConcurrency` | 기존 코드베이스에 없음. 충돌 없음. |
| API endpoint 변경 | 신규 endpoint 없음. 충돌 검토 대상 없음. |
| 이벤트/메시지명 변경 | 신규 이벤트명 없음. 충돌 검토 대상 없음. |

---

## 요약

`spec/5-system/4-execution-engine.md` 가 도입하는 신규 식별자 중 CRITICAL 충돌은 없다. 가장 주의할 점은 `EXECUTION_TIME_LIMIT_EXCEEDED` (신규, 엔진 누적 시간 초과)가 기존에 광범위하게 사용 중인 `EXECUTION_TIMEOUT` (Code 노드 스크립트 타임아웃)과 `EXECUTION_T*` 접두어를 공유한다는 점이다. 두 코드의 의미 차이는 spec 갱신(`3-error-handling.md`)에서 명시되어 있어 즉각적 차단 사유는 아니나, 구현 시 분류 로직(`execution-failure-classifier.ts` 등)에서 양자를 명시적으로 구분하는 주의가 필요하다. 섹션 번호 `§4.x`는 일관성 보완 차원에서 `§4.5`로 정정을 권장한다. 나머지 신규 식별자(`execution-run`, `EXECUTION_RUN_WORKER_CONCURRENCY`, `exec:run:seq:*`, `ExecutionRunProcessor` 등)는 기존 사용처와 충돌하지 않는다.

---

## 위험도

LOW
