# RESOLUTION — 03 M-1 install 보일러플레이트 helper 추출 ai-review 후속

리뷰: `review/code/2026/06/26/08_03_45/SUMMARY.md` — RISK **LOW**, Critical 0 / Warning 4 / INFO 10.
대상 커밋: `f77aeed4`(refactor) + review-fix `6e5c5084`(test).

## Warning (4건, 전부 testing) — ✅ 반영

추출된 공유 helper 의 보안 분기를 cafe24/makeshop 양쪽 spec 에 focused 테스트로 고정 (commit `6e5c5084`, behavior-preserving — 프로덕션 코드 무변경):

| # | Warning | 반영 |
|---|---------|------|
| W1 | `assertInstallTimestampFresh` NaN(비숫자) timestamp 분기 미검증 | 두 spec 에 `timestamp: 'not-a-number'` → `CAFE24_INSTALL_REPLAY`/`MAKESHOP_INSTALL_REPLAY` 케이스 추가 |
| W2 | `buildIntegrationDetailRedirectUrl` fallback URL·trailing slash 미검증 | 두 spec 에 (1) frontendUrl/appUrl 모두 '' → `http://localhost:3000/integrations/<id>`, (2) trailing slash 있는 URL → double-slash 없음 케이스 추가 (post-install redirect, status=connected) |
| W3 | `assertInstallNonceNotReplayed` nonce cache 경로 완전 미검증 | 두 spec 에 `installNonceCache` mock(6번째 @Optional ctor 인자) 주입 — replay=true 시 REPLAY throw + identifier 매핑(cafe24=`mall_id`/makeshop=`shop_uid`)을 nonce key 로 전달 확인 + replay 시 state 미생성 단언. (cache 미주입 graceful skip 은 나머지 전 install 테스트가 cache 없이 통과해 transitive 커버) |
| W4 | `persistReauthorizeState` expiresAt·필드 매핑·makeshop code_verifier 단언 제한적 | expiresAt 미래·requestedScopes 일치·serviceType + makeshop `providerMeta.code_verifier` 포함(PKCE 회귀 방지) 단언 추가 |

신규 테스트 10건(cafe24 5 + makeshop 5). 검증: lint·build·unit(backend **7409** 전건, +10) PASS.

## INFO (10건) — 보류/조치불요

- **Security INFO 1–3**: URL 경로 segment 인코딩 부재(호출부=DB UUID)·Redis 미설정 시 nonce no-op·client_secret 암호화 저장 — 전부 **기존 동작 그대로**(본 추출이 도입한 위험 아님). 조치 불요.
- **Maintainability INFO 4–7**: `identifier`→`mallId` 추상화 누수(주석 설명됨, nonce cache 인터페이스 일반화 시 해소)·`http://localhost:3000`·`5*60` 매직값 상수화·provider/serviceType 분리 의도 주석 — 전부 **원본 코드에서 이전된 값**. behavior-preserving 범위 유지 위해 별도 cleanup 으로 분리(본 PR 미반영).
- **Maintainability INFO 8 (배너 중복)**: **false positive** — 배너 `// Shared install-flow boilerplate (M-1)` 는 L1302 단 1곳. reviewer 가 `handleMakeshopInstall` 원본 JSDoc(①~⑤ 순서 설명)을 배너로 오인. 조치 불요.
- **Requirement/Scope INFO 9–10**: nonce `mallId` 시맨틱은 기존 의도적 설계(`identifier` 추상화로 오히려 명확)·단일 파일 변경 — 현 상태 유지.

## 결론

Critical 0. Warning 4 전건 반영(테스트 보강). INFO 는 기존 동작/원본 이전값/false-positive 로 보류 또는 조치불요. 게이트: lint·build·unit(7409)·e2e(214, 프로덕션 무변경) PASS.
