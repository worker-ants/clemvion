# 정식 규약 준수 검토 — `spec/data-flow/` (impl-done)

## 점검 범위 요약

이번 PR 의 실제 diff 는 매우 좁다 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
(+`.spec.ts`) 의 `updateExecutionStatus` else 분기를 `dataSource.transaction` 으로 감싸고
공통 종결부 `finishStatusTransition` 을 추출한 것이 전부다. spec 변경은 두 파일뿐이다:

- `spec/5-system/4-execution-engine.md` — 기존 "원자성 보장" 블록에 각주 2개 추가(+18줄)
- `spec/data-flow/3-execution.md` — §2.1 Schema 매핑 표의 "상태 전이" 행 셀 확장(1줄 교체)

나머지 번들 문서(`2-auth.md`, `9-observability.md`, `14-chat-channel.md`,
`15-external-interaction.md`, `0-overview.md`, `1-audit.md` 등)는 이번 PR 에서 변경되지 않았다.

## 발견사항

- **[INFO]** Schema 매핑 표 헤더가 §3.3 템플릿과 다르다 (본 PR 도입 아님)
  - target 위치: `spec/data-flow/3-execution.md` §2.1 (`| Sink (table) | 흐름 | read/write 컬럼 | 인덱스 / 제약 |`)
  - 위반 규약: `spec/data-flow/0-overview.md` §3.3 "Schema 매핑 표" (data-flow 영역 공통 규약 SoT) —
    템플릿은 `| Sink | Table / Key | 갱신 컬럼 / Pattern | 인덱스 / 제약 |` 로 정의
  - 상세: 컬럼 라벨이 "Sink (table) / 흐름 / read/write 컬럼" 대 "Sink / Table·Key / 갱신 컬럼·Pattern" 로 다르다.
    다만 이번 PR 은 이 행의 **내용**(셀 텍스트)만 1줄 확장했을 뿐 헤더를 만들거나 바꾸지 않았고,
    `spec/data-flow/` 하위 다른 문서들도 대체로 동일한 "Sink (table) / 흐름 / read/write 컬럼" 헤더를
    관행적으로 써 온 것으로 보여(§3.3 이 사후에 문서화되며 표현이 갈렸을 가능성), 이번 PR 이 새로
    만든 drift 가 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 후속으로 §3.3 템플릿 문구를 실제 관행("Sink (table) / 흐름 /
    read/write 컬럼")에 맞춰 갱신하거나, 반대로 전 영역 표 헤더를 §3.3 문구로 통일하는 정리 작업을
    별도 plan 으로 추적할 만하다.

## 확인 완료 항목 (위반 없음)

- **`spec/conventions/raw-query-results.md` 준수**: diff 의 else 분기는 `manager.query()` 결과를
  여전히 `updateReturningRows<{ id: string }>(...)` 로 언랩한다 — 트랜잭션 안으로 이동했을 뿐 §1
  불변식(RETURNING 은 튜플)의 소비 경로는 그대로 유지된다. §4 집행 가드
  (`update-returning-rows.spec.ts` 의 발견형 카운트, `execution-engine.service.ts` 등록 카운트=2)
  를 스코프 실행해 확인 — GREEN (`1 passed, 22 skipped`, 카운트 변경 없음).
- **`spec/conventions/error-codes.md` 준수**: `spec/data-flow/3-execution.md` §3.1 상태-전이 표에
  나열된 코드(`EXECUTION_TIME_LIMIT_EXCEEDED`, `WORKER_HEARTBEAT_TIMEOUT`, `SERVER_INTERRUPTED`,
  `EXECUTION_QUEUE_WAIT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`)는 전부 `UPPER_SNAKE_CASE` 이며
  이번 PR 이 새 코드를 추가하지 않았다 — §1 명명 원칙 위반 없음.
- **문서 구조 (Overview/본문/Rationale)**: 두 target 파일 모두 기존 3섹션 구조를 그대로 유지한다.
  이번 PR 의 신규 서술은 새 섹션을 만들지 않고 기존 "원자성 보장" blockquote 각주 뭉치에
  동일한 날짜-각주 패턴(`> **… (2026-08-30).**`)으로 삽입돼, 문서가 이미 쓰고 있던 관행과
  형식이 일치한다.
- **명명 규약**: 신규 API endpoint·DTO·식별자 없음(내부 private 메서드 `finishStatusTransition`
  분리는 TS 코드 레벨 리팩터로 spec/conventions 명명 규율의 적용 대상이 아니다).
  API 문서(swagger) 데코레이터·DTO 변경 없음 — `spec/conventions/swagger.md` 관련 없음.
- **금지 항목**: `spec/conventions/migrations.md`(신규 마이그레이션 없음), `node-output.md`
  (노드 출력 계약 변경 없음), `node-cancellation.md`(AbortError/취소 시맨틱 변경 없음) 등
  이번 diff 가 건드리는 영역 밖의 정식 규약에 저촉되는 패턴을 도입하지 않았다.

## 요약

이번 PR 은 `updateExecutionStatus` else 분기를 트랜잭션으로 감싸는 내부 구현 수정과, 그에 상응하는
2건의 spec 각주/표 셀 갱신뿐이다. 신규 명명·출력 포맷·API 문서·금지 패턴 도입이 없고, raw SQL 결과
처리(`updateReturningRows`)·에러 코드 명명(UPPER_SNAKE_CASE)·문서 3섹션 구조 모두 기존 정식 규약을
그대로 따른다. 유일하게 눈에 띄는 항목은 `spec/data-flow/3-execution.md` §2.1 표 헤더가
`0-overview.md` §3.3 템플릿 문구와 다르다는 것인데, 이는 이번 PR 이전부터 있던 전역적 표현 drift로
보이며 이번 diff 가 새로 만든 위반이 아니다.

## 위험도

LOW
