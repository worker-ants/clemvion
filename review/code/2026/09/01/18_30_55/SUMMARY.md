# Code Review 통합 보고서

## 전체 위험도
**LOW** — `origin/main...HEAD` 3커밋 누적 diff(원 수정 + 1R/2R fix)의 3라운드째 독립 재검토. 8개
reviewer(강제 7명 + 라우터 선택 1명) 전원이 결과를 남겼고 forced 화이트리스트 미이행 없음. 이번
라운드에서 신규 CRITICAL/WARNING 급 발견은 **0건**이다. 모든 reviewer 가 1·2라운드가 지적한
WARNING(JSDoc 오귀속, 관측 로그 미검증, plan 트래커 수치 불일치, CHANGELOG 누락)을 **소스 직접
재대조 + 2건의 독립 뮤테이션 재현**으로 실제 해소됨을 확인했다. 잔여는 전부 기존에 이미 우선순위
판단이 끝난 INFO 백로그의 재확인이며, 유일하게 이번 라운드가 새로 구체화한 관찰(concurrency)도
기능 영향 없는 진단 로그 정확도 수준이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency (신규 관찰) | `markNodeCancelled` catch 의 진단 로그가 내부 `save()`/`emitNode()` 두 순차 await 중 어느 쪽이 실패했는지 구분하지 않는다 — `save()` 성공·`emitNode()` 만 실패한 경우에도 "짝 row 가 non-terminal 로 잔류할 수 있다"는 문구를 남겨, 실제로는 이미 CANCELLED(terminal) 로 커밋된 상태를 오도할 수 있다. 기능적 정합성(취소 분류 유지)에는 영향 없음 | `ai-turn-orchestrator.service.ts:409-436`, `execution-engine.service.ts:4834-4863` | 조치 불요(급하지 않음). 필요 시 `save()`/`emitNode()` 를 별도 try 로 나눠 진단 문구를 세분화 |
| 2 | side_effect / concurrency (재확인) | `markNodeCancelled` reject 를 흡수해 항상 `ExecutionCancelledError` 로 재분류 → BullMQ 재시도를 통한 자가 치유 경로 상실. plan(C-4)이 이미 인지·수용한 트레이드오프, 신규 아님 | `ai-turn-orchestrator.service.ts:409-436` | 조치 불요(문서화된 의도). 배포 후 stalled-job recovery 가 잔류 non-terminal 짝 row 를 커버하는지 관측 권장 |
| 3 | security (재확인, 3회째) | `markNodeCancelled` reject 시 원본 예외 메시지를 서버 로그에 그대로 삽입. 클라이언트 노출 없음, 로그 싱크 접근 통제 전제 | `ai-turn-orchestrator.service.ts:430-435` | 조치 불요 |
| 4 | maintainability / testing (재확인) | `retry-turn.service.spec.ts` 신규 테스트 2건이 "`NOT_CALLED` sentinel + `updateExecutionStatus` mockImplementation" 10줄 블록을 문자 그대로 복제. W6 테스트 위생 백로그에 이미 등재 | `retry-turn.service.spec.ts:982-996`, `:1054-1068` | 조치 불요(우선순위 판단 완료). W6 정리 시점에 로컬 헬퍼(`captureErrorAtCompletion`) 추출 고려 |
| 5 | maintainability (재확인) | `markSpawnedRowFailed` 가 인접한 두 `string` 매개변수(`logContext`, `errorMessage`)를 받아 순서 실수를 타입 시스템이 못 잡음. 현재 호출부 2곳은 순서 정상 | `retry-turn.service.ts:724-728` | 급하지 않음. 호출부 증가 시 객체 인자 전환 고려 |
| 6 | maintainability (재확인) | `ResponseExecution` 의 `error` 필드가 엔티티 타입 정정(`| null`) 이후 `Omit`/재선언 대상에서 빠져도 되는데 유지 중. JSDoc 이 스스로 인지, 의도적 유지 | `executions.service.ts:95-104` | 급하지 않음. `inputData`/`outputData` nullable 정정 시 함께 정리 고려 |
| 7 | testing (재확인) | `execution-engine.service.spec.ts` 의 신규 `warnSpy` 가 명시적으로 `mockRestore()` 되지 않음. `service`/`logger` 가 매 테스트 재생성돼 실질 누출은 없음 | `execution-engine.service.spec.ts:3791-3797` | 급하지 않음. `warnSpy.mockRestore()` 한 줄 추가 |
| 8 | testing (사소, 신규 관찰이나 조치 불요) | `assertLinkedTransitionApplied` catch 의 로그 단언이 `nodeExec.id`·에러 메시지·`phase` 는 검증하나 `markNodeCancelled` 의 정확한 reject 시점(실행 순서)은 단언하지 않음 | `ai-turn-orchestrator.service.spec.ts:302-316` | 조치 불요 |
| 9 | scope / documentation (재확인) | `retry-turn-terminal-guard.md`(표 6행=미체크 6건, 취소선 처리 행 포함 시 7행처럼 보임)와 `ie-resume-turn-boundary-cancel.md`(표 7행이 "남긴 10건"을 카테고리별로 묶어 서술) — 둘 다 사실관계 오류는 아니나 표 형식이 서로 달라 오독 여지. 1·2라운드 모두 문제 삼지 않은 기존 스타일 | `plan/in-progress/retry-turn-terminal-guard.md`(C-4 처분 표), `plan/in-progress/ie-resume-turn-boundary-cancel.md:31-42` | 조치 불요(참고). 다음 편집 기회에 "행수=미체크 항목 수" 형식으로 통일 고려 |
| 10 | requirement (재확인) | 이번 diff 의 구현 세부(마킹 실패 흡수 정책·guarded UPDATE 반환값 로깅·성공 종결 시 `error` 클리어)를 규정하는 spec 본문 없음(회색지대). `Execution.error` nullable 정정은 오히려 spec/DB 와의 기존 불일치를 해소하는 방향 | `spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md`, `spec/1-data-model.md:474,562` | 없음 — spec 반영 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 내부 예외 메시지 로그 삽입(기존 패턴) 외 SQL 인젝션·시크릿·인증/인가·egress 이상 없음. `error=null` 명시 세팅은 오히려 스테일 에러 노출을 닫는 개선 |
| requirement | LOW | spec 회색지대 확인(문제 없음), 1·2R WARNING 6건 전건 해소를 line-level 로 재확인 |
| scope | NONE | 3라운드 코드 변경(3파일 11줄)이 직전 SUMMARY 처방과 1:1 대응, 스코프 이탈 없음 |
| side_effect | LOW | `Execution.error` 타입 확장 안전성을 21개 파일까지 넓혀 재확인, 신규 결함 없음. 저장소 뮤테이션 잔존물 없음 확인 |
| maintainability | NONE | W1(JSDoc 오귀속) 해소 소스 재확인. 잔여 INFO 3건은 기존 백로그(mock 중복·매개변수 순서·Omit 중복) |
| testing | NONE | 뮤테이션 2건(prepareSuccessTermination `error=null` 제거, `phase` 보간 치환)으로 1·2R WARNING 해소를 처음 실측 재현(RED 확인). 3 suites/595 tests GREEN |
| documentation | NONE | WARNING 3건(JSDoc 오귀속·CHANGELOG 누락·plan 수치 불일치) 해소를 소스 직접 재대조로 확인 |
| concurrency | LOW | 기존 방어기전(FOR UPDATE·guarded CAS·jsonb_exists·COALESCE) 전부 보존. save/emit 미분리로 인한 진단 로그 부정확 가능성 신규 관찰(INFO, 기능 영향 없음) |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 INFO(대부분 이전 라운드 조치의 재확인)를 기록했다.

## 권장 조치사항

1. (선택) `assertLinkedTransitionApplied` 의 `markNodeCancelled` catch 에서 `save()`/`emitNode()`
   실패를 구분해 진단 로그 문구 정확도를 높인다 — 기능 영향 없는 개선이라 급하지 않음.
2. (선택) W6 테스트 위생 백로그 일괄 정리 시점에 `retry-turn.service.spec.ts` 의 mock-capture
   블록(`NOT_CALLED` sentinel)을 로컬 헬퍼로 추출.
3. (선택) `execution-engine.service.spec.ts` 의 `warnSpy` 에 `mockRestore()` 추가해 형제 spy 와
   스타일 통일.
4. 그 외 즉시 조치가 필요한 항목 없음 — 이 changeset 은 push/머지 가능 상태로 판단된다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (8명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 개별 사유를 반환하지 않음(diff 가 성능 경로를 건드리지 않는다고 판단한 것으로 추정 — JSDoc/테스트/헬퍼 추출 위주 변경) |
  | architecture | 상동 — 신규 모듈·의존성 구조 변경 없음 |
  | dependency | 상동 — `package.json` 등 의존성 변경 없음 |
  | database | 상동 — 이번 changeset 은 기존 SQL/트랜잭션 구조를 변경하지 않음 (concurrency 리뷰어가 DB 관련 측면도 함께 재확인) |
  | api_contract | 상동 — 신규/변경 API 엔드포인트 없음 |
  | user_guide_sync | 상동 — 사용자 가이드 영향 없는 내부 서비스 로직 변경 |