# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `audit_log` 적재는 여전히 본 트랜잭션과 분리된 단독 `save()` 이며, 실패는 삼켜진다 (기존 설계, 이번 diff 는 관측성만 추가)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:76-121` (`record()` 메서드, `save()` 호출은 95줄), 호출부 예시 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:81-102` (`recordAudit`)
  - 상세: `AuditLogsService.record()` 는 `auditLogRepository.save(log)` 를 트랜잭션 없이 단독 호출하고, 실패 시 `catch` 에서 예외를 삼킨다. 즉 "주 작업(예: `auth_config.regenerate`) 커밋 성공 + 감사 행 유실" 이 여전히 가능하다. 이는 이번 diff 가 새로 만든 문제가 아니라 사전에 의도된 설계다 — 특권 작업(회전·삭제)이 감사 DB 장애로 실패해서는 안 된다는 판단이며, 코드 주석(97-98줄) 과 `plan/in-progress/spec-sync-auth-gaps.md` 양쪽에 "삼키는 것 자체는 의도" 라고 명시돼 있다. 이번 diff 는 그 갭(유실이 관측되지 않던 문제)만 메웠다 — OTel 카운터 `clemvion.audit.write_failed` 신설(`business-metrics.service.ts:183-185`) + 로그 메시지에 `action`/`resourceType`/`resourceId`/`workspaceId` 를 추가(`audit-logs.service.ts:114-119`)해 어떤 감사가 사라졌는지 알 수 있게 했을 뿐, 적재 유실 가능성 자체는 변하지 않았다.
  - 제안: 조치 불필요(의도된 트레이드오프, 이미 문서화·테스트됨). 카운터가 실제로 알람으로 연결되면(`rate(clemvion_audit_write_failed[5m]) > 0`) 운영상 유실을 사후 인지할 수 있으므로 현재 방향으로 충분하다. 향후 유실이 허용 불가 수준으로 판단되면 outbox 패턴(주 트랜잭션 내 outbox 기록 → 별도 워커가 릴레이) 이 대안이 될 수 있으나 이번 PR 범위 밖이다.

- **[INFO]** `resourceType` 라벨이 `record()` 시그니처상 `string`(열린 타입)이라 카운터 cardinality 가 이론상 무제한 — 클램핑(64자)으로만 방어
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:55-60`(`PROMETHEUS_LABEL_MAX_LEN`/`clampLabel`), `183-185`(`recordAuditWriteFailed`)
  - 상세: DB 자체가 아니라 OTel/Prometheus 메트릭 라벨이지만, 이 카운터의 소스가 `AuditLogsService.record()` 의 `entry.resourceType: string`(닫힌 유니온 아님)이라 컴파일러가 값 집합을 보장하지 못한다. 코드 주석이 "실측 10종으로 유계(현재 producer 호출부는 전부 내부 상수만 전달)" 라고 밝히고 있고, 이번 라운드에서 `PROMETHEUS_LABEL_MAX_LEN` 상수를 `recordExecutionError` 와 공유하도록 리팩터해 방어 강도 drift 를 없앴다(이전에는 `64` 가 두 곳에 매직넘버로 흩어져 있었음). 신규 결함 아님, `recordExecutionError` 와 동일 패턴.
  - 제안: 조치 불필요. `record()` 시그니처가 닫힌 유니온으로 좁혀지면 이 카운터도 함께 좁히는 것이 코드 주석에 이미 명시돼 있다.

- **[INFO]** `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힌 것은 컴파일 타임 전용 변경, 런타임 DB 동작·쿼리 구조 영향 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:81-102`
  - 상세: 타입 좁히기로 "다른 리소스의 action 을 auth_config 로 기록" 하는 실수를 컴파일러가 잡게 한 변경이다. INSERT 되는 값 자체(런타임 데이터)나 쿼리 구조에는 영향이 없다. `record()`/`recordAudit` 경로는 named 필드 시그니처(주석 92-93줄)를 이미 쓰고 있어 positional 인자 스왑에 의한 감사 주체·대상 뒤바뀜 위험도 없다. 신규 `repo-guards/__tests__/audit-action-binding*.ts` 는 정적 분석(TS AST 파싱) 가드로, DB 쿼리를 만들거나 실행하지 않는다.
  - 제안: 없음.

- **[INFO]** `findAll` 조회 경로(`audit-logs.service.ts:22-70`, `auth-configs.service.ts` `findAll`)는 이번 diff 로 변경되지 않았으나, 확인 차 검토한 결과 파라미터화 쿼리(named binding)·정렬 컬럼 화이트리스트(`getSortColumn`)·offset/limit 페이지네이션이 모두 유지되고 있어 SQL 인젝션·대량 데이터 스캔 관점에서 회귀 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:38-69`, `123-130`
  - 상세: `qb.andWhere('al.action = :action', { action })` 형태로 전부 named parameter 를 쓰고, `sort` 는 `getSortColumn` 화이트리스트를 거쳐 컬럼명 인젝션을 차단한다. 이는 이번 changeset 의 변경 대상이 아니라 확인 목적의 기록이다.
  - 제안: 없음.

## 요약

이번 변경 세트의 핵심은 (1) `AuditLogsService.record()` 의 감사 적재 실패를 OTel 카운터(`clemvion.audit.write_failed`)로 관측 가능하게 하고 로그 메시지에 `action`/`resourceType`/`resourceId`/`workspaceId` 식별자를 추가한 것, (2) `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입을 리소스에 묶인 타입(`AuditActionFor<...>`)으로 좁힌 것, (3) 그 바인딩을 전수 강제하는 정적 분석 가드(`repo-guards/__tests__/audit-action-binding*`) 신설, (4) 클램핑 상수(`PROMETHEUS_LABEL_MAX_LEN`) 공유화이다. 실제 SQL/쿼리 빌더, 인덱스, 트랜잭션 경계, 마이그레이션, 스키마, 커넥션 풀, 페이지네이션 로직은 diff 어디에서도 변경되지 않았다 — 현재 소스를 직접 열어 확인한 결과 `record()` 의 `save()` 호출과 `try/catch` 구조는 그대로이며(96-120줄), 추가된 것은 catch 블록 안의 메트릭 카운터 호출과 로그 문자열 확장뿐이다. 감사 로그가 주 트랜잭션과 분리된 best-effort 적재라는 기존 설계(적재 실패 시 유실 가능)는 이 diff 로 인해 새로 생긴 리스크가 아니라 사전에 의도되고 문서화·테스트된 트레이드오프이며, 이번 변경은 그 유실을 "보이게" 만드는 방향으로만 개선했다. `findAll` 조회 경로의 파라미터화·정렬 화이트리스트·페이지네이션도 확인 결과 그대로 유지된다. 데이터베이스 관점에서 이번 라운드(16:53) 신규로 도입된 위험은 없다.

## 위험도
NONE
