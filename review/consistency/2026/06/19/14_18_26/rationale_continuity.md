# Rationale 연속성 검토 결과

검토 모드: --impl-done  
대상: `spec/2-navigation/4-integration.md` + 구현 변경 (PR #633)  
맥락: 통합 사용처 추적 direct ∪ MCP 합집합, usageKind 필드 도입

---

## 발견사항

### 발견사항 없음 (이슈 부재)

PR #633 의 변경사항을 기존 `spec/2-navigation/4-integration.md ## Rationale` 및 관련 spec 의 Rationale 섹션 전체와 대조한 결과, 아래 4개 관점 모두에서 이슈가 발견되지 않았다.

---

**관점 1 — 기각된 대안의 재도입**

- 기존 Rationale 에서 사용처 쿼리 관련으로 기각된 대안은 "config.integrationId 단일 경로만" 이다. 이 결정은 PR #633 이 수정·확장하는 대상 자체이므로, PR 이 그것을 "재도입" 하는 것이 아니라 기존 단일 경로의 미비점(MCP 참조 누락)을 보완하는 것이다.
- `Attention 가상 필터값` Rationale 에서 기각된 "멀티 선택 칩" / "multi-value 쿼리(`?status=expiring&status=expired`)" 는 이번 PR 과 관련 없는 영역이며 재도입되지 않는다.
- Cafe24 Private install_token 관련 Rationale 에서 폐기된 "100건 mall_id 스캔 + trial HMAC" 패턴도 이번 변경에서 재등장하지 않는다.

**관점 2 — 합의된 원칙 위반**

- Rationale 의 "영속화되는 상태와 화면 필터링용 술어를 분리" 원칙: `usageKind` 는 DB 컬럼이 아니라 SQL CASE 식으로 도출되는 derived 값(query result 컬럼)이며 Integration.status Enum 을 확장하지 않는다. 원칙 준수.
- Rationale 의 "단일 경로" 원칙(예: PATCH body 단일 경로, `isActive` read-only 배지 등): 이번 PR 은 사용처 조회 경로를 변경하지 않는다. GET /api/integrations/:id/usages 경로는 그대로이고 쿼리 내부만 확장됐다. 원칙 준수.
- DB Enum 비확장 원칙: PR 은 Migration을 추가하지 않으며 `node` 테이블에 새 컬럼을 추가하지 않는다. SQL CASE 식으로 `usage_kind` 를 런타임에 파생한다. 원칙 준수.

**관점 3 — 결정의 무근거 번복**

- PR #633 은 spec diff 에서 `## Rationale` 에 **"사용처 추적 — AI Agent MCP 참조 포함"** 항목을 신설해 결정 배경·3가지 이유·`direct` 우선 규칙·JSONB `@>` 선택 근거를 명시했다. 이는 결정 번복이 아니라 기존 결정의 범위 확장이며, 그 근거가 새 Rationale 항목으로 함께 작성됐다. 규약("결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가")을 충족.
- spec 본문 §7.1 도 동시에 개정돼 "두 참조 경로의 합집합", `usageKind` 정의, `direct` 우선 규칙을 반영했다. spec 과 Rationale 와 구현이 삼위일체로 갱신됐다.

**관점 4 — 암묵적 가정 충돌**

- Rationale 에 기록된 "INT-US-05 활동 로그는 MCP 호출을 이미 기록한다" 라는 invariant 와 "사용 탭에 MCP 사용처 표시" 가 충돌 없이 정합을 이룬다. 오히려 신규 Rationale 항이 "(1) spec 내부 정합 — 활동 탭엔 호출이 있는데 사용 탭엔 사용처 없음 모순" 을 명시적으로 해소 동기로 기술했다.
- spec §7.1 의 "두 경로는 실질 배타적" 기술과 구현의 `direct` 우선 CASE 식 사이에 겉보기 긴장이 있으나, spec 자체가 "한 노드가 양쪽 모두에 해당하면 `direct` 를 우선한다" 라고 방어적 규칙을 함께 명기해 모순을 해소했다. Rationale 도 동일 설명을 담고 있다. 암묵적 가정 충돌 없음.

---

## 요약

PR #633 은 기존 사용처 추적 범위를 `config.integrationId` 단일 경로에서 `config.mcpServers[].integrationId` MCP 경로까지 합집합으로 확장하면서, 해당 결정의 근거와 기각된 대안(integrationId 단일 스캔 유지)이 왜 충분하지 않았는지를 새 Rationale 항목 "사용처 추적 — AI Agent MCP 참조 포함" 에 3가지 이유로 명시했다. spec 본문 §7.1, §7.2, §4.5 UI 설명도 함께 갱신돼 spec-Rationale-구현 삼위일체가 유지된다. 기존 Rationale 에서 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않는다.

## 위험도

NONE

STATUS: DONE
