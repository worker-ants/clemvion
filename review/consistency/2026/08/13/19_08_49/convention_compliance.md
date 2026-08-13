# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, target=`spec/5-system/`, diff-base=`origin/main`.
- `git diff origin/main...HEAD -- spec/5-system/` → **0줄** (이번 PR 은 `spec/5-system/` 를
  전혀 건드리지 않았다). 따라서 "target 문서가 정식 규약을 따르는가" 를 (a) 이번 PR 이 실제로
  변경한 코드가 `spec/5-system/` 가 정의한 명명·출력 포맷·API 문서 규약을 새로 위반하는지,
  (b) 코드 변경이 참조하는 spec 절(§7.1/§8/§9.3/§EIA§6)이 여전히 규약과 정합적인지 두 축으로
  실측했다.
- 실제 코드 diff(`git diff origin/main...HEAD -- codebase/backend/**`) 확인 결과, 이번 PR 은
  `assertRowArray` (raw SQL `.query()` 반환 shape 런타임 가드)를 execution-engine·executions
  두 서비스 4개 지점에 부착하는 내부 하드닝이다 — 신규 API 엔드포인트·DTO·에러 코드·이벤트
  페이로드·파일/식별자 명명 변경 없음.
- 대조한 정식 규약: `spec/conventions/error-codes.md`(에러 코드 명명), `spec/conventions/swagger.md`
  (DTO/컨트롤러 데코레이터 패턴), `spec/5-system/4-execution-engine.md` §9.3(BullMQ 큐/DLQ 서술과
  코드 주석의 정합성), 파일 구조 관례(`common/utils/` 기존 명명 패턴).

## 발견사항

없음 — 이번 diff 범위에서 정식 규약 위반을 발견하지 못했다.

세부 근거:

1. **명명 규약** — `assert-row-array.ts` / `assertRowArray()` 는 같은 디렉터리의 기존
   `assertCorsOriginsConfigured` (`common/utils/cors-origins.ts`)와 동형의 `assert*` TS
   narrowing 함수 패턴이며, 파일명도 접미어 없는 kebab-case(`cors-origins.ts`,
   `process-in-batches.ts`, `with-timeout.ts`)로 기존 다수 파일과 일치한다. `SNAPSHOT_CACHE_MAX_ENTRIES`
   를 `export const` 로 변경한 것은 테스트 노출용 상수 export 이며 명명 규약 위반 없음.
2. **출력 포맷 규약** — 이번 diff 는 HTTP 응답 봉투·이벤트 페이로드·에러 코드(`error.code`)
   문자열을 발행하지 않는다. `assertRowArray` 가 던지는 `Error` 는 (i) admission gate 는
   DB 트랜잭션 콜백 내부, (ii) `computeChainDepth`/`lockNonTerminalExecutionRow` 는 BullMQ
   job 처리 경로 또는 raw SQL 헬퍼로, 어느 경로도 `GlobalExceptionFilter` 가 만드는 HTTP
   에러 envelope(`3-error-handling.md §2.1`)에 `error.code` 값으로 노출되지 않는다. 따라서
   `error-codes.md` §1 "의미 기반 명명"·`UPPER_SNAKE_CASE` 표기 규율의 적용 범위(클라이언트에
   노출되는 코드 값) 밖이며 위반이 아니다.
3. **문서 구조 규약** — `spec/5-system/` 은 이번 PR 에서 변경되지 않았다. 표본 점검한
   `4-execution-engine.md`·`13-replay-rerun.md`·`14-external-interaction-api.md` 는 모두
   frontmatter(`id/status/code`) + `## Overview` + 본문 + `## Rationale` 3섹션 구조를 유지하고
   있다. 코드 주석이 인용하는 `4-execution-engine.md §9.3`("DLQ 모니터")도 실제 §9.3 "BullMQ
   큐 목록 → Dead-letter 모니터링" 절과 일치해 인용 오류 없음.
4. **API 문서 규약** — 이번 diff 는 컨트롤러·DTO 를 건드리지 않아 `swagger.md` 의 데코레이터/DTO
   명명 패턴이 적용될 표면이 없다.
5. **금지 항목** — `spec/conventions/` 가 명시적으로 금지한 패턴(예: swagger.md §6 "빈 껍데기
   스키마", node-output.md 위반 등)에 해당하는 신규 코드가 없다.

## 요약

이번 `--impl-done` 대상 diff 는 `spec/5-system/` 문서 자체를 변경하지 않았고, 실제 코드 변경도
raw SQL `.query()` 반환 shape 를 검증하는 내부 방어 로직(`assertRowArray`) 부착에 한정된다.
이 로직은 HTTP 응답 봉투·이벤트 페이로드·에러 코드·API 데코레이터 등 `spec/conventions/` 가
규율하는 어떤 외부 표면도 새로 만들지 않으며, 명명 패턴은 기존 `common/utils/` 관례와 일치한다.
코드 주석이 인용하는 spec 절(§9.3 DLQ 모니터 등)도 실측 대조 결과 정확했다. 정식 규약 준수
관점에서 이번 변경분에 대해 지적할 위반 사항이 없다.

## 위험도
NONE
