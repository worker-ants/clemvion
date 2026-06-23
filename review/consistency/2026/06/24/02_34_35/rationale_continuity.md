# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후, diff-base=origin/main)

---

## 발견사항

- **[INFO]** `5-admin-console.md R2` — 외형 서버 저장 번복의 Rationale 품질 양호, 추가 보완 제안
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §4·§Rationale R2`
  - 과거 결정 출처: `5-admin-console.md` 초기 v1 "emit-only 미저장" 결정 (R2 내 `기존 결정` 항목으로 참조됨)
  - 상세: R2 는 과거 "외형 백엔드 미저장"을 부분 번복하면서 이유(localStorage-only 의 브라우저/기기 이탈 한계 해소), 범위(기존 trigger config 한 필드, 신규 엔티티 없음), 결정 날짜(2026-06-24)를 모두 명시했다. 번복 자체는 규칙에 맞게 기술됐다. 다만 R2 는 "기존 결정" 을 인라인 서술하지 않고 단순히 참조만 해서, 독자가 "초기 v1 emit-only 정책의 원문"을 별도 위치에서 찾아야 한다 — 원본 결정이 현재 spec 어느 파일에도 독립 조항으로 남아 있지 않으므로 R2 자체가 유일한 맥락이다.
  - 제안: R2 에 `**기존 결정(채택, v1 초기)**` 항목을 한 문장으로 추가해 `emit-only; 복잡도 회피가 핵심 근거` 임을 명시하면 Rationale 이 자기완결(self-contained)적이 된다. 현재도 검토 가능한 수준이므로 CRITICAL/WARNING 아님.

- **[INFO]** `0-architecture.md §R8 carve-out` — same-origin admin 미리보기 예외의 구현 적합성 확인됨, 추가 설명 부재
  - target 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` (sandbox 속성)
  - 과거 결정 출처: `0-architecture.md §R8` — "`srcdoc`/`about:blank` 자가 생성 기각" + carve-out(admin 미리보기는 same-origin 실제 `src` iframe)
  - 상세: `live-preview.tsx` 는 `srcdoc` 없이 `src={iframeSrc}` 로 실제 URL 을 사용하며 carve-out 을 올바르게 따른다. 단, sandbox 속성에 `allow-same-origin` 이 포함돼 있고, 이는 `0-architecture §2 ("iframe sandbox + CSP 로 권한 제한")` 의 `allow-same-origin` 포함 여부에 대한 별도 결정이다. 현재 spec §2 의 sandbox 예시(`allow-scripts allow-forms allow-same-origin`)와 일치하므로 위반은 아니나, 코드 주석에 "신뢰된 1st-party 위젯 한정으로 수용" 이라는 트레이드오프 메모가 있어 이 결정이 Rationale 에 기록되지 않았다는 점이 gap 이다.
  - 제안: `4-security.md §1`(iframe sandbox 정책표) 또는 `5-admin-console.md §6` 의 비고로 "admin 미리보기 iframe 은 same-origin 동봉이므로 `allow-same-origin` 포함(EIA/localStorage 동작 필요) — 고객 임베드 경로와 다름" 을 한 줄 추가하면 Rationale 연속성이 완전해진다.

---

## 요약

`spec/7-channel-web-chat/` 의 Rationale 연속성은 전반적으로 양호하다. 과거 기각된 대안들 — `srcdoc`/`about:blank` 자가 생성(`0-architecture §R8`), Shadow DOM 인라인 마운트(`0-architecture §R1`), lazy 시작 + `firstMessage` 동봉(`1-widget-app §R6`), `per_trigger` 토큰(`3-auth-session §R3`), 신규 web-chat 엔티티(`5-admin-console §R1`), 외부 CDN fetch / 직접 컴포넌트 마운트(`5-admin-console §R6`) — 은 구현에서 모두 채택하지 않았고 코드에서도 확인된다. 외형 서버 저장(`5-admin-console §R2`)은 과거 "emit-only" 결정의 번복이지만 이유·범위·날짜가 명시돼 있어 규칙을 따른다. 두 개의 INFO 항목은 Rationale 의 자기완결성·세부 보완 제안이며, CRITICAL 또는 WARNING 에 해당하는 기각 대안 재도입이나 합의 원칙 위반은 발견되지 않았다.

---

## 위험도

NONE
