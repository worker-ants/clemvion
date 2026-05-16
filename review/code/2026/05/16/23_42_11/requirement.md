# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `V052` 마이그레이션 — CHECK 제약 재정의 시 기존 값 보호 확인 필요
  - 위치: `backend/migrations/V052__notification_type_integration_action_required.sql` 라인 7-17
  - 상세: `DROP CONSTRAINT IF EXISTS notification_type_check` 후 새 CHECK 로 교체하는 방식은 기존 데이터 중 이미 CHECK 에 없던 값이 존재하는 경우 `ADD CONSTRAINT` 단계에서 실패한다. 운영 환경에 이미 비정상 값이 적재되어 있으면 마이그레이션이 롤백되며 알림 테이블 전체 INSERT 가 막힌다. 마이그레이션 스크립트에 "기존 invalid 데이터 사전 정리" 또는 최소한 사전 조회 스텝이 없다.
  - 제안: 마이그레이션 실행 전 `SELECT COUNT(*) FROM notification WHERE type NOT IN (...)` 로 invalid 행 수를 로그에 남기거나, pre-flight 검사 쿼리를 스크립트 앞에 추가한다.

- **[WARNING]** `PaginationQueryDto.sort` — 기본값 `created_at`이 새 `@Matches` 패턴과 불일치
  - 위치: `backend/src/common/dto/pagination.dto.ts` 라인 641 (`sort?: string = 'created_at'`)
  - 상세: `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 는 영문자 시작 + 영숫자/밑줄만 허용한다. 기본값 `'created_at'` 은 이 패턴과 일치하므로 문제 없다. 그러나 `@IsOptional()` 이 적용되어 있어 `sort` 가 `undefined` 일 때 `@Matches` 검증이 스킵된다. 이 경우 서비스 레이어의 `getSortColumn()` 화이트리스트가 2차 방어를 담당하지만, 기본값이 DTO 필드에 직접 선언되어 있어 `undefined` 가 실제로 도달하는 경우가 없는지 검토가 필요하다. (`class-transformer` 적용 순서에 따라 기본값이 채워지기 전에 validation 이 실행될 수 있다)
  - 제안: `@IsOptional()` 과 기본값의 실행 순서를 단위 테스트로 명시적으로 검증하거나, `sort` 를 `@IsString()` + `@Matches(...)` + default `'created_at'` 으로 선언하고 Optional 제거를 검토한다.

- **[WARNING]** `sanitizePayloadForWs` — 깊이 초과(MAX_SANITIZE_DEPTH) 경우 원본 참조가 그대로 반환됨
  - 위치: `backend/src/modules/websocket/websocket.service.ts` 라인 93-94 (`if (depth > MAX_SANITIZE_DEPTH) return value;`)
  - 상세: depth 초과 시 `value` 원본을 그대로 반환한다. 이 경로에서 하위 객체에 credential 키가 포함되어 있어도 redact 되지 않은 채로 WebSocket 으로 emit 된다. 이번 변경(W-25)은 "unchanged 시 원본 참조 반환" 최적화를 추가했는데, 이로 인해 depth 초과 케이스가 의도적인 것인지 보안 허점인지 주석으로 명확히 하지 않았다.
  - 제안: `if (depth > MAX_SANITIZE_DEPTH) return value;` 에 "depth 초과 시 하위 credential 미 redact" 동작을 명시하는 주석을 추가하거나, 실제로 이 경로가 credential 데이터에 도달하지 않음을 단위 테스트로 검증한다.

- **[WARNING]** `HMAC allowlist` — `UnauthorizedException` 의 `message` 필드에 알고리즘명 노출
  - 위치: `backend/src/modules/hooks/hooks.service.ts` 라인 1210-1213
  - 상세: `throw new UnauthorizedException({ code: 'AUTH_FAILED', message: \`Unsupported HMAC algorithm: ${algorithm}\` })` 가 클라이언트에게 unsupported 알고리즘명을 그대로 반환한다. 외부 노출 엔드포인트에서 내부 설정값(hmacAlgorithm)을 응답에 포함시키는 것은 정보 노출(information leakage) 위험이 있다.
  - 제안: 응답 메시지를 `Unsupported HMAC algorithm` 고정 문자열로 교체하고 알고리즘명은 서버 로그에만 기록한다.

- **[WARNING]** `statistics.getSummary` 리팩토링 — workflowId 필터 적용 후 `getRawOne` 이 `null` 반환 시 `buildSummary({})` 로 처리되는데 원래 쿼리(워크스페이스 전체)와 의미가 달라짐
  - 위치: `backend/src/modules/statistics/statistics.service.ts` 라인 1537-1543
  - 상세: 이전 코드에서는 workflowId 가 있을 때 별도 쿼리가 없으면 workspace 집계를 반환했으나, 리팩토링 이후 workflowId 가 있지만 해당 워크플로에 실행 기록이 없으면 `result` 가 `null` 이 되어 `buildSummary({})` 를 통해 모든 값이 0 인 통계를 반환한다. 이는 의도된 동작이지만, 기존 동작(workflow 데이터 없을 때 fallback 방식)과 정확히 일치하는지 문서화되어 있지 않다.
  - 제안: 스펙 또는 서비스 주석에 "해당 workflowId 에 실행 기록이 없으면 전부 0 반환" 동작을 명시한다.

- **[INFO]** `V053` 마이그레이션 — `title` 컬럼이 인덱스에 미포함
  - 위치: `backend/migrations/V053__notification_workspace_type_resource_idx.sql` 라인 284-285
  - 상세: 주석에 기술된 쿼리 형태는 `WHERE workspace_id = $1 AND type = $2 AND resource_id = $3 AND title = $4 AND created_at >= $5` 인데, 생성된 인덱스는 `(workspace_id, type, resource_id, created_at DESC)` 로 `title` 이 없다. `title` 카디널리티가 낮으면 인덱스 스캔 후 필터로 충분하지만, `title` 이 선택도 높은 컬럼인 경우 index scan + heap fetch 가 발생할 수 있다. 설계상 의도임을 주석에 명시하면 혼동을 방지할 수 있다.
  - 제안: 주석에 "`title` 은 인덱스 후 heap filter 로 처리 — 카디널리티 낮음(동일 resource 내 title 고정)" 와 같은 사유를 추가한다.

- **[INFO]** `websocket.gateway.ts` MAX_SUBSCRIPTIONS 재검사 — TOCTOU 완화이지만 여전히 non-atomic
  - 위치: `backend/src/modules/websocket/websocket.gateway.ts` 라인 1607-1615
  - 상세: `authorize()` 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사를 추가했으나, 두 번의 체크 사이 또 다른 코루틴이 동시에 add 까지 완료할 수 있다. Node.js 싱글 스레드 특성상 실제 race 발생 가능성은 매우 낮지만, Set 크기 체크와 Set.add 가 동일 마이크로태스크 체크포인트 내에 있지 않으면 이론상 MAX+1 구독이 가능하다.
  - 제안: 현재 수준의 완화로 충분하면 주석에 "Node.js 단일 스레드 이벤트 루프에서 사실상 atomic" 을 명시하고 종결한다.

- **[INFO]** `backend/package.json` overrides — 의존성 버전 범위 표기 불일치
  - 위치: `backend/package.json` 라인 566-567 (`"protobufjs": "^7.5.6"`, `"fast-uri": "^3.1.2"`)
  - 상세: C-13 에서 overrides 로 추가한 `protobufjs ^7.5.6` 는 `package-lock.json` 의 실제 resolved 버전이 `7.5.8` 이고, `fast-uri` 는 `3.1.2` 다. `^7.5.6` 범위는 향후 `7.x` 패치에서 자동 업그레이드되어 CVE 가 재발할 가능성이 있다. 보안 fixes 적용 목적의 overrides 는 정확한 버전(`7.5.8`, `3.1.2`)으로 고정하는 것이 더 안전하다.
  - 제안: overrides 를 `"protobufjs": "7.5.8"` 과 `"fast-uri": "3.1.2"` 로 정확히 고정하거나, CVE 해소된 최소 버전임을 명시하는 주석을 추가한다.

- **[INFO]** `webhook e2e` — `crypto` 모듈 import 확인 필요
  - 위치: `backend/test/webhook-trigger.e2e-spec.ts` 라인 1854, 1863, 1872, 1881
  - 상세: `crypto.randomBytes(8).toString('hex')` 로 교체했는데, 변경된 코드 diff 내에 `import crypto from 'crypto'` 또는 `import { randomBytes } from 'crypto'` 가 보이지 않는다. Node.js 내장 모듈이라 전역 접근이 가능하지만, TypeScript strict 모드에서는 명시적 import 가 필요하다. 커밋 메시지에 "tsc 통과"라고 명시되어 있으므로 import 는 파일 상단에 존재할 가능성이 높지만, diff 에서 확인이 되지 않는다.
  - 제안: diff 상단에 `import { randomBytes } from 'crypto'` 또는 `import * as crypto from 'crypto'` 가 있는지 확인한다.

---

## 요약

이번 커밋은 Critical 7건 + Warning 15건의 리뷰 항목을 일괄 처리한 대규모 수정이다. 요구사항 충족 측면에서 핵심 결함(V052 CHECK 미포함으로 인한 알림 발사 실패, rawBody 미설정으로 인한 HMAC 인증 실패, allNodes.find O(N), 구독 경쟁 조건 등)은 의도한 대로 구현되어 있다. 그러나 V052 마이그레이션에서 기존 invalid 데이터에 대한 사전 검사가 없고, HMAC 알고리즘명이 에러 응답에 노출되며, sanitizePayloadForWs 의 depth 초과 경로에서 credential redact 가 보장되지 않는 점은 보완이 필요하다. 전반적으로 의도한 기능을 대부분 올바르게 구현했으나 일부 에러 시나리오와 엣지 케이스에서 미흡한 부분이 남아 있다.

---

## 위험도

MEDIUM
