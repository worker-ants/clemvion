# 요구사항(Requirement) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현 + webchat polish batch + webhook 본문 크기 spec 동기화  
분석 기준: spec/2-navigation/4-integration.md, spec/7-channel-web-chat/, spec/5-system/12-webhook.md 外  
diff-base: origin/main

---

## 발견사항

### [WARNING] i18n `tokenExpiresAuto` 값이 spec §4.1 `"next in"` 요건 미충족

- **위치**: `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` L83 + `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L323
- **상세**:
  - spec §4.1 헤더 정책: `Auto-renews · next in <duration>` (예: `Auto-renews · next in 1h 24m`)
  - i18n EN 키 `tokenExpiresAuto` = `"Auto-renews · in {{duration}}"` → `"next"` 단어 누락
  - `page.tsx` L323이 이 i18n 키를 Overview 탭 Token Expires 행에서 사용하고 있어, 상세 페이지에 `"Auto-renews · in 1h 24m"` 로 렌더된다 (spec §4.1 불일치)
  - 반면 `status-badge.tsx` L92는 i18n 없이 직접 `` `Auto-renews · next in ${humanizeUntil(...)}` `` 를 사용 → 헤더 배지는 spec 준수
  - 따라서 **헤더 배지 (status-badge.tsx) 는 올바르고, 상세 페이지 Overview Token Expires 행 (page.tsx → tokenExpiresAuto i18n) 은 "next"가 누락**된 불완전 상태
- **spec §4.2 추가 충돌**: spec §4.2는 Token Expires 행 형식을 `in <duration> · auto-renews` (순서 역전)으로 정의. i18n `tokenExpiresAuto`는 `"Auto-renews · in {{duration}}"` 형식이어서 §4.2 순서와도 다름. §4.1과 §4.2가 서로 다른 형식을 정의하므로 구현이 어느 쪽을 따라야 하는지 모호하나, 현재 page.tsx가 i18n 키를 쓰는 것은 §4.1 "next in"도, §4.2 "in · auto-renews" 순서도 아닌 중간 형식
- **제안**: `en/integrations.ts`의 `tokenExpiresAuto`를 `"Auto-renews · next in {{duration}}"` 로 수정 (§4.1 준수). spec §4.2 Token Expires 행 형식(`in <duration> · auto-renews`)과 §4.1 헤더 형식이 다를 경우, 어느 컨텍스트에 어느 형식을 쓸지 spec을 명확히 하고 i18n 키를 상황별로 분리 또는 통일. KO 키도 동반 확인 필요

---

### [WARNING] spec §4.2 Overview Token Expires 행 형식 vs §4.1 헤더 형식 불일치 (spec 자체 결함)

- **위치**: `spec/2-navigation/4-integration.md` §4.1 (헤더 메타 라인) vs §4.2 (Overview 기본 정보 표 행)
- **상세**:
  - §4.1 헤더: `Auto-renews · next in <duration>`
  - §4.2 Overview Token Expires 행: `in <duration> · auto-renews`
  - 두 컨텍스트(헤더 배지 보조 라벨 vs 상세 Overview 행 값)가 서로 다른 텍스트 형식을 정의하는 것이 **의도적 차별화인지 draft 불일치인지** 명시되어 있지 않음. 구현자 (`page.tsx`)가 단일 i18n 키를 두 컨텍스트에 공유해 오용하게 된 근본 원인
  - 코드가 틀렸다기보다 spec 기술이 모호 → spec 수정 필요
- **제안**: spec §4.2 Token Expires 행 설명을 §4.1과 같은 `Auto-renews · next in <duration>` 으로 통일하거나, 컨텍스트별로 형식이 다름을 명시. 구현은 spec 결정 이후 i18n 키 분리 여부 판단. 코드 fix 이전에 spec 명확화가 선행되어야 함

---

### [WARNING] `expiring` 가상 필터의 `i.token_expires_at > NOW()` 조건 누락 가능성 확인 필요

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` L514–L519 (`expiring` 분기)
- **상세**:
  - `expiring` 분기: `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at <= NOW() + 7d AND token_expires_at > NOW()` + `excludeAutoRefresh`
  - `attention` 분기 L535–L542: `(i.status IN ('expired','error') OR (i.status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + 7d AND NOT autoRefresh))`
  - `attention`의 connected 서브조건에는 `i.token_expires_at > NOW()` 가드가 있어 already-expired 행 중복 방지
  - `expiring` 분기에도 `token_expires_at > NOW()` 조건(L518)이 있어 직접적 버그는 아님
  - 그러나 spec §2.3 `Expiring` 칩은 `status='connected' AND tokenExpiresAt ∈ (NOW, NOW+7d]` 로 정의하는데, 코드는 `<= NOW() + 7d AND > NOW()` 로 구현 — 반열린 구간 처리가 spec과 일치
  - **INFO 수준**: 구현이 spec과 일치하나, `attention` 분기의 connected 부분도 `!autoRefresh` (SQL: `NOT IN autoRefreshServiceTypes`) 제외를 동일하게 적용했는지 재확인 필요. L540에서 `autoRefreshExclusion` 인라인 문자열로 추가됨 — 패턴이 `excludeAutoRefresh(qb)` 헬퍼 함수와 다른 경로로 구현됨. 기능 동등성은 코드 상 동일하지만 일관성 관점에서 통일 권장
- **제안**: `attention` 분기 내 connected 서브조건도 `excludeAutoRefresh` 헬퍼를 통일 사용하거나, 인라인 방식 유지 시 주석으로 동등성 명시

---

### [INFO] [SPEC-DRIFT] `status-badge.tsx` subLabel이 i18n 없이 직접 영문 하드코딩

- **위치**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L92
- **상세**: `"Auto-renews · next in ${humanizeUntil(...)}"` — i18n 키 없이 직접 영문 문자열 사용. 한국어 사용자에게는 i18n 없이 영문이 그대로 노출됨. `page.tsx`의 동일 맥락은 `t("integrations.tokenExpiresAuto", ...)` i18n 사용
- **제안**: [SPEC-DRIFT] spec §4.1이 i18n 키를 명시하지 않음 → spec 문서에 헤더 보조 라벨 i18n 키 명시 필요. 코드는 i18n 적용이 권장되나 spec 갱신 전까지 현행 동작은 기능 회귀가 아님 (해당 spec 위치: `spec/2-navigation/4-integration.md §4.1`)

---

### [INFO] `computeStatus` 에서 `expiresSoon && !integration.autoRefresh` 조건 — `pending=null` 엣지 케이스

- **위치**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L80
- **상세**: `integration.autoRefresh`가 `undefined`이거나 `null`인 경우 `!integration.autoRefresh`는 `true`로 평가되어 만료 임박 표시가 발동. 실제로 `IntegrationDto.autoRefresh`는 `boolean` 타입으로 선언되어 있으므로 undefined/null 케이스는 TS 타입 시스템에서 방지됨. 런타임 엣지 케이스로 실질 위험 없음

---

### [INFO] spec/7-channel-web-chat/2-sdk.md §5 `ChatInstance` 타입 SoT와 `resetSession` 불일치 (기존 이슈)

- **위치**: `spec/7-channel-web-chat/2-sdk.md` §1 (이번 diff) vs §5 `ChatInstance` 인터페이스
- **상세**: 이번 diff는 §1에서 `resetSession`이 `wc:command` 전용이고 npm `ChatInstance`·`ClemvionChat` 전역 메서드에 미노출임을 명시. 그러나 consistency review (14_49_11/naming_collision.md)가 이미 지적한 대로 §5 `ChatInstance` 타입 블록과 `types.ts`·`loader.ts` switch에 미반영 상태는 이번 diff가 해소하지 않음. 이번 diff의 §1 정정은 코드 현실과 spec 산문을 정합시키는 올바른 방향이나, §5 타입 SoT에도 "resetSession은 ChatInstance에 없음"이 명시되어야 완결됨
- **제안**: 별도 follow-up으로 §5 `ChatInstance` 인터페이스 블록에 `resetSession` 미포함 이유 주석 추가 (코드 변경 불필요, spec 문서만)

---

### [INFO] `spec/4-nodes/7-trigger/1-manual-trigger.md` 응답 봉투 변경 — 기능 완전성 확인

- **위치**: `spec/4-nodes/7-trigger/1-manual-trigger.md` diff (파일 36)
- **상세**: 기존 "Planned (현행 필터는 details 키만 전달)" → 구현 완료로 변경. `toTriggerParameterErrorDetails` 헬퍼가 실제로 존재하고 `hooks.service.ts`에서 사용됨 (`details: toTriggerParameterErrorDetails(err.errors)`). `GlobalExceptionFilter`가 `details`를 봉투에 포함함(L91). 구현이 spec 기술과 일치하며 "Planned" 마커 제거 정당
- **제안**: 없음

---

## 요약

이번 변경의 핵심 구현(autoRefresh attention 술어 제외)은 spec §2.3/§2.4/§9.1/§11.4를 실질적으로 충족하고 있다. backend 서비스 레지스트리 동적 조회 + `NOT IN` 파라미터 바인딩 구현이 Rationale "왜 derived 필드인가"의 하드코딩 금지 원칙을 준수하며, frontend `needsAttention()`과 `computeStatus()`의 `!autoRefresh` 가드도 spec과 정합한다. 단, i18n EN 키 `tokenExpiresAuto`가 spec §4.1이 정의한 `"Auto-renews · next in {{duration}}"` 에서 `"next"` 단어가 누락되어 상세 페이지 Token Expires 행이 spec과 불일치한다. 이는 기존 consistency 리뷰에서 WARNING으로 식별된 사항(`"subLabel 'in' vs spec 정의 'next in'"`)이 i18n 레이어에서 미해소된 것으로, status-badge.tsx 헤더 배지는 이미 `"next in"`을 올바르게 구현하고 있으나 page.tsx의 i18n 경로가 여전히 누락 상태다. spec §4.1과 §4.2의 토큰 만료 표시 형식 불일치도 구현 혼선의 근본 원인으로, spec 명확화가 선행되어야 한다.

## 위험도

MEDIUM — i18n `tokenExpiresAuto` `"next"` 누락은 상세 페이지에서 spec §4.1 문구 불일치로 노출되는 직접적 기능 불일치이나 핵심 비즈니스 로직(attention 카운트·만료 필터) 자체는 올바르게 구현됨
