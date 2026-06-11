# Rationale 연속성 검토 결과

**검토 모드**: spec draft (--spec)
**Target**: `spec/4-nodes/4-integration/1-http-request.md`
**검토일**: 2026-06-11

---

## 발견사항

### [INFO] ALLOW_PRIVATE_HOST_TARGETS 호출 범위 표현 — 신규 vs 구 문구 일관성

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout (line 105)
- **과거 결정 출처**: 동일 파일 이전 버전(commit `79f1d849`) §4 SSRF opt-out callout — "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다 — HTTP Request·Database Query·Send Email"
- **상세**: 이전 버전의 callout 은 "HTTP Request" 로만 표현하고 `none`/`integration`/`custom` 을 명시하지 않았다. target 에서는 **"HTTP Request(`none`/`integration`/`custom` 전부)"** 로 명시적 열거를 추가했다. 이는 번복이 아니라 강화이며 §8.2 Rationale 과 정합하므로 충돌 없음. 다만 구 callout 문구와 신 문구가 동일 파일 내에서 완전 교체됐는지(구 문구 잔재 없는지) 외 주변 시스템이 옛 표현을 copy 했는지 단순 확인 권장 수준이다.
- **제안**: 별도 조치 불필요. 이미 §8.2 가 구 문구와 신 문구를 명시적으로 대조하고 있어 Rationale 연속성이 자체 설명된다.

---

### [INFO] 기각된 대안 (B·C)의 이유 충분성 — "어느 spec 에도 근거 없었다" 주장 검증 가능성

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §8.2 "기각된 대안" (line 356)
- **과거 결정 출처**: 없음(해당 대안에 대한 과거 Rationale 자체가 없었음 — target 이 최초 정식화)
- **상세**: §8.2 는 "코드 주석은 'none 은 내부 서비스를 정당하게 호출할 수 있다'고 정당화했으나 어느 spec 에도 근거가 없었다(키워드 검색 0건)"고 서술한다. 실제 이전 spec 히스토리(git `79f1d849` 이전 전체 포함)에서 `none`/`custom` 인증에 대한 무가드 예외를 Rationale 로 정식화한 항목은 존재하지 않는다. 코드 주석 수준의 비공식 정당화가 있었을 뿐이며, 이는 "어느 spec Rationale 에도 근거 없음" 이라는 target 의 서술과 사실적으로 일치한다. 추가 기각 대안 (A — 현재 결정) 은 target 에 명시되지 않았으나 (B)·(C) 와의 3지 대안 비교가 §8.2 본문으로 충분히 표현되어 있다.
- **제안**: 해당 항목은 "기각 이유가 spec 에 근거 없는 코드 주석이었음" 을 최초 명문화한 것이므로, 구조적으로 완결됐다. 추가 조치 불필요.

---

## 요약

target 문서(`spec/4-nodes/4-integration/1-http-request.md`)에서 새로 도입된 §8.2 Rationale 은 기존 spec 에서 명시적으로 기각·폐기된 대안을 재도입하지 않는다. `none`/`custom` 인증의 무가드 동작은 어떤 spec Rationale 에도 정식화된 적 없었고(코드 주석 수준만 존재), 오히려 기존 `ALLOW_PRIVATE_HOST_TARGETS` callout 의 "통합 노드 전반의 SSRF 가드를 공통 제어한다" 원칙과 충돌하는 구현 불일치였다. target 은 그 모순을 명시적으로 지적하고 spec 내부 일관성을 복원하면서, 기각 이유·운영 영향(breaking)·마이그레이션 경로·기각된 대안 (B·C) 을 §8.2 에 완결적으로 기록하고 있다. 합의된 설계 원칙(secure-by-default + ALLOW_PRIVATE_HOST_TARGETS 단일 제어)과 정합하며, 결정 번복 없이 새 Rationale 을 동반하고 있어 연속성 관점의 문제가 없다.

## 위험도

NONE
