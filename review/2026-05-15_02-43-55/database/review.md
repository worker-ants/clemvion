### 발견사항

- **[INFO]** `install_token` 컬럼 포맷 변경의 기존 행 공존
  - 위치: `integration-oauth.service.ts:888` (token 발급), `third-party-oauth.controller.ts` INSTALL_TOKEN_PATTERN
  - 상세: DB 컬럼 `install_token`은 `String?` (길이 제약 없음)이므로 기존 64자 hex 행과 신규 22자 base64url 행이 같은 컬럼에 혼재한다. 컨트롤러 레벨에서 `/^[A-Za-z0-9_-]{22}$/` 정규식으로 사전 차단하므로 구 포맷 토큰은 DB 조회까지 도달하지 않는다. TTL 스캐너가 24h 내 구 포맷 행을 `expired` 처리한다. 의도된 설계이며 기능 이상 없음.
  - 제안: 없음 (현행 설계 안전)

- **[INFO]** 부분 인덱스 `(install_token) WHERE install_token IS NOT NULL` (V043) 효율성
  - 위치: `spec/1-data-model.md` 인덱스 표, `integration-oauth.service.ts` handleInstall
  - 상세: 22자 base64url로 단축되어도 해당 부분 인덱스는 값 변경과 무관하게 동일하게 동작한다. NULL 제외 부분 인덱스라 인덱스 크기도 영향 없다. lookup 쿼리는 여전히 O(1) 단일 row 조회.
  - 제안: 없음

- **[INFO]** `(workspace_id, mall_id) UNIQUE` 부분 인덱스와 에러코드 description 불일치 (spec 수준)
  - 위치: `spec/2-navigation/4-integration.md §9.4`, `spec/1-data-model.md` 인덱스 표
  - 상세: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러는 SQL UNIQUE 제약이 `service_type='cafe24'` 기준(`app_type` 무관)으로 발화하나, 에러 코드명에 `PRIVATE_APP`이 포함돼 public 앱 중복 케이스를 포함하지 않는 것처럼 읽힌다. 이번 변경에서 spec 본문은 "app_type 무관" 으로 수정됐다. 코드 동작 자체는 이미 정확하다.
  - 제안: 에러 코드명 변경(`CAFE24_MALL_ALREADY_CONNECTED`)은 followup 항목으로 남겨진 상태 — DB 동작에는 영향 없음

---

### 요약

이번 변경은 DB 스키마 무변경이 핵심이다. `install_token` 컬럼이 `String?`(길이 제약 없음)이므로 32바이트 hex → 16바이트 base64url 포맷 전환에 마이그레이션이 불필요하고, 기존 부분 인덱스(V043, V046)도 그대로 유효하다. 컨트롤러 레벨 정규식 가드가 DB 조회 전에 구 포맷 토큰을 차단해 기존 행과의 혼재도 안전하게 격리된다. N+1, 트랜잭션 정합성, 커넥션 관리, SQL 인젝션 관점에서 신규 위험 없음.

### 위험도

**LOW**