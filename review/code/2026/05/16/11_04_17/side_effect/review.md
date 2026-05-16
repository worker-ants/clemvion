# 부작용(Side Effect) 리뷰

세션: `review/code/2026/05/16/11_04_17`
리뷰어: side_effect

---

### 발견사항

---

#### 1. OAuthBeginResultDto 시그니처 변경 — 호출자 타입 호환성

- **[WARNING]** `OAuthBeginResultDto` 의 `authorizeUrl` 과 `state` 가 필수(`string`)에서 선택(`string?`)으로 변경됨. 기존 호출자가 해당 필드를 non-null 단언 없이 직접 사용하는 경우 런타임 undefined 참조 발생 가능.
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 7)
  - 상세: 기존에 `authorizeUrl: string`, `state: string` 이었던 필드가 이번 변경으로 `authorizeUrl?: string`, `state?: string` 으로 전환되었다. 이 DTO 를 소비하는 프론트엔드 코드 또는 다른 서비스 코드가 `result.authorizeUrl.startsWith(...)` 처럼 옵셔널 체크 없이 접근하면 `TypeError: Cannot read properties of undefined` 가 발생한다.
  - 제안: 프론트엔드의 `/api/oauth/begin` 응답 처리 코드 전체에서 `authorizeUrl` / `state` 접근 시 옵셔널 체이닝(`?.`) 또는 `mode` 분기 체크를 강제 적용했는지 확인한다. TypeScript strict null checks 가 활성화된 환경이라면 컴파일 오류로 잡히지만, 그렇지 않으면 런타임 버그가 된다.

---

#### 2. `Integration` 엔티티에 신규 컬럼 추가 — ORM 캐시/매핑 부작용

- **[INFO]** `Integration` 엔티티에 `consecutiveNetworkFailures` 컬럼이 추가됨. 마이그레이션(V049)이 함께 포함되어 DDL 정합성은 확보되어 있으나, TypeORM 의 엔티티 캐시나 스키마 자동동기화(`synchronize: true`) 설정이 활성화된 환경에서는 의도치 않은 DDL 재실행이 발생할 수 있다.
  - 위치: `backend/src/modules/integrations/entities/integration.entity.ts` (파일 8), `backend/migrations/V049__integration_consecutive_network_failures.sql` (파일 4)
  - 상세: `NOT NULL DEFAULT 0` 으로 기존 행을 backfill 하는 구조는 올바르다. 단, `synchronize: true` 가 활성화된 로컬 개발 환경에서 마이그레이션과 엔티티 정의가 동시에 배포될 경우 TypeORM 이 마이그레이션과 별도로 `ALTER TABLE` 을 추가 실행하려 시도할 수 있다.
  - 제안: 프로젝트가 `synchronize: false` + Flyway(또는 유사 툴) 전용 마이그레이션 모드로 운영됨을 확인하거나, 개발 환경 문서에 이 조건을 명시한다.

---

#### 3. `enqueueCafe24BackgroundRefresh` 쿼리 조건 확장 — 스캔 범위 부작용

- **[INFO]** `lastRotatedAt: LessThan(cutoff)` 에서 `Or(LessThan(cutoff), IsNull())` 로 변경되어 기존에는 조회되지 않던 `lastRotatedAt IS NULL` 행들이 refresh 대상에 포함됨.
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` (파일 10, line ~443)
  - 상세: 의도된 변경이며 코드 주석에도 설명되어 있다. 다만 이 변경으로 인해 legacy `lastRotatedAt = NULL` 행이 다수인 환경에서는 첫 실행 시 refresh 큐에 예상보다 많은 잡이 한꺼번에 적재될 수 있다. BullMQ jobId dedup 이 작동하므로 중복 처리는 방지되지만, 큐 부하가 일시적으로 급증할 수 있다.
  - 제안: 운영 배포 시점에 `lastRotatedAt IS NULL` 인 `cafe24` + `connected` 행 수를 사전에 파악하고, 필요하면 배포 직후 큐 모니터링을 강화한다.

---

#### 4. `Cafe24TokenRefreshProcessor` 상태 검증 확장 — 동작 범위 변경

- **[INFO]** `source === 'background'` 조건부 status 검증이 `source` 무관 검증으로 확장됨. 기존에 `proactive` 잡은 status 검증 없이 통과했으나, 이제 `status !== 'connected'` 이면 모든 소스에서 스킵된다.
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (파일 40)
  - 상세: 코드 주석(CONC H-2)에 race-safe 이유가 상세히 설명되어 있어 의도된 변경임은 명확하다. 다만 `proactive` 경로에서 `status = 'connected'` 이외의 상태로 진입하는 케이스(예: reauthorize 진행 중 proactive 가 동시에 발화)가 이전과 다르게 처리된다. handler 의 `resolveIntegration` 에서 선행 검증이 있으므로 실제 영향은 작지만, 로그 출력이 달라진다(`source=` 인자 추가).
  - 제안: 변경사항 자체는 더 안전하다. 추가 조치 불필요.

---

#### 5. `make e2e-test` / `e2e-test-full` 의 `--build` 플래그 추가 — Docker 빌드 부작용

- **[INFO]** `docker compose run --rm --build` 가 추가됨. `--build` 플래그를 `docker compose run` 에 적용하면 runner 이미지도 rebuild 한다. `backend-e2e-runner` 이미지가 Dockerfile 에서 별도 빌드 스테이지를 가진다면 불필요한 빌드가 발생할 수 있다.
  - 위치: `Makefile` (파일 2, `e2e-test` / `e2e-test-full` 타겟)
  - 상세: `docker compose up --build` 는 서비스 이미지를 rebuild 하는 표준 플래그이며 BuildKit layer cache 가 활성화되면 변경 없는 레이어는 재사용된다. 이 동작은 의도와 일치하고 실질적인 부작용은 없다.
  - 제안: 현재 runner 이미지가 실제로 `--build` 대상에 포함되는지(즉, `docker-compose.e2e.yml` 에서 `build:` 절이 정의되어 있는지) 확인하면 충분하다.

---

#### 6. `getConfigSummary` 시그니처에 `locale` 파라미터 추가

- **[INFO]** `getConfigSummary(nodeType, config, context)` 에서 `getConfigSummary(nodeType, config, context, locale)` 로 시그니처 확장. 기본값 `DEFAULT_LOCALE` 이 지정되어 있어 기존 호출자는 영향 없다.
  - 위치: `frontend/src/lib/utils/node-config-summary.ts` (파일 111)
  - 상세: 옵셔널 파라미터에 기본값이 있으므로 하위 호환이 유지된다. 부작용 없음.
  - 제안: 이미 올바르게 처리됨. 추가 조치 불필요.

---

#### 7. `consumePreviewToken` 의 평문 자격증명 처리 변경 — 호출자 에러 핸들링

- **[WARNING]** 기존 `consumePreviewToken` 은 `enc:` prefix 없는 평문 자격증명을 `JSON.parse` 통과로 허용했으나, 이제 `INTEGRATION_CREDENTIALS_INVALID` 에러로 hard-fail 한다. 이 함수의 호출 경로에서 평문 자격증명이 실제로 입력될 수 있는 레거시 경로(수동 마이그레이션, ETL, 운영 스크립트 등)가 존재한다면 기존에 조용히 성공하던 흐름이 에러로 전환된다.
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (파일 13, `consumePreviewToken`), 테스트: 파일 12 line ~527
  - 상세: 테스트가 새 동작을 명시적으로 검증하므로 의도된 변경임은 명확하다. 그러나 운영 DB 에 암호화되지 않은 레거시 자격증명이 존재하는 경우 해당 통합의 preview token 소비 플로우가 즉시 실패한다.
  - 제안: 배포 전 운영 DB 에서 `credentials NOT LIKE 'enc:%'` 행 수를 확인하고, 존재하면 마이그레이션 스크립트로 재암호화하거나 해당 행을 무효화한다. `V049` 이후 migration 체인에 이 검증을 포함시키는 것을 권장한다.

---

#### 8. 노드 warning 메시지 한국어 → 영어 일괄 변경 — 프론트엔드 표시 부작용

- **[WARNING]** 26+ 노드 스키마의 `warningRules[].message` 가 한국어에서 영어로 일괄 변경됨. 프론트엔드에서 이 메시지를 직접 렌더링하는 경로가 `getConfigSummary` 의 `translateBackendWarning` 를 통해 한국어로 번역되도록 변경되어 있으나, `translateBackendWarning` 의 매핑 테이블이 모든 변경된 메시지를 정확히 커버하는지가 핵심이다.
  - 위치: `frontend/src/lib/i18n/backend-labels.ts` (파일 108, diff omitted), `frontend/src/lib/utils/node-config-summary.ts` (파일 111)
  - 상세: `backend-labels.ts` 의 diff 가 prompt size limit 으로 생략되었다. 만약 번역 매핑 테이블에 누락된 영어 메시지가 있으면 ko 로케일 사용자에게 영어 그대로 노출된다. 이는 UX 회귀다.
  - 제안: `backend-labels.ts` 의 `WARNING_KO` (또는 동등 매핑 객체)에 이번 PR 에서 변경된 모든 영어 메시지가 ko 번역과 함께 등록되어 있는지 전수 대조한다. CI 테스트에서 `translateBackendWarning(영어메시지, 'ko') !== undefined` 를 검증하는 스냅샷 테스트를 추가하는 것을 권장한다.

---

#### 9. `IntegrationsService.create` 에 `lastRotatedAt: new Date()` 초기화 추가 — 암묵적 시간 의존

- **[INFO]** 신규 통합 생성 시 `lastRotatedAt` 이 `new Date()` 로 명시 초기화된다. 이는 의도된 수정이며 테스트도 추가되어 있다. 단, `new Date()` 는 호출 시점의 서버 시각을 사용하므로, 서버 시각이 DB 시각과 크게 차이나는 환경에서는 cutoff 계산이 미묘하게 달라질 수 있다.
  - 위치: `backend/src/modules/integrations/integrations.service.ts` (파일 15, line ~626)
  - 상세: 실질적인 문제는 없다. `new Date()` 대신 DB 서버 시각(`NOW()`)을 사용하는 방식이 더 정합하지만, 10일 cutoff 기준에서 수초 차이는 무의미하다.
  - 제안: 추가 조치 불필요.

---

### 요약

이번 변경은 Cafe24 Private OAuth 플로우 추가, integration 연속 네트워크 실패 카운터 도입, 노드 warning 메시지 영어화, e2e Makefile `--build` 추가, 문서 동기화 등 여러 관심사를 포함한다. 부작용 관점에서 가장 주목할 지점은 두 가지다. 첫째, `OAuthBeginResultDto` 에서 `authorizeUrl` / `state` 가 required → optional 로 바뀌어 프론트엔드 호출자가 undefined 핸들링 없이 접근하면 런타임 오류가 발생할 수 있다. 둘째, `consumePreviewToken` 의 평문 자격증명 hard-fail 전환은 올바른 보안 방향이지만, 운영 DB 에 레거시 미암호화 행이 있다면 기존에 통과하던 흐름이 즉시 실패로 전환된다. 노드 warning 메시지 일괄 영어화는 `translateBackendWarning` 매핑 테이블의 완전성에 의존하며, diff 가 생략된 `backend-labels.ts` 에서 누락이 발생할 경우 ko 로케일 사용자에게 영어 메시지가 직접 노출되는 UX 회귀가 생긴다. 그 외 DB 컬럼 추가, 쿼리 조건 확장, Makefile `--build` 추가는 의도된 범위 안에서 동작하며 심각한 부작용이 없다.

### 위험도

MEDIUM
