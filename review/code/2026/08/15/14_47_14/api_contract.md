# API 계약(API Contract) 리뷰 — EIA `durationMs` DB=wire 불변식 닫기 (fresh review)

## 검토 범위 요약

이 diff 는 직전 라운드(`13_58_27`)에서 검토된 코드 변경(①`finalizeCancelledExecution` guarded
UPDATE 결과 확인, ②retry-turn CANCELLED 재진입 `.returning()`, ③REST `GET
/api/external/executions/:id` 에 `durationMs` 추가)에 더해, 그 라운드의 WARNING 을 반영한
후속 spec 정정(`spec/5-system/14-external-interaction-api.md` EIA-IN-04 필드 목록,
§6.5 취소선 보존)과 리뷰/컨센시스 산출물(`review/**`)을 포함한다. API 계약 표면에 실질적으로
닿는 변경은 여전히 셋(①②③)이며, 코드 자체는 직전 라운드와 동일하다.

## 발견사항

- **[INFO]** `EIA-IN-04` 요구사항 필드 목록에 `durationMs` 가 이번 라운드에서 동기화됨 — 직전 라운드 WARNING 해소 확인
  - 위치: `spec/5-system/14-external-interaction-api.md:77` (diff 게이트, §3.2 EIA-IN-04 행)
  - 상세: 직전 라운드(`13_58_27/requirement.md`)가 §5.3 JSON 예시·§6 필드표는 갱신됐지만 §3.2
    요구사항 정의 문장(REST 단발 조회가 반환하는 필드 괄호 열거)에서 `durationMs` 가 빠졌다고
    WARNING 을 냈다. 이번 diff 는 `| EIA-IN-04 | ... (status / currentNode / context /
    result|error / seq / updatedAt) |` 를 `(status / currentNode / context / result|error /
    durationMs / seq / updatedAt)` 로 정정했다 — 실제 `ExecutionStatusDto` 필드와 spec 요구사항
    정의가 다시 1:1 대응한다.
  - 제안: 조치 불요 (확인 완료).

- **[INFO]** REST `durationMs` 필드는 additive·nullable, 기존 "부재 표현"(§5.4) 관례를 그대로 따름 — 하위 호환 유지
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:116-130`,
    `codebase/backend/src/modules/external-interaction/interaction.service.ts:434-438`
  - 상세: `@ApiPropertyOptional({ nullable: true })` + `durationMs?: number | null` 형태이고,
    서비스 코드는 `execution.durationMs ?? null` 로 **키를 항상 채워** 응답한다(TS 상 `?` 는
    optional 이지만 런타임에는 값이 절대 `undefined` 가 아니다) — 같은 DTO 의 `currentNode`
    (`waiting_for_input 상태에서만 실값. 그 외에는 null`)와 동일한 기존 관례라 신규 비일관성이
    아니다. 기존 클라이언트는 필드를 무시하면 되므로 breaking change 가 아니다.
    `STATUS_PROJECTION_COLUMNS`(`interaction.service.ts:78`)에도 함께 추가돼 정확집합 가드와
    응답 스키마가 어긋나지 않는다.
  - 제안: 조치 불요 (모범 사례).

- **[INFO]** `execution.cancelled` push 이벤트가 특정 레이스에서 더 이상 발행되지 않는 동작 변경 — 계약상 정합화, 문서화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4930` (`finalizeCancelledExecution`)
  - 상세: 종전에는 guarded UPDATE(`status IN (non-terminal)`)가 0행이어도 `EXECUTION_CANCELLED`
    를 무조건 발행했다. 이번 변경은 `persisted` 를 확인해 `false` 면 DB 를 재조회하고, 그 값이
    `CANCELLED` 가 아니면(다른 종결자가 FAILED/COMPLETED 로 이미 선점) emit 을 skip 한다 — 동시
    writer 가 이미 다른 terminal 상태로 선점한 레이스에서, webhook/SSE/WS 를 구독하는 외부
    클라이언트 관점에서 종전에 오던 `execution.cancelled` 알림이 이제는 오지 않는다(대신 그
    선점한 writer 의 이벤트가 온다). `CHANGELOG.md` 에 "수신자 영향" 절로 명시 고지돼 있고,
    "DB 에 반영되지 않은 사후 오시그널"을 막는 정합성 수정이라 데이터 유실이 아니며, `GET
    /api/external/executions/:id` 재조회로 실제 최종 status·`durationMs` 를 여전히 확인할 수
    있다. 직전 라운드에서 이미 INFO 로 평가된 항목과 동일 — 이번 라운드에서 코드·문서 모두
    변경 없음을 재확인.
  - 제안: 조치 불요. (선택) EIA spec 의 webhook 재전송/신뢰성 절에도 "동시 선점 시 해당 종결
    이벤트는 발행되지 않을 수 있다"는 한 줄을 추가하면 CHANGELOG(내부 개발 로그) 외에 외부
    API 소비자용 공식 계약 문서에도 같은 사실이 반영돼 완결성이 높아진다 — 필수는 아님.

- **[INFO]** `durationMs` 의 의미가 종결 경로에 따라 달라짐(실행 시간 vs 대기 경과 시간) — 세 곳(DTO JSDoc·Swagger description·spec §6.5)에 일관되게 문서화됨
  - 위치: `execution-status-response.dto.ts:116-122`, `spec/5-system/14-external-interaction-api.md:485-488`
  - 상세: 취소·타임아웃 종결 경로에서는 `durationMs` 가 실행 소요 시간이 아니라 대기 경과 시간을
    의미한다는 캐비엇이 DTO JSDoc·Swagger description·spec 세 곳에 정확히 일치한다. 같은
    필드명이 상태에 따라 다른 의미를 가지는 것은 스키마 설계 관점에서 이상적이진 않지만(별도
    필드 분리가 더 명확), 이번 PR 이 새로 도입한 결정이 아니라 직전 PR(#1171)이 세운 계약을
    그대로 확장한 것이고 계약 자체는 문서상 명확하다.
  - 제안: 조치 불요 (참고). 추후 필드 분리(`elapsedMs` 등) 논의가 나오면 참고.

- **[INFO]** 요청 검증·URL 경로·페이지네이션·인증/인가 표면에는 변경 없음
  - 상세: 이번 diff 는 응답 DTO 필드 추가와 내부 이벤트 발행 로직 정합화, 그리고 그에 대응하는
    spec/plan 문서 갱신에 국한된다. 신규 엔드포인트, 경로 변경, 쿼리 파라미터, 요청 바디 스키마,
    페이지네이션, 인증/인가 가드 변경은 없다. 버전 관리(API versioning) 스킴 자체도 이 저장소가
    쓰지 않으며 이번 변경으로도 도입되지 않았다.

## 요약

이 라운드는 API 계약 관점에서 직전 라운드(`13_58_27`, 위험도 LOW)의 코드를 그대로 이어받고,
그 라운드가 지적한 유일한 계약 관련 WARNING(§3.2 EIA-IN-04 필드 목록에 `durationMs` 누락)을
정정해 spec 과 구현이 다시 1:1 대응한다. REST 응답 필드 추가(`durationMs`)는 additive·nullable
로 설계되어 완전히 하위 호환이며 기존 "부재 표현" 규약(§5.4)·기존 필드(`currentNode`)와 동일한
패턴을 따른다. `finalizeCancelledExecution` 의 조건부 emit skip 은 잘못된 이벤트(DB 에 반영되지
않은 종결 신호)를 막는 정합성 수정으로, CHANGELOG 에 수신자 영향이 명시돼 있고 재조회 API 로
실제 상태를 확인할 수 있어 데이터 유실이 아니다. Breaking change, 버전 관리 이슈, 에러 응답
형식·상태 코드 문제, 요청 검증 미비, URL/경로 설계 위반, 페이지네이션 문제, 인증/인가 누락은
발견되지 않았다.

## 위험도

LOW
