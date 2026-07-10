## 발견사항

### 검증 결과: 발견된 CRITICAL/WARNING 없음

target(`plan/in-progress/spec-integration-error-code-doc-fix.md`)의 4곳 doc-only 정정을 관련 spec들의 `## Rationale` 전체(발췌 + 원본 파일 직접 대조 + git 이력)와 교차 검증한 결과, 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 오히려 다음 근거들이 target 의 정정을 적극적으로 뒷받침한다.

- **직전 커밋(#894, 2026-07-10 17:53, `b214284e6`)의 명시적 예고**: `spec/2-navigation/4-integration.md` §4.6 배너 작업의 커밋 메시지에 "잔여 pre-existing 문서 stale(INTEGRATION_NOT_CONNECTED §6/0-common)은 신규 §4.6 이 정확하므로 회귀 아님 — planner 후속 task_6f46d7eb 이관" 이라고 명시되어 있다. target 은 이 예고된 후속 작업(§6/0-common 의 stale 정정)을 정확히 수행하고 있다 — 결정의 번복이 아니라 **이미 합의된 후속 조치의 이행**이다.
- **동일 문서 내부의 기존 정합 서술과 일치**: `spec/2-navigation/4-integration.md:380` (§4.6 관련, #894 로 이미 반영됨)에 "직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패" 라는 문구가 이미 존재한다. target 이 고치려는 §6 line 726 은 같은 문서 안에서 이 문구와 모순되던 **문서 내부 불일치**였다. target 은 이 불일치를 코드(§6 Rationale·`resolveIntegration` 검증) 쪽으로 정렬한다.
- **`INTEGRATION_INCOMPLETE` 의 `testConnection` 용법 유지는 기존 Rationale 과 정확히 부합**: `spec/2-navigation/4-integration.md` Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식" 항은 `POST /api/integrations/:id/test` 의 `pending_install` 가드가 `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 를 반환한다고 명시적으로 결정했다. target 의 Rationale ("`INTEGRATION_INCOMPLETE` 의 testConnection·credential-누락 용법은 유지")은 이 기존 결정을 정확히 보존한다 — 번복이 아니다.
- **`INTEGRATION_INCOMPLETE`/`INTEGRATION_NOT_CONNECTED` 를 특정 조건(status vs credentials)으로 갈라 쓰는 원칙**은 `spec/4-nodes/4-integration/0-common.md:83-84` 에서 이미 명시(`INTEGRATION_NOT_CONNECTED`=status 검사, `INTEGRATION_INCOMPLETE`=필드 누락 검사)되어 있고, `pending_install` 이 그 목록에서 누락된 것은 **git 이력상 최초 도입 시점(과거 Cafe24 Private 전용이던 시절)부터의 단순 누락**이며, 이후 MakeShop 확장 시에도 갱신되지 않은 것으로 확인된다 — 즉 명시적으로 기각·확정된 설계가 아니라 방치된 문서 stale.
- **"코드가 SoT" 원칙은 이 저장소에서 이미 반복적으로 채택된 패턴**이다 (`spec/2-navigation/0-dashboard.md` Rationale 헤더 "본 절은 2026-06-03 spec-vs-code 동기화 시 코드 현실에 맞춰 정정한 항목의 근거다" 등). target 의 "코드가 SoT — spec 을 코드에 맞춘 정정" Rationale 은 이 저장소의 기존 합의 원칙과 정확히 같은 장르다.
- `spec/4-nodes/4-integration/3-send-email.md` §8 Rationale 에는 line 221 의 `INTEGRATION_NOT_CONNECTED` 상태 목록(`expired`/`error`)에 대한 별도의 명시적 설계 근거 항목이 없다 — 즉 이 목록도 §6/0-common 과 동일한 성격의 누락이며, target 의 4번째 수정은 기존 Rationale 항목과 충돌하지 않는다.

- **[INFO]** §6 line 726 정정 시 AI Agent 경로의 서술 정밀도 보완 여지
  - target 위치: `plan/in-progress/spec-integration-error-code-doc-fix.md` 변경 항목 1 (`spec/2-navigation/4-integration.md` §6 line 726)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md:380` (§4.6 "연결 안 됨 배너" Rationale, #894 로 확정)
  - 상세: 해당 Rationale 은 "AI Agent 는 MCP bridge 가 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고(=에러코드 없음), **직결 노드만** `INTEGRATION_NOT_CONNECTED` 로 즉시 실패"라고 두 경로를 구분한다. target 의 line 726 수정은 "노드·AI Agent 에서 사용할 수 없다 (`INTEGRATION_NOT_CONNECTED` — §4.2)"처럼 단일 에러코드를 두 대상에 동시 부여하는 기존(정정 전) 표현 구조를 그대로 유지한다. 이는 새로 도입하는 오류는 아니고 원래도 있던 서술이라 target 범위를 벗어나지만, §4.6 Rationale 의 더 정밀한 구분과 완전히 정합하지는 않는다.
  - 제안: 여유가 있다면 "노드는 즉시 `INTEGRATION_NOT_CONNECTED`, AI Agent 는 MCP bridge 가 해당 tool 을 아예 노출하지 않아 에러코드 자체가 발생하지 않음" 정도로 두 경로를 분리 서술하면 §4.6 Rationale 과 완전히 정합해진다. 필수 조치는 아님(범위 확대 불필요).

## 요약
target 문서는 신규 결정이 아니라 직전 PR(#894)이 이미 "정확함"으로 확정한 §4.6 배너 서술(`INTEGRATION_NOT_CONNECTED`)을 기준으로, 같은 문서 내부에 방치되어 있던 §6/§4.2 stale 서술을 코드(`resolveIntegration` status 검사)에 맞춰 정정하는 4곳 doc-only 변경이다. `#894` 커밋 메시지가 이 정정 작업을 `task_6f46d7eb` 후속으로 명시적으로 예고했고, 관련 Rationale(연결 테스트 `pending_install` 가드의 `INTEGRATION_INCOMPLETE`, 0-common.md 의 status-vs-credential 구분 원칙, "코드가 SoT" 동기화 관례)과 전면적으로 정합한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도
NONE
