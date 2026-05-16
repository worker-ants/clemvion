# 보안(Security) 코드 리뷰

리뷰 대상: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, consistency review 문서 6종 (review/consistency/2026/05/16/14_28_20/)

---

### 발견사항

- **[WARNING]** `install_token` 라이프사이클 변경 — callback 성공 후 NULL 처리로 인한 install_token 소멸 위험
  - 위치: `spec/1-data-model.md` §2.10 `install_token_issued_at` 설명, `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 변경 부분
  - 상세: 이번 worktree 의 diff 에서 `install_token_issued_at` 설명이 "callback 성공 시 **보존**" 에서 "callback 성공 시 **NULL**" 로 변경되었다. 기존 spec(main)은 post-install navigation 을 위해 callback 성공 이후에도 `install_token` 과 `install_token_issued_at` 을 보존하도록 명시했으며, 이 install_token 이 상세 페이지의 App URL (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 경로에 사용된다. callback 성공 후 install_token 이 NULL 처리되면 connected 상태의 Cafe24 Private 통합에서 install_token 이 없는 경우 App URL 을 구성할 수 없게 된다. 이 상태에서 HMAC 검증 실패가 발생하면 사용자가 비교할 App URL 을 조회할 방법이 없어진다.
  - 제안: `install_token_issued_at` 의 NULL 처리 정책을 명확히 단일화한다. "callback 성공 후 보존" 과 "callback 성공 후 NULL" 이 두 spec 문서에서 동시에 공존하고 있으므로, App URL 노출이 제거된 이번 worktree 방향(§4.2 App URL 카드 삭제)과 일관되게 install_token 을 NULL 처리하는 방향을 선택했다면 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 의 HMAC 회복 흐름(`tryRecoverByMallId`)과의 관계도 재검토해야 한다.

- **[WARNING]** 배너 집계 조건 단순화 — `pending_install` 및 `expired` 상태 행의 이중 집계 위험
  - 위치: `spec/2-navigation/4-integration.md` §2.4 배너 조건, §11.4 UI 배지 조건
  - 상세: 변경 후 §2.4 배너 조건이 `token_expires_at <= now() + 7d` 로 단순화됐다. 이 조건은 `status='expired'` 인 행도 `token_expires_at <= now()` 를 이미 만족하므로 `status IN (expired, error)` 카운트와 중복으로 집계된다. `pending_install` 상태의 행은 토큰이 없어 `token_expires_at` 가 NULL 이어야 하지만, COALESCE fallback 로직이 개입하거나 부적절한 데이터가 있을 경우 예기치 않게 포함될 수 있다. UI 에 표시되는 "주의 필요" 건수가 실제보다 과장되면 사용자는 문제가 없는 통합을 불필요하게 조치하려 할 수 있다 (false positive 에 의한 사용자 혼동). §11.4 도 동일하게 `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 로 변경되어 같은 문제를 공유한다.
  - 제안: `status NOT IN (expired, error, pending_install)` 가드를 추가하거나 `status='connected'` 조건을 명시적으로 포함시켜 expired 상태의 이중 집계를 차단한다. 이는 단순 UI 표시 오류이지만 사용자의 조치 우선순위 판단에 직접 영향을 미친다.

- **[WARNING]** `GET /api/integrations/cafe24/precheck` 엔드포인트 — 인가 검증 범위 미명시
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 1, `spec-update-cafe24-public-dup-guard.md` §9.2
  - 상세: 신규 precheck 엔드포인트 `GET /api/integrations/cafe24/precheck` 가 도입 예정이다. 이 엔드포인트는 `mall_id` 로 기존 통합 존재 여부를 사전 감지하는 목적이다. 그러나 spec 상에서 이 엔드포인트의 인가 정책이 명시되어 있지 않다. `workspaceId` 컨텍스트가 올바르게 적용되어야 한다 — workspace A 의 사용자가 workspace B 의 mall_id 존재 여부를 조회할 수 없어야 한다. 기존 `@Get(':id')` 핸들러는 `ParseUUIDPipe` + workspace scope 가드를 갖고 있으나, 신규 precheck 엔드포인트는 UUID 파라미터가 없고 `ParseUUIDPipe` 를 적용하지 않는다고 명시되어 있어 기존 가드 패턴을 그대로 재사용할 수 없다.
  - 제안: precheck 엔드포인트 spec 에 `JWT 인증 + workspace membership 검증` 가드를 명시한다. 응답에는 mall_id 가 이미 연결되어 있는지 여부(boolean)만 반환하고, 통합의 상세 정보(소유자, 상태 등)는 노출하지 않도록 응답 구조를 명확히 정의한다.

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 Public 흐름 재사용 — 클라이언트 분기 오인 위험
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 2, `backend/src/modules/integrations/integration-oauth.service.ts:1068`
  - 상세: 에러 코드 이름의 `PRIVATE` 은 API 클라이언트(프론트엔드, 외부 연동)에게 "Private 앱 전용 오류"라는 강한 의미 신호를 준다. 이 코드가 Public 흐름에서도 반환되기 시작하면, 클라이언트가 `if (code === 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED')` 조건으로 Public 중복을 방어하는 분기를 작성하는 게 어색해지고, 오인으로 인해 Public 경로의 409 처리 로직이 누락될 수 있다. 이는 기능 결함보다 API 계약의 신뢰성(self-documentation) 문제이지만, 내부 분기 로직의 누락으로 이어지면 보안적으로 중복 통합 차단이 우회될 수 있다.
  - 제안: `CAFE24_MALL_ALREADY_CONNECTED` 로 에러 코드를 rename 해 Public/Private 양쪽에 의미가 자연스럽게 적용되도록 한다. backend, spec, Swagger doc, 프론트엔드 메시지 키를 일괄 변경한다.

- **[INFO]** `install_token` 노출 범위 — `appUrl` 필드 삭제 후 install_token 을 path segment 에 포함한 URL 노출 경로 소멸
  - 위치: `spec/2-navigation/4-integration.md` §4.2 App URL 카드 삭제, §9.1 `GET /api/integrations/:id` `appUrl` 필드 제거
  - 상세: 기존 spec 은 `appUrl` 필드를 통해 `install_token` 을 URL path segment 로 노출했다. App URL 카드 삭제 + `appUrl` 필드 제거로 이 노출 경로가 사라진 것은 보안 관점에서 install_token 의 노출 면적이 줄어든다는 점에서 긍정적이다. 그러나 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 의 `tryRecoverByMallId` 회복 흐름과 `renderInstallErrorHtml` 에서 "통합 상세 페이지에서 App URL 확인" 을 안내하는 동선이 끊어진다. install_token 이 필요한 회복 흐름의 대안 경로가 spec 에서 정의되지 않은 채 삭제만 이루어진 상태다.
  - 제안: `appUrl` 필드와 App URL 카드 삭제가 확정된다면, HMAC 에러 회복 안내 문구와 `tryRecoverByMallId` 흐름에서 install_token 을 참조하는 경로가 어떻게 대체되는지 spec 에 명시한다. install_token 이 더 이상 상세 페이지에서 조회되지 않는다면 `CAFE24_INSTALL_INVALID_HMAC` 에러 시 사용자가 취할 수 있는 대안 조치도 에러 페이지 안내 문구에 함께 정의한다.

- **[INFO]** HMAC 검증 로그 보안 정책 — spec 에서 삭제된 항목
  - 위치: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시" 항 삭제
  - 상세: 삭제된 Rationale 에는 HMAC 검증 실패 로깅 정책("client_secret 자체는 절대 로그에 남기지 않는다 — SECRET_LEAK_PATTERNS 정책과 일관")이 명시되어 있었다. 이 정책이 Rationale 삭제와 함께 spec 어디에서도 참조되지 않게 된다. `client_secret` 로깅 금지가 code 레벨에서만 남고 spec 에서는 근거를 잃는다.
  - 제안: 보안 로깅 정책(`SECRET_LEAK_PATTERNS`, `client_secret` 로그 금지)은 spec 에 명시적으로 유지되어야 한다. Rationale 를 삭제하더라도 해당 정책 자체는 `spec/conventions/` 의 보안 로깅 규약 문서로 이전하거나 `spec/2-navigation/4-integration.md` §9.8 본문에 주석 형태로 보존한다.

- **[INFO]** `credentials` JSONB 암호화 — 암호화 알고리즘 및 키 관리 spec 미명시
  - 위치: `spec/1-data-model.md` §2.10 Integration `credentials` 필드, §2.16 LLMConfig `api_key` 필드, §2.17 AuthConfig `config` 필드
  - 상세: 데이터 모델에서 `(encrypted)` 표기로 암호화 저장을 명시하고 있으나, 어떤 암호화 알고리즘(AES-256-GCM 등)을 사용하는지, 키 관리 방식(KMS, 환경 변수 등)은 어디에 정의되어 있는지 본 파일 내에 참조가 없다. 이번 diff 에서 직접 변경된 항목은 아니지만, Integration 데이터 모델 전반이 리뷰 대상이므로 포함한다. `mall_id` 가 `credentials.mall_id` 의 plain projection 으로 평문 복제된다는 점도 명시되어 있어, 평문 컬럼과 암호화 컬럼의 경계가 명확히 관리되어야 한다.
  - 제안: 암호화 알고리즘 및 키 관리 규약을 `spec/conventions/` 에 정식화하고 데이터 모델에서 참조 링크를 추가한다. `mall_id` 와 같은 평문 복제 컬럼은 어떤 필드가 평문인지를 일람표 형태로 명시해 향후 실수로 민감 정보가 평문 컬럼에 복제되는 것을 방지한다.

---

### 요약

이번 diff 의 보안 관점 주요 위험은 두 영역에 집중된다. 첫째, `install_token` 라이프사이클 변경(callback 성공 후 보존 → NULL)이 App URL 카드 삭제와 맞물려 HMAC 에러 회복 흐름의 대안 경로를 spec 에서 소멸시켰다. `install_token` 은 외부 설치 흐름 식별 키로서 보안적으로 민감하며, 그 노출·소멸 정책이 spec 여러 곳에서 불일치하면 구현자가 의도치 않게 토큰을 과노출하거나 조기 소멸시킬 수 있다. 둘째, 배너/배지 집계 조건의 단순화로 `expired` 상태 행이 "만료 임박" 조건과 이중 집계되는 로직 결함이 발생했다. 이는 직접적인 보안 취약점은 아니나 사용자의 인증 상태 인지를 왜곡한다. 신규 precheck 엔드포인트의 workspace 인가 정책 미명시는 구현 시 권한 검증 누락으로 이어질 수 있어 착수 전 확인이 필요하다. 에러 코드 이름 불일치(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)는 클라이언트 분기 오인을 유도할 수 있어 rename 이 권장된다. 하드코딩 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 안전하지 않은 암호화 알고리즘 등의 전통적 취약점은 이번 diff 에서 발견되지 않았다. `credentials` 암호화 및 `client_secret` 로깅 금지 정책은 기존에 올바르게 정의되어 있으나 이번 Rationale 삭제로 spec 참조가 끊어지는 점은 보완이 필요하다.

---

### 위험도

MEDIUM
