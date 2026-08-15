# API 계약(API Contract) 리뷰 — EIA `durationMs` DB=wire 불변식 닫기

## 검토 범위 요약

이 PR 은 External Interaction API(EIA) 의 "DB 와 wire 가 같은 값을 말한다" 불변식을 닫는
작업이다. API 계약 표면에 실질적으로 닿는 변경은 셋:

1. `finalizeCancelledExecution` — guarded UPDATE 가 0행(동시 writer 선점)이면 `EXECUTION_CANCELLED`
   webhook/SSE/WS emit 을 skip (종전엔 무조건 emit) — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
2. `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기 — `.returning(['duration_ms', 'finished_at'])`
   추가로 emit 값을 DB 영속값과 일치시킴
3. `ExecutionStatusDto.durationMs` 신규 필드 — `GET /api/external/executions/:id` 응답에 추가(additive)

## 발견사항

- **[INFO]** `execution.cancelled` push 이벤트가 특정 레이스에서 더 이상 발행되지 않는 동작 변경 (계약상 정상화, 하위호환 영향 미미)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4891-4902` (`finalizeCancelledExecution`)
  - 상세: 종전에는 guarded UPDATE(`status IN (non-terminal)`)가 0행이어도 `EXECUTION_CANCELLED` 를
    무조건 발행했다. 이번 변경은 `persisted` 를 확인해 `false` 면 emit 을 skip 하고 서버 로그만
    남긴다. 이는 "DB 에 쓰이지 않은 종결 이벤트"를 막는 정합성 수정이지만, webhook/SSE/WS 를
    구독하는 외부 클라이언트 관점에서는 **관측 가능한 이벤트 스트림의 동작이 바뀐다** — 동시
    writer 가 이미 다른 terminal 상태로 선점한 극히 드문 레이스에서, 종전에 오던
    `execution.cancelled` 알림이 이제는 오지 않는다(대신 그 선점한 writer 의 이벤트만 온다).
    `CHANGELOG.md` 에 "수신자 영향" 절로 명시적으로 고지돼 있고, `GET /api/external/executions/:id`
    로 재조회하면 실제 최종 status 를 여전히 확인할 수 있어 데이터 유실은 아니다.
  - 제안: 조치 불요 — 이미 CHANGELOG 에 수신자 영향이 문서화됨. 다만 EIA spec 의 webhook 재전송/신뢰성
    절(§6 인근)에도 "동시 선점 시 해당 종결 이벤트는 발행되지 않을 수 있다"는 캐비엇을 한 줄
    추가하면 외부 API 소비자용 공식 계약 문서(CHANGELOG 는 내부 개발 로그에 가까움)에도 같은 사실이
    반영되어 완결성이 높아진다.

- **[INFO]** `durationMs` 신규 필드는 additive·nullable 로 올바르게 설계됨 (하위 호환 유지)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-130`
  - 상세: `@ApiPropertyOptional({ nullable: true })` + `durationMs?: number | null` 형태로, 기존
    `currentNode`/`result`/`error` 필드와 동일한 "종결 전 null, 키는 present" 관례(API 규약 §5.4)를
    따른다. 기존 클라이언트는 필드를 무시하면 되고 신규 파서만 값을 읽으면 되므로 breaking change
    가 아니다. `STATUS_PROJECTION_COLUMNS`(`interaction.service.ts:78`)에도 함께 추가되어 정확집합
    가드와 스키마가 어긋나지 않는다.
  - 제안: 조치 불요 (모범 사례).

- **[INFO]** `durationMs` 의 의미가 종결 경로에 따라 달라짐 (실행 시간 vs 대기 경과 시간) — 이미 문서화됨
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:116-122`
    (JSDoc + `@ApiPropertyOptional description`)
  - 상세: 취소·타임아웃 종결 경로에서는 `durationMs` 가 실제 실행 소요 시간이 아니라 "대기 경과
    시간"을 의미한다는 캐비엇이 DTO JSDoc·Swagger description·spec §6.5 세 곳에 일관되게 명시돼
    있다. 같은 필드명이 상태에 따라 다른 의미를 가지는 것은 API 응답 스키마 설계 관점에서 이상적이지는
    않지만(별도 필드로 분리하는 편이 더 명확), 이번 PR 이 처음 도입한 결정이 아니라 직전 PR(#1171)이
    세운 계약을 그대로 확장한 것이고, 캐비엇이 문서·코드 주석·OpenAPI description 세 곳 모두에
    일관되게 실려 있어 계약 자체는 명확하다.
  - 제안: 조치 불요 (참고용) — 추후 필드 분리(`elapsedMs` 등) 논의가 나오면 이 노트를 참고.

- **[INFO]** 요청 검증·URL 경로·페이지네이션·인증/인가 표면에는 변경 없음
  - 상세: 이번 diff 는 응답 DTO 필드 추가와 내부 이벤트 발행 로직 정합화에 국한된다. 신규 엔드포인트,
    경로 변경, 쿼리 파라미터, 페이지네이션, 인증/인가 가드 변경은 없다.

## 요약

이 PR 은 API 계약 관점에서 위험이 낮다. REST 응답 필드 추가(`durationMs`)는 nullable·optional 로
설계되어 완전히 하위 호환이며 기존 "부재 표현" 규약(§5.4)을 정확히 따른다. 더 미묘한 변경은
`finalizeCancelledExecution` 이 guarded UPDATE 의 반환값을 확인해 DB 에 실제로 반영되지 않은
`EXECUTION_CANCELLED` 이벤트의 오발행을 막는 것인데, 이는 잘못된 이벤트를 보내지 않게 하는
정합성 수정으로 CHANGELOG 에 수신자 영향까지 명시돼 있어 계약 위반이 아니라 오히려 계약을
바로잡는 변경이다. `retry-turn.service.ts` 의 `.returning()` 추가도 같은 성격(DB=wire 값 일치)의
내부 정합화이며 REST/webhook 스키마 자체는 바뀌지 않는다. Breaking change, 버전 관리 이슈,
에러 응답 형식·상태 코드 문제, 요청 검증 미비, URL/경로 설계 위반, 페이지네이션 문제, 인증/인가
누락은 발견되지 않았다.

## 위험도

LOW
