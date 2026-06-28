# 요구사항(Requirement) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현 (4 core 코드 파일 + 2 MDX 사용자 문서)
분석 기준: spec/2-navigation/4-integration.md §2.3·§2.4·§4.1·§4.2·§9.1·§11.4 + Rationale
diff-base: origin/main

---

## 발견사항

### [WARNING] i18n `tokenExpiresAuto` 값이 spec §4.1 `"next in"` 요건 미충족

- **위치**: `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` L83 + `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L322–324
- **상세**:
  - spec §4.1 헤더 메타 라인 (spec 본문 L278): `Auto-renews · next in <duration>` (예: `Auto-renews · next in 1h 24m`)
  - i18n EN 키 `tokenExpiresAuto` 현재값: `"Auto-renews · in {{duration}}"` — `"next"` 단어 누락
  - `page.tsx` L323이 이 i18n 키를 Overview 탭 Token Expires 행에서 사용하며, 실제 렌더 결과는 `"Auto-renews · in 1h 24m"` — spec §4.1 불일치
  - 반면 `status-badge.tsx` L361이 직접 `` `Auto-renews · next in ${humanizeUntil(...)}` `` 리터럴을 사용해 헤더 배지는 이미 spec §4.1 준수
  - 이 diff에서 `status-badge.tsx`의 subLabel 문자열은 `"in"` → `"next in"` 으로 올바르게 수정됐으나, 동일 맥락 i18n 키는 미수정 상태
- **spec 근거**: `spec/2-navigation/4-integration.md` §4.1 L278 — `Auto-renews · next in <duration>`
- **제안**: `en/integrations.ts` L83의 `tokenExpiresAuto`를 `"Auto-renews · next in {{duration}}"` 으로 수정. KO 키도 동반 확인·수정 필요.

---

### [WARNING] spec §4.2 Overview Token Expires 행 형식과 현 구현의 불일치 (spec 자체 결함 포함)

- **위치**: `spec/2-navigation/4-integration.md` §4.2 L286 vs §4.1 L278; `page.tsx` L322–324
- **상세**:
  - spec §4.2 (L286): `autoRefresh=true` 통합 친화 표기 = `` `in <duration> · auto-renews` `` (순서: 숫자 앞, `auto-renews` 뒤)
  - spec §4.1 (L278): `Auto-renews · next in <duration>` (순서: `Auto-renews` 앞)
  - i18n `tokenExpiresAuto = "Auto-renews · in {{duration}}"` 는 두 spec 섹션 어느 것도 정확히 따르지 않음
  - `page.tsx`는 이 i18n 키로 §4.2 컨텍스트(Overview 행)를 표시하지만, 키 값 형식이 §4.2 명세와 다름
  - 코드 혼자서 해결할 수 없는 상태 — spec §4.1과 §4.2가 동일 데이터를 다른 형식으로 정의하므로 구현자에게 모호성 발생
- **spec 근거**: `spec/2-navigation/4-integration.md` §4.2 L286 (`in <duration> · auto-renews`), §4.1 L278 (`Auto-renews · next in <duration>`) — 두 섹션 간 형식 불일치가 이 코드 경로의 불일치 근본 원인
- **제안**: spec §4.2의 Token Expires 행 표기를 §4.1과 동일한 `Auto-renews · next in <duration>` 으로 통일하거나(형식 차이가 의도적이라면 두 컨텍스트를 명시), 결정 후 i18n 키와 `page.tsx` 수정. 코드 fix 전 project-planner에 spec §4.2 명확화 위임 선행 필요.

---

### [INFO] backend `expiring` 분기 autoRefresh 제외 — `excludeAutoRefresh` 헬퍼 vs `attention` 인라인 구현 이중 경로

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` L145, L159–169
- **상세**:
  - `expiring` 분기: `excludeAutoRefresh(qb)` 헬퍼 함수 호출 — `andWhere(AUTO_REFRESH_NOT_IN, autoRefreshParams)` 최상위 AND
  - `attention` 분기: `autoRefreshExclusion` 인라인 문자열 보간 — connected 서브절 내부에 `AND i.service_type NOT IN (:...autoRefreshServiceTypes)` 삽입
  - 두 경로가 동일한 `AUTO_REFRESH_NOT_IN` 상수·`autoRefreshParams`를 참조하므로 SQL fragment·파라미터 키의 단일 진실은 유지됨
  - 코드 주석(L128–132)에서 attention 분기가 OR 합집합이라 헬퍼를 쓸 수 없는 이유를 명시적으로 설명하므로 의도적 설계로 판단
  - 기능 동등성 문제 없음. 향후 파라미터 키 변경 시 두 사용 경로를 함께 수정해야 한다는 유지보수 부담은 잔존
- **제안**: 현재 구현 유지 가능. 두 경로의 동등성이 주석으로 명시돼 있어 충분함.

---

### [INFO] `computeStatus`에서 `expiresSoon && !integration.autoRefresh` — `autoRefresh=undefined` 런타임 엣지

- **위치**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L394–397 (`needsAttention`), `computeStatus` expiresSoon 분기
- **상세**: `IntegrationDto.autoRefresh` 는 TypeScript 타입 `boolean`으로 선언되어 있어 `undefined`/`null` 케이스는 컴파일 타임 차단. 런타임 엣지 케이스 실질 위험 없음.
- **제안**: 변경 불필요.

---

### [INFO] spec Rationale L1194 — `supportsTokenAutoRefresh=true` provider 목록 stale

- **위치**: `spec/2-navigation/4-integration.md` Rationale L1194
- **상세**: Rationale이 "현재 `cafe24`/`google` 만 true"라고 기술하지만, spec §9.1 본문(L794)·registry 코드·본 diff의 테스트 주석(L76 `cafe24/google/makeshop`)·service-registry.ts(L662, L676, L387) 모두 `cafe24`, `google`, `makeshop` 세 provider를 true로 명시. MakeShop 도입 이후 Rationale만 미갱신.
- **제안**: `spec/2-navigation/4-integration.md` Rationale L1194 "현재 `cafe24`/`google` 만 true" → "현재 `cafe24`/`google`/`makeshop` 이 true" 로 정정. project-planner 위임.

---

### [INFO] [SPEC-DRIFT] `status-badge.tsx` subLabel이 i18n 없이 영문 직접 하드코딩

- **위치**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L361
- **상세**: `` `Auto-renews · next in ${humanizeUntil(...)}` `` — i18n 키 없이 영문 리터럴. `page.tsx` L323의 동일 맥락은 `t("integrations.tokenExpiresAuto", ...)` i18n 사용. spec §4.1은 표기 문자열만 정의하고 i18n 키를 명시하지 않아 spec이 침묵하는 영역.
- **제안**: [SPEC-DRIFT] 코드 유지 + spec `spec/2-navigation/4-integration.md §4.1` 에 헤더 보조 라벨 i18n 키(`integrations.tokenExpiresAutoSubLabel` 등) 명시 권장. 갱신 대상: §4.1 L278 비고 또는 i18n 정책 섹션.

---

## 요약

이번 변경의 핵심 기능(autoRefresh=true 통합을 attention/expiring 술어에서 제외)은 spec §2.3·§2.4·§9.1·§11.4 를 실질적으로 충족한다. backend의 service registry 동적 조회 + NOT IN 파라미터 바인딩이 Rationale "왜 derived 필드인가"의 하드코딩 금지 원칙을 준수하고, frontend `needsAttention()`·`computeStatus()`의 `!integration.autoRefresh` 가드도 spec과 정합한다. 사용자 문서(MDX 2개 파일)의 Google 추가·7일 이내 expiring 포함 설명·autoRefresh 제외 정책 안내도 spec 변경과 일치한다. 단 두 가지 WARNING이 잔존한다: (1) i18n EN 키 `tokenExpiresAuto`가 spec §4.1이 정의한 `"Auto-renews · next in {{duration}}"` 에서 `"next"` 단어가 누락되어 상세 페이지 Token Expires 행이 spec §4.1 불일치 — `status-badge.tsx` 헤더 배지는 `"next in"`이 이미 올바르게 구현됐지만 i18n 경로(`page.tsx → tokenExpiresAuto`)는 미수정; (2) spec §4.1(`Auto-renews · next in`)과 §4.2(`in <duration> · auto-renews`)가 동일 필드를 서로 다른 형식으로 정의하는 spec 자체 결함이 구현 혼선의 근본 원인이며 spec 명확화가 선행되어야 한다.

## 위험도

MEDIUM — i18n `tokenExpiresAuto` `"next"` 누락은 상세 페이지 Overview Token Expires 행에서 spec §4.1 문구 불일치로 노출되는 직접적 기능 불일치이나, 핵심 비즈니스 로직(attention 카운트·만료 필터·backend NOT IN 술어)은 spec 준수하여 올바르게 구현됨.
