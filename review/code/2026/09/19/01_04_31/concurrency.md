# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** V131(정리) → V132(전역 UNIQUE 인덱스 생성) 사이에 경쟁 조건 창이 존재하지만, 문서화·운영 절차로 완화되어 있다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:1-50` (DO 블록, 트랜잭션 커밋 시점) 및 `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:13-15` (운영 절차 ① 주석)
  - 상세: `CREATE UNIQUE INDEX CONCURRENTLY` 는 트랜잭션 블록 안에서 실행할 수 없어 V131(정리, 트랜잭션)과 V132(인덱스 교체, non-transactional)가 별도 파일·별도 커밋으로 분리됐다. V131 커밋 이후 V132 의 `CREATE UNIQUE INDEX CONCURRENTLY` 가 시작되기 전(또는 인덱스가 `indisvalid=true` 로 확정되기 전) 사이 창에서, 경로를 알고 있는 다른 워크스페이스가 여전히 유효한 워크스페이스 단위 인덱스(`idx_trigger_workspace_endpoint`)만 통과하는 복사 등록을 시도하면, 새 전역 UNIQUE 인덱스 빌드가 중복 키로 실패해 `idx_trigger_endpoint_path` 가 invalid 상태로 남을 수 있다. 이 창 자체는 코드가 스스로 정확히 인지하고 있고(V132 SQL 헤더 "운영 절차 ①"), 실패 시 복구 절차(V131 DO 블록 수동 재실행 → `repair` → `migrate`, README §6)까지 명시돼 있으며, 실패해도 옛 인덱스는 valid 상태를 유지해 보호 수준이 **줄어들지는** 않는다(문서 자체 확인). 재발 가능성 낮음(경로는 비밀 키 성격, 공격자가 정확히 이 두 마이그레이션 사이의 짧은 창을 노려야 함)이지만, 자동화된 재시도 없이 사람이 개입해야 닫히는 창이라는 점은 동시성 관점에서 기록해 둔다.
  - 제안: 현재 수준의 문서화·수동 복구 절차로 충분해 보인다. 다만 배포 파이프라인이 두 마이그레이션 사이에 앱 트래픽을 완전히 멈추지 않는다면(즉 마이그레이션 중에도 `POST /api/triggers` 가 계속 들어온다면), CI/배포 런북에 "V131 적용 후 즉시 V132 를 이어서 적용(트래픽 유입 최소화)"를 명시적 단계로 못박아 두는 편이 안전하다.

- **[INFO]** `endpoint_path` 유일성 검증은 앱 레벨 check-then-act 가 아니라 DB UNIQUE 제약 위반을 `catch` 하는 원자적 패턴을 그대로 유지 — 이번 변경으로 회귀 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `create()` (495-497행: `this.triggerRepository.save(trigger).catch(...)`), `update()` (636-723행: 트랜잭션 + `m.save(...).catch(...)`), `rethrowEndpointPathConflict()` (1654-1675행)
  - 상세: 이번 diff 는 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수값과 에러 메시지·주석만 바꾸고(`'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'`), 두 메서드의 저장 로직·트랜잭션·advisory lock(`acquireTriggerConfigLock`) 구조는 건드리지 않는다. 동시에 같은 경로로 두 워크스페이스가 트리거를 만들려 해도 DB 의 partial UNIQUE 인덱스가 원자적으로 승자를 정하고 패자는 23505 를 받아 `rethrowEndpointPathConflict` 가 409 로 매핑한다 — 사전 조회 후 삽입(TOCTOU 취약)이 아니라 삽입 실패를 사후 처리하는 올바른 패턴이 그대로 유지된다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 인덱스 이름 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)가 배포 순서(마이그레이션 선행 필요)에 결합돼 있음 — 기존에 문서화된 트레이드오프, 이번 PR 이 새로 만든 문제 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 224-228행(JSDoc + 상수)
  - 상세: 새 앱 코드가 V132 적용 전 DB(옛 인덱스 `idx_trigger_workspace_endpoint` 만 존재)에 붙으면 `isEndpointPathUniqueViolation` 이 이름 불일치로 false 를 돌려주고 `rethrowEndpointPathConflict` 는 원본 에러를 그대로 던진다. JSDoc 이 명시하듯 이는 "조용히 좁아지지만 안전한 방향"(세부 코드 없는 일반 `RESOURCE_CONFLICT` 로만 떨어짐, 500 아님)이라 실사용상 위험은 낮다. 마이그레이션-먼저-배포 순서를 지키면 발생하지 않는다.
  - 제안: 없음 — README §6 운영 절차가 이미 이 순서를 요구하고 있어 추가 조치 불요.

## 요약

이번 변경의 핵심은 `trigger.endpoint_path` 유일성 범위를 워크스페이스 단위에서 전역으로 넓히는 두 마이그레이션(V131 정리 + V132 `CREATE/DROP INDEX CONCURRENTLY` 교체)과, 그에 따른 `triggers.service.ts` 의 인덱스 이름 상수·에러 메시지 갱신이다. 유일성 검증은 이전과 동일하게 앱 레벨 체크가 아닌 DB UNIQUE 제약 위반 포착(원자적, TOCTOU 안전) 패턴을 유지하므로 이번 diff 가 새로운 경쟁 조건이나 잠금 문제를 만들지는 않는다. `CONCURRENTLY` 기반 무중단 인덱스 교체와 V131→V132 사이의 짧은 경쟁 창은 SQL 주석 자체에 상세히 인지·문서화돼 있고 실패해도 보호 수준이 줄지 않는 방향으로 설계돼 있어, 남은 창은 자동복구가 아닌 수동 운영 절차에 의존한다는 점만 기록해 둔다(INFO). Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW
