STATUS=success cross_spec review complete — 0 CRITICAL / 0 WARNING / 1 INFO

# Cross-Spec 일관성 검토 — spec-draft-nf-ob-07-redis-fail-open.md

## 검토 방법

`_prompts/cross_spec.md` 에 번들된 관련 spec 발췌 중 target 문서가 실제로 갱신을
선언한 두 파일(`spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`)이
**"본문 생략됨 — 컨텍스트 예산 초과"** 로 절단되어 있었다. 이 두 파일이 바로 target 이
직접 충돌 여부를 판단해야 할 핵심 대상이므로, 번들 대신 워크트리의 실제 파일을 직접
읽어 대조했다 (`spec/5-system/_product-overview.md` §NF-OB-07, `spec/data-flow/9-observability.md`
L198-206, 관련 코드 `codebase/backend/src/modules/metrics/business-metrics.service.ts`,
`.../external-interaction/idempotency.interceptor.ts`). 아울러 `fail-open`/`fail_open`/
`clemvion.` 전 spec 트리 grep 으로 다른 영역과의 명칭·정의 충돌 여부를 확인했다.

## 발견사항

- **[INFO]** 다른 영역의 fail-open 서술과 신규 메트릭의 연결 지점이 spec 상 명시되지 않음
  - target 위치: "판단이 필요한 지점" 섹션 (L66-72), "비목표" 섹션 (L74-77)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md:308,333` (EIA 전 Redis 경로 fail-open),
    `spec/5-system/12-webhook.md:338,450-456` (`PublicWebhookThrottleGuard`),
    `spec/5-system/15-chat-channel.md:113,716` (`ChatChannelRateLimiterService`),
    `spec/7-channel-web-chat/4-security.md:145-209` (chat-channel dedup/rate-limit)
  - 상세: 이 문서들은 이미 "Redis 미가용 시 fail-open" 을 프로즈로 기술하고 있고, target 은
    이 컴포넌트들이 `clemvion.redis.fail_open` 카운터에 **아직 배선되지 않았다**고 명시적으로
    인지·기록한다(비목표로 배제). 실제 모순은 없다 — 코드 확인 결과
    `RedisFailOpenComponent = 'idempotency'` 로 오직 `IdempotencyInterceptor` 만 계측하며,
    다른 어떤 spec 파일에도 `clemvion.redis.*` 를 언급하지 않는다. 다만 이 4개 문서 쪽에서
    "관측 가능한 fail-open 카운터가 있다" 는 교차 링크가 없어, 향후 이 컴포넌트들이 배선될 때
    9-observability.md/§NF-OB-07 표 갱신이 또 한 번 개별적으로 누락될 여지가 있다(현재
    drift 의 재발 패턴과 동일한 구조).
  - 제안: 이번 draft 범위에서 필수는 아님(비목표로 이미 명시). 후속 작업 시 §NF-OB-07
    표의 `component` 값 확장과 함께 이 4개 문서에 짧은 상호 참조를 추가하면 drift 재발을
    예방할 수 있다는 점만 기록.

## 교차 검증 결과 (충돌 없음 확인)

- **요구사항 ID**: `NF-OB-07` 은 `spec/5-system/_product-overview.md` 가 유일한 정의처(SoT)이며,
  `spec/2-navigation/4-integration.md`·`spec/5-system/4-execution-engine.md`·
  `spec/data-flow/9-observability.md` 의 다른 참조는 전부 링크/인용일 뿐 재정의가 아니다. 새 행
  추가가 다른 영역의 NF-OB-07 해석과 충돌하지 않는다.
- **데이터 모델**: `clemvion.redis.fail_open` 이라는 instrument 이름·`RedisFailOpenComponent`
  (`idempotency`)/`RedisFailOpenReason`(5종) 라벨 값은 코드(`business-metrics.service.ts`,
  `idempotency.interceptor.ts`)와 정확히 일치하고, 다른 spec 파일 어디에도 이 이름으로 이미
  정의된 엔티티/필드가 없다 — 명칭 충돌 없음.
- **API 계약**: 해당 없음 (메트릭 카탈로그 문서 추가이며 endpoint/요청·응답 변경 없음).
- **상태 전이**: 해당 없음 (draft 는 상태 머신을 정의·변경하지 않음. `9-observability.md §3`
  의 "상태 머신은 없다" 서술과도 무관 — 알림 rule 상태와 별개 영역).
- **RBAC**: 해당 없음 (권한 모델 변경 없음).
- **계층 책임**: 해당 없음. §NF-OB-07 서두 "모든 라벨은 bounded cardinality" 원칙과 신규
  라벨(component/reason)도 정합 — 코드가 타입으로 닫힌 집합을 강제하므로 그 원칙을
  위반하지 않는다.
- **카탈로그 완전성**: `spec/5-system/4-execution-engine.md` 가 `clemvion.queue.depth` 를
  개별 인용하지만 "카탈로그는 정확히 N개" 라는 배타적 선언은 없어 6번째 행 추가와 충돌하지
  않는다. `clemvion.execution.total/errors/llm.tokens/node.duration/queue.depth` 를 언급하는
  spec 파일은 target 이 갱신 대상으로 삼은 두 파일 + `4-execution-engine.md`(개별 인용만) 뿐이며,
  세 번째 숨은 미러 위치는 발견되지 않았다.

## 요약

target 문서(`plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`)는 이미 구현·계측된
`clemvion.redis.fail_open` 카운터를 SoT 카탈로그와 그 미러 문장에 등재하는 순수 문서 동기화
작업이다. 프롬프트 번들에서는 두 target 파일 본문이 예산 초과로 절단돼 있었으나, 워크트리
원본을 직접 대조한 결과 draft 가 제시하는 메트릭 이름·라벨 값·범위(component=idempotency 단독,
chat-channel 계열 배선은 명시적 비목표)가 코드·기존 spec 서술과 정확히 일치했다. 요구사항 ID
재정의, 데이터 모델·API 계약 충돌, 상태 전이 불일치, RBAC 충돌, 계층 책임 재배치 등 CRITICAL/
WARNING 급 cross-spec 충돌은 발견되지 않았다. 유일한 관찰(INFO)은 다른 영역의 미배선
fail-open 서술과의 상호 참조 부재로, drift 재발을 막기 위한 선택적 후속 개선 여지일 뿐 target
채택을 막을 사유는 아니다.

## 위험도

NONE
