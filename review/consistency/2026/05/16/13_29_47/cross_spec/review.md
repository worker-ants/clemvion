# Cross-Spec 일관성 검토 — Cafe24 §2/§9.9 ux-cleanup (Phase 4)

대상 변경: `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.9, §10 CHANGELOG  
검토 일시: 2026-05-16  
세션: `review/consistency/2026/05/16/13_29_47/cross_spec/`

---

## 발견사항

### 1. [INFO] `spec/conventions/cafe24-api-metadata.md` — §9.9 / 버퍼 패턴 직접 언급 없음, 갱신 불필요

- target 위치: `4-cafe24.md` §9.9 (Fields 편집 UI 재작성)
- 충돌 대상: `spec/conventions/cafe24-api-metadata.md` 전체
- 상세: `cafe24-api-metadata.md` 는 메타데이터 형식(인터페이스 정의, MCP Bridge 매핑, allowlist 관계)을 다루며, 옛 KeyValueEditor/편집 버퍼 패턴을 한 번도 언급하지 않는다. `§2 Operation 메타데이터 형식`의 `fields{}` 객체 구조는 §9.9 (B) 채택안의 "메타데이터에 명시된 키만 행으로 렌더" 전제와 정합하다. §4 신규 endpoint 추가 절차(step 8: "spec 본문 수정 불요")도 4-cafe24.md 와 충돌 없다.
- 제안: 갱신 불필요. 현재 상태로 일관성 유지.

---

### 2. [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — planned 항목 dropdown 노출 기술과 일치, 갱신 불필요

- target 위치: `4-cafe24.md` §2 "Operation 후보 표시: `status: planned` 행도 dropdown 에 노출하되 disabled + '(지원 예정)' 접미사로 구분"
- 충돌 대상: `spec/conventions/cafe24-api-catalog/_overview.md` §3 status enum
- 상세: `_overview.md` §3 은 `planned` 상태를 "UI 의 Operation 드롭다운에 disabled + '지원 예정' 배지로 노출"로 명시한다. `4-cafe24.md` §2 의 "(지원 예정) 접미사"와 `_overview.md` §3 의 "'지원 예정' 배지"는 같은 의도의 표현 방식 차이(접미사 vs 배지)다. §9.9 재작성은 KeyValueEditor → 동적 폼 전환 서술에 집중하며, planned 항목 표시 자체는 변경 전·후 모두 동일하게 §2 에 명시되어 있다. 실질적 모순 없음.
- 제안: 갱신 불필요. 다만 "접미사" vs "배지" 용어를 맞추고 싶다면 `_overview.md` §3 또는 `4-cafe24.md` §2 중 하나에 "(지원 예정) 접미사(배지)" 형태로 병기해 모호성을 제거할 수 있다. 우선순위 낮음.

---

### 3. [INFO] `spec/4-nodes/4-integration/0-common.md` — Cafe24 행 이미 포함, 동적 폼 세부 기술 범위 밖

- target 위치: `4-cafe24.md` §2 (메타데이터 기반 동적 폼 설명 전면 교체)
- 충돌 대상: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약, §7 출력 구조 색인
- 상세: `0-common.md` §5 캔버스 요약 표의 Cafe24 행 (`{resource} · {operation}`)과 §7 출력 색인의 cafe24 행은 §2 변경과 무관하다. `0-common.md` 는 공통 규약(5필드, durationMs 통일, handler 6단계 계약)만 정의하며 개별 노드의 fields 입력 방식을 기술하지 않는다. `4-cafe24.md` §2 의 fields 렌더 방식 변경(KeyValueEditor → 동적 폼)은 `0-common.md` 의 어느 규약과도 충돌하지 않는다.
- 제안: 갱신 불필요.

---

### 4. [INFO] `spec/2-navigation/4-integration.md` §5.8 — §9.9 를 직접 참조하지 않으며, 동적 폼 관련 언급 없음

- target 위치: `4-cafe24.md` §9.9 (Fields 편집 UI 재작성), §2 (편집 버퍼 줄 제거, 동적 폼 + 호환 키 보존 기술 추가)
- 충돌 대상: `spec/2-navigation/4-integration.md` §5.8 Cafe24
- 상세: `4-integration.md` §5.8 는 credentials JSONB 스키마(mall_id, app_type, access_token 등), OAuth 흐름, Rate Limit 정책, AI Agent 노출 요약을 다룬다. Fields 편집 UI 방식(KeyValueEditor vs 동적 폼)에 대한 언급이 없으므로 §9.9 재작성과 충돌 지점이 없다. §5.8 의 `config.fields` 관련 언급도 없다. 크로스 링크(`[Spec 통합 §5.8 Cafe24]`)는 `4-cafe24.md` 최상단 관련 문서 목록에서 이미 유지되고 있다.
- 제안: 갱신 불필요.

---

### 5. [INFO] `spec/5-system/11-mcp-client.md` — 버퍼 패턴 무관, §9.9 재작성 영향 없음

- target 위치: `4-cafe24.md` §9.9 적용 범위 변경 ("옛 편집 버퍼는 본 프로젝트에서 더 이상 사용되지 않음")
- 충돌 대상: `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge, §8.4 인증 실패 자동 status 전환
- 상세: `11-mcp-client.md` 는 `Cafe24McpBridge.callTool(name, args)` 가 args 를 "노드 핸들러의 `fields` 와 동일하게 처리"한다고 명시한다. 이 서술은 fields 의 직렬화 형식(`Record<string, unknown>`)을 전제하며, 그 형식은 §9.9 (A) KeyValueEditor 시절에도 (B) 동적 폼 시절에도 동일하다 — backend handler 의 `config.fields` shape 자체가 바뀌지 않았고, 바뀐 것은 frontend UI 에서 사용자가 keys 를 어떻게 입력하는가이다. MCP Bridge 계층은 fields 를 그대로 위임하므로 §9.9 재작성의 영향을 받지 않는다. §8.4 의 401/403 자동 status 전환 정책도 `4-cafe24.md` §6.1 과 일치(양쪽 모두 `error(auth_failed)`)한다.
- 제안: 갱신 불필요. 기존 일관성 확인.

---

### 6. [INFO] `plan/in-progress/cafe24-node-resource-operation-ux.md` — 명시적 검토 대상 아님이나 Phase 4 반영 여부 확인

- target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 4 섹션
- 충돌 대상: `4-cafe24.md` §10 CHANGELOG `2026-05-16 (ux-cleanup)` 행
- 상세: CHANGELOG 는 Phase 4 §9.9 cleanup 을 본 plan 에서 추적함을 명시하며, 호출자 설명에 따르면 plan 문서에 Phase 3 followups 체크 + Phase 4 §9.9 cleanup 섹션 + Phase 5+ 백로그 이전이 이미 반영되었다. 이는 plan ↔ spec CHANGELOG 사이의 이중 기록이지만 충돌이 아니라 정상 추적 패턴이다.
- 제안: 특별 조치 불필요. plan 문서가 실제로 갱신되었다면 일관성 달성.

---

## 요약

`4-cafe24.md` §2 와 §9.9 의 ux-cleanup 재작성은 대상 5개 문서 어느 것과도 직접 모순을 일으키지 않는다. `cafe24-api-metadata.md` 는 메타데이터 형식만 다루어 편집 버퍼 패턴을 언급조차 하지 않고, `cafe24-api-catalog/_overview.md` 의 `planned` 항목 dropdown 노출 정책은 §2 기술과 실질적으로 일치한다. `0-common.md` 는 fields 입력 방식을 정의하지 않으며, `4-integration.md` §5.8 은 credentials/OAuth에 집중하므로 동적 폼 변경의 영향권 밖이다. `11-mcp-client.md` 의 Bridge 계층은 `config.fields` shape 에 무관하게 args 를 그대로 위임하므로 변경과 독립적이다. INFO 6건은 모두 "현재 일관성 확인" 또는 "선택적 용어 통일 권장" 수준이며, 구현을 차단하거나 다른 spec 즉시 갱신을 강제하는 CRITICAL·WARNING 은 없다.

---

## 위험도

NONE
