# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩터링으로 신규 보안/기능 위험 없음. 테스트 커버리지 갭(WARNING 4건) 보완 권장.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `assertInstallTimestampFresh` — NaN(비숫자) 타임스탬프 경로 테스트 누락. `isNaN(timestampSec)` 분기(빈 문자열, 알파벳, undefined 등)가 cafe24/makeshop 양쪽 spec 모두 미검증. 보안 관련 엣지 케이스. | `integration-oauth.service.cafe24.spec.ts` line 915, `integration-oauth.service.makeshop.spec.ts` line 281 | 두 spec 모두에 `timestamp: 'not-a-number'` / `timestamp: ''` 케이스 추가해 동일 에러코드(`CAFE24_INSTALL_REPLAY` / `MAKESHOP_INSTALL_REPLAY`)가 반환되는지 검증 |
| 2 | Testing | `buildIntegrationDetailRedirectUrl` — `frontendUrl`/`appUrl` 모두 미설정 시 `localhost:3000` fallback 및 trailing slash 제거 동작 테스트 누락. 공통 helper 추출 후 cross-provider 일관성 보장 시 더 중요. | `integration-oauth.service.cafe24.spec.ts` lines 1219-1265, `integration-oauth.service.makeshop.spec.ts` lines 390-402 | (1) 두 env 값 모두 falsy 시 `localhost:3000/integrations/<id>` 반환 확인. (2) trailing slash 있는 URL에서 double-slash 없이 생성되는지 확인 |
| 3 | Testing | `assertInstallNonceNotReplayed` — 두 공급자 spec 모두에서 nonce cache 경로 완전 누락. replay 탐지, cache 미주입 graceful skip, cross-provider `identifier` 매핑(cafe24: `mall_id`, makeshop: `shop_uid`)이 미검증. | `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts` — handleInstall / handleMakeshopInstall describe 블록 | 각 spec에 `installNonceCache` mock 주입 fixture 추가: (1) replay 에러코드 throw, (2) cache 미주입 시 skip, (3) identifier 매핑 정확성 확인 |
| 4 | Testing | `persistReauthorizeState` — `expiresAt` 계산, `scope`/`integrationName`/`requestedScopes` 매핑, makeshop `code_verifier` 포함 여부 상세 검증 제한적. `code_verifier` 누락은 PKCE token exchange 실패로 이어지므로 회귀 위험 높음. | `integration-oauth.service.cafe24.spec.ts` line 1203-1210, `integration-oauth.service.makeshop.spec.ts` line 362-371 | `stateRow.expiresAt > Date.now()` 시간 범위 단언 추가, `requestedScopes` 배열 일치 확인, makeshop `providerMeta.code_verifier` 포함 여부 명시적 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `buildIntegrationDetailRedirectUrl` — `integrationId`를 URL 경로에 직접 삽입하나 입력 검증 없음. 실제 호출부는 TypeORM UUID이므로 실질 위험 낮음. | `buildIntegrationDetailRedirectUrl(integrationId: string)` | UUID 형식 검사 또는 `encodeURIComponent` (호출부가 DB UUID 라 보류) |
| 2 | Security | `assertInstallNonceNotReplayed` — Redis 미설정 시 nonce replay 검사 생략(graceful no-op). 기존 동작 그대로, 신규 취약점 아님. | helper | 운영 Redis 필수 여부 배포 가이드 명시 (기존 정책) |
| 3 | Security | `persistReauthorizeState` — `providerMeta`의 `client_secret`은 `encryptedJsonTransformer`로 암호화 저장. 기존 동작 보존. | helper | 기존 동작 — 조치 불요 |
| 4–7 | Maintainability | `identifier`→`mallId` 매핑 추상화 누수(주석 설명됨), `localhost:3000`·`5*60` 매직값(원본도 inline), provider/serviceType 분리 의도 | helper | 선택 nit — 원본 코드에서 이전된 값 |
| 8 | Maintainability | (false positive) 배너 중복 지적 — 실제 배너는 L1302 1곳뿐, reviewer 가 handleMakeshopInstall 원본 JSDoc(①~⑤)을 오인 | L1684 | 조치 불요 |
| 9–10 | Requirement/Scope | nonce `mallId` 시맨틱은 기존 의도적 설계, `identifier` 추상화로 오히려 명확. 단일 파일·범위 이탈 없음 | — | 현 상태 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | behavior-preserving. INFO 3건(URL 인코딩·Redis fallback·client_secret 암호화) 모두 기존 동작 — 신규 취약점 없음 |
| requirement | NONE | 4개 helper 모두 이전 inline 코드와 라인 수준 동일, spec 동작 전체 일치 |
| scope | NONE | 단일 파일 변경, 범위 이탈 없음 |
| side_effect | NONE | 공개 API 불변, DB 쓰기/env 읽기 부작용 기존과 동일 |
| maintainability | LOW | INFO 8건 (false-positive 배너 1건 포함) — 모두 선택 nit |
| testing | LOW | WARNING 4건: 공유 helper 의 보안 분기(nonce·NaN timestamp·fallback URL·state 필드) 커버리지 보완 |

## 권장 조치사항 (대응)

1. **[반영]** WARNING 1·2·3·4 — 공유 helper 의 보안 분기를 cafe24/makeshop 양쪽 spec 에 focused 테스트로 보강.
2. **[보류]** INFO maintainability nit(상수화 등) — 원본에서 이전된 값, behavior-preserving 범위 유지 위해 별도 cleanup 으로 분리.
3. **[조치불요]** INFO #8 배너 중복 = false positive (배너 L1302 단일).

## 라우터 결정

**실행** (6명, 전원 router_safety 강제): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`. **제외** (8명): performance·architecture·documentation·dependency·database·concurrency·api_contract·user_guide_sync (router 선별).
