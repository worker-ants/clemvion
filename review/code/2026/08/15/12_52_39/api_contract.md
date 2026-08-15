STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (10차 라운드, `12_52_39`)

## 방법론 노트

이 PR 은 이미 9회의 `ai-review`(`09_58_24`→`12_26_36`) + 다수의 `consistency-check` 라운드를
거쳤고, API 계약 관점의 실질 발견은 전부 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
트래커에 등재돼 있다. 프롬프트 diff 가 생략된 대형 파일(`execution-engine.service.ts`,
`terminal-duration.ts` 등)은 `Read`/`git diff origin/main --`/`grep -n` 으로 직접 열어
대조했다. 직전 라운드(`12_26_36`) 이후 실제로 추가된 커밋은 `67ad84a54` 1개뿐이며
(`CHANGELOG.md`, `execution-engine.service.spec.ts`(+8, 테스트 mock 보강뿐), `executions.service.ts`/
`.spec.ts`, 유저가이드 mdx 2, `spec-sync-external-interaction-api-gaps.md`), 이번 라운드는
그 신규 diff 를 중심으로 재검증하고 직전 라운드의 두 WARNING 이 여전히 유효한지 재확인했다.

## 발견사항

- **[WARNING]** REST 재조회(`GET /api/external/executions/:id`)와 push 계열(webhook/SSE/WS)
  간 `durationMs` 응답 스키마 비대칭 — 이번 라운드도 미해소, 신규 아님(재확인)
  - 위치: `spec/5-system/14-external-interaction-api.md:575`(필드 집합 표) / `:453-486`(§5.3
    `GET` 응답 예시에 `durationMs` 키 없음을 직접 대조 확인) / 트래커
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(`09_58_24` 등재분,
    "REST `GET /api/external/executions/:id` 에 `durationMs` 부재" 항목, 체크박스 미완료)
  - 상세: 종결 3종 push 이벤트엔 `durationMs`(`number | null`)가 실리기 시작했지만 같은
    execution 리소스를 REST 로 재조회하면 이 필드가 없다 — 클라이언트가 이벤트 유실 후
    재조회로 상태를 복구하는 흔한 패턴에서 필드가 사라지는 실질적 스키마 비대칭이다.
    CHANGELOG(`CHANGELOG.md:22-23`)에 "재조회 시 사라지는 비대칭" 으로 명시 고지돼 있고
    트래커에도 등재돼 있어 **은폐된 결함은 아니다**. 8라운드 넘게 이 PR 범위 밖으로
    의도적으로 미뤄져 있고 그 판단 자체는 타당하다(다른 표면 — `ExecutionStatusDto` +
    projection 변경).
  - 제안: 트래커 항목대로 `ExecutionStatusDto`/projection 에 `durationMs` 를 추가하는 후속
    PR 을 우선순위에 둘 것. 이번 PR 을 차단할 사유는 아니다.

- **[WARNING]** `execution.cancelled` 의 `durationMs` — retry-turn 재진입 시 DB 영속값과
  emit 값이 어긋나는 알려진 경로, 미해소·신규 아님(재확인)
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("retry-turn 재진입 시
    DB 와 emit 의 durationMs 가 어긋난다" 항목, `10_34_51` W1 등재), `spec/5-system/14-external-interaction-api.md:806`
    ("알려진 예외 1건" 문단)
  - 상세: retry-turn 처리 중 사용자가 Stop 하면 `finalizeGuarded` 의 CANCELLED 분기가
    `COALESCE(duration_ms, :new)` 로 `stop()` 이 커밋한 T1 값을 DB 에 보존하는데, in-memory
    `execution.durationMs` 는 갱신되지 않아 emit 은 재진입 시점 T2(더 큰 값)를 싣는다.
    희귀 레이스가 아니라 "retry-turn 처리 중 Stop" 이라는 일반 흐름에서 결정적으로
    재현되며, 같은 리소스에 대해 emit 값과 이후 DB 재조회 값이 달라질 수 있다는 점에서
    응답 일관성 결함이다. spec §6.5 에 이미 "알려진 예외" 로 명문화돼 있고 트래커에도
    등재돼 있다 — "DB write 경로를 또 바꾸는 변경이라 서두르면 과잉 스코프를 반복한다"
    는 근거로 범위 밖에 둔 판단도 타당하다.
  - 제안: 트래커 항목대로 CANCELLED 분기에 `.returning(['duration_ms'])` 를 추가해 emit
    직전 실제 persist 값을 되읽는 후속 PR.

- **[INFO]** `stop()` REST 경로(`POST /api/executions/:id/stop`)의 int4 오버플로 방어 —
  이번 라운드 신규 커밋(`67ad84a54`)의 수정, 계약 개선(양호)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:790-808`
    (`resolveTerminalDurationMs` 헬퍼로 교체), 컨트롤러
    `codebase/backend/src/modules/executions/executions.controller.ts:121-145`
    (`@Post(':id/stop')`, `ExecutionDto` 래핑 응답)
  - 상세: 종결 이벤트 emit 경로에서 두 차례 CRITICAL(`duration_ms INTEGER`/int4, 최대
    ≈24.8일 초과 시 `integer out of range` 로 UPDATE 전체 실패)로 잡힌 것과 **같은
    무가드 뺄셈이 내부 `stop()` REST 엔드포인트에도 남아 있었다.** 수정 전에는 24.8일
    이상 대기(예: 무기한 park 대기 중 `waiting_for_input`)한 실행에 대해 사용자가
    "중지" 를 눌러도 DB UPDATE 가 실패해 `stop()` 이 **의도치 않은 500 류 실패**로
    끝났을 것으로 추정된다(문서화된 `@ApiBadRequestResponse` 400 계약과도 어긋나는
    형태). 이번 수정은 같은 헬퍼(`resolveTerminalDurationMs`)로 클램프해 응답 스키마
    변경 없이(여전히 `ExecutionDto`) 실패 모드를 제거했다 — API 계약 견고성 개선.
  - 제안: 없음(양호). 참고로 `executions.service.spec.ts:766-800`(파일 11)에 24.8일
    초과 fixture 로 saturate 를 고정하는 회귀 테스트가 신설됐다.

- **[INFO]** 내부 대시보드/통계 REST 응답(`avgExecutionTime`/`avgDurationMs`)의 **의미**가
  스키마 변경 없이 좁아짐 — CHANGELOG 로 고지됨, 차단 사유 아님
  - 위치: `GET /api/dashboard/summary`(`codebase/backend/src/modules/dashboard/dashboard.controller.ts:38-39`
    → `dashboard.service.ts` `avgExecutionTime`), `GET /api/statistics/summary`
    (`codebase/backend/src/modules/statistics/statistics.controller.ts:45-49` →
    `statistics.service.ts` `avgDurationMs` ×2), CHANGELOG.md(`67ad84a54` 추가분,
    "⚠️ 대시보드·통계의 '평균 실행 시간' 숫자가 이동한다")
  - 상세: 이번 PR 이 취소·타임아웃 경로에서 `duration_ms` 를 처음 채우기 시작하면서, 종전
    `duration_ms IS NOT NULL` 필터만으로 우연히 안전했던 세 집계 쿼리에 `status = 'completed'`
    조건을 추가했다. 필드명·타입·응답 스키마는 그대로지만 **같은 필드가 반환하는 숫자의
    정의**가 "duration_ms 가 있는 모든 실행의 평균" 에서 "완료된 실행만의 평균" 으로
    좁아진다 — 정상 실패·stop 취소의 실제 소요 시간이 더는 반영되지 않는다. 스키마
    호환성 관점에서는 breaking 이 아니지만(같은 필드명·타입), 값의 의미가 조용히
    달라지는 것은 이 필드를 기간별로 비교·캐싱하는 외부/내부 소비자에게 지표 불연속으로
    보일 수 있다. CHANGELOG 에 근거(우연한 안전이었다는 설명 포함)와 함께 명시 고지돼
    있어 은폐된 변경은 아니다.
  - 제안: 없음(현행 유지, 이미 필요한 정정). 다음에 지표 문서(사용자 가이드/API 문서)를
    갱신할 기회가 있으면 "완료된 실행 기준" 이라는 정의를 라벨/툴팁에도 반영 검토.

## 확인된 양호 사항 (재확인)

- **하위 호환성**: `durationMs` 는 종결 3종 payload 에 필드를 추가하는 것뿐 — 필드 제거·
  이름 변경·타입 좁힘 없음. 배포 경계 재생 레거시(키 부재) 이벤트도 `undefined` 로 안전
  통과(`chat-channel.dispatcher.spec.ts` "레거시(키 부재) 이벤트도 깨지지 않는다").
- **타입 계약 일관성**: `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 타입
  전부 `durationMs?: number | null` 로 동일 갱신(`chat-channel/types.ts:397,420,438`),
  `spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` union 도 동일하게 갱신돼
  spec-to-convention drift 없음. `null`(알 수 없음) vs 키 부재(레거시)를 구분하는 설계는
  §6.4 `error.code` null 관례와 일치.
  값을 모를 때도 payload 에 명시적 `null` 을 싣도록(`?? null`) 구현돼 JSON 직렬화 시
  `undefined` 필드 소실로 "값 없음" 과 "필드 없음" 이 뒤섞이는 문제를 방지.
- **버전 관리/URL 설계**: additive 변경이라 버전 증가 불필요. `spec/5-system/14-external-interaction-api.md`
  의 `/v1/` 오탈자(Re-run 경로 문서 표기)는 이미 별도 커밋(`cdaa4291d`)으로 정정·격리됐고
  실제 라우트에 `/v1/` 세그먼트가 존재한 적이 없어 URL 설계 자체에 영향 없음(과거 라운드가
  실측 확인, 이번 라운드 재확인).
- **에러 응답/요청 검증/페이지네이션**: 이번 diff 범위(신규 커밋 포함)에 새 엔드포인트·
  요청 파라미터·에러 코드·목록 API 변경이 없어 해당 없음.
- **인증/인가**: 종결 이벤트 emit 경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/
  `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)의 `WHERE`/
  `AND WHERE` 상태 가드는 보존, `SET`/`RETURNING` 절만 확장 — 인가 경계 변경 없음.
  `stop()` 컨트롤러도 `verifyOwnership` IDOR 가드가 그대로 유지됨(`executions.controller.ts:144`).

## 요약

이 PR 은 종결 이벤트 3종에 `durationMs` 를 추가하는 순수 additive 변경으로, 하위 호환성·
타입 일관성·null-vs-키부재 표현 규약을 모두 준수하며 레거시 이벤트 흡수도 회귀 테스트로
고정돼 있다. 직전 라운드부터 재확인 중인 두 WARNING(REST 재조회-push 간 `durationMs`
비대칭, retry-turn 재진입 시 DB≠emit 값 불일치)은 여전히 유효하지만 둘 다 CHANGELOG·
spec·트래커에 명시적으로 고지·등재돼 있고 "다른 표면 변경이 필요하다" 는 타당한 근거로
범위 밖에 남겨져 있어 이 PR 을 차단할 사유는 아니다. 이번 라운드의 유일한 신규 커밋
(`67ad84a54`)은 내부 `stop()` REST 경로에 남아 있던 같은 클래스의 int4 오버플로를 막아
API 계약 견고성을 개선했고(양호), 그 부수 효과로 대시보드/통계 REST 응답의 `avg` 지표가
값의 정의만 좁아지는 변화가 CHANGELOG 로 적절히 고지돼 있다. 10차 누적 라운드 시점 기준
API 계약 관점에서 이 PR 을 차단할 CRITICAL 은 없다.

## 위험도

LOW
