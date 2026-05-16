# Cross-Spec 일관성 검토 — Cafe24 HMAC raw-value 보존 재정정

Target: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
검토 시각: 2026-05-16

---

## 발견사항

### 1. [CRITICAL] CHANGELOG 삽입 앵커 불일치 — `2026-05-16 (ux-cleanup)` 행 부재

- **target 위치**: 변경 2 "CHANGELOG 행 추가", "기존 `2026-05-16 (ux-cleanup)` 행 다음에 추가"
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG`
- **상세**: target 문서는 새 CHANGELOG 행을 "기존 `2026-05-16 (ux-cleanup)` 행 다음" 에 삽입하도록 지시하나, 현재 `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 에는 해당 태그를 가진 행이 존재하지 않는다. 현재 마지막 행은 `2026-05-16 (catalog)` 이다. 개발자가 draft 를 그대로 따르면 삽입 위치를 결정할 수 없다.
- **제안**: draft 의 앵커를 실제 마지막 행인 `2026-05-16 (catalog)` 으로 수정하거나, 새 행을 "CHANGELOG 표 마지막 행으로 추가" 로 재기술한다.

---

### 2. [CRITICAL] spec §9.8 알고리즘과 현행 백엔드 구현의 직접 모순

- **target 위치**: 변경 1 — §9.8 알고리즘 단계 2 및 새 코드 예시 (`buildHmacMessage`)
- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.ts` L1564–1635 (현재 배포된 코드)
- **상세**: target 문서는 §9.8 알고리즘을 "raw URL-encoded 값 그대로 보존, decode/re-encode 금지" 로 바꾸는 spec 정정이다. 그러나 현재 backend 코드는 여전히 `URLSearchParams` 로 decode → `formUrlEncode` 로 재인코딩하는 PR #67 SEC H-1 방식을 구현하고 있다. spec 이 갱신되면 spec 과 구현 사이에 직접 모순이 생긴다. spec 채택 후 developer 가 구현을 동기화하지 않으면 운영 HMAC 검증이 spec 과 다른 알고리즘으로 계속 실행된다.
  - 현행 코드: `URLSearchParams(rawQuery)` → `formUrlEncode(v)` (공백 `%20` → `+`)
  - 신규 spec: `rawQuery.split('&')` → raw value 그대로 (decode 없음)
  - 이 두 알고리즘은 공백이 포함된 파라미터(`user_name=%20...` vs `user_name=+...`)에서 서로 다른 메시지를 생성한다.
- **제안**: spec 갱신과 동시에 `backend/src/modules/integrations/integration-oauth.service.ts` 의 `buildHmacMessage` 함수를 raw-value 방식으로 교체해야 한다. developer plan 에 구현 동기화 태스크를 명시적으로 포함시킨다. spec 단독 갱신은 spec-코드 불일치를 유발하므로, spec 병합과 구현 PR 을 동일 브랜치로 묶거나 순서를 명시한다.

---

### 3. [CRITICAL] 기존 HMAC 테스트가 spec 과 self-fulfilling 모순 — 회귀 보호 부재

- **target 위치**: 변경 3 Rationale "테스트 보강" 단락
- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L708 `'accepts HMAC for queries containing space-encoded values (URLEncoder compat)'`
- **상세**: target 문서는 "옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 self-fulfilling 검증(compute 와 verify 가 같은 broken 알고리즘 사용)"이라고 명시한다. 현재 테스트 파일의 `formUrlEncodeForTest` 헬퍼(L25)가 production `formUrlEncode` 와 동일한 broken 알고리즘을 복제하고 있어 실제 Cafe24 동작을 검증하지 못한다. spec 이 raw-value 방식으로 바뀌면 이 테스트는 새 spec 에서 실패한다(또는 동일 self-fulfilling 패턴이 유지되면 여전히 오검증). 새 spec 의 알고리즘이 구현되어도 `John+Doe` 기반 테스트가 남아 있으면 회귀 보호가 없는 것과 같다.
- **제안**: spec 적용과 동시에 테스트 파일의 `formUrlEncodeForTest` 헬퍼와 기존 `John+Doe` 기반 HMAC 테스트를 제거하고, draft 가 제안하는 `user_name=...%20...` raw URL 형식 테스트로 교체한다. 이를 개발 plan 의 필수 항목으로 포함시킨다.

---

### 4. [WARNING] 변경 3 Rationale 삽입 앵커 불일치 — "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 부재

- **target 위치**: 변경 3 "위치: `## Rationale` 섹션 말미, 현재 마지막 항 'Cafe24 App URL 상세 페이지 표시 (2026-05-16)' 다음에 추가"
- **충돌 대상**: `spec/2-navigation/4-integration.md ## Rationale` 현행 마지막 항 "install_timeout 알림 미발사 (2026-05-16)"
- **상세**: draft 가 지정한 삽입 앵커 항목 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 는 현재 `spec/2-navigation/4-integration.md` 의 Rationale 섹션에 존재하지 않는다. 현재 실제 마지막 Rationale 항은 "install_timeout 알림 미발사 (2026-05-16)" 이다. 삽입 위치 오기술이지만 "섹션 말미"라는 의도가 명확하므로 CRITICAL 이 아닌 WARNING 으로 등급화한다.
- **제안**: draft 의 삽입 위치 설명을 "## Rationale 섹션 말미, 현재 마지막 항 'install_timeout 알림 미발사 (2026-05-16)' 다음" 으로 수정한다.

---

### 5. [WARNING] `verifyHmac` 함수 시그니처 — spec 코드 예시와 실제 구현 분리 패턴 불일치

- **target 위치**: 변경 1 "새 코드 예시" — `verifyHmac(rawQuery, clientSecret, receivedHmac)` 단일 함수
- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.ts` L1574–1635 — `buildHmacMessage` + `verifyHmacWithMessage` 분리 패턴
- **상세**: target draft 의 새 코드 예시는 `buildHmacMessage` + `verifyHmac` (단일 함수) 두 개를 보여준다. 그러나 현재 backend 코드는 `buildHmacMessage` + `verifyHmacWithMessage` 로 분리되어 있으며, `tryRecoverByMallId` 가 `buildHmacMessage` 를 한 번 호출하고 후보별로 `verifyHmacWithMessage` 를 재사용하는 패턴이다. draft 의 `verifyHmac` 단일 함수 예시는 `rawQuery` 를 인자로 받아 내부에서 `buildHmacMessage` 를 호출하므로, 현재 구현의 분리 패턴과 다르다. spec 예시가 그대로 적용되면 `tryRecoverByMallId` 에서 후보마다 `rawQuery` 재파싱이 발생한다.
  - 이미 draft 의 self-check 에서 "호출자 변경 불필요" 라고 기재되어 있으나, spec 코드 예시가 구현 패턴과 불일치하면 이후 개발자가 혼동할 수 있다.
- **제안**: spec 의 코드 예시를 현행 구현 패턴(`buildHmacMessage` + `verifyHmacWithMessage` 분리) 에 맞게 조정하거나, 예시는 개념 설명용이고 실제 분리 패턴은 주석으로 명시한다.

---

### 6. [WARNING] `data-flow/5-integration.md` 의 callback 후 `install_token=NULL` 처리 기술 — 기존 spec 과 모순 (pre-existing)

- **target 위치**: target draft 본체와 직접 관련 없음 (검토 과정에서 발견된 기존 drift)
- **충돌 대상**: `spec/data-flow/5-integration.md` L90 (`UPDATE integration SET status=connected, install_token=NULL, ...`) vs `spec/4-nodes/4-integration/4-cafe24.md §9.8` ("install_token 은 통합 lifetime 동안 보존")
- **상세**: `data-flow/5-integration.md` 는 callback 성공 시 `install_token=NULL` 로 표기하고 있으나, `spec/4-nodes/4-integration/4-cafe24.md §9.8` 및 `spec/2-navigation/4-integration.md §6 상태 전이` 에 따르면 2026-05-15 이후 install_token 은 post-install navigation 의 persistent 식별자로 격상되어 callback 성공 시에도 NULL 처리하지 않는다. 이는 target draft 가 도입한 것이 아닌 기존 spec drift 이지만, 이번 변경과 같은 맥락(§9.8 갱신)이므로 함께 수정할 기회다.
- **제안**: `spec/data-flow/5-integration.md` L90 을 `UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at` (install_token 제거)로 수정하고, 관련 다이어그램 주석에 "install_token 은 통합 lifetime 동안 보존 — [§9.8]" 을 추가한다.

---

### 7. [INFO] `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` — 최신 항이 `(catalog)` 로 끝나 hmac-raw-fix 맥락 연결이 모호

- **target 위치**: 변경 2 CHANGELOG 행 (삽입 위치 수정 후)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` 기존 마지막 행 `2026-05-16 (catalog)`
- **상세**: 새 CHANGELOG 행 태그가 `(hmac-raw-fix)` 인 반면, 바로 앞 행이 `(catalog)` 여서 `(후속)`, `(ux-cleanup)` 같은 누락 태그가 있다는 인상을 줄 수 있다. consistency 문제는 아니지만 CHANGELOG 의 시계열 가독성을 위해 명시적 주석이 있으면 좋다.
- **제안**: CHANGELOG 행에 "PR #67 SEC H-1 후속 재정정" 맥락을 짧게 명시하거나, 태그를 `(hmac-raw-fix, SEC H-1 재정정)` 으로 보강한다.

---

## 요약

Target 문서 자체의 논리는 정합적이나, spec 정정 범위와 실제 구현·테스트 동기화가 단일 plan 에 묶여 있지 않아 spec 만 갱신되고 코드가 구 알고리즘으로 남을 위험이 CRITICAL 급이다. 특히 (1) CHANGELOG 삽입 앵커 오기, (2) 백엔드 `buildHmacMessage` / `formUrlEncode` 가 여전히 PR #67 방식으로 배포되어 있어 spec 채택 후 spec-구현 직접 모순, (3) `formUrlEncodeForTest` 를 사용하는 self-fulfilling 테스트가 제거되지 않으면 신규 spec 의 회귀 보호가 없는 세 가지 CRITICAL 이 있다. WARNING 급으로는 변경 3 삽입 앵커 오기, spec 코드 예시와 실제 분리 패턴 불일치, data-flow/5-integration.md 의 install_token=NULL 오기(기존 drift) 가 식별된다. spec 적용 plan 에 구현·테스트 동기화 태스크를 명시적으로 포함해야 spec 정정이 운영에서 효과를 발휘한다.

---

## 위험도

**HIGH** — spec 단독 적용 시 spec 과 운영 코드가 서로 다른 HMAC 알고리즘을 정의하는 직접 모순 상태가 된다. 구현 동기화가 함께 이뤄지면 spec 자체의 논리적 모순은 없으며 MEDIUM 으로 하락한다.
