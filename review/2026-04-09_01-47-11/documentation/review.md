## Documentation Code Review — AI Node 스펙 변경

### 발견사항

---

**[INFO]** `endReason` enum 값과 실제 포트 라우팅 간 의도적 불일치가 문서 내에만 설명됨
- 위치: `spec/4-nodes/3-ai-nodes.md` — `endReason` enum 정의 이후 주석
- 상세: `endReason`에 `timeout`이 여전히 유효한 값이지만 프론트엔드에서는 `error` 포트로 통합된다는 설명이 인라인 참고(> 참고:)로만 기재됨. 이 동작은 백엔드 구현자가 `endReason: "timeout"`을 그대로 내보내야 하는지, 아니면 `"error"`로 정규화해야 하는지 모호함.
- 제안: 다음과 같이 명시적으로 분리하여 기술할 것:
  ```
  - 백엔드: endReason 값은 timeout | error 모두 허용
  - 포트 라우팅: timeout, error 모두 `error` 포트로 라우팅
  ```

---

**[WARNING]** 유효성 검증 규칙의 예약 포트 ID 목록이 실제 포트 구조와 불일치
- 위치: `spec/4-nodes/3-ai-nodes.md` — "유효성 검증 규칙" 섹션
- 상세: 예약 포트 ID 목록에 `timeout`이 포함되어 있음(`out`, `in`, `timeout`, `error`, `user_ended`, `max_turns`). 그러나 동일 문서에서 `timeout` 포트는 제거되었고 "존재하지 않음"으로 명시됨. 예약 목록에 `timeout`을 포함시키는 것은 혼동을 줄 수 있음 — 미래에 재도입 가능성을 예약하는 의도라면 주석으로 명시가 필요함.
- 제안: `timeout`을 예약 목록에서 제거하거나, 제거하지 않는다면 `# 과거 포트, 현재 미사용` 등 이유를 주석으로 명시.

---

**[WARNING]** Multi Turn 조건 0개 케이스의 동작이 PRD와 Spec 간 미세하게 다르게 기술됨
- 위치: `prd/3-node-system.md` ND-AG-24 vs `spec/4-nodes/3-ai-nodes.md` "조건이 0개인 경우" 섹션
- 상세:
  - PRD(ND-AG-24): `"조건 0개 시 기본 out 포트만 (하위 호환)"`
  - Spec: `"Multi Turn: out (기본 출력만 제공하여 기존 엣지 유지)"`
  - 두 문서는 의미상 동일하나 표현이 다름. 더 큰 문제는 `prd/6-phase2-ai.md` ND-AG-24도 동일한 내용을 기술하는데, 세 곳의 표현이 모두 미묘하게 달라 단일 진실 공급원(Single Source of Truth) 원칙이 약화됨.
- 제안: Spec을 권위 있는 문서로 지정하고, PRD 두 곳에는 "상세: spec/4-nodes/3-ai-nodes.md 참조"로 위임하는 패턴을 일관 적용할 것. 현재 `prd/6-phase2-ai.md`는 이미 `> 상세:` 링크를 쓰고 있으나 ND-AG-23/24는 자체 기술하고 있어 불일치.

---

**[INFO]** `_turnDebugHistory` 섹션이 새로 추가되었으나 설정(config) 테이블에 관련 필드 없음
- 위치: `spec/4-nodes/3-ai-nodes.md` — "디버그 데이터" 섹션
- 상세: `_turnDebugHistory`가 출력 구조에 포함된다고 명시되었으나, 이 필드가 항상 포함되는지, 옵트인(opt-in)인지, 어떤 조건에서 포함/제외되는지 문서화되지 않음. 디버그 데이터가 실행 결과 페이로드에 항상 포함된다면 크기 제한 관련 고려사항도 없음.
- 제안: 설정(config) 테이블에 `includeDebugHistory: Boolean` 같은 필드 추가 여부를 결정하고, 포함 조건(예: 개발 모드 전용, 항상 포함 등)을 명시.

---

**[INFO]** 도구 이름 정제(sanitize) 함수의 결과 길이 제한이 문서화되지 않음
- 위치: `spec/4-nodes/3-ai-nodes.md` — "도구 이름 규칙" 섹션
- 상세: UUID를 `_`로 치환하면 `tool_xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx` 형태로 최대 41자가 됨. OpenAI 등 일부 LLM API는 도구 이름 최대 길이 제한(OpenAI: 64자)이 있으며, 현재 스펙은 이 제약을 언급하지 않음.
- 제안: "정제된 UUID는 최대 N자 이내" 또는 "LLM API 호환성을 위해 최대 64자 이내로 잘림 처리"를 도구 이름 규칙에 추가.

---

### 요약

이번 변경은 `timeout` 포트 제거, 도구 이름 접두사 규칙 도입(`cond_`/`tool_`), Multi Turn 조건 0개 케이스 하위 호환 처리 등 구체적인 구현 결정을 PRD와 Spec에 반영한 문서화 작업으로, 전반적으로 일관성 있게 수정됨. 다만 `endReason: "timeout"` 값의 백엔드/프론트엔드 간 처리 차이가 인라인 주석으로만 설명되어 구현 모호성이 남아 있으며, 유효성 검증 규칙의 예약 포트 ID 목록에 제거된 `timeout`이 잔존하는 점이 가장 주의가 필요한 부분임. PRD 두 파일과 Spec 간 동일 요구사항의 표현 불일치는 낮은 위험도이지만 장기적으로 단일 진실 공급원 원칙 강화가 권장됨.

### 위험도

**LOW**