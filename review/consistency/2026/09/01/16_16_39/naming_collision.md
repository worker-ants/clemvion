# 신규 식별자 충돌 검토 — `spec-draft-audit-resource-type-count.md`

## 검토 범위 요약

target 은 `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표의 `clemvion.audit.write_failed`
행 중 `resource_type` 라벨 카디널리티 서술을 **"실측 12종" → "실측 10종"** 으로 정정하고, 동반해서
`business-metrics.service.ts` JSDoc·`plan/in-progress/spec-sync-auth-gaps.md`·
`plan/complete/spec-draft-audit-write-failed-metric.md` 3곳의 같은 오기산을 정정하는 **숫자·근거
정정 draft**다. 새 요구사항 ID, 새 엔티티/DTO/인터페이스, 새 API endpoint, 새 이벤트/메시지명, 새
환경변수/설정키를 **하나도 도입하지 않는다** — 기존에 이미 등재된 `NF-OB-07` / `clemvion.audit.write_failed`
행의 서술(카디널리티 숫자와 그 근거 문장)만 고친다.

## 발견사항

검토 관점 1~5(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수) 모두에서 target 이
새로 도입하는 식별자가 없다 — 실측 결과 CRITICAL/WARNING 없음.

- **[INFO]** 새 plan 파일 경로는 기존 명명 컨벤션과 정합
  - target 신규 식별자: `plan/in-progress/spec-draft-audit-resource-type-count.md`
  - 기존 사용처: 동일 디렉터리의 `spec-draft-avatar-storage-key.md`, `spec-draft-eia-62-waiting-payload.md`,
    `spec-draft-eia-notification-payload-contract.md` (모두 `spec-draft-<주제>.md` 패턴), 그리고
    `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` · `plan/complete/spec-draft-audit-write-failed-metric.md`
    (동일 NF-OB-07 카탈로그를 다룬 선례 draft들)
  - 상세: 파일명이 기존 어떤 `spec-draft-*` 파일과도 정확히 겹치지 않고, "무엇을 다루는 draft인지"가
    파일명에서 바로 읽혀 컨벤션에 부합한다. 충돌 아님 — 참고용 기록.
  - 제안: 없음(현행 유지).

- **[INFO]** `NF-OB-07` / `clemvion.audit.write_failed` 는 신규 ID 가 아니라 기존 등재 항목의 재참조
  - target 신규 식별자: 없음 (target 은 `NF-OB-07`, `clemvion.audit.write_failed` 를 새로 만들지 않고
    기존 표의 라벨 카디널리티 서술만 수정)
  - 기존 사용처: `spec/5-system/_product-overview.md:70,75,77` (NF-OB-07 원 정의), 이미 완료된
    `plan/complete/spec-draft-audit-write-failed-metric.md`(원 등재 draft) · `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`
    (동일 카탈로그에 다른 행을 추가한 선례) · `spec/data-flow/1-audit.md:28` · `spec/data-flow/9-observability.md:202,208,270,279`
  - 상세: 검색 결과 `NF-OB-07` 은 전 spec/plan 코퍼스에서 단일 의미로 일관되게 참조되고 있으며,
    target 정정 후에도 그 참조 관계가 깨지지 않는다(같은 행의 서술 문구만 바뀜, ID·메트릭명·라벨명은
    불변).
  - 제안: 없음.

- **[INFO]** 정정 대상으로 나열된 3개 동반 파일 경로가 실제로 존재하고 올바른 대상을 가리킴
  - target 신규 식별자: 없음 (경로 참조 정합성 확인용)
  - 기존 사용처: `codebase/backend/src/modules/metrics/business-metrics.service.ts`(존재),
    `plan/in-progress/spec-sync-auth-gaps.md`(존재), `plan/complete/spec-draft-audit-write-failed-metric.md`(존재,
    §A 에서 `NF-OB-07` 행을 다룸)
  - 상세: 세 경로 모두 리포지토리에 실재하며, target 이 "동반 정정" 절에서 지목한 대상과 일치한다.
    새 파일 생성이 아니므로 경로 충돌 대상이 아니다.
  - 제안: 없음.

## 요약

target 문서는 기존에 이미 등재된 `NF-OB-07` 카탈로그의 `clemvion.audit.write_failed` 행에서
잘못 기재된 라벨 카디널리티 숫자("실측 12종")를 실측치("실측 10종")로 정정하고 근거 서술을
보강하는 **순수 정정 draft**로, 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키를
전혀 도입하지 않는다. 새로 생성하는 것은 plan 파일 경로(`plan/in-progress/spec-draft-audit-resource-type-count.md`)
하나뿐이며 이는 기존 `spec-draft-*` 명명 컨벤션과 기존 파일들 어디와도 충돌하지 않는다. 신규 식별자
충돌 관점에서 이 changeset 은 구조적으로 충돌이 발생할 표면 자체가 없다.

## 위험도

NONE
