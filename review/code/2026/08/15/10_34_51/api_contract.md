STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (재검토, `10_34_51`)

## 검토 방법

이번 라운드는 동일 PR(`durationMs` 종결 3종 확장)에 대한 3번째 ai-review 다. 직전 두 라운드
(`09_58_24`, `10_18_38`)의 `api_contract.md`/`RESOLUTION.md` 를 먼저 읽어 이미 지적·조치된
항목과 겹치지 않게 델타만 판정했다. 프롬프트에서 diff 가 생략된 `execution-engine.service.ts`
전체와 `spec/5-system/14-external-interaction-api.md` 는 `git diff origin/main -- <path>` 로
직접 확인했고, `ExecutionStatusDto`(diff 밖 파일)는 `Read`/`grep` 으로 현재 상태를 재확인했다.

## 발견사항

- **[WARNING]** REST 폴링(`GET /api/external/executions/:id`)과 push 이벤트(webhook/SSE/WS) 간
  필드 스키마 비대칭이 여전히 남아 있다 — `durationMs` 가 이벤트에는 실리는데 상태 재조회
  API 에는 없다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (`ExecutionStatusDto` — `durationMs` 필드 부재, `Read` 로 확인. 이번 diff 에 미포함) /
    고지 지점: `CHANGELOG.md:20`(`"REST GET /api/external/executions/:id 에는 아직 없다"`)
  - 상세: 이전 라운드(`10_18_38` api_contract WARNING)에서 이미 지적됐고 이번 라운드까지
    `ExecutionStatusDto`에 변경이 없어 그대로 재확인된다. 외부 통합자가 push 이벤트를 놓쳐
    (webhook 재시도 실패 등) REST 로 상태를 복구하는 경로에서는 `durationMs` 를 영영 받지
    못한다. **다만 이번 라운드에서 확인한 새 사실**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 이 갭이 정식으로 트래커 등재됐다(`durationMs` 후속 2건, "REST `GET
    /api/external/executions/:id` 에 `durationMs` 부재" 항목) — 절차적으로는 정당한 유예이고,
    CHANGELOG·spec·plan 세 곳 모두에 일관되게 고지돼 있다. 등급을 낮추지 않고 WARNING 으로
    유지하는 이유는 이 비대칭이 **실재하는 API 계약 갭**이기 때문이지, 문서화가 부족해서가
    아니다.
  - 제안: 이전 라운드와 동일 — 후속 PR 에서 `ExecutionStatusDto`+projection 컬럼에
    `durationMs` 를 추가해 두 표면의 필드 집합을 맞출 것. 이미 트래커에 있으므로 추가 조치
    불필요, 재발 방지 확인 목적의 재기재.

- **[INFO]** `duration_ms` int4 클램프(saturate) 동작이 공개 API 계약 문서(EIA §6)에 여전히
  캐비엇으로 없다 — 코드 주석·RESOLUTION 문서에만 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:88`(`LEAST(2147483647, …)`,
    `TERMINAL_DURATION_MS_SQL`) / 대응 spec: `spec/5-system/14-external-interaction-api.md`
    §6.5 (`git diff origin/main -- spec/5-system/14-external-interaction-api.md` 로 확인 —
    이번 라운드가 §6.5 에 `EXECUTION_QUEUE_WAIT_TIMEOUT` 의 "큐 대기 시간" 캐비엇은
    새로 추가했지만 int4 saturate 캐비엇은 추가하지 않았다)
  - 상세: 24.8일(`2^31-1` ms)을 초과해 대기한 실행이 취소되면, 실제 경과시간이 아니라
    `2147483647`(≈24.8일)로 saturate 된 값이 wire 로 나간다. 클램프 자체는 정당한 방어(직전
    CRITICAL — UPDATE 실패로 인한 영구 고착 — 를 막기 위함, 이미 조치 완료)이지만, **외부
    소비자가 읽는 정본 계약 문서**에는 이 saturate 동작이 여전히 명시돼 있지 않다. 직전
    라운드(`10_18_38` api_contract)에서 이미 같은 지점을 INFO 로 지적했는데, 이번 라운드
    diff 를 보면 §6.5 에 `EXECUTION_QUEUE_WAIT_TIMEOUT` 캐비엇은 새로 넣으면서 saturate
    캐비엇은 넣지 않았다 — 한쪽 캐비엇만 반영되고 다른 한쪽은 두 라운드 연속 누락된 형태다.
    또한 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "durationMs 후속
    2건" 목록에도 이 항목은 없다(REST 비대칭·SQL e2e 미검증만 등재) — WARNING 항목과 달리
    **공식 백로그에 아직 등재되지 않은 상태**다.
  - 제안: 우선순위는 낮다(도달 빈도·영향 모두 작음)만, §6 필드 표 또는 §6.5 에 "long-park
    실행은 `2147483647`(int4 상한)로 saturate 될 수 있다" 한 줄을 추가하거나, 최소한
    `spec-sync-external-interaction-api-gaps.md` 트래커에 등재해 다음 편집 때 놓치지 않게
    할 것.

## 확인 — 직전 라운드 지적이 이번 diff 에서 실제로 해소됨

- **[해소 확인]** `chat-channel.dispatcher.ts` 의 캐스트 타입이 producer 의 `number | null`
  변경을 반영하지 못했던 문제(`10_18_38` api_contract INFO)가 이번 diff 에서 3곳 전부
  `{ durationMs?: number | null }` 로 정정됐다 — `chat-channel.dispatcher.ts:534-535`,
  `:572-573`, `:589-590` (직접 `grep` 으로 재확인, 세 곳 모두 일치). RESOLUTION 문서의
  W8 조치와 부합한다.
- **[해소 확인]** producer 타입(`types.ts`)·컨슈머 union 타입(`chat-channel-adapter.md:149-151`)·
  spec §6 필드 표·§6.3~§6.5 예시 JSON 이 모두 `durationMs?: number | null` / "구현됨,
  알 수 없으면 null" 로 정확히 동기화돼 있다(`grep`으로 전수 대조).

## 그 외 점검 결과 (문제 없음으로 판정, 직전 라운드와 판단 유지)

- **하위 호환성**: 기존 필드 제거·이름 변경 없는 순수 추가(additive) 필드. 기존 클라이언트가
  unknown field 를 무시하는 진화 모델과 일치. Breaking change 아님.
- **버전 관리**: 이 프로젝트는 URL 버전 세그먼트를 쓰지 않는 컨벤션이며, 이번 변경이
  additive 라 버전 이슈를 만들지 않는다.
- **응답 형식**: producer(항상 키 존재, 값 모르면 `null`) vs consumer(optional 유지, 레거시
  재생 이벤트 흡수) 계약 분리가 코드 주석·spec 캐비엇 양쪽에 일관되게 설명돼 있다. 3종
  이벤트(`completed`/`failed`/`cancelled`) 모두 동일 규칙 적용 — 일관성 있음.
- **에러 응답**: 이번 diff 범위 밖(직전 PR 에서 이미 일원화). 변경 없음.
- **요청 검증**: 해당 없음 — 신규 요청 파라미터·바디 없음. 서버발 이벤트 payload 확장뿐.
- **URL/경로 설계**: `spec/5-system/14-external-interaction-api.md` 의 Re-run 경로 `/v1/`
  세그먼트 제거는 실제 라우팅 변경이 아니라 문서 오탈자 정정(별도 커밋, impl-prep
  consistency-check CRITICAL 해소). 실제 컨트롤러 라우트는 애초에 `/v1/` 을 쓴 적이 없다.
- **페이지네이션**: 해당 없음 — 목록 API 변경 없음.
- **인증/인가**: 변경 없음. 신규 raw UPDATE 5곳(`execution-engine.service.ts:1036,1171,2828,2899,3352`)
  모두 기존 `WHERE id = :id AND status = :xxx` 가드를 그대로 보존한 채 `SET`/`RETURNING`
  절만 확장했다. `TERMINAL_DURATION_MS_SQL` 은 하드코딩 상수이고 유일한 가변 값
  (`terminalFinishedAt`)은 5곳 전부 `setParameter` 로 바인딩돼 인젝션 표면 없음.

## 요약

이번 라운드는 `durationMs` 종결 이벤트 확장에 대한 3차 재검토다. 직전 라운드가 지적한
`chat-channel.dispatcher.ts` 의 nullable 타입 미반영은 이번 diff 에서 3곳 전부 정정됐고,
producer/consumer 계약 분리·spec 동기화도 코드·문서 양쪽에서 정확히 확인된다. 남는 API 계약
리스크는 두 가지이며 둘 다 신규가 아니라 **이전 라운드부터 이어지는 재확인**이다: (1)
REST 폴링과 push 이벤트 간 `durationMs` 필드 집합 비대칭(WARNING, 트래커 등재·CHANGELOG 고지
완료된 의도적 유예), (2) int4 saturate 클램프 동작이 공개 spec 문서에 캐비엇으로 없는 점
(INFO, 이번 라운드에서 §6.5 캐비엇 절반만 채워지고 이 부분은 트래커에도 없어 놓치기 쉬운
상태). 둘 다 영향이 제한적이고 breaking change 가 아니므로 위험도는 낮게 유지한다.

## 위험도

LOW
