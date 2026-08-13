# User Guide Sync 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (같은 20행) 을 SoT 로 적재했다.

## 변경 파일 요약

이번 changeset 은 다음으로 구성된다:

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` (+`.spec.ts`)
- `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` (신규)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (백로그 항목 완료 갱신)
- `review/code/**`, `review/consistency/**` 하위 다수 리뷰 산출물 (코드 아님)
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`

핵심 코드 변경은 `IdempotencyInterceptor` 의 기존 fail-open 다섯 경로(GET 실패·SET 실패·직렬화 실패·엔트리 손상·payload 손상) 각각에 `BusinessMetricsService.recordRedisFailOpen(component, reason)` OTel 카운터 호출 한 줄씩을 추가한 것이다. 신규 export 타입 `RedisFailOpenComponent`/`RedisFailOpenReason` (리터럴 유니온)도 함께 추가됐다.

## trigger 매칭 검토 (20행 전수)

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 미매칭. `idempotency.interceptor.ts` 는 `codebase/backend/src/modules/external-interaction/` 아래로 `nodes/**` 글롭 밖.
- **신규 UI 문자열 (TSX)** — 미매칭. `codebase/frontend/src/**/*.tsx` 변경 없음(frontend 변경 파일 0건).
- **신규 위젯 chrome 문자열** — 미매칭. `codebase/channel-web-chat/**` 변경 없음.
- **통합/제공자 변경** — 미매칭. 신규/변경 provider 없음.
- **유저 가이드 신규 섹션 디렉토리** — 미매칭. `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 미매칭. 인터셉터·메트릭 서비스는 controller/DTO 가 아니며, 인터셉터가 감싸는 응답 계약(상태 코드·바디)에 행동 변경 없음(관측 계측만 추가).
- **신규 BullMQ 큐 추가** — 미매칭.
- **신규 warningCode 발행 (backend warningRules)** — 미매칭. 이번 추가는 `clemvion.redis.fail_open` **OTel Counter**(Prometheus 라벨)이지, API 응답의 `warningRules`/`WARNING_KO` 대상 사용자 가시 코드가 아니다.
- **신규 errorCode 발행** (`error-codes.ts`) — 미매칭. `error-codes.ts` 변경 없음.
- **신규 cross-cutting enum 값 추가** (interaction-type-registry 대상) — 미매칭. `RedisFailOpenComponent`/`RedisFailOpenReason` 은 메트릭 라벨 타입이지 `WaitingInteractionType`류 interaction-type-registry.md 매트릭스 대상 enum 이 아니다.
- **신규 backend zod ui.label/hint/group/itemLabel 값** — 미매칭.
- **신규 handler output field** (`output.result.*`) — 미매칭. 이번 변경은 execution 응답 바디에 필드를 추가하지 않는다(순수 관측 사이드채널).
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 미매칭. `idempotency.interceptor.ts` 는 EIA 외부 커맨드 재전송 캐시이지 인증/세션 미들웨어가 아니다.
- **AuthConfig type enum 변경** — 미매칭.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 미매칭.
- **실행·디버깅 흐름 변경** — 경계 사례로 직접 조사: `codebase/frontend/src/content/docs/05-run-and-debug/` 는 idempotency/interaction.guard/external-interaction 을 어디서도 언급하지 않는다(grep 0건). 이번 diff 는 캐시 정책(TTL·409 판정·fail-open 동작 자체)에 행동 변경이 없고, API 호출자가 관찰 가능한 응답/상태 코드도 그대로다 — 순수 내부 OTel 카운터 추가이므로 사용자가 보는 실행/디버그 UI 흐름에 영향 없음. **미매칭**.
- **환경 변수·기동 방법·런타임 변경** — 미매칭. `OTEL_ENABLED` 는 기존 변수 재사용, 신규 env var 없음.
- **spec 신규/대규모 변경** (`spec/5-*/**` 등) — `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` 는 이 glob 에 매칭되나, 이 changeset 안에서 **frontmatter code:/status:/pending_plans: 정합 갱신은 이미 반영**돼 있다(NF-OB-07 카탈로그 표에 `clemvion.redis.fail_open` 행 추가 + `data-flow/9-observability.md` 미러 문장·Rationale 절 동시 갱신, `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 가 그 절차를 기록). 이 행의 target 은 spec 내부 정합(consistency-checker 도메인)이며 실제로 `review/consistency/2026/08/13/{09_36_31,09_48_44,10_20_59}` 세 라운드를 거쳐 검증됐다. user-guide-sync 고유 대상(frontend docs MDX/i18n dict/backend-labels/locale.ts)과는 무관 — **본 리뷰어 영역 밖**.
- **user-guide GUI 흐름 절 신규/변경** — 미매칭. `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음.
- **spec 자체 누락·오류 판단** — 해당 없음(이미 절차대로 project-planner 위임 완료된 상태로 changeset 에 반영됨).

## 결론

이번 changeset 은 EIA 멱등성 캐시의 fail-open 다섯 경로에 OTel 관측 카운터(`clemvion.redis.fail_open`)를 배선한 **순수 내부 관측성(observability) 작업**이다. 사용자가 API 호출로 관찰 가능한 응답·상태 코드·에러/경고 메시지에 행동 변경이 없고, 신규 노드·신규 UI 문자열·신규 warning/error 코드·인증 흐름 변경·표현식 언어 변경·신규 문서 섹션도 없다. 유일하게 glob 매칭되는 `spec-major-change` 행(spec/5-system, spec/data-flow)은 이미 이 changeset 안에서 동반 갱신이 완료돼 있고, 그 target(frontmatter 정합)은 consistency-checker 도메인이지 본 리뷰어(frontend user-guide/i18n/backend-labels) 도메인이 아니다.

## 발견사항

없음. 해당 없음.

## 요약

매트릭스 20개 trigger 행 전수를 검토했고, glob 매칭 1건(spec-major-change → spec/5-system·data-flow, 이미 동반 갱신 완료·consistency-checker 도메인)을 제외하면 어떤 trigger 도 매칭되지 않았다(0건 매칭 필요 대상). 이 changeset 은 backend OTel 메트릭 계측 추가 + 그 spec 카탈로그 등재로, `codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/dict/**`, `backend-labels.ts`, `locale.ts` 등 user-guide-sync 고유 대상 파일이 전혀 변경되지 않았고 변경될 필요도 없다. 누락 0건.

## 위험도

NONE
