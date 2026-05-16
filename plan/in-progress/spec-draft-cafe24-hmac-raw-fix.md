---
worktree: cafe24-hmac-raw-fix-b8e2d1
started: 2026-05-16
owner: project-planner
spec_files:
  - spec/4-nodes/4-integration/4-cafe24.md
  - spec/2-navigation/4-integration.md
---

# Spec Draft — Cafe24 HMAC 알고리즘 재정정 (Critical 운영 결함)

## 배경

PR #67 (2026-05-16 SEC H-1) 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였다. 사용자가 신규 Cafe24 Private 통합을 등록 직후에도 `CAFE24_INSTALL_INVALID_HMAC` 발생. 진단 로그는 `reason=hmac_verify_failed urlMallId=gehrig0301 dbMallId=gehrig0301 dbAppType=private` 으로 명확 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.

증거:
- 사용자 URL: `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` (Cafe24 가 공백을 `%20` 으로 인코딩)
- 우리 옛 알고리즘: `URLSearchParams` decode → `formUrlEncode` 로 `+` 인코딩 → 메시지 안에 `+`
- Cafe24 의 실제 알고리즘 (Java 샘플): URL value 를 raw 그대로 (`%20` 그대로) HMAC 메시지에 사용

→ **Cafe24 는 URLEncoder 를 호출하지 않는다. URL 의 raw byte 를 그대로 보존한다.**

---

## 변경 1 — `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 본문 정정

**위치**: §9.8 Private 앱 App URL HMAC 검증, "알고리즘" 단계 2

**옛 텍스트** (현재 line 429):
> 2. **form-urlencoded** query string 형태로 직렬화: `key=URLencoded-value&...`. 값 인코딩은 Java `URLEncoder.encode(value, "UTF-8")` 호환 — `application/x-www-form-urlencoded` MIME 규약 (공백 → `+`).

**새 텍스트**:
> 2. **원본 URL-encoded 값을 그대로 보존** 해서 query string 형태로 직렬화: `key=raw-value&...`. **decode/re-encode 금지** — Cafe24 의 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 split 한 뒤 `=` 로 한 번만 split 해서 value 부분을 **raw 그대로** TreeMap 에 저장한다. 즉 Cafe24 가 URL 에 `%20` 으로 보냈으면 HMAC 메시지에도 `%20`, `+` 로 보냈으면 `+` 그대로 유지된다. value 의 의미를 해석하지 않고 byte 단위로 매칭하는 게 정답. **재정정 배경**은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 참조.

**옛 코드 예시** (line 434-458 의 `formUrlEncode` + `URLSearchParams` 사용 예제):
- 통째로 제거

**새 코드 예시**:
```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
  const message = buildHmacMessage(rawQuery);
  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
  return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
}
```

---

## 변경 2 — `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 행 추가

**위치**: §10 CHANGELOG 표 끝

**추가할 행** (기존 `2026-05-16 (ux-cleanup)` 행 다음):

```
| 2026-05-16 (hmac-raw-fix) | §9.8 HMAC 검증 알고리즘 **재정정** — PR #67 SEC H-1 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였음. Cafe24 공식 샘플은 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에 사용한다 (`request.getQueryString()` split → TreeMap 보존). 운영 사용자 보고 (2026-05-16) — Cafe24 가 URL 에 `%20` 으로 공백을 인코딩해 보내는데 우리는 `+` 로 변환해 메시지 불일치. raw-value 보존 방식으로 재정정. 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항. |
```

---

## 변경 3 — `spec/2-navigation/4-integration.md` Rationale 신규 항

**위치**: `## Rationale` 섹션 말미, 현재 마지막 항 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 다음에 추가.

**본문**:

```markdown
### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)

PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16). HMAC 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.

**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.

**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).

**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.

```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}
```

**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.

**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.

**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp + 실제 hmac) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.

**관련 history**:
- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)
```

---

## 정합성 self-check

- [x] 변경 1 의 새 코드 예시는 변경 3 의 Rationale 코드와 동일 (동기 유지)
- [x] 변경 2 CHANGELOG 행이 변경 3 Rationale 항을 링크
- [x] `formUrlEncode` 헬퍼는 spec 본문 외 다른 인용 없음 (grep 확인)
- [x] `buildHmacMessage` 시그니처 (인자: `rawQuery: string`, 반환: `string`) 호환 — 호출자 (`handleInstall`, `tryRecoverByMallId`) 변경 불필요
- [x] PR #67 SEC H-2 (`tryRecoverByMallId` workspace 횡단 방지) 와 무관 — 본 변경은 message 빌드 알고리즘만 정정
- [x] capability-token 보안 전제 무영향 — install_token 형식 / TTL / 보존 정책 변경 없음
