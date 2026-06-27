# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상: `spec/2-navigation/6-config.md`
검토일: 2026-06-27

---

### 발견사항

**발견사항 없음 (이하는 정합 확인 메모)**

---

- **[INFO]** R-3 번복(ModelConfig 단일화)의 교차 스펙 정합 확인
  - target 위치: `spec/2-navigation/6-config.md §Rationale R-3 (번복)`
  - 과거 결정 출처: `spec/1-data-model.md §2.16 Rationale (ModelConfig 통합)` — "구 LLMConfig/RerankConfig sibling 분리(API shape 차이 근거)는 실행 레이어 관심사일 뿐 설정 테이블을 쪼갤 이유가 아니었다"
  - 상세: target R-3 는 "이전 결정(폐기)"·"번복 결정"·"번복 근거" 를 명시하며, `data-model.md §2.16 Rationale` 도 "([Spec 설정 §Rationale R-3](./2-navigation/6-config.md) 의 sibling 분리 결정을 번복.)" 으로 쌍방 교차 참조한다. 기각된 sibling 분리 대안은 재도입되지 않았으며 번복 Rationale 가 두 문서에 모두 기록됐다.
  - 제안: 없음 (정합).

- **[INFO]** bearer_token 자동 발급 강제 결정의 선행 기록 확인
  - target 위치: `spec/2-navigation/6-config.md §A.2 Bearer Token 행 + §Rationale R-2`
  - 과거 결정 출처: `spec/1-data-model.md §2.17.3 Rationale (AuthConfig 도메인)` — "기존 6-config 의 '자동 생성 또는 사용자 입력' 중 사용자 입력 옵션을 제거하고 자동 발급(`wft_<hex32>`)만 허용"
  - 상세: 옛 6-config 에는 bearer_token 사용자 직접 입력 허용 옵션이 있었다. data-model §2.17.3 이 이를 제거하는 결정을 먼저 기록했고, target R-2 는 동일 표현("사용자 입력 없이 자동 발급만 허용")으로 이를 반영했다. 합의된 결정이 두 문서에 일관되게 기록됐으며, target 이 과거 허용 옵션을 재도입하지 않는다.
  - 제안: 없음 (정합).

- **[INFO]** ModelConfig mutation 권한 Editor+ vs AuthConfig mutation 권한 Admin+ 분기
  - target 위치: `spec/2-navigation/6-config.md §3 Model Config API` ("mutation 은 Editor+") vs `§3 Authentication API` ("mutation 은 Admin+")
  - 과거 결정 출처: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` (payload 미포함이나 target 이 일관되게 인용)
  - 상세: 두 권한 레벨 분기는 명시적으로 auth.md §3.2 를 출처로 인용한다. `spec/2-navigation/16-agent-memory.md Rationale` 가 "삭제는 editor 이상으로 제한" 을 지식저장소·메모리 도메인에 동일 적용하여 패턴 정합성이 간접 확인된다. AuthConfig Admin+ 는 `spec/5-system/1-auth.md §3.2 Owner/Admin=CRUD` 선언에서 온다. payload 에 auth spec Rationale 이 없어 직접 교차 확인은 불가하나 target 인용이 일관적이다.
  - 제안: 없음. 구현 착수 전 auth.md §3.2 매트릭스에서 ModelConfig=Editor·AuthConfig=Admin 를 재확인하는 것이 권장 사항이나, 현재 인용 구조상 위반 근거 없음.

---

### 요약

`spec/2-navigation/6-config.md` 는 Rationale 연속성 관점에서 이상 없다. 두 건의 명시적 번복(R-3 ModelConfig 단일화, R-5 max_tokens 2048→4096 정정)은 모두 새 Rationale 를 동반하며, 특히 R-3 는 `spec/1-data-model.md §2.16 Rationale` 과 쌍방 교차 참조로 일관되게 기록됐다. 과거 기각된 대안(sibling RerankConfig/LLMConfig 분리)은 재도입되지 않았고, 합의된 설계 원칙(SSRF 가드 통일·마스킹 단일 진실·AuthConfig-as-SoT·자동 발급 강제)을 모두 준수한다. bearer_token 사용자 입력 옵션의 제거는 data-model 이 선행 결정하고 target 이 반영한 구조로, 합의 역행이 아니다. AuthConfig Admin+ / ModelConfig Editor+ 권한 분기는 auth spec §3.2 인용이 일관되며 인접 Rationale 패턴과도 부합한다.

### 위험도

NONE
