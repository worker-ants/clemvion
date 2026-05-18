### 발견사항

- **[INFO]** 보조 Rationale 코퍼스와 target 도메인의 직접 연관성 부재
  - target 위치: plan 전체 (배경, 결정, 작업 항목)
  - 과거 결정 출처: 제공된 Rationale 발췌 전체 (`spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/4-integration.md`)
  - 상세: 제공된 Rationale 발췌는 모두 Integration/Auth 도메인(Cafe24 install token, OAuth callback, status_reason 통일, refresh 실패 정책 등)에 속한다. send-email 노드의 `to/cc/bcc` array-only 정준화 결정과 직접 충돌하거나 이를 기각한 과거 결정이 발췌 범위 내에 존재하지 않는다. orchestrator가 보조 코퍼스를 더 넓게 수집하지 못한 것으로 보이며, `spec/4-nodes/4-integration/3-send-email.md §Rationale` (신설 예정) 이외의 노드 카테고리 공통 spec(`spec/4-nodes/0-common.md` 등)이 제공되지 않아 그 쪽에서 sum-type 허용 원칙이 있는지 검토할 수 없다.
  - 제안: 후속 점검 시 `spec/4-nodes/0-common.md` 및 `spec/4-nodes/4-integration/3-send-email.md` 전문을 포함한 코퍼스로 재검토를 권장한다. 단, 현재 제공 범위 안에서는 충돌 증거가 없다.

- **[INFO]** §8 Rationale 신설 계획 — 결정 번복 근거 명문화 여부 사전 확인
  - target 위치: `작업 항목 > spec/4-nodes/4-integration/3-send-email.md > §8 Rationale 신설`
  - 과거 결정 출처: 해당 spec 기존 Rationale (코퍼스에 미포함)
  - 상세: target plan이 "§8 Rationale 신설 — array-only 정준화 결정 + 3개 선택지 비교 + breaking + 스테이징 마이그레이션 skip 근거 + 6 layer 동작 명시"를 명시적으로 계획하고 있다. 이는 CLAUDE.md가 요구하는 "결정의 근거를 해당 spec 문서 끝의 `## Rationale` 섹션에 기록" 원칙과 정합하며, 무근거 번복 패턴에 해당하지 않는다. 단, 실제 구현 commit에서 Rationale 신설이 누락되면 사후 위반이 된다.
  - 제안: PR 리뷰 시 `spec/4-nodes/4-integration/3-send-email.md §8 Rationale` 섹션이 plan에 명시된 3개 선택지 비교 및 breaking 결정 근거를 실제로 포함하는지 확인한다.

- **[INFO]** "단일 commit" 정책 — CLAUDE.md 규약과의 정합
  - target 위치: `작업 항목 첫 번째 블록 callout` ("모든 변경은 단일 commit — schema/validator/handler/spec/i18n 동시 정렬이 의미를 가진다")
  - 과거 결정 출처: 해당 설계 원칙이 기존 Rationale에 명시된 선례는 없음
  - 상세: 단일 commit 정책은 원자적 일관성을 위한 설계 선택이다. 이 자체가 기존 Rationale의 원칙을 위반하는 증거는 제공 코퍼스 내에 없다. 다만 단일 commit이 PR 리뷰 중 부분 수정이 필요한 상황에서 재작업 비용을 높인다는 trade-off가 있으나, plan이 이를 의도적으로 선택한 것으로 보인다.
  - 제안: 단일 commit의 근거(부분 적용 시 동일한 sum-type 비대칭 재현)를 신설 §8 Rationale에 함께 기재하면 추후 이 결정이 왜 분리 commit으로 가지 않았는지를 추적할 수 있다.

### 요약

제공된 Rationale 코퍼스(Integration/Auth 도메인)와 target plan(send-email array-only 정준화) 사이에 직접적인 기각 결정 재도입, 합의 원칙 위반, 무근거 번복, invariant 충돌은 발견되지 않는다. target plan은 `spec/4-nodes/4-integration/3-send-email.md §8 Rationale 신설`을 명시적으로 포함하고 있어 CLAUDE.md의 "결정 근거를 Rationale 섹션에 기록" 원칙을 따를 의도를 보인다. 다만 보조 코퍼스가 send-email 도메인의 기존 Rationale 및 노드 카테고리 공통 spec을 포함하지 않아 해당 영역의 잠재 충돌 여부는 현재 검토 범위 밖이다. 위험 수준은 낮다.

### 위험도

LOW
