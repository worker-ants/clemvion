# API 계약(API Contract) 리뷰 — EIA `durationMs` DB=wire 불변식 닫기 (3차 리뷰)

## 검토 범위 요약

이 PR 이 API 계약 표면에 실질적으로 닿는 변경은 이전 두 라운드(`13_58_27`, `14_47_14`)와 동일하게
셋이다.

1. `finalizeCancelledExecution`(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)
   — guarded UPDATE 가 0행(동시 writer 선점)이면 재조회 후 `CANCELLED` 일 때만
   `EXECUTION_CANCELLED` webhook/SSE/WS emit.
2. `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기 — `.returning(['duration_ms',
   'finished_at'])` 로 실제 persist 값을 되읽어 emit.
3. `ExecutionStatusDto.durationMs` 신규 필드 — `GET /api/external/executions/:id` 응답에 추가
   (additive).

`codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`,
`interaction.service.ts` 의 현재 파일 상태를 직접 `Read`/`grep` 으로 대조해 diff 내용과 실제 코드가
일치함을 확인했다. `durationMs` 필드명은 REST DTO 와 `execution-engine.service.ts` 의 모든
webhook/SSE/WS emit 지점(`emitCancellationEvent`, completed/failed 경로 등)에서 동일하게
사용되어 push/pull 표면 간 네이밍 불일치는 없다.

## 발견사항

- **[INFO]** REST 신규 필드 `durationMs` — additive·nullable, 하위 호환 유지 (모범 사례)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`ExecutionStatusDto.durationMs`, `@ApiPropertyOptional({ nullable: true })`)
  - 상세: `execution.durationMs ?? null` 로 키를 항상 채워 응답하되(`interaction.service.ts` `getStatus`),
    DTO 는 `@ApiPropertyOptional`(optional)+`nullable: true` 로 선언한다. "종결 전 null, 키는 항상
    present" 라는 §5.4 부재 표현 규약을 기존 `currentNode`/`result`/`error` 필드와 동일하게 따른다.
    기존 클라이언트는 필드를 무시하면 되므로 breaking change 가 아니고, `STATUS_PROJECTION_COLUMNS`
    에도 함께 추가돼 select 목록과 응답 스키마가 어긋나지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `execution.cancelled` push 이벤트가 특정 레이스에서 더 이상 발행되지 않는 동작 변경 — 계약 정합화이며 CHANGELOG 에 명시 고지됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`finalizeCancelledExecution`, `if (!persisted) { ... }` 블록)
  - 상세: 종전에는 guarded UPDATE(`status IN (non-terminal)`)가 0행이어도 `EXECUTION_CANCELLED` 를
    무조건 발행했다(DB 는 FAILED 인데 wire 는 cancelled — EIA §6 종결 계약 위반). 이번 변경은
    `persisted` 가 `false` 면 재조회해 `CANCELLED` 일 때만 발행한다. 동시 writer 가 이미 다른
    terminal 상태로 선점한 레이스에서, 종전엔 오던 `execution.cancelled` 알림이 이제는 오지 않지만
    대신 그 선점한 writer(`finalizeFailedExecution` 등)의 자기 이벤트가 이미 나가므로 **정확히
    하나의 종결 이벤트**가 DB 상태와 일치해 나간다 — 이벤트 유실이 아니라 오발행 제거다.
    `CHANGELOG.md` "수신자 영향" 절에 명시됐고, `GET /api/external/executions/:id` 재조회로도 실제
    상태를 확인할 수 있다. 코드는 이전 두 라운드 검토 시점과 동일하며 새로 도입된 변경이 아니다.
  - 제안: 조치 불요. (선택, 필수 아님) EIA spec 의 webhook 재전송/신뢰성 절에도 "동시 선점 시 해당
    종결 이벤트는 발행되지 않을 수 있다"는 한 줄을 추가하면 CHANGELOG(내부 개발 로그) 외에 외부 API
    소비자용 공식 계약 문서(`spec/5-system/14-external-interaction-api.md`)에도 같은 사실이
    반영되어 완결성이 높아진다 — 이전 두 라운드에서 이미 동일하게 제안됐고 지금도 미반영 상태지만,
    CHANGELOG·§6.5·plan 세 곳에 이미 같은 사실이 실려 있어 차단 사유는 아니다.

- **[INFO]** `durationMs` 값의 의미가 종결 경로에 따라 달라짐(실행 시간 vs 대기 경과 시간) — 문서 3곳 일관
  - 위치: `execution-status-response.dto.ts` JSDoc/`@ApiPropertyOptional description`,
    `spec/5-system/14-external-interaction-api.md` §5.3 예시(`"durationMs": 4242 | null` 행)와
    §6.5 캐비엇
  - 상세: 취소·타임아웃 종결 경로에서는 `durationMs` 가 실행 소요 시간이 아니라 "대기 경과 시간"을
    의미한다는 캐비엇이 DTO JSDoc·Swagger description·spec §6.5 세 곳에 문구까지 일치한다. 같은
    필드명이 상태에 따라 의미가 갈리는 것은 스키마 설계 관점에서 이상적이지 않지만(별도 필드 분리가
    더 명확), 이번 PR 이 새로 도입한 결정이 아니라 직전 PR(#1171)이 세운 계약을 REST 표면으로
    확장한 것뿐이고 캐비엇이 일관되게 문서화돼 계약 자체는 명확하다.
  - 제안: 조치 불요 (참고용).

- **[INFO]** EIA-IN-04 요구사항 필드 목록·spec §5.3 JSON 예시가 실제 구현과 1:1 대응
  - 위치: `spec/5-system/14-external-interaction-api.md` §3.2 EIA-IN-04 행, §5.3 예시
  - 상세: `(status / currentNode / context / result|error / durationMs / seq / updatedAt)` 로
    `durationMs` 가 요구사항 정의·JSON 예시·`ExecutionStatusDto` 필드 세 곳 모두에 반영돼 있다.
    이전 라운드(`13_58_27`)가 지적했던 §3.2 누락 WARNING 은 다음 라운드(`14_47_14`)에서 이미
    해소됐고, 이번 라운드에도 유지되고 있음을 재확인.
  - 제안: 조치 불요.

- **[INFO]** 요청 검증·URL/경로·페이지네이션·인증/인가·버전 관리 표면에는 변경 없음
  - 상세: 이번 diff 는 REST 응답 DTO 필드 추가와 내부 이벤트 발행/영속값 되읽기 로직 정합화, 그리고
    대응 spec/plan 문서 갱신에 국한된다. 신규 엔드포인트, 경로 변경, 쿼리 파라미터, 요청 바디 스키마,
    페이지네이션, 인증/인가 가드 변경은 없다. 이 저장소는 API 버전 스킴 자체를 쓰지 않으며 이번
    변경으로도 새로 도입되지 않았다.

## 요약

이번 라운드(3차)의 API 계약 표면 변경은 앞선 두 라운드(`13_58_27`, `14_47_14`, 둘 다 위험도
LOW·CRITICAL/WARNING 0)에서 이미 검토된 코드와 동일하며, 독립적으로 현재 파일 상태를 대조한 결과도
diff 서술과 일치한다. REST 신규 필드 `durationMs` 는 additive·nullable 로 완전히 하위 호환이고 기존
"부재 표현" 규약(§5.4)을 정확히 따른다. `finalizeCancelledExecution` 의 조건부 emit skip 은 잘못된
종결 이벤트(DB 에 반영되지 않은 사후 오시그널)를 막는 정합성 수정으로, CHANGELOG·spec·plan 세 곳에
수신자 영향이 명시돼 있고 재조회 API 로 실제 상태를 여전히 확인할 수 있어 데이터 유실이 아니다.
Breaking change, 버전 관리 이슈, 에러 응답 형식·상태 코드 문제, 요청 검증 미비, URL/경로 설계 위반,
페이지네이션 문제, 인증/인가 누락은 발견되지 않았다. review/consistency 산출물(파일 16~53)은 이전
리뷰 라운드의 메타 산출물이며 API 계약 코드 자체가 아니라 별도 평가 대상이 아니다.

## 위험도

LOW
