# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 / 방법

prompt_file 의 번들은 컨텍스트 예산 초과로 다음이 **절단**되어 있었다:
- target 그 자체인 `spec/5-system/14-external-interaction-api.md` (98,001자)
- `<git diff origin/main...HEAD -- code_areas>` (16,627자)
- `spec/conventions/error-codes.md`·`execution-context.md`·`interaction-type-registry.md`·`swagger.md`·`spec-impl-evidence.md`·`node-output.md` 등 정식 규약 핵심 문서 다수

지시대로 "여기 없다"를 "내용이 없다"의 근거로 삼지 않고, 아래를 워크트리에서 **직접** 열람해 재구성했다:
- `git diff origin/main...HEAD --stat` (전체) → `git diff origin/main...HEAD -- codebase/` (전문)
- `git diff origin/main...HEAD -- spec/5-system/_product-overview.md spec/data-flow/9-observability.md` (전문)
- `spec/5-system/14-external-interaction-api.md` (frontmatter + §R8·§8.4·EIA-IN-11·EIA-RL-02)
- `spec/conventions/redis-keys.md` (번들에 완전 포함돼 있었음), `spec/conventions/error-codes.md` (직접 Read)
- `spec/conventions/spec-impl-evidence.md` (직접 Read, §1 frontmatter 적용/제외 대상)

## 실제 변경 내용 (diff-base `origin/main`)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` + spec — `clemvion.redis.fail_open` OTel Counter 관측 추가 (기존 R8 캐시 키 스코프 구현 위에 fail-open 관측만 신규)
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` + spec — `recordRedisFailOpen(component, reason)` 신설, `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온으로 라벨 값 폐집합화
- `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 표에 `clemvion.redis.fail_open` 행 추가
- `spec/data-flow/9-observability.md` 본문·Rationale에 대응 서술 추가

## 발견사항

정식 규약(`spec/conventions/**`) 위반으로 판정할 항목을 찾지 못했다. 점검한 관점별 근거:

- **명명 규약**: 신규 라벨 `component`(`idempotency`)·`reason`(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)은 lowercase snake_case로, NF-OB-07 카탈로그의 기존 라벨(`status`, `type`, `node_type`)과 동일한 케이스 컨벤션을 따른다. `error-codes.md`(UPPER_SNAKE_CASE)는 `error.code`(client 계약)에만 적용 범위가 명시돼 있고 OTel 메트릭 라벨은 그 적용 범위 밖이라 케이스 불일치가 아니다.
- **출력 포맷 규약**: OTel instrument 이름 `clemvion.redis.fail_open`은 기존 dot 표기(`clemvion.*`) 규칙, unit `'{event}'`는 형제 Counter들의 UCUM 스타일(`{execution}`/`{error}`/`{token}`)과 일치한다. NF-OB-07 표의 신규 행 포맷(메트릭/종류/라벨/의미 4열, "라벨 (열거값)" 표기)도 기존 5행과 동일하다.
- **Redis 키 규약(`spec/conventions/redis-keys.md`)**: 이번 PR은 신규 Redis 키를 도입하지 않는다(메트릭만 추가). 참조된 캐시 키 `interaction:idempotency:<executionId>:<route>:<key>`는 §3 인벤토리에 이미 등재돼 있고, §1 "머리 2세그먼트 고정 + 꼬리 가변" 형태·§2 "현재 워크스페이스 세그먼트를 쓰는 키 없음" 원칙과도 정합하다(신규 workspaceId 세그먼트 도입 없음).
- **문서 구조 규약**: `spec/5-system/_product-overview.md`(`_` prefix)와 `spec/data-flow/9-observability.md`는 `spec/conventions/spec-impl-evidence.md §1`의 frontmatter 의무 **제외 대상**(각각 밑줄 prefix, `spec/data-flow/**`)이라 frontmatter 부재가 정상이며 실제로 두 파일 모두 frontmatter 없이 원래 구조를 유지한다. `9-observability.md`의 신규 Rationale 소제목은 일반 서술형 제목으로, 같은 문서의 다른 Rationale 소제목들과 동일 스타일이다(이 문서는 `R-N` prefix 컨벤션을 선언한 적 없음 — `chat-channel-adapter.md`/`chat-channel.md`와 다른 문서).
- **spec-impl-evidence 코드 커버리지**: `codebase/backend/src/modules/external-interaction/**`는 이미 `14-external-interaction-api.md`의 frontmatter `code:` 글로브에 포함돼 있어 `idempotency.interceptor.ts` 변경에 별도 frontmatter 갱신 의무가 없다. `codebase/backend/src/modules/metrics/**`를 소유하는 spec(`_product-overview.md`)은 frontmatter 추적 제외 대상이라 갱신 의무 자체가 없다 — 갭 아님.
- **API 문서 규약(Swagger/DTO)**: 이번 diff는 controller·DTO를 변경하지 않아 해당 관점은 적용 대상이 없다(N/A).
- **금지 항목**: 라벨을 `string`으로 넓혀 두지 않고 리터럴 유니온으로 폐집합화한 설계는 오히려 `_product-overview.md` §5 서문의 "모든 라벨은 bounded cardinality" 원칙과 `redis-keys.md` Rationale이 경고하는 "지켜진 적 없는 규칙"류의 문서-구현 괴리를 피하는 방향이다. `component`를 실제 배선된 값(`idempotency`) 하나만 열거하고 미배선 소비자(rate limiter·quota 등)를 미리 나열하지 않은 것도 "문서가 구현보다 넓어지는" 패턴을 스스로 경계한 서술이다.

## 요약

이번 diff는 EIA 멱등성 캐시(idempotency interceptor)의 Redis fail-open 강등을 `clemvion.redis.fail_open` OTel Counter로 관측 가능하게 만드는 좁은 범위의 변경이며, 신규 Redis 키·신규 API 표면·DTO/Swagger 변경이 없다. NF-OB-07 메트릭 카탈로그 표 형식, OTel 네이밍(dot 표기)·unit 표기, 라벨 케이스, frontmatter 적용/제외 대상, redis-keys.md 인벤토리 정합을 각각 대조했으나 정식 규약(`spec/conventions/**`) 위반은 발견되지 않았다. 다만 orchestrator가 조립한 prompt bundle이 예산 초과로 target 원문(`14-external-interaction-api.md`)과 diff 자체, 그리고 error-codes.md 등 다수 conventions 원문을 절단한 상태였다는 점은 검토 프로세스상의 리스크로 기록해 둔다(본 검토는 그 결손을 워크트리 직접 Read로 보완했다).

## 위험도
NONE
