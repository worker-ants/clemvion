spec 및 구현 파일을 모두 확인했습니다. 결과를 정리합니다.

---

## 발견사항

**CRITICAL 및 WARNING 위배 없음.**

---

- **[INFO]** `markIntegrationCallbackError` — connected 행의 `status_reason` 미갱신
  - target 위치: 구현 파일 `backend/src/modules/integrations/integration-oauth.service.ts:611-622` (spec §10.4 에러 매핑 표 대응 구현)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §10.4 에러 매핑 표 및 Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나"
  - 상세: 
    - spec §10.4 표는 "state mismatch / expired (state row 소비 후)" 케이스에 대해 **integrationId 가 식별된 모든 행**에 `status_reason='oauth_state_mismatch'` 또는 `oauth_state_expired` 기록을 요구한다.
    - 그러나 `markIntegrationCallbackError` 현재 구현은 `pending_install` 행만 `statusReason = errorCode.toLowerCase()`로 갱신하고, `connected` 행의 state 에러는 `lastError`만 기록한 채 `statusReason`을 갱신하지 않는다.
    - Rationale 섹션은 `pending_install` 흐름의 status 보존 이유만 설명하고, `connected` 행의 state 에러 처리에 대한 설명이 없다 — Rationale 불완전성이지 연속성 위배는 아님.
    - 실제 발생 빈도: state expired/mismatch가 `connected` 행의 reauthorize 중 일어나는 경우는 매우 드문 엣지 케이스(팝업이 10분 내에 닫히지 않거나 provider 불일치 등).
  - 제안: spec §10.4 에러 매핑 표의 "state mismatch / expired (state row 소비 후)" 행에 "모든 status 행에 적용" 명시를 추가하거나, Rationale에 connected 행의 state error에 대한 정책을 한 문장 보충. 구현상에서도 `else` 분기에 state 에러코드 패턴 매칭 추가 검토.

---

## 요약

`spec/2-navigation/4-integration.md`의 2026-05-14 개정 사항은 의사결정 연속성 관점에서 건전하다. install timeout 시 `→ (삭제)`에서 `→ expired`로의 번복은 §6 본문에 "번복 acknowledgment" 노트로, Rationale에도 상세 근거로 명시되어 있다. `mode='cafe24_private_install'` 신설 기각, `CAFE24_INSTALL_INVALID_TOKEN(404)` 분리의 보안 전제, `pending_install` 필터 칩 제외 등 주요 결정이 모두 Rationale에 근거와 폐기된 대안을 포함해 기록되어 있다. 타 spec의 Rationale(data-model, workflow-list, auth 등)과의 교차 위배도 없다. 단 하나의 INFO 수준 지적은 spec §10.4의 connected 행 state 에러 시 `status_reason` 갱신 요건이 구현에서 누락된 엣지 케이스로, Rationale 불완전성과 구현 갭이 겹친 사항이다.

## 위험도

**LOW**