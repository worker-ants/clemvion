# 요구사항(Requirement) 리뷰 — Cafe24 HMAC raw-value 재정정

리뷰 대상: `cafe24-hmac-raw-fix-b8e2d1` worktree 변경 세트  
주요 파일: `spec/4-nodes/4-integration/4-cafe24.md` §9.8, `spec/2-navigation/4-integration.md` Rationale, `spec/1-data-model.md` §2.10, `spec/data-flow/5-integration.md`, `backend/.../integration-oauth.service.ts`, `backend/.../integration-oauth.service.cafe24.spec.ts`, 다수의 consistency-check 리뷰 파일

---

### 발견사항

- **[INFO]** `verifyHmac` spec 코드 예시와 실제 구현의 함수 분리 패턴 불일치
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 블록 (라인 2065–2075 diff 기준) vs `backend/.../integration-oauth.service.ts` L1656
  - 상세: spec 코드 예시는 `verifyHmac(rawQuery, clientSecret, receivedHmac)` 단일 함수를 정의하며 내부에서 `buildHmacMessage`를 호출한다. 그러나 실제 구현은 `buildHmacMessage` + `verifyHmacWithMessage` 로 분리되어 있으며, `tryRecoverByMallId`가 `buildHmacMessage`를 한 번 호출한 뒤 후보별로 `verifyHmacWithMessage`를 재사용하는 패턴이다. 이 괴리는 `tryRecoverByMallId`에서 `rawQuery` 재파싱 비용을 회피하는 설계 의도를 spec 예시가 반영하지 못함을 의미한다. 기능적으로는 문제없으나 spec을 읽는 개발자가 분리 패턴을 모르고 `verifyHmac` 단일 함수로 교체하면 성능 저하가 발생할 수 있다.
  - 제안: spec §9.8 코드 예시를 `buildHmacMessage` + `verifyHmacWithMessage` 분리 패턴으로 교체하거나, 현행 단일 함수 예시가 "개념 설명용"임을 명시하고 실제 분리 패턴은 주석으로 언급한다.

- **[INFO]** `computeTestHmac` 헬퍼의 필터링 로직이 production `buildHmacMessage`와 미세하게 다름
  - 위치: `backend/.../integration-oauth.service.cafe24.spec.ts` L29–39 (`computeTestHmac`) vs `integration-oauth.service.ts` L1643–1654 (`buildHmacMessage`)
  - 상세: `computeTestHmac`는 `.filter((p) => p.length > 0 && !p.startsWith('hmac=') && p.includes('='))` 로 필터링한다. 반면 production `buildHmacMessage`는 `.filter((p) => p.key.length > 0 && p.key !== 'hmac')` 로 필터링한다. 두 로직의 차이는 다음과 같다. (1) `computeTestHmac`은 `=`를 포함하지 않는 파라미터 (`key`만 있고 `=`가 없는 `flag` 형태)를 제외하지만, production은 `key`가 비어있지 않은 경우 `=`가 없어도 포함한다. (2) `computeTestHmac`은 `hmac=` 접두어로 필터링하므로 `hmac`이 key로만 존재하는 (`hmac` without `=`) 경우를 제거하지 못한다. 일반적인 쿼리스트링에서는 실질적 차이가 없지만, 비표준 파라미터 형식에서 두 결과가 달라질 수 있어 self-fulfilling 검증의 완전 제거가 보장되지 않는 엣지케이스가 존재한다.
  - 제안: `computeTestHmac`의 필터링 로직을 production과 완전히 동일하게 정렬한다. 구체적으로 `eqIdx = part.indexOf('=')`, `key = eqIdx === -1 ? part : part.slice(0, eqIdx)` 패턴을 그대로 복제하여 `p.key.length > 0 && p.key !== 'hmac'` 조건을 적용한다.

- **[INFO]** CHANGELOG 삽입 앵커 실제 상태와의 불일치 — spec에서는 이미 해소됨
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG (diff 라인 2104 기준)
  - 상세: consistency-check `cross_spec/review.md`(파일 24)는 "기존 `2026-05-16 (ux-cleanup)` 행 다음에 추가"라는 삽입 앵커가 draft 시점에 파일에 없었다고 CRITICAL로 보고했다. 그러나 실제 적용된 diff(파일 31)를 보면 `(ux-cleanup)` 행이 이미 존재하며 그 다음에 `(hmac-raw-fix)` 행이 정상 추가되었다. SUMMARY(파일 16)가 이를 "false positive"로 분류한 판단은 적절하다. 단, draft 문서가 실제 spec 상태를 기준으로 작성되지 않아 일시적 혼란을 유발했다는 점은 process 관점의 관찰이다.
  - 제안: spec draft 작성 시 삽입 위치를 "파일의 마지막 CHANGELOG 행 다음"처럼 구조적 기준으로 기술하면 앵커 오기 위험을 원천 차단할 수 있다.

- **[INFO]** `spec/data-flow/5-integration.md` callback 성공 분기 — `install_token` 보존 정정 완료, `install_token_issued_at` 명시 부재
  - 위치: `spec/data-flow/5-integration.md` L87–128 (diff 파일 32)
  - 상세: diff에서 `UPDATE integration SET status=connected, install_token=NULL, ...` 을 `install_token + install_token_issued_at 보존` 으로 정정했다. 이는 `spec/2-navigation/4-integration.md` §6 상태 전이 및 Rationale "install_token persistent 격상" 정책과 일치한다. 단, `<br/>` 태그로 inline 주석을 추가하는 방식은 mermaid sequenceDiagram 문법에서 `<br/>` 가 일부 렌더러에서 지원되지 않을 수 있다는 사소한 호환성 우려가 있다.
  - 제안: mermaid `Note over Svc,PG: install_token 보존` 등 공식 mermaid 주석 문법 사용을 검토한다.

- **[INFO]** `tryRecoverByMallId` 내 HMAC 검증이 raw-value 알고리즘과 일치하는지 spec에 명시 부재
  - 위치: `spec/2-navigation/4-integration.md` Rationale "HMAC 검증 알고리즘 — raw URL-encoded 값 보존" (diff 파일 30, 라인 1957–1992)
  - 상세: Rationale 신규 항은 `buildHmacMessage` 함수 공유 구조를 통해 `tryRecoverByMallId`에도 동일 알고리즘이 적용됨을 self-check에서 확인했으나, Rationale 본문 자체에는 이 연계가 명시되어 있지 않다. 향후 `tryRecoverByMallId`를 수정하는 개발자가 알고리즘 공유 구조를 놓치면 회복 분기만 구 알고리즘으로 회귀할 위험이 있다.
  - 제안: rationale_continuity reviewer(파일 28)의 제안과 동일 — Rationale 신규 항 또는 기존 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에 "HMAC 알고리즘 재정정이 회복 분기에도 동일 적용됨 — `buildHmacMessage` 공유 구조"를 한 줄 추가한다.

- **[INFO]** `spec/data-flow/5-integration.md` callback 실패 분기의 `install_token` 보존 명시 부재
  - 위치: `spec/data-flow/5-integration.md` L128 (diff 파일 32, else 분기)
  - 상세: else 분기 (`UPDATE integration SET status_reason='oauth_token_exchange_failed', ...`) 에서도 `install_token` 보존이 명시되어 있고 실제 코드(`integration-oauth.service.ts` L637 이후)도 `install_token`을 건드리지 않는다. 그러나 callback 성공 시 보존을 명시한 것과 달리, 실패 시 보존도 동일하게 spec 주석에 명시되어 있어 일관성이 있다. 별도 조치 불필요 — 기록용.
  - 제안: 없음.

- **[WARNING]** `computeTestHmac`이 `key`가 없는 파라미터(value-only fragment)를 `p.includes('=')` 조건으로 제외 — production과 동작 불일치 엣지 케이스
  - 위치: `backend/.../integration-oauth.service.cafe24.spec.ts` L32 vs `integration-oauth.service.ts` L1643–1651
  - 상세: production `buildHmacMessage`는 `key`가 비어있지 않은 `part`를 포함하는데, `=` 없이 `part` 자체가 `key`가 되는 케이스(`flag` 형 파라미터)를 포함한다. 반면 `computeTestHmac`은 `.includes('=')` 조건으로 이를 제외한다. 실제 Cafe24 쿼리스트링에는 이런 형태가 없을 가능성이 높지만, 만약 미래에 Cafe24가 flag 형 파라미터를 쿼리스트링에 포함시킨다면 테스트는 성공해도 production이 이를 포함하여 HMAC 불일치가 발생할 수 있다. 즉 테스트가 production 동작을 완전히 커버하지 않는 잠재적 self-fulfilling 취약점이 남아있다.
  - 제안: `computeTestHmac`을 production `buildHmacMessage`의 구현을 직접 import하거나, 동일한 split-by-`=`-on-`indexOf` 로직으로 재작성하여 완전한 동치를 보장한다.

---

### 요약

이번 변경 세트의 핵심인 HMAC raw-value 보존 재정정은 요구사항 완전성 관점에서 높은 수준으로 구현되어 있다. 운영 재현 증거 기반의 spec 정정, 백엔드 `buildHmacMessage` 구현, `verifyHmacWithMessage` 분리 구조, `handleCallback` 내 `install_token` 보존 정책, `spec/1-data-model.md` §2.10 및 `spec/data-flow/5-integration.md`의 drift 정정까지 다층적으로 일관성이 확보되어 있다. 회귀 보호 테스트 3종(`%20` 수락, `+` 수락, 구 SEC H-1 알고리즘 거부)도 적절히 추가되었다. 단, `computeTestHmac` 헬퍼가 production `buildHmacMessage`의 필터링 로직과 미세하게 다른 점이 테스트의 완전한 동치를 보장하지 않으며, spec 코드 예시의 `verifyHmac` 단일 함수가 실제 구현의 `buildHmacMessage` + `verifyHmacWithMessage` 분리 패턴을 반영하지 않아 향후 유지보수 혼동 위험이 있다. 이 두 항목이 본 리뷰에서 확인된 가장 유의미한 요구사항-구현 간 괴리이며, 모두 INFO 또는 WARNING 수준으로 기능적 결함이 아닌 문서 명확성 및 테스트 신뢰도 범주에 해당한다.

### 위험도

LOW
