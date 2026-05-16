# 성능(Performance) 코드 리뷰

리뷰 대상: `cafe24-hmac-raw-fix-b8e2d1` 브랜치 변경 사항  
리뷰 일시: 2026-05-16  
분석 범위: 30개 파일 (review/consistency/**, spec/1-data-model.md, spec/2-navigation/4-integration.md, plan 문서)

---

## 분석 결과 개요

이번 diff 는 **문서 전용 변경**으로 구성되어 있다.

- `review/consistency/**` — 일관성 검토 세션 산출물 (SUMMARY, checker 별 review.md, _prompts/, _retry_state.json, meta.json)
- `spec/1-data-model.md` — `install_token` / `install_token_issued_at` 컬럼 설명 정정 (문구 변경)
- `spec/2-navigation/4-integration.md` — App URL 카드 스펙 행 추가 + `GET /api/integrations/:id` 설명 보강 (문구 변경)
- spec draft 로 참조되는 `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` — HMAC 알고리즘 재정정 설계 문서

실제 실행 코드(`backend/**`, `frontend/**`)의 변경은 포함되어 있지 않다. 성능 영향을 직접 유발하는 코드 변경이 없으므로, 아래 분석은 **스펙에 명시된 알고리즘 설계** 및 **미래 구현 시 고려가 필요한 성능 위험**을 중심으로 서술한다.

---

## 발견사항

### 발견사항 1

- **[INFO]** 제안된 `buildHmacMessage` 알고리즘의 시간 복잡도 — 현재 구현 대비 개선
  - 위치: `spec-draft-cafe24-hmac-raw-fix.md` 변경 1 "새 코드 예시", `spec/2-navigation/4-integration.md` Rationale (신규 항)
  - 상세: 신규 spec 은 `buildHmacMessage(rawQuery)` 를 다음 파이프라인으로 정의한다.
    1. `rawQuery.split('&')` — O(n), n = query string 길이
    2. `.map(part => { indexOf('='), slice })` — O(n)
    3. `.filter(p => p.key.length > 0 && p.key !== 'hmac')` — O(k), k = 파라미터 수
    4. `.sort((a, b) => ...)` — O(k log k), 알파벳 정렬
    5. `.map(p => p.raw).join('&')` — O(n)

    전체 복잡도는 O(n + k log k) 이며, k(파라미터 수)는 Cafe24 App URL 에서 통상 10개 미만으로 고정되어 있어 실제로는 O(n)에 수렴한다. 이는 기존 구현(`URLSearchParams` 생성 → `formUrlEncode` 재인코딩)의 이중 처리(decode + re-encode)를 제거한 것으로, 알고리즘 관점에서 간결한 개선이다.

    한 가지 확인이 필요한 사항: sort 시 `String.prototype.localeCompare` 대신 `<` / `>` 비교 연산자를 사용하고 있다. 이는 locale 독립적인 바이트 수준 사전 정렬(lexicographic)을 수행하며, Cafe24 의 Java `TreeMap` 의 기본 키 정렬 방식과 일치한다. 의도된 선택이나 spec 에 명시적 근거가 없어 향후 유지보수자가 `localeCompare` 로 교체할 경우 미묘한 회귀를 유발할 수 있다.
  - 제안: Rationale 코드 블록 상단 주석에 `// Java TreeMap 기본 정렬 = Unicode code point 순. localeCompare 사용 금지.` 한 줄을 추가할 것을 권장한다. 구현 단계에서 단위 테스트로 검증되면 충분하다.

---

### 발견사항 2

- **[INFO]** `buildHmacMessage` 내 불필요한 중간 객체 할당 — 최소화 여지 있으나 무시 가능한 수준
  - 위치: spec-draft의 `buildHmacMessage` 코드 예시 (변경 1, 변경 3)
  - 상세: 현재 spec 코드 예시는 `.map(part => ({ key, raw: part }))` 로 파라미터 수 k 만큼의 임시 객체 `{key, raw}` 를 생성한다. Cafe24 App URL 의 파라미터 수는 일반적으로 10개 미만(고정 스키마)이므로 실제 할당량은 무시할 수 있는 수준이다. 만약 파라미터 수가 미래에 대폭 증가하는 경우에만 최적화를 고려할 가치가 있다.
  - 제안: 현재 규모에서는 최적화 불필요. spec 코드 예시는 가독성 우선이므로 현행 유지가 적절하다.

---

### 발견사항 3

- **[INFO]** `timingSafeEqual` 에 `Buffer.from(computed)` / `Buffer.from(receivedHmac)` 두 번 할당 — 동일 길이 보장 필요
  - 위치: spec-draft 의 `verifyHmac` 코드 예시 (변경 1)
  - 상세: `timingSafeEqual` 은 두 Buffer 의 **길이가 동일**해야 한다. 그렇지 않으면 `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` 예외를 던진다. spec 코드 예시에서는 이 길이 검사가 명시되어 있지 않다. `computed` 는 항상 `base64` 인코딩된 SHA-256 digest(44자)이므로, `receivedHmac` 이 조작되거나 다른 길이로 전달될 경우 예외가 발생해 비교 자체가 수행되지 않고 상위 호출자로 예외가 전파된다. 이는 timing-safe 보호가 우회되는 것은 아니나, 예외 발생 경로와 정상 경로의 응답 시간 차이가 간접적인 정보를 노출할 수 있다(sideband).
  - 제안: 구현 단계에서 `timingSafeEqual` 호출 전 `computed.length === receivedHmac.length` 검사를 추가하고, 길이가 다를 경우 즉시 `false` 를 반환하도록 한다. 성능 측면에서는 경미하나 보안 측면에서도 중요한 패턴이다.

---

### 발견사항 4

- **[INFO]** spec/1-data-model.md 문구 정정 — 성능 영향 없음, 기록 목적
  - 위치: `spec/1-data-model.md` lines 253-254 (install_token, install_token_issued_at 설명)
  - 상세: 이번 변경은 두 컬럼의 설명 문구를 "callback 성공 시 NULL" 에서 "callback 성공 시 보존"으로 정정한다. 문구 변경만이므로 성능 영향은 전혀 없다. 단, 컬럼 정책 변경(NULL → 보존)이 실제 백엔드 코드에 반영될 때, `handleCallback` 에서 `installTokenIssuedAt = null` 로 UPDATE 하던 부분이 제거되므로 해당 UPDATE 문의 write amplification 이 소폭 감소하는 효과는 있다(경미).
  - 제안: 구현 동기화 시 `handleCallback` 의 UPDATE 쿼리에서 불필요한 `install_token = NULL` / `install_token_issued_at = NULL` SET 절이 제거되었는지 확인한다.

---

## 요약

이번 diff 는 review 산출물, spec 문서, plan 파일 등 **문서 전용 변경**으로 구성되며, 실제 실행 코드 변경이 포함되어 있지 않다. 성능 측면에서 직접적인 위험은 없다. 분석에서 주목할 점은 스펙으로 제안된 신규 `buildHmacMessage` 알고리즘인데, 기존 구현의 이중 인코딩(decode + re-encode) 단계를 제거하고 query string 을 raw 그대로 처리하는 단순한 O(n + k log k) 파이프라인으로 교체한다. 파라미터 수 k 가 고정적으로 소수이므로 실질적 복잡도는 O(n)이며, 이는 기존보다 효율적이다. 발견된 사항은 모두 INFO 수준으로, 구현 단계에서 localeCompare 회귀 방지 주석 추가와 `timingSafeEqual` 의 길이 검사 패턴 적용이 권장된다.

---

## 위험도

NONE
