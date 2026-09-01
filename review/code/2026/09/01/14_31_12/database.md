# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `audit_log` 적재는 여전히 본 트랜잭션과 분리된 별도 `save()` 이며, 실패는 삼켜진다 (기존 설계, 이번 diff 는 관측성만 추가)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:85-111` (`record()` 메서드), 호출부 예시 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:189-197`
  - 상세: `AuditLogsService.record()` 는 `auditLogRepository.save(log)` 를 트랜잭션 없이 단독 호출하고, 실패 시 `catch` 에서 예외를 삼킨다(`logger.warn` + 이번 diff 로 추가된 `metrics?.recordAuditWriteFailed`). 즉 "주 작업(예: `auth_config.regenerate`) 커밋 성공 + 감사 행 유실"이 여전히 가능한 상태다. 다만 이는 **이번 diff 가 새로 만든 문제가 아니라 기존 의도된 설계**다 — 특권 작업(회전·삭제)이 감사 DB 장애로 실패해서는 안 된다는 판단이며, 코드 주석·`plan/in-progress/spec-sync-auth-gaps.md` 양쪽에 "삼키는 것 자체는 의도"라고 명시돼 있고 `audit-logs.spec.ts` 로 회귀 방지도 걸려 있다. 이번 diff 는 그 갭(유실이 관측되지 않던 문제)을 메우는 방향으로만 움직였다 — OTel 카운터(`clemvion.audit.write_failed`) 신설 + 로그 메시지에 `action`/`resourceType`/`resourceId`/`workspaceId` 를 추가해 어떤 감사가 사라졌는지 알 수 있게 했다. DB 정합성 관점에서 "적재 유실 가능"이라는 사실 자체는 변하지 않았으므로 정보 제공 차원에서 기록한다.
  - 제안: 조치 불필요(의도된 트레이드오프, 이미 문서화·테스트됨). 향후 audit_log 유실이 운영상 허용 불가 수준으로 판단되면 outbox 패턴(주 트랜잭션 내 outbox 테이블 기록 → 별도 워커가 `audit_log` 로 릴레이) 검토가 대안이 될 수 있으나, 이는 이번 PR 범위 밖의 별도 설계 결정이다.

- **[INFO]** `resourceType` 라벨이 `record()` 시그니처상 `string`(열린 타입)이라 OTel 카운터 cardinality 가 이론상 무제한
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:168-172` (`recordAuditWriteFailed`)
  - 상세: DB 자체와는 직접 관련 없으나(OTel/Prometheus 메트릭), `resourceType.substring(0, 64)` 클램핑만으로 방어하고 있다. 코드 주석이 "실측 12종으로 유계"라고 밝히고 있고 `record()` 호출부가 전부 내부 상수(`AUTH_CONFIG_RESOURCE_TYPE` 등)만 넘기므로 현재는 안전하다. `recordExecutionError` 와 동일 패턴이라 신규 결함이 아니다.
  - 제안: 조치 불필요. 향후 `record()` 시그니처가 닫힌 유니온으로 좁혀지면 이 카운터도 함께 좁히는 것이 코드 주석에 이미 명시돼 있다.

- **[INFO]** `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힌 것은 컴파일 타임 전용 변경, 런타임 DB 동작 영향 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:86`
  - 상세: 타입 좁히기로 "다른 리소스의 action 을 auth_config 로 기록"하는 실수를 컴파일러가 잡게 한 변경이다. `INSERT` 되는 값 자체(런타임 데이터)나 쿼리 구조에는 영향이 없다. 새로 추가된 `repo-guards/__tests__/audit-action-binding*.ts` 는 정적 분석(TS AST 파싱) 가드로 DB 쿼리를 만들지 않는다.
  - 제안: 없음.

## 요약

이번 변경 세트의 핵심은 (1) 감사 로그 적재 실패를 OTel 카운터로 관측 가능하게 하고 로그 메시지에 식별자를 추가한 것, (2) `auth-configs.service.ts` 의 `recordAudit` action 파라미터 타입을 리소스에 묶인 타입으로 좁힌 것, (3) 그 바인딩을 전수 강제하는 정적 분석 가드/테스트 신설이다. 실제 SQL/쿼리 빌더, 인덱스, 트랜잭션 경계, 마이그레이션, 스키마, 커넥션 풀, 페이지네이션 로직은 diff 어디에서도 변경되지 않았다 — `AuditLogsService.record()` 의 `save()` 호출과 `try/catch` 구조는 그대로이고, 추가된 것은 catch 블록 안의 메트릭 카운터 호출과 로그 문자열 확장뿐이다. 감사 로그가 주 트랜잭션과 분리된 best-effort 적재라는 기존 설계(적재 실패 시 유실 가능)는 이 diff 로 인해 새로 생긴 리스크가 아니라 사전에 의도되고 문서화·테스트된 트레이드오프이며, 이번 변경은 그 유실을 "보이게" 만드는 방향으로만 개선했다. 데이터베이스 관점에서 신규로 도입된 위험은 없다.

## 위험도
NONE
