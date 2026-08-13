# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 재확인 (prompt 청크가 target/diff 를 절단했음)

prompt_file 의 target 문서(`spec/5-system/14-external-interaction-api.md`)와 code diff 청크는
컨텍스트 예산 초과로 **본문이 생략**되어 있었다. 이를 "내용 없음" 으로 오판하지 않기 위해
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
직접 `git diff origin/main...HEAD` 를 재실행해 실제 변경 범위를 확인했다.

**실제 diff 범위** (`spec/**` 한정):

```
spec/5-system/_product-overview.md |  3 ++-
spec/data-flow/9-observability.md  | 15 ++++++++++++++-
```

즉 이번 diff 는 `spec/5-system/14-external-interaction-api.md` 를 건드리지 않는다 — prompt 의
"Target 문서: spec/5-system/" 는 영역 단위 지정이고, 실질 변경은 **NF-OB-07 메트릭 카탈로그에
`clemvion.redis.fail_open` 카운터 1건 추가**(+ 대응 코드: `IdempotencyInterceptor` 의 다섯
fail-open 경로에 `BusinessMetricsService.recordRedisFailOpen` 계측 배선)다.

## 발견사항

없음 — CRITICAL/WARNING 등급 충돌을 찾지 못했다.

### 확인한 잠재 충돌 지점과 결론 (기록용)

- **NF-OB-07 카탈로그 중복 정의 여부**: `spec/5-system/_product-overview.md` 가 유일한 카탈로그
  SoT 이며, `spec/data-flow/9-observability.md` 는 링크로 참조만 한다(기존 이원화 정책 패턴을
  그대로 따름). `spec/5-system/4-execution-engine.md`·`spec/2-navigation/4-integration.md` 도
  NF-OB-07 을 언급하지만 개별 메트릭을 나열하지 않고 링크 참조뿐이라 drift 없음.
- **`component`/`reason` 라벨의 "닫힌 집합" 주장이 실제 코드와 맞는가**: `RedisFailOpenComponent
  = 'idempotency'` 단일값이고, 코드 전체에서 Redis fail-open 을 쓰는 곳은
  `chat-channel-rate-limiter`·`channel-conversation`·`interaction-rate-limiter`·
  `terminal-revoke-reconciler`·`public-webhook-quota` 등 다수이나 이번 diff 에서 배선된 것은
  `idempotency.interceptor.ts` 뿐임을 코드로 확인했다. `data-flow/9-observability.md` 신규
  단락이 "실제 배선은 idempotency 하나뿐" 이라 명시하고 "rate limiter·quota·conversation 등"
  을 **미배선 예시**로 든 것도 실제 서비스명(`*-rate-limiter*`, `*-quota*`,
  `channel-conversation*`)과 부합한다 — 문서가 구현보다 넓게 약속하지 않는다.
- **EIA §R8 "캐시 키 스코프" 와의 정합**: `spec/5-system/14-external-interaction-api.md` §R8 은
  이번 diff 로 변경되지 않았고, `idempotency.interceptor.spec.ts` 의 §R8 관련 describe 블록도
  통과 내용(서수 색인 → 이름 색인 리팩터, 신규 메트릭 관측 블록 추가)만 바뀌었을 뿐 §R8 이
  정의하는 캐시 키 스코프(`<executionId>:<route>:<key>`) 자체는 그대로다. 충돌 없음.
- **계층 책임**: `IdempotencyInterceptor`(`external-interaction` 모듈)가
  `BusinessMetricsService`(`@Global` `MetricsModule`)를 `@Optional()` 로 주입받는 패턴은
  `execution-engine.service.ts`·`continuation-dlq-monitor.service.ts`·`llm-usage-log.service.ts`
  가 이미 쓰는 기존 패턴과 동일 — 새 계층 위반 없음.
- **RBAC/상태 전이/데이터 모델/API 계약**: 이번 변경은 OTel 메트릭 계측(옵저버빌리티)만 추가하며
  엔드포인트·요청/응답 shape·엔티티 필드·상태 머신·권한 규칙을 전혀 건드리지 않는다.

## 요약

이번 diff 는 기존 NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 카운터 1건을 추가하고
`IdempotencyInterceptor`(EIA 멱등 캐시, §R8) 의 다섯 fail-open 경로에 계측을 배선한 좁은 범위의
관측성 변경이다. 실제 `spec/**` diff 는 `_product-overview.md`(NF-OB-07 행·카탈로그 표)와
`data-flow/9-observability.md`(교차 참조 + "닫힌 집합" rationale) 두 파일뿐이며,
`14-external-interaction-api.md` 는 손대지 않았다. 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과의 모순을 찾지 못했다. 라벨 값의 "닫힌
집합" 주장·미배선 서비스 예시 모두 실제 코드베이스와 대조해 정확함을 확인했다.

## 위험도

NONE
