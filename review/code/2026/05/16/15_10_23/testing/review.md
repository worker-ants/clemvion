# Testing Review

리뷰 대상: consistency-checker 산출물 및 spec 변경 (`cafe24-mall-dup-ux-a7f2c8` worktree)

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `scope-tab.test.tsx` mock 데이터가 삭제된 `appUrl` 필드를 전제하여 테스트가 spec 불일치 상태로 유지됨
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` line 133, 173, 197
  - 상세: `cross_spec/review.md` 발견사항 2에 따르면 이번 worktree spec은 `GET /api/integrations/:id` 응답의 `IntegrationDto`에서 `appUrl: string | null` 필드를 제거했다. 그러나 해당 테스트 파일의 mock 데이터는 세 위치에서 `appUrl: "https://example.com/api/3rd-party/cafe24/install/abc"` 를 포함한다. 이는 spec이 삭제한 계약을 테스트가 계속 강제함을 의미하며, 두 가지 문제를 야기한다. (a) spec 방향대로 `appUrl`을 실제로 제거하여 구현하면 이 테스트가 깨지거나 기대 동작과 불일치한다. (b) spec을 복원하지 않고 구현을 진행하면 테스트는 통과하나 실제 API 응답에 `appUrl`이 없어 App URL 카드 UI가 동작하지 않는다. 어느 방향이든 mock을 현재 spec과 정렬시키지 않은 채 방치하면 테스트가 제품 동작을 검증하는 것이 아니라 삭제된 과거 동작을 검증하게 된다.
  - 제안: spec 방향을 먼저 결정한다. (A) `appUrl` 필드를 spec에 복원하면 mock 데이터는 그대로 유효하다. (B) `appUrl`을 실제로 제거한다면 `scope-tab.test.tsx`의 mock 데이터에서 `appUrl` 필드를 제거하고, App URL 카드 관련 렌더링 어서션도 삭제 또는 조건부로 교체한다.

---

### 발견사항 2

- **[CRITICAL]** `needsAttention` 함수와 `attentionCount` 변수에 대한 테스트가 spec 삭제와 불일치 — 회귀 위험
  - 위치: `frontend/src/app/(main)/integrations/page.tsx`, `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
  - 상세: `cross_spec/review.md` 발견사항 1에서 확인된 것처럼, 이번 spec 변경은 `Attention` 가상 필터 칩과 `?status=attention` 쿼리값을 완전히 제거했다. `needsAttention(...)` 함수는 `status-badge.tsx`에서 export되고 있으며, `page.tsx`는 이를 import하여 `attentionCount`를 계산한다. 이 함수들에 대한 단위 테스트가 존재한다면 그 테스트는 현재 spec에서 정의를 잃은 동작을 검증하게 된다 — spec 없는 코드 경로(유령 로직)에 테스트 커버리지가 형성된다. 반대로 이 함수들에 대한 테스트가 없다면, 이번 변경에서 해당 코드가 그대로 잔류하더라도 회귀를 잡을 수단이 없다.
  - 제안: (A) `Attention` 개념을 spec에 복원하는 방향이라면 `needsAttention`·`attentionCount` 단위 테스트도 보존한다. (B) Attention 개념을 실제로 제거한다면 `needsAttention` 함수 및 `attentionCount` 연산 코드를 제거하고, 해당 함수에 대한 테스트도 함께 삭제한다. 어떤 방향이든 spec → 코드 → 테스트가 동일 계약을 가리켜야 한다.

---

### 발견사항 3

- **[WARNING]** 배너 조건 단순화(`token_expires_at <= now() + 7d`)에 대한 엣지 케이스 테스트 부재 가능성
  - 위치: `spec/2-navigation/4-integration.md` §2.4, §11.4; 배너 카운트 관련 프론트엔드/백엔드 테스트
  - 상세: `cross_spec/review.md` 발견사항 3에서 지적한 것처럼, 기존 spec의 배너 조건은 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'`였다. 이번 변경으로 단순화된 `token_expires_at <= now() + 7d`는 `expired` 상태 행이 "만료 임박"으로도 집계되어 이중 카운트가 발생하는 경계 케이스를 방어하지 않는다. 이 경계 케이스(`token_expires_at`가 과거인 `expired` 상태 행)를 검증하는 테스트가 없다면, 배너 카운트가 `expired ∪ expiring`으로 중복 집계되는 버그가 프로덕션에서만 발견된다.
  - 제안: 배너 조건 변경에 대한 단위 테스트 또는 통합 테스트에 다음 엣지 케이스를 추가한다. (a) `status='expired', token_expires_at=과거` — 배너 `expiring` 카운트에 포함되지 않아야 함. (b) `status='connected', token_expires_at=6일 후` — expiring 카운트에 포함되어야 함. (c) `status='pending_install'` — 배너에서 제외되어야 함.

---

### 발견사항 4

- **[WARNING]** `GET /api/integrations?status=expiring` 가상 필터값 변환 규칙 삭제 — 해당 API 엔드포인트 테스트 회귀 가능성
  - 위치: `spec/2-navigation/4-integration.md` §9.1; 백엔드 `integrations.controller.ts` 및 관련 테스트
  - 상세: `cross_spec/review.md` 발견사항 4에 따르면, 이번 spec 변경은 `GET /api/integrations` 의 `status` 파라미터 허용값 목록과 가상 필터값 변환 규칙을 모두 삭제했다. `Expiring (7일 이내)` 칩은 여전히 spec §2.3에 존재하므로 프론트엔드는 계속 `?status=expiring`을 전송한다. 만약 백엔드에 `status=expiring` 파라미터를 처리하는 테스트가 있었다면, 그 테스트는 spec 삭제에도 불구하고 구현과 함께 계속 통과하거나 이제 0건 반환을 기대해야 하는 불일치 상태가 된다. 반대로 테스트가 없다면, 구현에서 변환 규칙을 누락해도 잡을 수단이 없다.
  - 제안: 백엔드의 `integrations` 목록 조회 테스트에서 `status=expiring` 케이스를 명시적으로 검증한다. spec이 복원되는 방향이라면 "변환 규칙 적용 후 `connected AND token_expires_at within 7d` 조건의 행만 반환"을 어서션한다. spec에서 칩 자체를 제거하는 방향이라면 `status=expiring` 파라미터 처리 테스트를 제거하거나 "0건 반환 또는 400 에러" 어서션으로 교체한다.

---

### 발견사항 5

- **[WARNING]** `GET /api/integrations/cafe24/precheck` 신규 엔드포인트에 대한 테스트 계획 부재
  - 위치: `plan/in-progress/spec-update-cafe24-public-dup-guard.md` §9.2; `naming_collision/review.md` 발견 1
  - 상세: `naming_collision/review.md`는 신규 `GET /api/integrations/cafe24/precheck` 엔드포인트가 기존 NestJS 라우터의 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 와 라우트 우선순위 충돌 위험이 있음을 경고했다. 이 엔드포인트에 대한 e2e 또는 통합 테스트가 계획되지 않은 상태에서 구현하면, 라우트 우선순위 오류가 실제 HTTP 호출 없이는 발견되지 않는다. 단위 테스트는 NestJS 라우팅 레이어를 통하지 않으므로 이 충돌을 검증할 수 없다.
  - 제안: 신규 `GET /api/integrations/cafe24/precheck` 핸들러에 대해 e2e 또는 supertest 기반 통합 테스트를 작성한다. 테스트에서 검증할 케이스: (a) `GET /api/integrations/cafe24/precheck?mallId=testmall` 가 200을 반환하고 `@Get(':id')`로 라우팅되지 않음. (b) 유효한 UUID로 `GET /api/integrations/:id`가 여전히 정상 동작함 (회귀 방지). 핸들러 선언 순서가 올바른지는 단위 테스트가 아닌 이 수준의 테스트만 검증 가능하다.

---

### 발견사항 6

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Public 흐름 재사용 — 프론트엔드 에러 처리 분기 테스트 갭
  - 위치: `naming_collision/review.md` 발견 2; `backend/src/modules/integrations/integration-oauth.service.ts:1068`; 프론트엔드 에러 처리 코드
  - 상세: `naming_collision/review.md`가 지적한 것처럼, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드를 Public 흐름에도 재사용하면 코드 이름의 `PRIVATE`이 의미를 오도한다. 프론트엔드에서 이 에러 코드를 기반으로 분기 로직(409 처리)을 작성할 때 `PRIVATE` 이름만 보고 Public 경로의 409 처리를 누락할 수 있다. 만약 해당 분기 로직에 대한 테스트가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드를 명시적으로 사용한다면, 에러 코드 이름을 `CAFE24_MALL_ALREADY_CONNECTED`로 변경 시 테스트도 함께 갱신해야 한다. 반대로 Public 흐름 409 처리를 테스트하지 않는다면 해당 경로의 커버리지 갭이 된다.
  - 제안: 프론트엔드에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드를 처리하는 분기 로직에 대해 (a) Private 흐름 409 응답 처리, (b) Public 흐름 409 응답 처리 두 케이스를 각각 테스트한다. 에러 코드 이름을 `CAFE24_MALL_ALREADY_CONNECTED`로 일반화하기로 결정했다면 테스트 내 에러 코드 문자열도 함께 갱신한다.

---

### 발견사항 7

- **[INFO]** consistency-checker orchestrator의 target 문서 수집 버그 — 다른 checker 검토 품질 영향
  - 위치: `rationale_continuity/review.md` 발견사항 2 ("target 문서가 orchestrator에 `(없음)`으로 전달됨")
  - 상세: orchestrator가 `spec/2-navigation/4-integration.md`의 내용을 prompt_file에 포함시키지 못해 "구현 대상 영역: (없음)"으로 기재된 버그가 발견됐다. `rationale_continuity` checker는 직접 Read로 분석을 보완했지만, 이 버그가 지속되면 다른 checker들이 target 문서 없이 분석을 수행하거나 빈 입력 기반의 불완전한 결론을 낼 수 있다. orchestrator 자체에 대한 테스트(또는 검증 로직)가 있다면 이 케이스를 포착했을 것이다.
  - 제안: orchestrator의 파일 수집 단계에 대한 자동화 검증을 추가한다. 파일이 존재하는데도 `(없음)`이 반환되는 경우 에러를 올리는 가드 로직 및 이를 검증하는 테스트를 작성한다. consistency-checker 자체의 테스트 가능성을 높이기 위해 파일 읽기 로직을 별도 함수로 분리하고 단위 테스트 대상으로 만드는 것을 고려한다.

---

### 발견사항 8

- **[INFO]** `install_token` 생명주기 변경 — 기존 callback 성공 시 보존 로직에 대한 회귀 테스트 필요
  - 위치: `spec/1-data-model.md` §2.10 Integration `install_token` / `install_token_issued_at` 컬럼 설명 변경
  - 상세: 이번 diff에서 `install_token` 설명이 "callback 성공 시 보존" → "callback 성공 또는 TTL 만료 시 NULL"로 변경됐고, `install_token_issued_at` 설명도 "callback 성공 시 보존" → "callback 성공 시 NULL"로 변경됐다. 이는 실제 생명주기 동작의 변화를 의미한다. 이 변경에 대응하는 테스트(callback 성공 시 `install_token`이 NULL로 초기화되는지 검증하는 테스트)가 있는지 확인이 필요하다. 기존 테스트가 "callback 성공 후 `install_token` 보존"을 어서션하고 있었다면 회귀 테스트가 역방향으로 작동하게 된다.
  - 제안: `oauth callback` 성공 핸들러 테스트에 `install_token` 및 `install_token_issued_at`이 callback 이후 `NULL`로 초기화되는지를 명시적으로 어서션하는 케이스를 추가 또는 수정한다.

---

## 요약

이번 변경은 주로 spec 문서(`spec/2-navigation/4-integration.md`, `spec/1-data-model.md`) 및 consistency-checker 산출물(review/consistency/)로 구성되어 있으며, 직접적인 구현 코드 변경은 없다. 그러나 테스트 관점에서 가장 심각한 문제는 **spec 변경과 기존 테스트 코드의 계약 불일치**다. `scope-tab.test.tsx`의 `appUrl` mock 데이터(line 133, 173, 197)는 spec이 삭제한 필드를 계속 전제하고 있어, 구현이 spec을 따르면 테스트가 깨지고, 테스트를 보존하면 spec과 구현이 어긋나는 이중 위험이 발생한다. `Attention` 가상 필터 삭제에 따른 `needsAttention` 함수 관련 코드도 테스트와 spec이 동기화되어야 한다. 신규 엔드포인트 `GET /api/integrations/cafe24/precheck`는 NestJS 라우트 우선순위 충돌 위험을 e2e 테스트만 검증할 수 있으므로 반드시 통합 테스트 계획이 선행되어야 한다. 전반적으로 spec 방향 결정(복원 vs 실제 제거)이 먼저 확정되어야 테스트 갱신 범위도 확정될 수 있으며, 현재 상태에서 구현에 착수하면 테스트와 코드와 spec이 세 방향으로 어긋나는 위험이 크다.

---

## 위험도

HIGH
