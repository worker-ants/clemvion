# 신규 식별자 충돌 검토 — spec/data-flow/ (eia-failopen-observability)

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- spec/` 결과가 공백 — 이번 브랜치는 `spec/` 을 전혀 변경하지
않았다. 즉 target 로 번들된 `spec/data-flow/*.md` 전문(9-observability.md · 14-chat-channel.md ·
15-external-interaction.md · 0-overview.md · 1-audit.md 등)은 이번 diff 가 "새로 도입"한 것이 아니라
이전에 이미 origin/main 에 병합된 기존 내용이며, 이번 라운드는 그 위에 참고 컨텍스트로만 번들됐다.

실제 코드 diff(`origin/main...HEAD -- code_areas`)는 다음 7개 파일에 한정된다:

- `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (수정 — `cause` 비노출 캐너리 추가)
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (주석 정리)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (주석 정리)
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (주석 정리)
- `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts` (신규)
- `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (주석 확장)

이 중 실제로 **새 식별자**를 도입하는 것은 두 신규 guard 파일뿐이다 (나머지는 테스트 로컬
상수/주석 정리). 아래는 그 신규 식별자를 6개 관점으로 대조한 결과다.

## 발견사항

없음.

### 확인한 항목 (충돌 없음)

1. **파일 경로** — `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` /
   `redis-fail-open-catalog.spec.ts` 는 `new file mode` (신규). 동일 디렉터리의 기존 명명 컨벤션
   (`<name>-guard.ts` + `<name>.spec.ts`, 선례: `masked-reject-callers-guard.ts` /
   `masked-reject-callers.spec.ts`, `production-build-devdep-guard.ts` / `.spec.ts`)을 그대로
   따르며, 동명의 기존 파일도 없다.

2. **엔티티/타입명** — 신규 guard 가 참조/재수출하는 `RedisFailOpenComponent` /
   `RedisFailOpenReason` (`business-metrics.service.ts`) · `recordRedisFailOpen` ·
   `clemvion.redis.fail_open` 메트릭명은 이미 프로덕션 코드(`business-metrics.service.ts`,
   `idempotency.interceptor.ts`)·spec(`spec/5-system/_product-overview.md` NF-OB-07 카탈로그,
   `spec/data-flow/9-observability.md`)에 동일 의미로만 쓰이고 있고, 이번 diff 는 그 위에 "코드·
   spec·실배선 3자 정합"을 검증하는 가드를 새로 얹었을 뿐 새 의미를 부여하지 않는다. 실측:
   `RedisFailOpenComponent` 유니온의 유일 리터럴은 `'idempotency'` 이고 프로덕션 배선도
   `idempotency.interceptor.ts` 한 곳뿐 — spec Rationale("실제로 배선된 것은 EIA 멱등 캐시
   하나뿐")과 정합.

3. **요구사항 ID** — `NF-OB-01`~`NF-OB-07` 은 `spec/5-system/_product-overview.md` 에 이미 순차
   등록되어 있고 이번 diff 는 새 ID 를 부여하지 않는다.

4. **guard 내부 신규 식별자** — `UNION_SOURCE` / `CATALOG_SPEC` / `UNION_TYPE_NAME` / `RECORDER_FN`
   상수와 `readUnionMembers` / `readCatalogComponents` / `listProductionSources` /
   `findWiredComponents` 함수는 `redis-fail-open-catalog-guard.ts` 안에서만 정의·소비되며 저장소
   어디에도 동명의 export 가 없다.

5. **테스트 로컬 상수** — `http-exception.filter.spec.ts` 에 추가된 `CAUSE_MARKER` /
   `CLOSED_ENVELOPE_KEYS` 는 `describe` 블록 스코프 지역 상수로, 파일 밖 어디에도 동명 식별자가
   없다.

6. **API endpoint / 이벤트 / 큐 / ENV var** — diff 추가 라인(`+`) 전체를 대상으로
   `process.env` / 데코레이터(`@Controller`/`@Get` 등) / `new Queue(...)` / BullMQ 큐 리터럴을
   grep 했으나 신규 도입 0건. 이번 변경은 테스트·가드 코드에 한정되어 API surface·큐 카탈로그·
   환경변수를 건드리지 않는다.

7. **"정본(canonical source)" 표기 재배치** — `error-shape.spec.ts` 를 "enumerable own key 인
   이유" 서술의 정본으로 지정하고 `expression-resolver.service.spec.ts` / `code.handler.spec.ts`
   가 그쪽을 가리키도록 정리했다. 이는 식별자가 아니라 주석 내 산문 지시어이고, `spec/5-system/
   3-error-handling.md §6.3.1` (C1 AND C2 판정 기준의 정본)과는 가리키는 대상·질문이 달라
   ("무엇이 부착 판정 기준인가" vs "왜 enumerable 을 축으로 잡는가") 이름 충돌로 보지 않는다.

## 요약

이번 라운드의 실제 코드 diff 는 `spec/` 을 전혀 건드리지 않으며(신규 spec 식별자 없음), 유일한
신규 프로덕션/테스트 파일인 `redis-fail-open-catalog-guard.ts`·`.spec.ts` 는 기존 디렉터리 명명
컨벤션을 그대로 따르고, 그 안에서 참조하는 모든 도메인 식별자(`RedisFailOpenComponent` /
`RedisFailOpenReason` / `recordRedisFailOpen` / `clemvion.redis.fail_open` / `NF-OB-07`)는 이미
코드·spec 양쪽에 동일 의미로 확립되어 있다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
ENV var·파일 경로 6개 관점 전수에서 충돌을 찾지 못했다.

## 위험도

NONE
