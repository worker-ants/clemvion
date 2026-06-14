# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` + 구현 diff (3064c9c6...HEAD)
검토 모드: --impl-done

---

## 발견사항

### 1. [INFO] `TERMINAL_REVOKE_RECONCILE_QUEUE` 큐의 group 분류

- **target 위치**: `codebase/backend/src/modules/system-status/system-status.constants.ts` L75-78 (diff 신규 추가)
- **위반 규약**: 직접 위반 규약 없음 — 참고 규약: `spec/2-navigation/15-system-status.md §2.3` 의 `QueueGroup` 의미 도메인
- **상세**: `TERMINAL_REVOKE_RECONCILE_QUEUE` 가 `group: 'system'` 으로 등록됐다. spec R15 에서 "login-history-pruner 선례와 동일 패턴" 으로 명시했고, `LOGIN_HISTORY_PRUNER_QUEUE`·`NOTIFICATION_SECRET_ROTATOR_QUEUE` 등 동류 maintenance scheduler 가 모두 `group: 'system'` 인 것과 일관된 분류다. `NOTIFICATION_WEBHOOK_QUEUE`(outbound webhook 발송)가 `group: 'integration'` 인 점과 비교하면 동일 EIA 모듈 내에서도 역할에 따라 그룹이 달라지는데, revoke reconciler 는 외부 통합 호출이 아닌 내부 maintenance sweep 이라 `'system'` 이 의미상 적합하다.
- **제안**: 현 분류(`'system'`)를 유지한다. 추가 조치 불필요.

### 2. [INFO] `RECONCILE_TERMINAL_STATUSES` 와 `interaction.service.ts` 의 `TERMINAL_STATUSES` 이중 정의

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L47-56 (diff 신규 추가), `interaction.service.ts` L33
- **위반 규약**: 직접 위반 규약 없음 — 참고: `spec/conventions/error-codes.md §1` 의 "의미 기반 명명" 원칙
- **상세**: 두 상수가 동일한 값 집합(COMPLETED, FAILED, CANCELLED)을 표현하나 타입이 각각 `readonly ExecutionStatus[]`(SQL `IN` 절용 배열)와 `ReadonlySet<ExecutionStatus>`(`.has()` 용 Set)로 달라 단일 공유 상수로 통합이 불가능하다. diff 의 JSDoc 주석에 "이름 충돌 회피 위해 `RECONCILE_` prefix" 이유가 명시되어 의도가 드러난다. 명명 규약 상 의미 기술 원칙(error-codes.md §1)에도 부합한다.
- **제안**: 현 설계를 유지한다. 추가 조치 불필요.

### 3. [INFO] spec frontmatter `code:` 글로브가 신규 파일을 포함하는지 확인

- **target 위치**: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` — `codebase/backend/src/modules/external-interaction/**`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"를 명시해야 함
- **상세**: diff 신규 파일 `terminal-revoke-reconciler.service.ts` 는 `codebase/backend/src/modules/external-interaction/**` 글로브에 이미 포함된다. `system-status.constants.ts` 변경 및 e2e 테스트(`test/system-status.e2e-spec.ts`)는 spec-impl-evidence 의 `code:` 의무 대상(구현 경로)이 아니라 인프라 등록/검증 파일이므로 frontmatter 미등재가 정상이다.
- **제안**: 추가 조치 불필요. 글로브가 자동 포함한다.

---

## 요약

이번 diff 는 interaction-token.service.ts, system-status.constants.ts, system-status.e2e-spec.ts 세 파일에 걸친 범위 제한적 변경이다. `TERMINAL_STATUSES` 상수를 `RECONCILE_TERMINAL_STATUSES` 로 리네임해 동일 모듈 내 naming collision 을 해소하고, `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 `MONITORED_QUEUES` 에 `group: 'system'` 으로 등재하며, 해당 큐 이름을 e2e 기대값 목록에 추가한 세 가지 변경이다. `spec/conventions/` 의 명명 규약(error-codes.md §1 의미 기반 명명, UPPER_SNAKE_CASE), swagger 데코레이터 규약(swagger.md §2-1 `@ApiBearerAuth`), spec-impl-evidence frontmatter 규약(spec-impl-evidence.md §2 글로브 포함 확인) 어느 것도 직접 위반하지 않는다. 발견사항 전부 INFO 등급의 확인 사항이며, 채택 시 다른 시스템이 가정한 invariant 를 깨는 요소가 없다.

## 위험도

NONE
