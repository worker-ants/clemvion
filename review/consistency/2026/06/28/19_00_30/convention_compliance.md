# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md §1.5.4` 에러 코드 표 — historical-artifact 예외 설명 주석의 범위가 실제 레지스트리(`error-codes.md §3`)와 포함 코드 목록이 일치하지 않음

- **target 위치**: `spec/5-system/1-auth.md §1.5.4` (§1.5.4 에러 응답 표 아래 "명명 — historical-artifact 예외" 주석)
- **위반 규약**: `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리
- **상세**: §1.5.4 의 주석은 `invitation_not_found`·`invitation_expired`·`invitation_already_used`·`invitation_email_mismatch`·`forbidden`·`rate_limited` 6종을 나열한다. 그러나 `error-codes.md §3` 레지스트리에는 추가로 `workspace_type_mismatch`·`already_a_member`·`invitation_already_pending`·`invitation_already_accepted`·`workspace_not_found`·`user_not_found`·`admin_required` 7종이 초대 모듈(`workspace-invitations.service.ts`) 소속 historical artifact 로 등재돼 있다. §1.5.4 의 에러 응답 표는 이 7종을 포함하지 않고 있으며, 주석은 "위 코드들" 이라는 표현으로 §1.5.4 에 열거된 6종만을 가리킨다고 읽힐 수 있다. 실제로 이 7종은 초대 *발송·재발송·취소·수락* 흐름의 서비스 레이어 코드이므로 §1.5.4(에러 응답) 에 전부 포함될 필요는 없고 서비스 레이어에서만 발생하지만, §1.5.4 주석이 "본 레지스트리 예외는 위 표에 열거된 코드에 한함" 이라는 의미로 오해될 소지가 있다.
- **제안**: §1.5.4 주석 말미에 "§1.5.4 에 열거되지 않은 초대 발급·재발송·취소·revoke 흐름의 `workspace_type_mismatch`·`already_a_member`·`invitation_already_pending`·`invitation_already_accepted`·`workspace_not_found`·`user_not_found`·`admin_required` 도 동일 레지스트리(`error-codes.md §3`)에서 초대 모듈 historical artifact 로 관리됨을 참조 링크로 명시" 하거나, 또는 현 주석을 그대로 두고 오해 가능성을 수용한다면 규약 갱신이 아닌 INFO 수준 형식 제안으로 닫는다.

---

### [INFO] `spec/5-system/10-graph-rag.md §Overview` — "## Overview (제품 정의)" 제목이 CLAUDE.md 권장 3섹션 구성의 `## Overview` 표준 명칭과 미세하게 다름

- **target 위치**: `spec/5-system/10-graph-rag.md`, 파일 상단 `## Overview (제품 정의)` 헤딩
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: CLAUDE.md 및 타 spec 파일(예: `1-auth.md`의 `## Overview`)은 단순히 `## Overview` 를 표준 헤딩으로 사용한다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 라는 괄호 부제를 달고 있다. 이는 규약을 직접 위반하는 수준이 아니나, 편의 설명이 달린 비표준 헤딩이 일관성을 저하한다. `spec/5-system/` 내 다른 파일들(예: `12-webhook.md`의 `## Overview (제품 정의)`)도 동일 패턴을 사용하는 것을 볼 때 이 파일 단독의 문제가 아닌 공통 패턴으로 보이나, conventions 상으로는 `## Overview` 가 기준이다.
- **제안**: 변경 우선순위는 낮음. 동일 패턴을 사용하는 다른 파일들과의 일관성 유지 관점에서, 규약을 "(제품 정의) 부제 허용" 으로 업데이트하거나, 점진적으로 `## Overview` 로 단순화 하는 방향 중 하나를 선택한다.

---

### [INFO] `spec/5-system/1-auth.md §4.1` 감사 액션 카탈로그 — `user.email_changed` 가 "현재 구현된 액션" 표에 있으나 `audit-actions.md §3` 레지스트리에 미등재

- **target 위치**: `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표, 인증(워크스페이스 컨텍스트) 행의 `user.email_changed`
- **위반 규약**: `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리
- **상세**: `audit-actions.md §3` 레지스트리의 `user` resource 행은 `password_changed`, `2fa_enabled`, `2fa_disabled`, `email_changed` 4종을 열거한다. 그런데 "구현" 상태 표기에서 `email_changed` 는 `1-auth.md §4.1` 의 "현재 구현된 액션" 표에 있어 구현됐음을 나타낸다. `audit-actions.md §3` 레지스트리에도 같은 4종이 묶여 "구현" 으로 표기되어 있어 일치한다. 이 항목은 위반이 아니라 일치 확인 — 다만 `user.email_changed` 의 "(이메일 변경 확인 … details 에 raw 이메일 미저장)" 설명이 `§4.1` 에 있지만 `audit-actions.md` 의 레지스트리에는 해당 제약 설명이 없다. `audit-actions.md §3` 는 "명명·시제 규율" SoT 이고 details 정책은 `1-auth.md §4.1`(카탈로그) SoT 이므로 책임 분리는 정확하다. 규약상 위반 없음.
- **제안**: 변경 불필요. 책임 분리 확인 결과 일치.

---

### [INFO] `spec/5-system/12-webhook.md §WH-SC-09` 클라이언트 IP 추출 정책 교차참조 — `1-auth.md §2.3` IP 신뢰 정책(`TRUST_CF_CONNECTING_IP`)과 구체적 교차참조 누락

- **target 위치**: `spec/5-system/12-webhook.md §WH-SC-09` (`AuthConfig.ip_whitelist`)
- **위반 규약**: 없음 (직접 위반 없음, 형식 제안)
- **상세**: `12-webhook.md WH-SC-09` 는 "클라이언트 IP 를 알 수 없으면 거부(fail-closed)" 라고만 기술하며 실제 IP 추출 우선순위(`CF-Connecting-IP` → `X-Forwarded-For` → `req.ip`)를 서술하지 않는다. 이 정책의 SoT 는 `1-auth.md §2.3` 의 `클라이언트 IP` 표 및 Rationale `2.3.B` 인데, `12-webhook.md` 에는 해당 섹션에 대한 포인터 참조가 없다. 현행 구현이 `extractClientIp` 단일 유틸(`client-ip.ts`)로 통합된 만큼(PR #763 후속 리팩토링), IP 추출 정책 SoT 를 단일 참조 링크로 안내하면 미래 IP 추출 로직 변경 시 누락 가능성을 줄인다.
- **제안**: `WH-SC-09` 끝에 "IP 추출 우선순위 정책은 [인증 spec §2.3 클라이언트 IP](./1-auth.md#23-세션-정책)" 포인터 추가. 또는 현재처럼 추상적 기술로 두고 구현 세부를 spec 에 노출하지 않는 것도 수용 가능.

---

## 요약

`spec/5-system/` 의 정식 규약 준수 상태는 전반적으로 양호하다. `error-codes.md §3` historical-artifact 레지스트리와 `audit-actions.md §3` 도메인 레지스트리는 `1-auth.md §4.1`, `§1.5.4` 의 기술과 대체로 일치하며, 의도적 규약 이탈(초대 모듈 lowercase 코드 예외 등)은 레지스트리에 명시적으로 등재되어 있다. CRITICAL 및 WARNING 수준의 규약 직접 위반은 발견되지 않았다. 발견된 사항은 모두 INFO 수준의 형식 일관성 제안이며, 특히 §1.5.4 주석의 범위 표현 모호성과 `10-graph-rag.md`·`12-webhook.md` 의 `## Overview (제품 정의)` 헤딩 비표준성, 그리고 `WH-SC-09` 의 IP 추출 정책 교차참조 누락이 해당된다. 구현 완료 후 검토 맥락에서, 변경된 코드(hooks/client-ip 통합)에 대응하는 `spec/5-system/` 내 spec 문서(`12-webhook.md`, `2-api-convention.md`)는 현행 규약을 준수하며 기술되어 있다.

## 위험도

NONE
