# 동시성(Concurrency) 코드 리뷰

## 검토 범위 확인

이번 배치(B-1~B-8, 커밋 `03f665c63` 등)는 대부분 harness/typecheck ratchet 이동, `__test-utils__`
dist 제외, DB `select` 투영, 타입 개명, CHANGELOG/plan 문서, 리뷰 산출물 커밋으로 구성되어 있고
런타임 동시성 로직을 직접 수정하는 부분은 좁다. 다음 자리들이 "동시 요청·race window"와 접점이
있어 직접 원본 파일을 열어 확인했다:

- `codebase/backend/src/common/filters/http-exception.filter.ts` — `isUniqueViolation` 로컬 함수를
  `pg-error.ts` 의 `isPostgresUniqueViolation` 로 교체 (raw 표면 23505 → 409 매핑 범위 확장)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — 손으로 짠 constraint
  추출 표현식을 `pgErrorConstraint()` 호출로 교체 (두 자리, cafe24/makeshop 각각의 "concurrent
  INSERT race" 백스톱 catch 블록)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(신규) +
  `endpoint-path-conflict-wrap.spec.ts` + fixture — `triggerRepository.save()` 호출이 전부
  `endpoint_path` UNIQUE 충돌 캐치로 래핑됐는지 확인하는 AST 정적 가드
- `codebase/backend/test/webhook-trigger.e2e-spec.ts` B4 — endpointPath 충돌 시 409 응답 형태를
  실 DB 경로로 고정하는 e2e 케이스 신설
- `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts` —
  race-backstop catch 블록을 태우는 유닛 테스트를 flat/wrapped 두 에러 표면으로 파라미터화

## 발견사항

- **[INFO]** `pgErrorConstraint()` 로의 치환은 동작 동일성이 유지된 순수 리팩터 — 새 동시성 결함 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1271-1274`,
    `:1825-1828`
  - 상세: 종전 인라인 표현식 `(err as {...})?.constraint ?? (err as {...})?.driverError?.constraint`
    와 `pg-error.ts:43-47` 의 `pgErrorConstraint()` 구현을 직접 대조했다 — `e.constraint ??
    e.driverError?.constraint` 로 두 표면·fallback 순서가 정확히 동일하다. 이 catch 블록이 지키는
    "concurrent INSERT race" 백스톱(사전 in-memory 체크 통과 후 두 요청이 모두 INSERT 를 시도해
    UNIQUE 제약이 최종 방어선이 되는 경로) 자체의 원자성·판정 로직은 변경되지 않았다. 회귀 테스트
    (`integration-oauth.service.cafe24.spec.ts:602-650`, `makeshop.spec.ts` 동형)가 flat/wrapped 두
    드라이버 에러 표면 모두에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`/해당 매핑이 나오는지 함께
    고정했다.
  - 제안: 조치 불요.

- **[INFO]** `GlobalExceptionFilter` 의 unique-violation 판정 확장은 요청별 상태만 다루므로 동시성
  관점에서는 무해 — 다만 매핑 범위가 넓어진 사실 자체는 API 계약 축의 변경
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`isPostgresUniqueViolation`)
  - 상세: `catch()` 는 요청마다 새로 호출되고 공유 가변 상태를 참조하지 않는다(로컬 변수 `status`/
    `code`/`message`/`details` 만 사용). race window 자체(동시 두 요청이 애플리케이션 사전 체크를
    모두 통과한 뒤 DB UNIQUE 제약에서 하나만 성공)를 만들거나 없애는 변경이 아니라, 그 결과로 온
    에러를 어떤 HTTP 상태로 번역하는지의 범위만 넓혔다. 이 항목은 동시성 결함이 아니라 API 계약
    범위 확장이므로 `api_contract` reviewer 영역이 더 적절하고 실제로 그쪽 리포트(`12_53_08`)가
    이미 다뤘다 — 여기서는 "동시 요청 처리 로직 자체는 안전하게 유지됨"만 교차 확인한다.
  - 제안: 조치 불요.

- **[INFO]** 신설 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 빌드/테스트 시점 정적 분석
  도구이며 런타임 동시 요청 처리와 무관 — 다만 그 존재 목적은 race-backstop 패턴 회귀 방지
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    (`findTriggerRepositorySaves`, `isWrappedByConflictCatch`)
  - 상세: 이 가드는 `triggers.service.ts` 안의 모든 `triggerRepository.save(...)` 호출이
    `.catch((err) => this.rethrowEndpointPathConflict(err))` 로 감싸였는지를 AST 로 세어, 다음
    사람이 새 `save()` 호출을 추가하면서 이 race-backstop 캐치를 빠뜨리는 것을 잡는다(§1.10 계약).
    가드 자신은 싱글스레드 정적 분석이라 동시성 결함의 대상이 아니다. `isWrappedByConflictCatch` 가
    `.catch` 콜백 안에서 실제 호출식만 인정하도록(주석/문자열 언급만으로는 통과 안 함) 좁힌 것도
    확인했다(`callsConflictWrapper`, `mentionsButDoesNotCall` 대조군).
  - 제안: 조치 불요.

- **[INFO]** 신설 e2e `B4` 는 순차 요청 2건으로 UNIQUE 제약 충돌 응답 형태를 검증 — "동시 두 요청"
  race window 자체를 재현하는 테스트는 아니나, 테스트 자신의 주석이 그 범위를 정확히 밝히고 있어
  오도하지 않음
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: `createWebhookTrigger` 로 먼저 하나를 만들고 그다음 같은 `endpointPath` 로 두 번째 POST 를
    보내는 **순차** 시나리오다. 실제 "동시 INSERT" race(두 요청이 동시에 사전 체크를 통과해 DB
    단에서만 갈리는 경우)를 재현하지는 않는다. 다만 테스트 상단 주석이 스스로 "단위 테스트가 mock
    하는 드라이버 에러 형태가 실제와 같은지는 이 케이스만 확인한다"고 명시해 그 범위를 정확히
    한정하고 있고, 실제 race 시나리오(동시 두 요청)의 로직 커버리지는 이미 unit 레벨
    (`triggers.service.spec.ts`, mock 된 `QueryFailedError`)이 맡고 있다. 새 e2e 는 그 unit mock 이
    가정하는 드라이버 에러 형태가 실제 Postgres 응답과 일치하는지를 검증하는 보완 계층으로 정확히
    기능한다 — 범위 과장이 없다.
  - 제안: 조치 불요. 향후 진짜 동시 INSERT race 를 e2e 로 재현하려면(두 `Promise.all` 요청을 같은
    `endpointPath` 로 동시에 보내는 형태) 별도 항목으로 고려할 수 있으나 이번 diff 의 목적(§1.10
    wire 계약 고정)에는 필수가 아니다.

이 외 파일(`workspaces.service.ts` DB `select` 투영, `workflow-versions.service.ts` 타입 개명,
`.claude/test-stages.sh`/`PROJECT.md` typecheck ratchet 이동, plan/CHANGELOG 문서)은 동시성·비동기
실행 경로(락, 공유 가변 상태, Promise 조합, 스레드/커넥션 풀)를 건드리지 않는다.

## 요약

이번 배치의 동시성 인접 변경은 전부 기존에 이미 존재하던 "unique-constraint race backstop" 패턴
(사전 체크 통과 후 동시 INSERT 가 DB UNIQUE 제약에서 걸리면 409 로 번역)을 **재사용 헬퍼로
치환하는 리팩터**와 **그 패턴이 새 코드에서 빠지지 않도록 감시하는 정적 가드/테스트 추가**로
구성되며, race window 를 여닫거나 원자성·동기화 방식을 바꾸는 실질 변경은 없다. `pgErrorConstraint()`
치환은 이전 인라인 표현식과 동작이 정확히 동일함을 직접 대조해 확인했고, `GlobalExceptionFilter` 의
판정 확장은 요청 로컬 상태만 다뤄 동시 요청 간 간섭 위험이 없다. 새 e2e/유닛 테스트는 race-backstop
경로의 커버리지를 강화하는 방향이며 자기 범위(순차 vs 실제 동시성)를 정확히 문서화하고 있다.
Critical/Warning 급 동시성 결함은 발견되지 않았다.

## 위험도

NONE
