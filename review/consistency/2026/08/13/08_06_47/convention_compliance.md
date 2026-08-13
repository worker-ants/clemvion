# 정식 규약 준수 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 검토 범위·방법

target 은 `spec/` 이 아니라 `plan/in-progress/backend-lint-gate-broken-on-main.md` 이며, 검토 모드는
`--spec` 로 지정됐다. target 은 backend lint 게이트 복구 작업의 추적 plan 인데, 본문 후반부(§idempotency
캐시 관련 항목들)가 이번 developer 턴(`eia-r8-cache-scope-4ae434`)이 막 완료한 EIA 캐시 키 스코프 작업을
서술한다. 이 서술이 `spec/conventions/**` 의 정식 규약과 어긋나지 않는지를 다음 방식으로 교차 검증했다:

- 번들된 `spec/conventions/**` 발췌(다수 항목은 예산 초과로 절단 — `error-codes.md`·`execution-context.md`·
  `swagger.md`·`migrations.md`·`spec-impl-evidence.md`·`node-output.md` 등)를 1차로 훑고, target 이
  직접 인용/의존하는 항목은 실제 저장소 파일을 `Read`/`grep` 으로 원문 대조했다(번들 절단으로 인한
  거짓 음성을 피하기 위함 — 메모리 `feedback_consistency_spec_mode_budget`와 같은 클래스).
- target 이 인용하는 `secret-store.md §2.1` 각주, `error-codes.md` 의 `AbortError`/`VALIDATION_ERROR`
  등록, `spec-impl-evidence.md` 의 frontmatter 스키마를 대상 spec 파일(`spec/5-system/14-external-interaction-api.md`,
  `spec/data-flow/15-external-interaction.md`)의 현재 상태와 대조했다.

## 발견사항

target 문서에서 `spec/conventions/**` 를 직접 위반하는 CRITICAL/WARNING 은 발견하지 못했다. 아래는
확인 결과와 범위 관련 INFO 하나뿐이다.

- **[INFO] EIA Redis 키 레지스트리 갭의 SoT 는 `spec/conventions/**` 가 아니다 — 이미 정확히 추적됨**
  - target 위치: `## 후속` 절, 체크박스 미완료 항목 "**EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2
    키 레지스트리에 없다**" (`19_56_51` convention_compliance INFO 4 인용)
  - 위반 규약: 해당 항목은 `spec/5-system/4-execution-engine.md §9.1` (`{service}:{workspaceId}:{resource}:{id}:{sub}`
    Redis 키 패턴)을 인용한다. 이 파일은 `spec/conventions/**` 가 아니라 `spec/5-system/**` 이다.
    저장소 전체를 확인한 결과 `spec/conventions/**` 안에는 Redis 키 네이밍을 규정하는 문서가 없다
    (`grep -rl Redis spec/conventions/` → `execution-context.md`(in-memory Map 라우팅 전용, §9.1 과
    무관을 스스로 명시)·`conversation-thread.md` 뿐).
  - 상세: 새로 도입된 `interaction:idempotency:<executionId>:<route>:<key>` 3-세그먼트 키(target 의
    "완료" 서술과 `spec/data-flow/15-external-interaction.md` L258·`spec/5-system/14-external-interaction-api.md`
    §R8 Rationale 이 정확히 일치함을 확인)는 execution-engine §9.1 패턴을 따르지 않는다. 다만 이
    사실은 target 이 **이미 자체적으로 인지·기록**하고 있고(체크박스 미완료 + "planner 작업" 명시),
    출처인 `spec/conventions/**` 규약 문서가 애초에 존재하지 않으므로 이번 라운드의 "정식 규약(spec/conventions)
    준수" 관점에서는 새로운 CRITICAL/WARNING 이 아니다.
  - 제안: 조치가 필요하다면 `4-execution-engine.md` §9.1/§9.2 갱신(target 이 이미 제안한 대로) 이
    맞는 경로이며, `spec/conventions/` 쪽에 별도 대응은 불필요하다. 향후 유사 항목 재확인 시
    "spec/conventions 위반" 과 "spec/5-system 위반"을 같은 라벨(`convention_compliance`)로 묶지 않도록
    구분해 두면 후속 라운드의 중복 집계를 줄일 수 있다(규약 갱신 성격 제안).

## 교차 검증 — 위반 없음을 확인한 항목 (참고용, 결함 아님)

- **`secret-store.md §2.1` 각주 (`deleteByPrefix` LIKE 메타문자 거부)**: target 이 서술하는 "prefix
  불변식 2건"·"이스케이프가 아니라 거부인 이유"·"검증 두 층(e2e=의미론/단위=쿼리 형태)" 이 실제
  `spec/conventions/secret-store.md` §2.1 각주 원문과 문구·근거 모두 일치한다. 명명(`secret://<scope>/<resourceId>/<name>`)
  위반 없음.
- **`error-codes.md` §3 historical-artifact 레지스트리**: target 이 코드에서 사용/언급하는
  `AbortError`(PascalCase)·`VALIDATION_ERROR`(prefix 없는 전역 코드)는 각각 §3 예외 등록·§1 명시적
  예외로 이미 정당화돼 있다. target 이 이 코드들을 그대로 쓰는 것은 규약 위반이 아니다(신규 코드가
  아니라 기존 등록된 코드를 사용).
- **`spec-impl-evidence.md` frontmatter 규약**: target 이 수정을 서술하는
  `spec/5-system/14-external-interaction-api.md`(status: `partial`, `pending_plans:` 로
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 지정, 실존 확인됨)과
  `spec/data-flow/15-external-interaction.md`(§1 inclusive list 에서 `data-flow/**` 명시 제외 —
  frontmatter 부재가 정상) 모두 규약과 일치한다. `idempotency.interceptor.ts` 도 EIA spec 의
  `code:` 글로브(`codebase/backend/src/modules/external-interaction/**`)에 포함되어 stale glob
  문제도 없다.
- **API 문서 규약(`swagger.md`)**: target 은 Swagger 데코레이터·DTO 를 다루지 않는다(grep 결과
  `@Api*` 언급 0건) — 적용 대상 아님.

## 요약

target(`backend-lint-gate-broken-on-main.md`)은 lint 게이트 복구라는 원 주제에 더해 최근 EIA
idempotency 캐시 스코프 작업(`eia-r8-cache-scope-4ae434`)의 완료 서술을 담고 있는데, 그 서술이 인용하는
`spec/conventions/secret-store.md`·`error-codes.md`·`spec-impl-evidence.md` 규약 내용을 실제 파일과
대조한 결과 전부 일치했다. `spec/conventions/**` 자체를 직접 위반하는 대목은 찾지 못했다. 유일하게
언급할 만한 것은 target 이 이미 스스로 추적 중인 "EIA Redis 키가 execution-engine 레지스트리에
없다" 항목인데, 그 SoT 가 `spec/5-system/`이지 `spec/conventions/`가 아니라서 본 검토 관점(정식 규약
준수)에서는 새로운 결함으로 카운트하지 않았다(INFO, 범위 명확화 목적으로만 기록).

## 위험도

NONE
