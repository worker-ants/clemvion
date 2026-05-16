# API 계약(API Contract) 리뷰

## 발견사항

- **[CRITICAL]** `GET /api/integrations/:id` 응답에서 `appUrl` 필드 제거 — 하위 호환성 파괴
  - 위치: `spec/1-data-model.md` §2.10 Integration 테이블 diff, `review/consistency/2026/05/16/14_28_20/cross_spec/review.md` 발견사항 2
  - 상세: 이번 변경으로 `GET /api/integrations/:id` 응답의 `IntegrationDto`에서 `appUrl: string | null` 필드가 제거된다. 기존 API 클라이언트(프론트엔드)는 `appUrl`을 응답에서 읽어 Cafe24 Private 앱 설치 URL을 표시하는 로직이 이미 구현되어 있다(`scope-tab.test.tsx` line 133, 173, 197의 mock 데이터에 `appUrl` 포함). 이는 클라이언트와의 API 계약에서 명시적 필드를 제거하는 breaking change다. 응답 스키마에서 기존에 문서화·구현된 필드를 삭제할 경우 프론트엔드 코드가 `undefined`를 참조하게 되어 런타임 에러가 발생한다.
  - 제안: (A) `appUrl` 필드를 응답 스키마에 유지하고 deprecated 마킹 후 다음 major 버전에서 제거하는 단계적 절차를 밟는다. (B) 실제 제거가 필요하다면 프론트엔드 코드(`scope-tab.test.tsx` 등)와 Swagger 문서를 동시에 갱신하고, 변경을 API 버전 bump(예: `v2`)로 처리한다.

- **[CRITICAL]** `GET /api/integrations` — `?status=attention` 가상 필터값 삭제 — 기존 클라이언트가 해당 쿼리를 계속 발행
  - 위치: `review/consistency/2026/05/16/14_28_20/cross_spec/review.md` 발견사항 1, `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견사항 2
  - 상세: 기존 spec과 프론트엔드 코드는 `?status=attention` 쿼리 파라미터를 사용하는 클라이언트 동작을 구현하고 있다(`page.tsx`의 `attentionCount`, `status-badge.tsx`의 `needsAttention`). 이번 변경이 해당 가상 필터값을 spec에서 삭제하면 백엔드가 `attention`을 알 수 없는 status 값으로 처리하게 되고, DB Enum(`connected`/`expired`/`error`/`pending_install`)에 없는 값이므로 WHERE절에서 0건 반환이 되거나 400 에러가 발생할 수 있다. 기존 클라이언트가 계속 `?status=attention`을 보내는 한 이 쿼리는 조용히 실패한다.
  - 제안: `?status=attention` 가상 필터 변환 규칙을 백엔드 API 명세에 유지하거나, 클라이언트 코드를 동시에 갱신한다. 제거 전에 API 버전 분리 또는 지원 종료 공지 기간을 두어야 한다.

- **[WARNING]** `GET /api/integrations` — `?status=expiring` 가상 필터 변환 규칙 삭제 — 0건 반환 위험
  - 위치: `review/consistency/2026/05/16/14_28_20/cross_spec/review.md` 발견사항 4, `review/consistency/2026/05/16/14_28_20/naming_collision/review.md`
  - 상세: spec §9.1에서 `expiring` 가상 필터값 변환 규칙(`status='connected' AND token_expires_at within 7d`)이 삭제되었으나, UI의 `Expiring (7일 이내)` 상태 칩은 여전히 존재한다. 이 칩이 `?status=expiring` 요청을 발행하면 백엔드 변환 규칙이 없으므로 0건을 반환하거나 DB Enum 검증 실패가 발생한다. API 요청 파라미터 검증 측면에서도 허용 파라미터 값 목록이 명세에서 삭제되어 클라이언트 입장에서 어떤 값이 유효한지 알 수 없게 된다.
  - 제안: `expiring` 가상 필터 변환 규칙을 §9.1에 복원하거나, 상태 칩 `Expiring`을 UI에서 제거하는 작업을 동시에 수행한다. API 명세는 허용되는 `status` 파라미터 값 전체 목록을 항상 명시해야 한다.

- **[WARNING]** `POST /api/integrations/oauth/begin` — 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`를 Public 흐름에도 반환 — 에러 응답 의미 불일치
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견사항 2
  - 상세: 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`는 이름에 `PRIVATE`이 명시되어 있어 API 클라이언트가 "Private 앱 전용 에러"로 인식하도록 계약되어 있다. 이를 Public 흐름에서도 동일하게 반환하면 에러 응답 계약이 의미적으로 파괴된다. 에러 코드는 API 계약의 일부로, 클라이언트가 코드 이름 기반으로 분기 처리를 구현할 경우 `PRIVATE` 이름이 Public 경로의 409 처리 누락으로 이어진다. 현재 Swagger 문서도 "private 맥락"으로 기술되어 있다(`integrations.controller.ts:170`).
  - 제안: 에러 코드를 `CAFE24_MALL_ALREADY_CONNECTED`로 일반화하여 app_type에 무관하게 사용 가능한 이름으로 변경한다. 이는 backend, spec, Swagger doc, 프론트엔드 에러 처리 코드 모두 동시에 갱신이 필요한 API 계약 변경이다.

- **[WARNING]** `GET /api/integrations/cafe24/precheck` 신규 엔드포인트 — 동적 경로와의 충돌로 라우팅 실패 위험
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견사항 1
  - 상세: 신규 `GET /api/integrations/cafe24/precheck` 엔드포인트를 NestJS 컨트롤러에서 기존 `@Get(':id')` 핸들러보다 뒤에 선언하면 `cafe24`가 `:id` 파라미터로 소비되어 `ParseUUIDPipe`에서 400 Bad Request가 발생한다. 또한 path segment가 2개(`cafe24/precheck`)이므로 `@Get(':id/usages')`, `@Get(':id/activity')` 핸들러와도 우선순위 충돌이 발생할 수 있다. 이는 URL 경로 설계와 라우팅 순서 모두의 문제다.
  - 제안: `@Get('cafe24/precheck')` 핸들러를 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 핸들러 선언보다 앞에 배치한다. 신규 엔드포인트 Swagger 문서에도 이 경로가 정적 경로임을 명시하고 `ParseUUIDPipe`를 적용하지 않는다.

- **[WARNING]** `spec/1-data-model.md` §2.10 `install_token` 및 `install_token_issued_at` 설명 변경 — API 응답 계약 불명확
  - 위치: `spec/1-data-model.md` diff (line 611-613)
  - 상세: `install_token` 설명에서 "callback 성공 시 보존 (post-install navigation 의 식별 키) — callback 성공 시 보존" 조건이 삭제되어, 이제 "callback 성공 또는 TTL 만료 시 NULL"로 단순화됐다. `install_token_issued_at`도 "callback 성공 시 보존"에서 "callback 성공 시 NULL"로 변경됐다. 이 변경은 `GET /api/integrations/:id` 응답에서 callback 이후 `install_token`이 항상 NULL을 반환한다는 것을 의미하는데, 이전 스펙과 반대되는 API 응답 계약 변경이다. 기존에 `install_token`을 통해 App URL을 노출하던 로직이 callback 성공 후 항상 NULL을 받게 되어 작동하지 않는다.
  - 제안: `install_token`의 라이프사이클 변경이 의도적이라면, 이로 인해 영향 받는 API 응답 스키마(특히 `appUrl` 파생 로직)와 Swagger 문서를 동시에 갱신한다. 변경 사유를 Rationale에 명시한다.

- **[INFO]** `GET /api/integrations` 배너 카운트 쿼리 조건 단순화 — 잠재적 이중 집계로 API 응답 숫자 오류
  - 위치: `review/consistency/2026/05/16/14_28_20/cross_spec/review.md` 발견사항 3
  - 상세: 배너 카운트 조건이 `token_expires_at <= now() + 7d`로 단순화되어 이미 `expired` 상태인 행이 "만료 임박" 집계에도 포함될 수 있다. API가 반환하는 배너 카운트 숫자가 부풀어 클라이언트에 잘못된 정보를 제공할 수 있다. 이는 목록 API의 응답 데이터 정확성 문제다.
  - 제안: 배너 집계 쿼리 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가하거나, 상태별 카운트를 명시적으로 분리하여 이중 집계를 방지한다. 스펙의 §11.4 카운트 조건과 배너 조건을 일관되게 유지한다.

---

## 요약

이번 변경의 핵심은 `spec/1-data-model.md`의 `install_token` 라이프사이클 수정과, consistency checker가 식별한 API 계약 관련 위험 사항들이다. API 계약 관점에서 두 가지 CRITICAL 문제가 존재한다: (1) `GET /api/integrations/:id` 응답에서 `appUrl` 필드가 삭제되어 기존 클라이언트 코드 및 테스트와 직접 충돌하는 breaking change, (2) `?status=attention` 가상 필터 삭제로 기존 클라이언트 요청이 조용히 0건을 반환하거나 에러를 발생시키는 문제. `?status=expiring` 변환 규칙 삭제와 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`의 의미 확장, 신규 `cafe24/precheck` 라우팅 충돌 위험 또한 실제 API 동작에 영향을 미치는 WARNING급 사안이다. `install_token` 라이프사이클 변경(callback 성공 시 NULL 처리)은 API 응답 계약을 이전 스펙과 반전시키므로 이를 받아들이는 클라이언트 코드의 동시 갱신이 필수적이다. 전체적으로 spec이 코드보다 먼저 변경되어 클라이언트와의 계약이 일시적으로 파괴된 상태이며, 구현 착수 전 방향 결정과 코드·문서 동시 갱신이 요구된다.

---

## 위험도

HIGH
