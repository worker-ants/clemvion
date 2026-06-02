# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-error-codes.md` (격상 시 `spec/conventions/error-codes.md`)
검토 모드: spec draft (--spec)
검토 일시: 2026-06-02

---

### 발견사항

- **[INFO]** `4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외" 항이 아직 `spec/conventions/error-codes.md §3` 를 SoT 로 forward 참조하지 않음
  - target 위치: `plan/in-progress/spec-draft-error-codes.md` — 격상 시 동반 갱신 체크리스트 3번 항목
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale `### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정` "(c) 의미 기반 명명 선례 예외"
  - 상세: 현재 `4-integration.md` Rationale (c) 항은 "본 프로젝트의 에러 코드는 의미 기반 명명을 원칙으로 하나, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 historical artifact 예외로 등록한다 … 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다" 고만 적혀 있다. target draft 의 `spec/conventions/error-codes.md §3` 가 이 예외의 정식 레지스트리 SoT 가 된다고 명시하지 않은 채 spec 이 신설되면, 기존 (c) 항과 새 §3 간에 SoT 이중 정의가 발생한다. target draft 의 `§3` 표 비고 칸에 이미 "정식 SoT 는 본 §3" 이라고 적고 `4-integration.md` 로의 역참조도 기술되어 있으나, `4-integration.md` 쪽에서는 아직 forward 참조가 없는 상태다.
  - 제안: 격상 체크리스트 3번("4-integration.md Rationale (c) 에 forward 참조 + 정식 SoT 한 줄")이 이미 명시되어 있으므로 격상 시 반드시 이행. draft 자체에 추가 수정은 불필요. (체크리스트 이행 전 격상 금지를 draft 본문에 명시하면 더 안전.)

- **[INFO]** `spec/5-system/3-error-handling.md` 에 명명 규율 위임 한 줄 부재
  - target 위치: `plan/in-progress/spec-draft-error-codes.md` — 격상 시 동반 갱신 체크리스트 4번 항목
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §3.2` ("`UPPER_SNAKE_CASE` 에러 코드" 선언)
  - 상세: `3-error-handling.md` 는 `UPPER_SNAKE_CASE` 표기를 정의하고 `error-codes.ts` 를 enum 목록 SoT 로 지정하나, "명명 규율 자체는 `conventions/error-codes.md` 가 SoT" 라는 위임 구문이 없다. 격상 후 두 문서 간 SoT 경계가 모호해질 수 있다. target draft 의 Overview 에서 `UPPER_SNAKE_CASE` 표기는 `3-error-handling.md §3.2` 가 SoT 이며 재선언하지 않는다고 명시한 것은 올바르다. 다만 역방향 위임(3-error-handling → conventions/error-codes)이 없어 독자가 `3-error-handling.md` 만 읽으면 명명 규율 문서가 존재함을 알 수 없다.
  - 제안: 격상 체크리스트 4번("3-error-handling.md 에 명명 규율 위임 한 줄")이 이미 명시되어 있으므로 격상 시 반드시 이행.

- **[INFO]** `4-integration.md` Rationale "(c)" 항의 "의미 기반 명명을 원칙으로" 선언이 target 의 `§1` 과 동일 원칙을 별도로 서술 중 — 중복 정의 형태
  - target 위치: `spec/conventions/error-codes.md §1` (격상 후)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외"
  - 상세: `4-integration.md` 의 "(c)" 는 "본 프로젝트의 에러 코드는 의미 기반 명명을 원칙으로 하나" 라는 원칙 선언을 인라인으로 담고 있다. target 격상 후 동일 원칙의 공식 SoT 는 `conventions/error-codes.md §1` 가 되므로 `4-integration.md` (c) 의 원칙 인라인 선언은 중복이 된다. 기능적 충돌은 아니지만 "(c)" 에서 `§1` 역참조 추가(위 INFO #1 의 forward 참조와 동일 수정으로 해소 가능)로 정리되면 중복이 제거된다.
  - 제안: 격상 체크리스트 3번 수행 시 "(c)" 본문을 "의미 기반 명명 원칙 전반은 `spec/conventions/error-codes.md §1` 참조" 로 단축하는 방식으로 겸하여 정리.

---

### 요약

target draft(`spec/conventions/error-codes.md` 신설안)는 기존 spec 의 Rationale 에서 명시적으로 기각된 대안(rename 강제, 예외 소급 적용 등)을 재도입하지 않으며, `4-integration.md` Rationale 에서 확립된 "의미 기반 명명 원칙 + historical-artifact 예외 보존" 노선을 그대로 계승하고 있다. `UPPER_SNAKE_CASE` 표기 SoT 를 `3-error-handling.md` / `node-output.md` 에 두고 재선언하지 않는다는 경계 설정도 기존 SoT 구조와 정합한다. 발견된 사항은 격상 시 동반 갱신 체크리스트로 이미 포착된 INFO 수준의 SoT forward/backward 참조 미완성 2건 및 인라인 원칙 선언 중복 1건으로, 격상 체크리스트를 순서대로 이행하면 모두 자연 해소된다. Rationale 연속성 관점의 CRITICAL 또는 WARNING 사항은 없다.

### 위험도

LOW
