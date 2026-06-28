# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` 전 문서 (impl-done, diff-base=origin/main)

---

## 발견사항

### [INFO] `5-admin-console.md §R2` — 외형 미저장 번복 명시 여부
- target 위치: `spec/7-channel-web-chat/5-admin-console.md §R2`
- 과거 결정 출처: 동일 파일 `## Rationale §R2` 내 "기존 결정과의 관계" 항
- 상세: 과거 "외형 백엔드 미저장(emit-only)" 결정을 2026-06-24 결정으로 번복하며, §R2 가 번복 경위·기각 범위 보존을 명시하고 있다. 번복 이유("별도 시스템 미신설 + trigger config 한 필드로 한계 해소")와 비목표 유지("per-workspace 테마 관리 콘솔")가 함께 기재돼 있어 Rationale 연속성 요건을 충족한다. 다만 `_product-overview.md §2` 비목표 항에서 단서("단, …per-instance 외형 저장은 v1 범위")가 링크를 통해 상호 참조되므로 양쪽 문서를 교차 읽어야 전체 맥락이 드러난다.
- 제안: 단독 문서로도 맥락을 파악할 수 있도록 `_product-overview.md §2` 비목표 항에 "(결정 2026-06-24, 번복 전말: [5-admin-console R2](./5-admin-console.md))" 각주를 한 줄 추가하면 연속성 추적이 명확해진다. 현 상태는 연속성 위반이 아니므로 INFO 수준.

---

### [INFO] `2-sdk.md §R3` — `off()` 부재 보류를 확정으로 전환 명시
- target 위치: `spec/7-channel-web-chat/2-sdk.md §R3`
- 과거 결정 출처: 동일 파일 `## Rationale §R3` 내 "기존 v1 spec 은 `off()` 없이 `on()` 만 두었으나 이는 미결정(단순화 보류) 상태였고" 항
- 상세: 과거 `off()` 부재를 "단순화 보류"로 두었던 미결 사항을 `data-global` + `off()` 추가로 확정했다. §R3 이 "SPA 통합 피드백으로 cleanup 패턴 명시 요구가 확인되어 추가한다"는 이유와 함께 번복 배경을 설명하고 있어 Rationale 연속성 요건을 충족한다.
- 제안: 과거 보류 결정이 어느 원 spec iteration에서 기록됐는지 날짜/PR 참조가 없어, 추후 감사 시 추적이 불편할 수 있다. 필요하면 "(보류 기록: 초기 v1 스텁 작성 시점, 정식 확정 2026-06-25)" 형태로 타임스탬프를 보완하면 된다. 현 상태는 연속성 위반이 아님.

---

### [INFO] `1-widget-app.md §R6` — lazy 기각·eager 채택 Rationale 완비 확인
- target 위치: `spec/7-channel-web-chat/1-widget-app.md §R6`
- 과거 결정 출처: 동일 파일 `## Rationale §R6`
- 상세: lazy 시작(firstMessage 동봉) 모델이 명시적으로 기각되고, eager 시작이 2026-06-06 채택되었음이 결함 원인(구조적 불가, firstMessage 유실)과 함께 상세히 기재돼 있다. 기각된 lazy의 "낭비 방지" 이점이 재평가 결과 비용이 작다는 반박 근거까지 포함해 Rationale 연속성이 완비된다. 따름 규칙(큐 게이팅·폐기 조건)도 §R6 내에 일관되게 명시돼 있다.
- 제안: 없음. 모범적인 번복 Rationale 작성 사례.

---

### [INFO] `4-security.md §R5` — iframe sandbox `allow-same-origin` vs §R1 "완전 격리" 긴장
- target 위치: `spec/7-channel-web-chat/4-security.md §1 sandbox 표 + §R5`
- 과거 결정 출처: `0-architecture.md §R1` (iframe 격리 원칙)
- 상세: `0-architecture §R1`은 iframe이 CSS·JS·스토리지를 "완전 분리"한다고 선언한다. `4-security §1` sandbox 표에서 `allow-same-origin`이 사용되는 것은 표면적으로 이 원칙과 긴장한다. 그러나 `4-security §R5`가 이를 공식 Rationale로 명문화해 "(a) §R1 기준 모델은 cross-origin CDN 배포이며, (b) 동봉 same-origin 경로에서는 `allow-same-origin` 없이 세션/토큰 스토리지가 깨지므로 필수, (c) 공급망 무결성 전제로 수용 가능" 논거를 상세히 제공한다. 결정의 무근거 번복이 아닌 조건부 carve-out이 명시된 상태.
- 제안: `0-architecture §R1` 본문에 "단, 동봉 same-origin 경로에서의 `allow-same-origin` 트레이드오프는 [4-security §R5](./4-security.md)" 역참조를 한 줄 추가하면, 문서 진입 순서가 바뀌어도 긴장 인지가 즉각적이 된다.

---

## 요약

`spec/7-channel-web-chat/` 전 문서를 대상으로 Rationale 연속성을 검토한 결과, 명시적으로 기각된 대안의 무근거 재도입, 합의 원칙의 직접 위반, 또는 invariant 우회 설계는 발견되지 않았다. 주요 번복 결정(외형 서버 저장·eager 시작·off() 확정·allow-same-origin)은 모두 해당 문서 내 `## Rationale` 항에 기각 이유·전환 이유·따름 규칙이 명시돼 있어 연속성 추적이 가능하다. INFO 수준의 제안 세 건은 단독 문서 가독성 향상과 역참조 보완에 관한 것으로, 현 상태가 합의 원칙을 위반하거나 invariant를 우회한다는 판단은 없다.

## 위험도

NONE
