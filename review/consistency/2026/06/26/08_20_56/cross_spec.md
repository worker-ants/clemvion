# Cross-Spec 일관성 검토 결과

검토 대상: `03 M-1 — integration-oauth.service.ts install 보일러플레이트 4종 helper 추출`
diff-base: origin/main
검토 일시: 2026-06-26

---

## 발견사항

### [INFO] spec 이 기술하는 인라인 시퀀스 다이어그램과 실제 메서드 이름 불일치

- target 위치: `integration-oauth.service.ts` — 신규 private 메서드 4종(`assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`)
- 충돌 대상: `spec/data-flow/5-integration.md §1.2.1` (cafe24 시퀀스 다이어그램 — `③ timestamp ±5min 윈도우`, `⑥ nonce replay guard`, `INSERT integration_oauth_state`), `spec/data-flow/5-integration.md §1.2.2` (makeshop 시퀀스 다이어그램 — `cafe24 동형 가드 체인`)
- 상세: 두 데이터플로 다이어그램은 각 단계를 번호(①②③…)로 기술하고 있으며, 이 단계들이 독립 메서드로 분리됐다는 내용은 기재돼 있지 않다. 단 다이어그램은 behavior 를 설명하는 것이지 구현 구조를 명세하는 것이 아니므로 실제 계약 모순은 없다.
- 제안: spec 변경 불필요. 다이어그램이 이미 behavior 기준으로 기술돼 있어 리팩터 이후에도 정확하다. 동기화 수준에서만 INFO.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md` §9.8 Rate limiting note — nonce cache 키 구성 설명과 shared helper 의 `assertInstallNonceNotReplayed` 파라미터 이름 불일치

- target 위치: `integration-oauth.service.ts` `assertInstallNonceNotReplayed` — `params.identifier` 를 `mallId` 로 매핑해 `installNonceCache.isReplay({ mallId: params.identifier, ... })` 호출
- 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §9.8` — nonce 키 구성: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}`; `spec/4-nodes/4-integration/5-makeshop.md` §9.7 — nonce 재사용: "기존 third-party-oauth 인프라(install rate-limit/nonce)를 그대로 재사용"
- 상세: MakeShop 흐름에서 `identifier = query.shop_uid` 가 `mallId` 파라미터로 전달된다. `Cafe24InstallNonceCache.buildKey` 가 Redis 키를 `cafe24:install:nonce:{mallId}:...` 형식으로 생성한다면 MakeShop shop_uid 가 같은 prefix 의 cafe24 키 공간과 충돌하지 않는지 확인 필요하다. 코드 주석(`// reuse cafe24 nonce cache — keyed by value+timestamp+hmac; the hmac differs across providers so cross-provider collision is not a practical concern`)에는 설명이 있고, spec도 nonce 재사용을 허용한다고 기술하지만, spec 의 키 구성 설명(`cafe24:install:nonce:{mall_id}:...`)은 카페24 prefix 를 사용하는데 makeshop shop_uid 도 같은 prefix 를 쓰는 것인지 spec 에는 명시가 없다.
- 제안: target 코드의 동작은 기존 설계 의도와 일치한다(spec 5-makeshop §9 "nonce 재사용" 기술 부합). spec `4-cafe24.md §9.8` 의 nonce key 구성 설명에 makeshop 공유 사실 및 `cafe24:install:nonce:` prefix 가 provider-agnostic 임을 한 줄 추가하면 문서 완결성이 높아진다. 코드 변경 불필요.

---

### [INFO] `data-flow/5-integration.md §1.2.1` 시퀀스 번호 ⑥ 순서와 `assertInstallNonceNotReplayed` 호출 위치 관찰

- target 위치: `integration-oauth.service.ts` `handleInstall` — `assertInstallNonceNotReplayed` 는 HMAC 검증(⑤) 이후가 아니라 그 전에 호출된다 (현 diff 기준으로 ③ timestamp → nonce guard → ④ row lookup → ⑤ HMAC 검증 순서)
- 충돌 대상: `spec/data-flow/5-integration.md §1.2.1` — `⑥ (mall_id, timestamp, hmac) nonce replay guard — Redis 캐시`가 HMAC 검증(⑤) 이후로 기술돼 있음
- 상세: 스펙 시퀀스는 `⑤ mall_id/app_type 일치 + HMAC 검증` 다음에 `⑥ nonce replay guard` 가 나온다. 그러나 현 코드(리팩터 이전부터 존재)에서 nonce guard 는 HMAC 이전에 실행된다. 이 변경은 본 PR이 도입한 것이 아니라 기존부터 존재하던 순서 차이다(behavior-preserving 리팩터). 보안 측면에서 nonce guard 먼저 실행이 HMAC 선행 실행보다 오히려 불필요한 Redis I/O 를 일부 사례에서 발생시킬 수 있으나 correctness 는 영향 없다.
- 제안: 본 PR 범위 밖이므로 target 수정 불필요. 기존 spec drift 는 별도 issue 로 추적하거나 다음 spec-sync 시 `data-flow/5-integration.md` 시퀀스 번호를 코드 실행 순서에 맞게 정렬한다.

---

## 요약

이번 M-1 리팩터(install 보일러플레이트 4종 helper 추출)는 순수 behavior-preserving 내부 구조 정리다. `CAFE24_INSTALL_REPLAY`·`MAKESHOP_INSTALL_REPLAY` 에러 코드 문자열, `mode='reauthorize'` OAuthState, `providerMeta` shape(`mall_id/app_type/client_id/client_secret` vs `shop_uid/client_id/client_secret/code_verifier`), ±5분 타임스탬프 윈도우, nonce cache graceful fallback, post-install redirect URL 구성(`frontendUrl`/`appUrl`/`localhost:3000`) 모두 기존 spec(`4-cafe24.md §9.8`, `5-makeshop.md §9.7`, `data-flow/5-integration.md §1.2.1~1.2.2`, `conventions/error-codes.md §2`)과 일치한다. HMAC 빌더(`buildHmacMessage` / `buildMakeshopHmacMessage`)는 provider별로 유지되어 spec 의 "`VERIFY` 마킹" 이 요구하는 provider 분리를 보장한다. 발견된 세 항목은 모두 INFO 수준이며, spec 과의 직접 모순이나 잠재 충돌은 없다.

## 위험도

NONE
