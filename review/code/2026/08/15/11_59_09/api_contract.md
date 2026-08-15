# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs`

## 검토 방법

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `terminal-duration.ts`, `terminal-duration.spec.ts`,
`spec-sync-external-interaction-api-gaps.md` 등)은 `git diff origin/main -- <path>` 로 직접
대조했다. REST 응답 스키마(`ExecutionStatusDto`)·webhook fan-out(`notification-fanout.service.ts`)·
`main.ts` global prefix·`executions.controller.ts` 라우트는 `Read`/`Grep` 으로 실제 코드를
열어 실측했다(추정 금지).

## 발견사항

- **[WARNING]** REST 재조회(`GET /api/external/executions/:id`) 응답에는 `durationMs` 가 없다 — push 계열(webhook/SSE/WS)과 응답 스키마가 비대칭
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`ExecutionStatusDto` — `result`/`error`/`seq`/`updatedAt` 필드는 있으나 `durationMs` 필드 자체가 클래스에 없음, 실측 확인)
  - 상세: 같은 실행(execution)의 종결 상태를 이벤트로 받으면 `durationMs` 가 있고, 같은 실행을 REST 로 재조회하면 그 필드가 통째로 사라진다 — 같은 리소스의 서로 다른 표현(representation)이 다른 필드 집합을 노출하는 응답 스키마 불일치다. 다만 이는 이번 diff 가 새로 만든 결함이 아니라 **의도적으로 스코프 밖으로 미룬 항목**이다: `CHANGELOG.md`("REST `GET /api/external/executions/:id` 에는 아직 없다... 재조회 시 사라지는 비대칭이라 후속으로 추적 중")·`review/code/2026/08/15/09_58_24/RESOLUTION.md`(W4 "유효한 지적... 다른 표면... 트래커 등재")·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`("`durationMs` 후속 2건" 절)에 모두 명시적으로 문서화·추적되고 있다. 하위 호환성 파괴는 아니다(필드가 없을 뿐 기존 계약을 어기지 않음).
  - 제안: 이미 트래커에 있으므로 추가 조치 불필요. 다음 편집에서 `ExecutionStatusDto` + projection 컬럼에 `durationMs` 를 추가하거나, 의도적 제외라면 spec §5.3 에 사유를 명시할 것(트래커가 이미 그렇게 적어 두었다).

- **[INFO]** `execution.cancelled` 의 `durationMs` 가 특정 경로에서 DB 영속값과 emit 값이 어긋날 수 있는 알려진 예외 1건 (retry-turn 재진입)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `finalizeGuarded`(CANCELLED 분기, `COALESCE(duration_ms, :new)`) — spec 쪽 서술: `spec/5-system/14-external-interaction-api.md` §6.5 "알려진 예외 1건"
  - 상세: retry-turn 처리 중 사용자가 Stop 하면 DB 에는 `stop()` 이 커밋한 최초 시각(T1) 기준 값이 보존되는데, in-memory `execution.durationMs` 가 갱신되지 않아 emit 은 재진입 시점(T2, 더 큰 값)을 싣는다. "wire 가 곧 DB 값" 이라는 이번 PR 의 불변식이 이 한 경로에서만 깨진다. 다만 이는 새로 발견한 결함이 아니라 spec §6.5 에 명시적으로 문서화되고 `spec-sync-external-interaction-api-gaps.md` (`10_34_51` W1)에 후속 작업으로 등재돼 있다.
  - 제안: 트래커에 이미 있음(회귀 테스트는 emit 값 자체를 단언하도록, `updateExecutionStatus` 가 `RETURNING` 을 돌려주도록 하는 두 항목). 추가 조치 불필요, 문서화 상태 확인만 완료.

- **[INFO]** `durationMs` 값의 의미가 상태별로 다르다(실행 시간 vs 대기 시간) — 필드명이 암시하는 의미보다 넓은 범위를 담음
  - 위치: `spec/5-system/14-external-interaction-api.md` §6.5 (신규 캐비엇 단락, `EXECUTION_QUEUE_WAIT_TIMEOUT`/park 취소/공개 위젯 idle 회수 3경로 명시)
  - 상세: `EXECUTION_QUEUE_WAIT_TIMEOUT`·park 취소·공개 위젯 idle 회수 경로의 `durationMs` 는 "실행 소요 시간"이 아니라 "생성부터 취소까지의 대기 시간"이다(`started_at` 이 실행 시작이 아니라 생성 시각이라서). 외부 API 소비자가 필드명만 보고 실행 시간으로 오독할 여지가 있다. 다만 이번 라운드가 spec §6.5 에 이 캐비엇을 명시적으로 추가해 외부에 문서화된 상태이고(종전엔 캐비엇이 한 경로만 명명했었다), 사양 위반은 아니다(§6 이 "종결까지의 경과"로 정의한 것과 일관).
  - 제안: 문서화로 이번 PR 범위에서는 충분. 장기적으로는 별도 필드(`waitMs` 등)로 분리하는 안이 `spec-sync-external-interaction-api-gaps.md` 에 이미 후속 항목으로 올라 있다(내부 집계 소비처 오염 관점, `10_34_51` W3) — API 계약 관점에서도 같은 방향이 유효하다.

- **[정보/확인 완료 — 이슈 아님]** REST Re-run 엔드포인트 경로 오탈자 정정이 실제 라우트와 일치함을 실측 확인
  - 위치: `spec/5-system/14-external-interaction-api.md` — `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run`
  - 상세: `codebase/backend/src/main.ts` 의 `app.setGlobalPrefix('api')` + `codebase/backend/src/modules/executions/executions.controller.ts:258` `@Post(':id/re-run')`(컨트롤러 `@Controller('executions')`)를 대조한 결과 실제 라우트는 `/api/executions/:id/re-run` 이며 `/v1/` 세그먼트는 존재하지 않는다. 이 프로젝트에 URL 버전 프리픽스 컨벤션 자체가 없으므로, 종전 spec 표기가 오히려 존재하지 않는 API 버전 관리 체계를 암시하는 오류였다. 이번 정정은 정확하다.

## 그 외 점검 결과 (문제 없음으로 판정)

- **하위 호환성**: `durationMs` 는 종결 이벤트(`execution.completed`/`failed`/`cancelled`) payload 에 새 필드를 **추가**만 한다 — 필드 제거·이름 변경·타입 좁힘 없음. 기존 클라이언트는 무시하면 되므로 breaking change 아님(CHANGELOG 에도 명시).
- **버전 관리**: 이 API 는 URL 버전 프리픽스가 없고 이벤트 payload 는 additive-only 로 진화하는 설계다. 이번 필드 추가는 그 설계와 일관되고 별도 버전 범프가 필요 없는 방식이다.
- **응답 형식 일관성**: `durationMs?: number | null` — producer 는 항상 키를 채우고 값 미상 시 `null`(형제 `error.code`·`error.nodeId` 의 부재 표현과 동일 관례), consumer 타입은 optional 유지(배포 경계 레거시 재생 이벤트 대응). `chat-channel/types.ts`(`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`, L397/L420/L438)와 `chat-channel.dispatcher.ts`(L534-535/572-573/589-590)의 캐스팅 타입이 서로 일치함을 실측 확인. webhook fan-out(`notification-fanout.service.ts:134` `payload: event.payload`)이 payload 를 그대로 전달하므로 webhook/SSE/WS/chat-channel 네 표면이 같은 emit 시점 payload 객체를 공유 — 채널별 필드 누락·표기 불일치 위험이 낮은 설계다.
- **에러 응답**: 이번 diff 는 에러 응답 형식 자체를 변경하지 않는다(직전 PR 이 `error` object 통일을 이미 완료).
- **요청 검증**: 이번 diff 는 신규 요청 파라미터·바디를 추가하지 않는다(서버→클라이언트 payload 확장만). 요청 검증 표면 변경 없음.
- **URL/경로 설계**: 신규 엔드포인트 없음. 유일한 경로 관련 변경은 spec 오탈자 정정(`/v1/` 제거)이며 실제 라우트와 일치함을 위에서 실측 확인.
- **페이지네이션**: 목록 API 변경 없음. 해당 없음.
- **인증/인가**: 인증/인가 로직·미들웨어 변경 없음. 해당 없음.
- **테스트 커버리지(계약 경계)**: `chat-channel.dispatcher.spec.ts` 가 숫자·`null`·키 부재(레거시) 세 상태를 각각 고정해 wire 계약의 세 갈래를 회귀 테스트로 잠갔다(`durationMs 전파` describe 블록).

## 요약

이번 변경은 EIA 종결 이벤트 3종(`execution.completed`/`failed`/`cancelled`) payload 에 `durationMs` 필드를 추가하는 순수 additive 변경이다. 하위 호환성을 깨지 않고(기존 필드 무변경, 신규 필드는 optional/nullable), `null` 로 "값 미상"과 "키 부재(레거시)"를 구분하는 설계가 형제 `error.code` 관례와 일관되며, webhook/SSE/WS/chat-channel 네 표면이 같은 payload 객체를 공유해 채널 간 표기 불일치 위험도 낮다. 가장 눈에 띄는 API 계약 관점 결함 — REST 재조회 응답(`ExecutionStatusDto`)에 `durationMs` 가 없어 push 이벤트와 응답 스키마가 비대칭인 점, 그리고 취소 경로 값이 "실행 시간"이 아니라 "대기 시간"인 의미 불일치 — 은 둘 다 새로 발견한 결함이 아니라 CHANGELOG·spec §6.5·`spec-sync-external-interaction-api-gaps.md` 에 이미 명시적으로 문서화·추적되고 있음을 직접 코드(`ExecutionStatusDto`)와 문서 대조로 확인했다. retry-turn 재진입 시 DB/wire 값이 어긋나는 알려진 예외 1건도 마찬가지로 spec 에 명문화되고 후속 트래커에 등재돼 있다. 신규 요청 검증·URL 설계·페이지네이션·인증/인가 표면은 이번 diff 와 무관하다.

## 위험도

LOW
