STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 검토 방법

프롬프트 번들에서 크기 제한으로 생략된 `execution-engine.service.ts`/`retry-turn.service.ts`
전체 diff 는 `git diff origin/main -- <path>` 로 직접 확인했다. 다운스트림 소비자
(`chat-channel.dispatcher.ts`, `ExecutionStatusDto`) 는 이번 PR diff 밖이지만 API 계약
영향(스키마 일관성) 판단을 위해 `Read`/`grep` 으로 대조했다.

## 발견사항

- **[WARNING]** 동일 리소스에 대해 push(WS/webhook/SSE) 응답과 REST 폴링 응답의 필드 스키마가
  갈린다 — `durationMs` 가 이벤트에는 실리는데 상태 재조회 API 에는 없다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`ExecutionStatusDto`, `durationMs` 필드 부재 — 이번 diff 에 미포함, 현재 상태를 `Read` 로 확인) / 대응 spec: `spec/5-system/14-external-interaction-api.md` — CHANGELOG(`CHANGELOG.md` 게이트 `20`) 가 "REST `GET /api/external/executions/:id` 에는 아직 없다" 로 자인
  - 상세: 이번 PR 전에는 durationMs 가 어느 표면에도 없어 비대칭이 없었다. 이번 PR 이 push
    계열(3종 종결 이벤트) 에만 durationMs 를 채우면서, 같은 실행을 REST 로 재조회하는
    클라이언트는 이 필드를 영영 받지 못하는 **새로운 비대칭**이 생겼다. 외부 통합자가
    이벤트를 놓쳐(네트워크 단절 등) `GET /api/external/executions/:id` 로 상태를 복구하는
    설계라면(EIA 는 웹훅 재시도 실패 시 폴링을 권장하는 구조), duration 정보를 얻을 방법이
    없다.
  - 참고: 이 사실은 이미 CHANGELOG·plan(`plan/in-progress/eia-terminal-payload.md` RESOLUTION
    W4)에 문서화·트래킹돼 있고, "다른 표면(ExecutionStatusDto+projection)이라 이 PR 범위
    밖" 이라는 명시적 유예 근거도 있다. 절차적으로는 정당하지만, API 계약 관점에서는 실재하는
    스키마 불일치이므로 등급을 낮추지 않고 WARNING 으로 기재한다.
  - 제안: 후속 PR 에서 `ExecutionStatusDto` 에도 `durationMs` 를 추가해 push/pull 두 표면의
    필드 집합을 맞출 것. 그 전까지는 spec §5(REST 응답 스키마) 에도 "durationMs 는 push
    전용, REST 는 아직 미제공" 캐비엇을 명시하면 외부 통합자의 오해를 줄일 수 있다(현재
    §6 필드 표에만 암시돼 있고 §5 REST 응답 절에는 없음).

- **[INFO]** `duration_ms` int4 clamp(saturate) 동작이 공개 API 계약 문서(§6)에는 없다 —
  코드 주석·CHANGELOG·plan 에만 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (`TERMINAL_DURATION_MS_SQL`,
    `LEAST(2147483647, …)`) / 대응 spec 절 `spec/5-system/14-external-interaction-api.md` §6.5
  - 상세: `duration_ms` 컬럼이 `INTEGER`(int4, 최대 ≈24.8일)라 그 이상 대기한 실행(park·
    idle-wait 등 5경로)이 취소되면 실제 경과시간이 아니라 `2147483647`(≈24.8일)로
    saturate 된 값이 wire 로 나간다. 이 클램프 자체는 CRITICAL 회귀(UPDATE 실패로 인한
    영구 고착)를 막기 위한 정당한 방어(전 라운드 리뷰에서 이미 확인·조치됨)이지만, **외부
    API 소비자가 읽는 정본 계약 문서(§6)에는 이 saturate 동작이 언급되지 않는다** — 그
    자리에는 `markQueueWaitTimeout` 이 "큐 대기 시간" 의미라는 캐비엇만 있고 상한 클램프
    캐비엇은 없다. 실무 도달 빈도는 극히 낮다(24.8일 초과 대기)만, 도달 시 클라이언트가
    "실제 24.8일 걸렸다" 로 오독할 수 있다.
  - 제안: §6 필드 표 또는 §6.5 캐비엇에 "long-park 실행은 `2147483647`(int4 상한)로
    saturate 될 수 있다" 한 줄 추가. 우선순위는 낮음(도달 확률·영향 모두 작음).

- **[INFO]** 다운스트림 내부 소비자의 타입 선언이 이번 producer 타입 변경(`number` →
  `number | null`)을 반영하지 않은 채 남아 있다 (이번 diff 범위 밖)
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534`,
    `:571`, `:587` (`(event.payload as { durationMs?: number }).durationMs` — `| null`
    누락. 이번 PR 파일 목록에 없어 원본을 `Read` 로 직접 확인)
  - 상세: `codebase/backend/src/modules/chat-channel/types.ts` 의 `EiaCompletedEvent`
    /`EiaFailedEvent`/`EiaCancelledEvent.durationMs` 는 이번 PR 로 `number | null` 이
    됐고, 이제 실제로 여러 취소 경로에서 `null` 값이 런타임에 나갈 수 있다(값을 모를 때).
    그런데 `chat-channel.dispatcher.ts` 는 여전히 `{ durationMs?: number }` (null 미포함)
    로 캐스팅한다. TypeScript 타입 단언은 런타임 값을 바꾸지 않으므로 **지금 당장 동작이
    깨지지는 않는다** — `null` 값은 그대로 통과해 출력 객체(같은 `types.ts` 유니온으로
    타이핑됨, `number | null` 을 허용)에 담긴다. 다만 이 캐스트 지점의 타입 선언 자체가
    실제보다 좁아, 향후 이 필드로 산술(`durationMs / 1000` 등)이나 `typeof === 'number'`
    분기를 추가하는 사람이 `null` 케이스를 컴파일러 도움 없이 놓칠 함정이 된다.
  - 제안: 이번 PR 필수 아님(범위 밖 파일, 런타임 무영향). 다음에 이 파일을 건드릴 때
    `{ durationMs?: number | null }` 로 캐스트 타입을 맞출 것.

## 그 외 점검 결과 (문제 없음으로 판정)

- **하위 호환성**: `durationMs` 는 기존 필드 제거·이름 변경 없는 순수 추가 필드다. 프로듀서
  타입은 필수(`?` 없이 항상 채움), 컨슈머 타입(`chat-channel/types.ts`)은 여전히
  optional 로 남겨 레거시 재생 이벤트(키 자체가 없는 경우)를 흡수한다 — 의도가 코드 주석에
  명시돼 있고 근거(29개 fixture 타입 오류 실측, 직전 PR `error.nodeId` 판단과의 일관성)도
  적절하다. 이 저장소는 URL 버전 세그먼트를 쓰지 않는 컨벤션(`2-api-convention.md §1`)이며,
  스펙 자체가 "기존 클라이언트는 unknown field 무시" 를 이미 명시한 진화 모델을 채택하고
  있어 이번 추가는 그 모델과 일치한다. 직전 PR(#1170)의 `error` string→object 전환처럼
  기존 파서를 깨뜨리는 shape 변경이 아니다.
- **버전 관리**: 변경 없음. 별도 API 버전 협상 수단이 이 프로젝트에 없고, 이번 변경은
  추가적(additive)이라 버전 이슈를 만들지 않는다.
- **응답 형식/스키마 문서 동기화**: `spec/5-system/14-external-interaction-api.md` §6 필드
  표·예시 JSON·`spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` 유니온 타입이
  코드 변경(`types.ts`)과 정확히 동기화됐다 — `durationMs?: number` → `durationMs?: number | null`
  양쪽 모두 일치. producer(항상 키 존재, 값 모르면 `null`) vs consumer(optional 유지) 계약
  분리가 코드 주석·spec 캐비엇 양쪽에 일관되게 설명돼 있다.
- **에러 응답**: 이번 diff 범위 밖(직전 PR 에서 이미 `toTerminalErrorPayload` 로 일원화).
  변경 없음.
- **요청 검증**: 해당 없음 — 신규 요청 파라미터·바디가 없다. 이번 변경은 서버가 emit 하는
  이벤트 payload 필드 추가이며 클라이언트 입력을 받지 않는다.
- **URL/경로 설계**: `spec/5-system/14-external-interaction-api.md` 의 Re-run 경로에서
  `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run` 로 `/v1/` 세그먼트가
  빠졌다. 이는 실제 라우팅 변경이 아니라 **문서 오탈자 정정**이다(`git log` 로 확인한 별도
  커밋 `cdaa4291d` — impl-prep consistency-check CRITICAL 지적을 해소한 것). 실제 컨트롤러
  라우트는 애초에 `/v1/` 을 쓴 적이 없다. RESTful 설계 관점에서 새로 도입된 문제 없음.
- **페이지네이션**: 해당 없음 — 목록 API 변경 없음.
- **인증/인가**: 변경 없음. 신규 raw UPDATE 5곳 모두 기존 `WHERE id = :id AND status = :xxx`
  가드를 그대로 보존한 채 `SET`/`RETURNING` 절만 확장했다. 인가 경계(상태 전이 가드)가
  넓어지거나 좁아지지 않았다. `TERMINAL_DURATION_MS_SQL` 상수는 하드코딩 문자열이고 유일한
  가변 값(`terminalFinishedAt`)은 5곳 전부 `setParameter` 로 바인딩돼 SQL 인젝션 표면도
  없다(security 리뷰어의 이전 라운드 판정과 일치, 이번 재확인에서도 동일).

## 요약

이번 변경은 EIA 종결 이벤트(`execution.completed`/`failed`/`cancelled`) payload 에
`durationMs` 필드를 추가하는 순수 additive 확장으로, 기존 클라이언트를 깨뜨리지 않고
producer/consumer 계약 분리(항상 키 존재 vs optional 유지)도 명확한 근거와 함께 spec·코드
양쪽에 일관되게 반영됐다. 유일하게 남는 API 계약 관점 리스크는 이번 PR 이 REST 폴링
(`GET /api/external/executions/:id`)과 push 이벤트 간에 필드 집합 비대칭을 새로 만들었다는
점인데, 이는 이미 문서(CHANGELOG·plan)에 인지·추적되고 있고 의도적 범위 유예다. int4 클램프
saturate 동작이 공개 spec 에 캐비엇으로 명시되지 않은 점, 그리고 이번 diff 밖 파일
(`chat-channel.dispatcher.ts`)의 타입 캐스트가 새 nullable 타입을 아직 반영하지 못한 점은
둘 다 실질 영향이 작아 INFO 로 남긴다. Breaking change·버전 관리·인증/인가·요청 검증·
URL 설계 관점에서 새로 도입된 심각한 문제는 없다.

## 위험도

LOW
