### 발견사항

---

**[CRITICAL]** `timeout` 포트 제거에 따른 기존 연결 엣지 파손
- 위치: `spec/4-nodes/3-ai-nodes.md` 포트 섹션 및 Multi Turn 종료 조건 3-d
- 상세: 기존에 `timeout` 포트에 연결된 엣지를 가진 워크플로우는 포트가 사라지면서 dangling edge 상태가 됨. 스펙에 마이그레이션 전략(예: `timeout` → `error` 포트로 자동 리맵)이 없음
- 제안: 마이그레이션 가이드 또는 자동 리맵 로직 명시. 저장된 워크플로우 데이터의 `timeout` 엣지를 `error`로 변환하는 데이터 마이그레이션 스크립트 필요 여부 결정

---

**[CRITICAL]** Multi Turn 0-conditions 하위 호환 처리 불완전
- 위치: `spec/4-nodes/3-ai-nodes.md` 공통 섹션, `prd/3-node-system.md` ND-AG-24
- 상세: 기존 Multi Turn + 0-conditions 구성의 포트: `timeout` + `user_ended` + `max_turns` + `error` → 변경 후: `out` 하나만 제공. `user_ended`, `max_turns`, `error` 포트에 연결된 기존 엣지가 모두 파손됨. "하위 호환"이라고 명시했으나 실제로는 포트 4개 → 1개로 축소되어 하위 호환이 아님
- 제안: 0-conditions Multi Turn의 포트 구조를 별도로 명시. `out` 추가는 좋지만 기존 포트(`user_ended`, `max_turns`, `error`)는 유지하거나, 파손 범위를 명확히 인지한 breaking change로 분류해야 함

---

**[WARNING]** 도구 이름 규칙 변경으로 인한 기존 `toolOverrides` 설정 파손
- 위치: `spec/4-nodes/3-ai-nodes.md` Tool Area 연동 섹션, ToolOverride 구조
- 상세: 기존 도구 이름은 순수 UUID였으나, 변경 후 `tool_` + 정제 UUID 형식으로 바뀜. 저장된 `toolOverrides[].toolName`이 UUID 형식을 직접 참조하거나, 로그/히스토리에서 도구 이름으로 매칭하는 로직이 있다면 불일치 발생
- 제안: 기존 저장 데이터에 대한 마이그레이션 처리 여부 및 `toolOverrides`의 `toolName` 필드가 접두사 포함 여부를 처리하는 방식 명시

---

**[WARNING]** `endReason` enum 의미론적 불일치
- 위치: `spec/4-nodes/3-ai-nodes.md` Multi Turn 오류 포트 출력 구조
- 상세: `endReason` enum에 `timeout`이 유효 값으로 남아있지만, `timeout` 포트는 제거됨. 스펙 내 주석("참고: endReason에서 timeout은 여전히 유효한 값이지만...")으로 설명하고 있으나, 구현자가 포트 라우팅 로직에서 `endReason === 'timeout'`을 특수 처리해야 하는지 여부가 불명확. 또한 Single Turn 오류 출력 JSON에는 `endReason` 필드 자체가 없어 두 모드 간 출력 구조가 비대칭
- 제안: `timeout` endReason 값을 완전히 제거하고 `error`로 통합하거나, 런타임에서 `timeout`을 `error`로 정규화하는 처리를 명시. Single Turn 오류 출력에도 `endReason` 필드 추가를 검토

---

**[WARNING]** 신규 유효성 검증 규칙의 기존 데이터 영향
- 위치: `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙 섹션 (신규 추가)
- 상세: 최대 20개 조건 제한, prompt 최대 2,000자 제한이 새로 추가됨. 이미 저장된 워크플로우 중 조건이 20개 초과이거나 prompt가 2,000자 초과인 경우, 로드/편집 시 오류 발생 가능
- 제안: 신규 검증 규칙을 기존 데이터에 소급 적용할지 여부 명시. 편집 시에만 적용하는 "soft validation" 방식 채택 여부 결정

---

**[INFO]** `_turnDebugHistory` 필드 추가 — 출력 구조 확장
- 위치: `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 (신규)
- 상세: 출력 데이터에 `_turnDebugHistory` 필드 추가는 additive change이므로 기존 소비자를 파손하지 않음. 다만 `requestPayload`에 전체 메시지 배열 포함 시 대용량 데이터가 실행 기록에 저장될 수 있음
- 제안: 디버그 데이터 저장 크기 상한 또는 운영/개발 환경별 포함 여부 설정 검토

---

**[INFO]** Single Turn 포트 순서 변경
- 위치: `prd/3-node-system.md` ND-AG-23, `spec/4-nodes/3-ai-nodes.md` 포트 섹션
- 상세: 조건 포트가 `out` 앞으로 이동. 기능 영향은 없으나 캔버스 UI에서 포트 렌더링 순서가 바뀌어 기존 사용자에게 시각적 변화 발생
- 제안: 포트 순서 변경이 UI에서 자동 반영되는 방식인지(저장된 포트 순서 유지 여부) 확인 필요

---

### 요약

이번 변경은 `timeout` 포트 제거와 도구 이름 규칙 변경이라는 두 가지 **파괴적 인터페이스 변경(breaking change)**을 포함한다. 특히 `timeout` 포트 제거는 기존 워크플로우의 엣지를 직접 파손하며, "하위 호환"으로 명시된 Multi Turn 0-conditions 케이스도 실제로는 포트 4개를 1개로 축소하는 breaking change다. 도구 이름 접두사 도입은 LLM 호환성 측면에서 타당한 개선이지만, 기존 저장 데이터와의 불일치를 유발할 수 있어 마이그레이션 전략이 필요하다. `endReason` enum에서 `timeout` 값이 잔존하면서 포트는 제거된 의미론적 불일치도 구현 단계에서 혼란을 야기할 수 있다.

### 위험도

**HIGH**