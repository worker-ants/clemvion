# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-error-codes.md`
검토 모드: spec draft (--spec)

---

## 발견사항

- **[INFO]** 봉투 형식 표기에 `details?` optional 표기 추가 — 기존 SoT 와 경미한 표현 차이
  - target 위치: `§1 형식` — `{ "error": { "code": "...", "message": "...", "details?": ... } }`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.3 에러 응답` (JSON 예시), `spec/5-system/3-error-handling.md §3.2 Route to Error Port 상세` (필드 정의 테이블 `details | Object?`)
  - 상세: `api-convention §5.3` 의 봉투 예시는 `details` 필드를 optional 표기 없이 보여주고, `3-error-handling §3.2` 는 `details | Object?` 로 optional 임을 정의한다. target 의 인라인 봉투 표기 `"details?": ...` 는 두 SoT 와 표면 표기 방식이 다르다. 의미는 동일(optional)하지만, 봉투 형식 SoT 는 `api-convention §5.3` 임을 target 본문이 이미 명시하고 있으므로, target 이 중복으로 인라인 봉투를 재정의하는 꼴이 될 수 있다.
  - 제안: target `§1` 의 봉투 인라인 표기를 `api-convention §5.3` 로 단순 위임 참조로 교체하거나, `details?` 표기를 SoT 스타일(`details` + footnote "optional") 로 통일. 내용상 충돌은 아니므로 선택적 정비.

- **[INFO]** `4-integration.md` Rationale 의 "의미 기반 명명 선례 예외" 포인트 (c) 의 참조 키워드 불일치
  - target 위치: `§4 Historical-artifact 예외 레지스트리` 테이블의 `근거` 컬럼 링크 및 `§2 의미 기반 명명` 원칙
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 항목 (c)
  - 상세: `4-integration.md` Rationale (c) 는 "본 프로젝트의 에러 코드는 **의미 기반 명명을 원칙**으로 하나, ... historical artifact 예외로 등록한다" 고 기술하며 이미 해당 원칙의 존재를 전제한다. target 이 이 원칙을 정식 규약으로 격상하는 것은 Rationale (c) 의 전제와 완전히 부합한다. 다만, target 의 `§4` 테이블 "근거" 컬럼이 `4-integration.md Rationale` 항으로 링크하는 반면, `4-integration.md` Rationale (c) 는 "신규 통합 conventions 문서" 를 명시적으로 교차 참조하지 않는다. 향후 두 문서 간의 상호 참조가 단방향으로 남는 비대칭.
  - 제안: `4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" (c) 에 신규 `spec/conventions/error-codes.md` 를 forward 참조로 추가하도록 후속 plan 에 메모. target 자체 수정 필요 없음.

- **[INFO]** `VALIDATION_ERROR` prefix 미적용 — target 의 도메인 prefix 원칙과 불일치 사례
  - target 위치: `§1 형식` 예시 `VALIDATION_ERROR`, `§3-error-handling.md §1.3` 기존 코드
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.3` (`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `INVALID_STATE` 등 prefix 없는 코드 다수)
  - 상세: target `§1` 은 `<DOMAIN>_<CONDITION>` 형태의 도메인 prefix 를 원칙으로 선언하면서, 예시로 `VALIDATION_ERROR` (prefix 없음) 를 언급한다. `3-error-handling §1.3` 에는 `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `INVALID_STATE` 처럼 도메인 prefix 없는 코드가 다수 존재한다. target `§4 Historical-artifact 예외 레지스트리` 는 현재 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 한 건만 등재한다. prefix 없는 시스템 레벨 코드들이 예외로 등록되지 않고 있는 상태는, 향후 신규 코드 작성자가 "왜 `VALIDATION_ERROR` 는 예외인가?" 를 역추적해야 하는 ambiguity 를 남긴다.
  - 제안: target `§2` 또는 `§4` 에, 시스템/도메인 공통 코드(`VALIDATION_ERROR`, `INTERNAL_ERROR` 등 시스템 계층 코드)는 prefix 원칙의 적용 범위 밖(시스템 글로벌 코드)임을 명시하거나, 해당 코드를 §4 레지스트리에 일괄 등재하거나, §1 의 "도메인 prefix" 원칙 설명에 "도메인 범주화가 의미 있는 코드에 한해 적용" 이라는 단서를 추가.

---

## 요약

target 문서 `plan/in-progress/spec-draft-error-codes.md` 는 `spec/2-navigation/4-integration.md` Rationale 에서 이미 전제한 "의미 기반 명명 원칙"과 "historical artifact 예외" 패턴을 정식 규약으로 격상한다는 취지가 기존 Rationale 결정과 완전히 부합한다. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` rename 기각 결정(a)(b)(c) 도 target `§4` 레지스트리와 `§3 안정성/rename 정책` 이 일관되게 반영하고 있다. 발견된 사항은 모두 INFO 수준으로, 봉투 표기의 SoT 참조 방식 경미 불일치, 두 문서 간 상호 참조 단방향 비대칭, 기존 시스템 레벨 코드(`VALIDATION_ERROR` 등)가 §4 예외 레지스트리에 등재되지 않아 도메인 prefix 원칙 적용 범위가 모호한 점이다. CRITICAL 또는 WARNING 수준의 기각 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 발견되지 않는다.

---

## 위험도

LOW
