# 신규 식별자 충돌 검토 — `spec-draft-audit-write-failed-metric.md`

## 검토 방법

target 이 새로 도입/노출하려는 식별자를 추출해 각각 전수 검색했다.

- 메트릭명 `clemvion.audit.write_failed`
- 라벨 `resource_type` (해당 카운터 라벨로서)
- Rationale 이 언급하는 메서드명 `BusinessMetricsService.recordAuditWriteFailed(resourceType)`
- draft 파일 자체의 경로 `plan/in-progress/spec-draft-audit-write-failed-metric.md`
- `1-audit.md` 에 추가되는 상호참조 앵커 `#nf-ob-07-메트릭-카탈로그`

검색 대상: `spec/` 전체, `plan/in-progress/`, `codebase/backend/src` (구현이 이미 존재하므로 spec 쪽
신규 식별자가 구현과 어긋나는지도 함께 확인).

```
$ grep -rn "clemvion\.audit\.write_failed|recordAuditWriteFailed|write_failed" spec/ codebase/backend/src
```
→ `spec/` 쪽 매치 0건. `codebase/backend/src/modules/metrics/business-metrics.service.ts:106` 의
`meter.createCounter('clemvion.audit.write_failed', …)` 및 `audit-logs.service.ts:110` 의 호출부만
매치 — 즉 이 메트릭명은 **구현에는 이미 존재하고 spec 카탈로그에는 아직 없다**. target 이
채우려는 정확히 그 갭이다.

```
$ grep -rn "write_failed|write\.failed|WriteFailed" spec/  (audit 관련 3파일 제외)
```
→ 0건. 다른 도메인(웹훅 이벤트명, 큐 job 이름, SSE 이벤트명 등)에서 유사 문자열이 이미 다른
의미로 쓰이고 있지 않다.

```
$ grep -n "resource_type" spec/5-system/_product-overview.md spec/data-flow/9-observability.md spec/data-flow/1-audit.md
```
→ `resource_type` 은 이미 `audit_log` 테이블 컬럼(`data-flow/1-audit.md:45,202`)이자
`9-observability.md:158` 의 `notification` 적재(`resource_type='alert_rule'`)에서 **동일한
의미**(감사 대상 리소스 종류)로 쓰이는 기존 어휘다. target 이 신설하는 카운터 라벨
`resource_type` 은 이 기존 컬럼값을 그대로 실어 보내는 것이라 **의미가 일치** — 충돌이 아니라
올바른 재사용이다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 메트릭 카탈로그 신규 행은 기존 네임스페이스·명명 규칙과 일치
  - target 신규 식별자: `clemvion.audit.write_failed` (Counter), 라벨 `resource_type`
  - 기존 사용처: 없음(spec 상 신규). 참고 대조군 — `spec/5-system/_product-overview.md:88`
    `clemvion.redis.fail_open` (동일 `clemvion.<domain>.<subject>_<past-participle>` 패턴),
    `codebase/backend/src/modules/metrics/business-metrics.service.ts:106` (구현 선행 존재, 이름 동일)
  - 상세: dot 표기(`clemvion.*`) 네임스페이스, Prometheus sanitize 규칙(`clemvion_*`), 카운터/라벨
    구조 모두 기존 6개 행과 동형이다. `resource_type` 라벨은 `audit_log.resource_type` 컬럼
    (`data-flow/1-audit.md` V001 정의)과 같은 어휘를 그대로 쓴다.
  - 제안: 없음 — 그대로 반영 가능. (참고로 남김: 실제로 이 메트릭명이 spec 에 없는 상태로
    구현만 먼저 머지된 것이 이 draft 의 존재 이유이며, 그 사실 자체가 새 충돌이 아니라 이미
    해소 대상으로 인지된 갭이다.)

- **[INFO]** draft 파일 경로는 기존 명명 컨벤션과 일치
  - target 신규 식별자: `plan/in-progress/spec-draft-audit-write-failed-metric.md`
  - 기존 사용처: 같은 디렉터리의 `spec-draft-avatar-storage-key.md`,
    `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`
  - 상세: `spec-draft-<주제>.md` 패턴을 그대로 따르고, 다른 in-progress 파일명과 문자열 충돌 없음.
  - 제안: 없음.

- **[INFO]** `1-audit.md` 신규 상호참조 앵커는 기존 링크와 동일 슬러그를 재사용(충돌 아님)
  - target 신규 식별자: 링크 `../5-system/_product-overview.md#nf-ob-07-메트릭-카탈로그`
  - 기존 사용처: `spec/5-system/4-execution-engine.md:1746` 이 이미 동일한 앵커 문자열
    (`#nf-ob-07-메트릭-카탈로그`)로 같은 절을 참조 중 — 대상 헤딩(`### NF-OB-07 메트릭 카탈로그`,
    `_product-overview.md:77`)과 슬러그가 정확히 일치.
  - 상세: 새 앵커를 발명하는 것이 아니라 기존에 검증된 앵커 문자열을 그대로 재사용하므로
    깨진 링크 위험이 없다.
  - 제안: 없음.

## 요약

target 이 새로 도입하는 식별자는 메트릭명 `clemvion.audit.write_failed` 와 라벨 `resource_type`
뿐이며, 둘 다 spec 전체 검색 결과 기존에 다른 의미로 쓰인 이력이 없다(`resource_type` 은 동일
의미의 기존 컬럼 어휘를 재사용). 이 메트릭명은 이미 구현(`business-metrics.service.ts`)에
존재하는 이름과 정확히 일치해 spec-구현 간 표류가 없고, 명명 패턴(`clemvion.<domain>.<verb>`)도
`redis.fail_open` 선례와 동형이다. draft 파일 경로·문서 내 상호참조 앵커도 기존 컨벤션을 그대로
따른다. 신규 식별자 충돌 관점에서 차단 사유 없음.

## 위험도

NONE
