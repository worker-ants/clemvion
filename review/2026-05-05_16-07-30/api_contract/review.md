### 발견사항

- **[WARNING]** `add_node`/`update_node` 응답의 `result.ports` 계약 변화
  - 위치: `shadow-workflow.ts:400-410`, `shadow-workflow.ts:549-558`
  - 상세: F-2 이전에는 button ID 없는 entry를 저장하면 `result.ports`의 port ID는 resolver가 `btn_0`, `btn_1` 형태로 내려줬다. F-2 이후 동일한 input에 대해 `confirm`, `cancel` 같은 label-slug 기반 ID가 내려온다. 이번 턴에서 `add_node` → `add_edge`를 연속 호출하는 LLM/클라이언트는 동일 요청에 다른 port ID를 받게 되어 **암묵적 계약이 변경**된다.
  - 제안: 문서(`4-ai-assistant.md`)에 "F-2 이후 `result.ports`의 ID 형식이 label-slug 우선으로 바뀌었다"를 명시. 이미 `워크플로우 조립 규칙` 섹션에 설명이 추가돼 있으나, 하위 §4.3.2 `ports` 구조 설명에도 "button ID가 없으면 label-slug가 부여된다"는 일문을 추가하면 계약이 완결된다.

- **[WARNING]** 마이그레이션 미실행 상태에서의 `update_node` — edge 단절 위험
  - 위치: `button-slug.util.ts:83-87`, `migrate-button-ids.ts` 전체
  - 상세: 기존 워크플로의 button에 ID가 없는 상태에서 F-2 코드가 먼저 배포되면, `update_node` 호출 시 `normalizeNodeButtonIds`가 label-slug(`confirm` 등)를 부여한다. 그런데 canvas에 이미 resolver fallback ID(`btn_0`)로 연결된 edge가 있다면 dangling이 발생한다. 코드 주석과 spec이 "마이그레이션 먼저, 그 다음 F-2 활성화"를 전제로 명시하고 있으나, 이 **배포 순서 의존성이 API 계약 외부에 있는 운영 절차**로만 남는다.
  - 제안: 서버 기동 시 또는 `update_node` 진입 시점에 migration 완료 여부를 확인하는 feature flag/guard를 두거나, 최소한 배포 runbook에 "마이그레이션 완료 확인 후 F-2 활성화" 체크리스트를 체계화한다.

- **[INFO]** 마이그레이션 스크립트와 `normalizeNodeButtonIds`의 ID 정책 불일치 — 혼재 가능성
  - 위치: `migrate-button-ids.ts:113` (`btn_${i}`), `button-slug.util.ts:96` (label-slug 우선)
  - 상세: 마이그레이션은 label과 무관하게 `btn_0`, `btn_1` 형태를 부여하고, `normalizeNodeButtonIds`는 label-slug를 우선 시도한다. 마이그레이션 후 `update_node`로 새 button entry를 추가하면 기존 `btn_0`과 신규 `cancel`이 한 노드에 공존한다. 기능 버그는 아니지만 ID 형식이 혼재해 API 소비자 입장에서 일관성이 약해진다.
  - 제안: 마이그레이션 스크립트도 label-slug 정책(`normalizeNodeButtonIds`)을 재사용하도록 통일을 고려. 단, 기존 edge와의 호환을 위해 "ID 없는 entry에만 적용, 기존 `btn_0`은 유지" 정책은 그대로 두어야 한다.

- **[INFO]** 마이그레이션 스크립트 `--workspace-id` / `--user-id` 입력값 무검증
  - 위치: `migrate-button-ids.ts:225-227`
  - 상세: `CLI_WORKSPACE_ID`, `CLI_USER_ID`는 존재 여부만 확인하고 UUID 형식 검증이 없다. 형식이 잘못된 값이 `audit_log`에 삽입될 수 있다. 일회성 관리자 스크립트이나, audit trail 정합성 측면의 경미한 약점이다.
  - 제안: 삽입 전 간단한 UUID regex 검사 추가.

---

### 요약

이번 변경은 `shadow-workflow`의 `add_node`/`update_node` 내부에 버튼 ID 자동 정규화를 삽입해 `result.ports` 계약을 **label-slug 기반으로 변경**하는 것이 핵심이다. 기존 클라이언트가 port ID를 `result.ports`에서 수신 후 즉시 사용하는 권장 패턴을 따른다면 하위 호환성 문제는 없다. 그러나 **마이그레이션 스크립트 선행 실행이라는 배포 순서 의존성**이 코드 바깥의 운영 절차에만 존재하는 점이 가장 큰 리스크다. spec 문서 업데이트는 변경 의도를 잘 반영하고 있으며, 핵심 API 계약(`ShadowResult`, `ports` 구조)은 additive 변경으로 기존 필드를 제거하지 않았다.

### 위험도
**MEDIUM**