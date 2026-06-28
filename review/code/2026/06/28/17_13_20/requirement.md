# 요구사항(Requirement) 리뷰 — autoRefresh attention 술어 제외

리뷰 대상: autoRefresh attention/expiring 술어 구현 (4 code files)
diff-base: origin/main
관련 spec: `spec/2-navigation/4-integration.md` §2.3·§2.4·§4.1·§9.1·§10.5·§11.4 + Rationale "자동 갱신 통합을 attention 술어에서 제외"

---

## 발견사항

### [INFO] spec fidelity — §2.4 배너 포함 조건과 backend attention 분기 일치

- 위치: `integrations.service.ts` attention 분기 (`else if (status === 'attention')`)
- 상세: spec §2.4 포함 조건 `status IN (expired, error) OR (status='connected' AND ... AND NOT integration.autoRefresh)` 가 구현에서 `(i.status IN ('expired', 'error') OR (i.status = 'connected' AND i.token_expires_at IS NOT NULL AND i.token_expires_at > NOW() AND i.token_expires_at <= NOW() + INTERVAL '7d' AND i.service_type NOT IN (:...autoRefreshServiceTypes)))` 로 정확하게 번역됐다. `NOT integration.autoRefresh` → `service_type NOT IN (...)` 번역은 spec Rationale "왜 derived 필드인가"에서 명시적으로 채택된 방식이다. 필드명·조건 순서·INTERVAL 값 모두 일치.
- 제안: 없음.

---

### [INFO] spec fidelity — §9.1 `expiring` 가상 필터 정의와 구현 일치

- 위치: `integrations.service.ts` expiring 분기 + `excludeAutoRefresh` 헬퍼
- 상세: spec §9.1 표 `expiring` = `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh` 와 구현이 일치한다. `within 7d` 의 "아직 미만료이고 7일 이내" 의미는 `i.token_expires_at > NOW()` 조건으로 정확히 표현됐다. `excludeAutoRefresh(qb)` 헬퍼가 최상위 AND로 조건을 추가하는 방식이 단일 connected 집합인 expiring 분기에 올바르게 적용됐다.
- 제안: 없음.

---

### [INFO] spec fidelity — §4.1 헤더 보조 라벨 문자열 정확히 일치

- 위치: `status-badge.tsx` subLabel 변수
- 상세: spec §4.1 l.278 "Auto-renews · next in <duration>" 과 구현 `` `Auto-renews · next in ${humanizeUntil(integration.tokenExpiresAt)}` `` 이 정확히 일치한다. 이전 구현의 `"Auto-renews · in <duration>"` ("next in" 누락)이 이번 PR에서 수정됐다. 테스트도 `expect(view.subLabel).toMatch(/^Auto-renews · next in /)` 로 spec 텍스트를 그대로 검증한다.
- 제안: 없음.

---

### [INFO] spec fidelity — §10.5 autoRefresh 실패 신호 보전 양 레이어 일치

- 위치: `status-badge.tsx` `needsAttention()`, `integrations.service.ts` attention 분기
- 상세: spec §2.4·§10.5 + Rationale §1196 "autoRefresh 통합의 갱신이 실패해 error(auth_failed)/error(network) 로 전이하면 status IN (expired, error) 분기로 attention 에 포함 — 사용자 신호 회귀 없음" 정책이 양 레이어에서 올바르게 구현됐다. frontend `needsAttention()` 는 `error`/`expired` 상태에서 `autoRefresh` 값과 무관하게 `true` 반환. backend attention SQL의 `i.status IN ('expired', 'error')` 분기도 `autoRefreshExclusion` 과 무관하게 동작.
- 제안: 없음.

---

### [INFO] TODO 완전 제거 확인

- 위치: `status-badge.tsx` `needsAttention()` 함수
- 상세: 이전 구현에 있던 장문의 `TODO(autoRefresh 가드)` (스펙과 구현 불일치를 알리는 미완성 주석)가 이번 PR에서 완전히 제거되고 완성된 구현과 명확한 목적 주석으로 대체됐다. 코드 전체에 TODO/FIXME/HACK/XXX 미완성 징표 없음.
- 제안: 없음.

---

### [INFO] 엣지 케이스 — `autoRefreshServiceTypes` 빈 배열 방어 코드 올바름

- 위치: `integrations.service.ts` `excludeAutoRefresh` 헬퍼, `attention` 분기 `autoRefreshExclusion`
- 상세: 현재 registry에 3개 항목이 있어 빈 배열 케이스는 발생하지 않으나, 양 경로 모두 `autoRefreshServiceTypes.length > 0` 가드를 갖고 있어 빈 배열 시 `NOT IN ()` 구문 오류를 방지한다. 코드 주석에 이 설계 이유가 명시됐다.
- 제안: 없음.

---

### [INFO] SPEC-DRIFT — Rationale l.1194 `supportsTokenAutoRefresh=true` provider 목록 stale

- 위치: `spec/2-navigation/4-integration.md` Rationale "왜 derived 필드인가" 항, l.1194
- 상세: Rationale 본문이 "현재 `cafe24`/`google` 만 true"라고 기술하나, 실제 `service-registry.ts` 에는 `cafe24`, `google`, `makeshop` 세 provider가 `supportsTokenAutoRefresh: true`로 등록됐다. §9.1 본문(l.794)은 이미 "현재 `service_type='cafe24'`, `service_type='google'`, `service_type='makeshop'` 이 `true`"로 올바르게 반영됐으나 Rationale 만 갱신 누락. 코드가 옳고 spec Rationale 일부만 낡은 케이스.
- 제안: 코드 유지 + `spec/2-navigation/4-integration.md` Rationale "왜 derived 필드인가" 항 l.1194의 "`cafe24`/`google` 만 true" → "`cafe24`/`google`/`makeshop` 이 true"로 갱신 (project-planner 반영 대상). 코드 변경 불필요.

---

### [INFO] 기능 완전성 — spec 요구 5개 술어 표면 중 4개 이번 PR 커버

- 위치: 전체 변경 파일
- 상세: spec Rationale §1192 요구 5개 표면(`§2.4 배너·§11.4 사이드바 카운트·§2.3 Expiring 칩·§9.1 ?status=expiring·?status=attention`) 중 이번 PR 범위의 4개 코드 파일이 커버하는 표면 — `?status=expiring`(백엔드), `?status=attention`(백엔드), frontend `needsAttention()`/`computeAttentionBreakdown()`(배너·칩), §4.1 subLabel — 모두 완료. §11.4 사이드바 서버-사이드 카운트 API의 별도 구현은 이번 diff 범위 밖이나, spec §2.4가 "집계 범위 — 현재 페이지 한정"으로 frontend `computeAttentionBreakdown`의 현재 페이지 집계 방식을 명시적으로 허용한다.
- 제안: 없음. §11.4 사이드바 카운트 API가 별도 PR로 처리된다면 해당 시점에 검증.

---

## 요약

이번 변경은 spec/2-navigation/4-integration.md §2.3·§2.4·§9.1·§10.5·§11.4 및 Rationale "자동 갱신 통합을 attention 술어에서 제외"가 요구하는 기능을 정확하게 구현했다. backend `integrations.service.ts`의 SQL 술어는 spec 포함 조건과 line-level로 일치하며, attention의 OR 합집합 구조에서 connected 서브절 안쪽에 인라인으로 제외 조건을 배치한 이유도 주석으로 명확히 설명됐다. frontend `needsAttention()`의 이전 TODO가 완전히 해소됐고 `computeStatus()` subLabel도 spec §4.1 텍스트와 정확히 일치하도록 수정됐다. autoRefresh 실패 시 error/expired 전이 후 attention 재포함(§10.5 신호 보전)도 양 레이어에서 올바르게 구현됐고 테스트로 검증됐다. Rationale l.1194의 provider 목록에서 makeshop이 누락된 SPEC-DRIFT가 하나 있으나 코드 자체는 정확하며 spec 문서 갱신 과제다. Critical·Warning 발견사항 없음.

## 위험도

NONE
