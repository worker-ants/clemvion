STATUS=success cross_spec review complete — Critical 0 / Warning 2 / Info 1
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — spec-draft-raw-query-results.md

## 발견사항

### [WARNING] `OAUTH_STATE_MISMATCH` 카탈로그 등재가 두 번째 도메인 표면(`integration_oauth_state`)을 빠뜨린다

- **target 위치**: `## C. 카탈로그 등재 — OAUTH_STATE_MISMATCH` — "`spec/5-system/3-error-handling.md` §1.2 인증/인가 에러에 `OAUTH_STATE_MISMATCH` (400) 를 등재하고 `data-flow/2-auth.md` 와 상호링크한다."
- **충돌 대상**: `spec/2-navigation/4-integration.md` §9.4 (line 851, `OAUTH_STATE_MISMATCH` (400) 이미 등재) · `spec/data-flow/5-integration.md` (line 94 `DELETE integration_oauth_state ... RETURNING *`, line 392 `oauth_state_mismatch` DB 값)
- **상세**: `OAUTH_STATE_MISMATCH` 는 코드베이스에서 **두 개의 독립된 테이블·서비스**가 공유하는 문자열이다 — 로그인 OAuth(`auth_oauth_state` 테이블, `auth-oauth.service.ts`, SoT `data-flow/2-auth.md`, 이번 draft 의 §B 가 다루는 대상)와 통합 OAuth(`integration_oauth_state` 테이블, `integration-oauth.service.ts`, SoT `data-flow/5-integration.md` + `2-navigation/4-integration.md`)다. 실측 결과 통합 쪽은 **이미 `2-navigation/4-integration.md:851` 에 카탈로그화돼 있다**. target 의 §C 는 `data-flow/2-auth.md` 와만 상호링크하도록 지시하는데, 그대로 집행하면 중앙 카탈로그의 유일한 도메인 링크가 로그인 표면만 가리켜 통합 표면이 암묵적으로 배제된 것처럼 읽힌다. 자매 집결 티켓 `spec-update-node-cancellation-shutdown-classification.md` (line 647~655) 는 바로 이 문제를 "착수 전 알아야 할 두 가지" 로 이미 명시했다 — "미등재 ≠ 미문서화"(다른 두 문서에 이미 나와 있음)와 "한 코드가 두 표면을 공유한다"(카탈로그 행이 양쪽을 다 덮거나 어느 쪽인지 명시해야 함, 안 그러면 반대쪽이 카탈로그와 어긋난다). target 의 §C 는 이 두 caveat 를 **모두 누락**한 채 그 티켓에서 표 한 행만 가져왔다 — 위임이 한 단계 건널 때마다 범위가 좁아진다는, target 문서 자신이 §B/§7 에서 짚은 바로 그 패턴의 재발이다.
- **제안**: §C 를 집행할 때 카탈로그 행에 두 표면을 모두 언급하거나(`data-flow/2-auth.md` + `data-flow/5-integration.md` 양쪽 상호링크), 로그인 표면 한정임을 명시하고 통합 표면은 기존 `2-navigation/4-integration.md` 서술이 이미 담당함을 각주로 남긴다. `spec_impact` 목록에도 `spec/data-flow/5-integration.md`(또는 최소 `spec/2-navigation/4-integration.md`)를 추가할지 검토.

### [WARNING] `OAUTH_STATE_MISMATCH`(400) 를 §1.2 메인 테이블에 넣으면 문서 자신의 상태코드 배치 규칙과 어긋난다

- **target 위치**: `## C. 카탈로그 등재` — "§1.2 인증/인가 에러에 ... 등재"
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.2 메인 테이블 (현재 전 항목이 401/403/423 만) 및 같은 문서 하단 Rationale "§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재" 불릿
- **상세**: error-handling.md 자신의 Rationale 이 명시적으로 배치 규칙을 남겨 뒀다 — "`NOT_A_MEMBER`·`INVALID_PASSWORD` 는 §1.2 에 배치(**둘 다 401/403 auth 코드로 §1.2 의 401/403/423 구조 부합** — §1.3 유효성 400/404/409/422 아님)". 실측하면 §1.2 메인 테이블에는 현재 400 상태 코드가 **0건**이고, 400 상태를 가진 auth 도메인 코드(`WEBAUTHN_VERIFY_FAILED`·`INVALID_OPTIONS_TOKEN`·`REAUTH_REQUIRED`)는 전부 §1.2.1 서브섹션에 있다. `OAUTH_STATE_MISMATCH` 는 400 이라 이 문서 자신이 세운 규칙대로면 메인 §1.2 가 아니라 §1.2.1 류 서브섹션(또는 §1.5~§1.9 가 쓰는 "도메인 spec 참조" 패턴)에 가야 한다. 다만 자매 집결 티켓의 이전 consistency 라운드(`00_54_07`)가 "§1.8 → §1.2 로 정정"까지는 판단했으나, §1.2 메인 vs §1.2.1 서브섹션의 상태코드 세분까지는 다루지 않았다 — 이번이 그 세부 판단의 최초 지적이다.
- **제안**: §C 집행 시 §1.2.1 확장(제목을 "2FA/WebAuthn/재인증/OAuth" 로 넓히거나 병렬 서브섹션 신설) 또는 §1.2 메인 배치를 유지하려면 그 예외 근거(예: OAuth 흐름이 §1.2.1 의 2FA/재인증과 달리 "1차 로그인 자체" 범주라는 판단)를 Rationale 에 남길 것.

### [INFO] 소급 각주 "붙일 위치" 서술이 정식 section 제목과 다르다

- **target 위치**: `## B. 소급 각주` 표의 "붙일 위치" 열 — `§8 동시성 cap`, `동시 호출 표의 re-extract 행`
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 의 실제 제목은 `## 8. 동시 실행 제한`, `spec/5-system/10-graph-rag.md` 의 실제 제목은 `## 7. 에러 처리`(표 자체에 "동시 호출 표" 라는 명칭은 없고 `re-extract 동시 호출` 행이 그 표 안에 있음)
- **상세**: 앵커 자체(§8, §7 표의 re-extract 행)는 실측과 정확히 일치해 충돌은 아니다. 다만 "§8 동시성 cap"·"동시 호출 표"는 문서 본문 제목을 그대로 인용한 게 아니라 paraphrase 라, 나중에 grep 으로 앵커를 찾을 때 오차가 생길 수 있다(target 문서 자신이 §D 개정 이력에서 "앵커를 검증 없이 옮긴" 실수를 이미 한 번 자인했다).
- **제안**: 실제 집행 시 정식 heading 텍스트(`## 8. 동시 실행 제한`, `## 7. 에러 처리`)를 각주에 함께 병기.

## 요약

target 문서가 인용하는 다른 spec 영역의 구체 사실(§2.4 3·4번째 불릿, §1.1 admission 언급 0건, §8 admission gate 소재, 12곳/3파일 재측정, `finalizeCancelledExecution` 재분류, OAuth 상태 코드 400·occurrence 카운트 등)은 전부 실제 파일·git 이력 대조로 검증됐고 정확했다 — 자기 자신의 개정 2 배너가 밝힌 두 건(§1.1 vs §8 앵커, §2.4 표-행 vs 소비-경로)도 실측과 일치하게 정정돼 있다. 유일하게 반복되는 결함 패턴은 target 문서 자신이 §7·§B Rationale 에서 명시적으로 경계한 바로 그것("위임이 한 단계 건널 때마다 범위가 좁아진다") 이 §C(OAUTH_STATE_MISMATCH 카탈로그 등재)에서 재발했다는 점이다 — 자매 집결 티켓이 이미 식별해 둔 "두 표면 공유" caveat 가 이번 draft 로 옮겨오며 누락됐고, 여기에 더해 문서 자신의 상태코드 배치 규칙(§1.2=401/403/423 전용)과도 어긋난다. 둘 다 spec 본문을 실제로 작성할 때(§C 집행 단계) 반영하면 해소되는 범위이며, target 문서의 나머지 부분(§A/§B/§D/§E)에는 cross-spec 모순이 발견되지 않았다.

## 위험도

MEDIUM
