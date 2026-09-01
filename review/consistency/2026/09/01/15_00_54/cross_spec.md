# Cross-Spec 일관성 검토 — `clemvion.audit.write_failed` NF-OB-07 카탈로그 등재

## 검토 방법

번들에는 target 이 직접 수정하는 세 파일(`spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md`, `spec/data-flow/1-audit.md`)이 컨텍스트 예산 초과로
절단되어 있었다. 절단된 부분은 실제 파일(`spec/**`)을 직접 읽어 대조했고, 관련 도메인
(`spec/1-data-model.md` AuditLog/AlertRule 엔티티, `spec/data-flow/2-auth.md`,
`spec/5-system/1-auth.md`, `spec/5-system/4-execution-engine.md`)도 grep 으로 교차 확인했다.
필요한 범위에서 실제 코드(`business-metrics.service.ts`, `audit-logs.service.ts`,
`login-history.service.ts`)도 대조해 spec 서술이 실측과 어긋나지 않는지 확인했다.

## 발견사항

- **[INFO]** Overview 의 "규칙" 인용이 원문보다 넓다
  - target 위치: Overview 2번째 단락 ("`9-observability.md` 의 Rationale 이 스스로 … 규칙 이라고
    못 박고 있고 …")
  - 충돌 대상: `spec/data-flow/9-observability.md` Rationale "`clemvion.redis.fail_open` 의
    `component` 를 실제 배선된 값만 열거하는 이유" (파일 내 실제 문장: "새 소비자를 배선할 때
    유니온과 NF-OB-07 카탈로그 표를 **동시에** 넓히는 것이 규칙이다")
  - 상세: 원문 규칙은 **`clemvion.redis.fail_open` 라벨의 닫힌 유니온(`RedisFailOpenComponent`/
    `RedisFailOpenReason`)을 넓힐 때** 카탈로그 표도 함께 넓히라는, 그 메트릭 하나에 국한된
    규칙이다. target 은 이를 "신규 메트릭 일반에 적용되는 카탈로그 갱신 규칙"으로 일반화해
    인용한다. 결론(카탈로그에 행을 추가한다)은 같은 문단의 그 앞 문장("표 밖에 흩어지면
    카탈로그가 SoT 이기를 그만둔다")으로도 독립적으로 정당화되므로 실질적 모순은 아니다 —
    다만 인용 근거의 정밀도가 낮다.
  - 제안: "그 규칙을 이행한다" 를 "카탈로그가 SoT 라는 같은 문단의 원칙을 이행한다" 정도로
    좁혀 인용 대상을 정확히 하거나, 인용 범위를 `redis.fail_open` 사례에 한정한다고 명시.

- **[INFO]** `login_history` 비대칭의 "후속 항목 등재" 위치 미명시
  - target 위치: 변경안 C, "`login_history` 쪽을 이번에 넓히지 않는 이유" 문단 ("후속 항목으로
    등재한다")
  - 충돌 대상: 없음 (spec 충돌이 아니라 완결성 이슈)
  - 상세: "등재한다"고만 쓰고 `plan/` 내 구체적 트래커(예: `plan/in-progress/` 신규 항목 또는
    기존 `spec-sync-auth-gaps.md` 잔여 목록)를 지목하지 않는다. spec 자체의 정합성에는 영향이
    없지만, 실제로 등재되지 않으면 이 draft 가 만든 "비대칭이 보인다"는 이점이 다음 사람에게
    다시 발견 비용을 지운다.
  - 제안: 이 draft 를 `spec/` 에 반영하는 커밋에서 `login_history` 카운터 부재를 후속 작업으로
    `plan/in-progress/` 에 명시적으로 등재.

## 교차 확인 결과 (충돌 없음 — 근거 기록)

- **데이터 모델**: `spec/1-data-model.md` §2.18 `AuditLog.resource_type` 은 이미 `String`(열린
  타입)으로 정의돼 있다. target A-3 의 "소스 시그니처가 `string`(열림)" 서술은 이 기존 정의와
  일치하며, 새로 엔티티/필드를 추가하지 않는다.
- **요구사항 ID**: `NF-OB-07` 은 기존 ID 확장(카탈로그 표에 행 추가)이며 새 ID 를 채번하지
  않는다. 다른 영역에서 `NF-OB-07` 이 다른 의미로 쓰인 사례 없음 (grep 확인).
- **알림/RBAC 도메인과의 분리**: `spec/1-data-model.md` §2.25 `AlertRule.type`
  (`failure_rate`/`duration`/`llm_cost`, in-app 알림용 완전히 별개의 닫힌 enum)과
  `NF-OB-07` OTel 카운터 카탈로그는 서로 다른 서브시스템(전자는 워크스페이스 알림 규칙,
  후자는 Prometheus 계측)이라 겹치지 않는다. target 은 `AlertRule` 을 건드리지 않는다 — 혼동
  없음.
- **다른 영역의 audit 서술과의 정합**: `spec/data-flow/2-auth.md`, `spec/5-system/1-auth.md`
  는 감사 실패 관측 방식을 재서술하지 않고 `data-flow/1-audit.md` 로 cross-ref 만 하므로,
  target 의 C 변경(두 `record` 서술 분리)과 충돌하는 중복 서술이 없다.
  `spec/5-system/4-execution-engine.md` 도 `clemvion.queue.depth` 만 언급하며 NF-OB-07 전체
  목록을 재열거하지 않아 갱신 불요.
- **라인 앵커**: target 이 인용한 `spec/data-flow/1-audit.md:21-23` 은 실제 파일과 정확히
  일치 (line 21 "두 `record` 모두 **실패를 삼킨다**" ~ line 23 `Logger.error`).
- **앵커 링크**: `[NF-OB-07 카탈로그](../5-system/_product-overview.md#nf-ob-07-메트릭-카탈로그)`
  는 `spec/data-flow/9-observability.md` 가 이미 동일 슬러그로 참조 중인 유효 앵커.
- **표 서식**: 신규 카탈로그 행(`메트릭 | 종류 | 라벨 | 의미`)의 컬럼 구성·"알람 예" 문장
  패턴이 `clemvion.redis.fail_open` 행과 동형이며 표 스키마를 어기지 않는다.
- **layer 책임**: `AuditLogsService` 가 `BusinessMetricsService` 를 통해 카운터를 올리는
  구조는 `clemvion.redis.fail_open` 이 이미 쓰는 계측 경로(도메인 서비스 → 중앙
  `BusinessMetricsService`)와 동일 패턴이며 새로운 계층 책임 분할을 만들지 않는다.

## 요약

target 이 수정하는 세 spec 파일(`5-system/_product-overview.md` NF-OB-07 카탈로그,
`data-flow/9-observability.md` 인프라 메트릭 나열, `data-flow/1-audit.md` swallow 서술)은
모두 실제 파일 내용과 라인 앵커까지 정확히 일치하며, `1-data-model.md`(AuditLog.resource_type
타입), `AlertRule`(별개 알림 도메인), `data-flow/2-auth.md`·`5-system/1-auth.md`·
`5-system/4-execution-engine.md`(감사·큐 메트릭 관련 인접 서술) 어느 쪽과도 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 차원에서 모순을 만들지 않는다. 유일한 지적은
Rationale 인용의 일반화 정도(INFO)와 후속 작업 등재 위치 미명시(INFO)로, 둘 다 채택을 막을
사유가 아니다.

## 위험도

NONE
