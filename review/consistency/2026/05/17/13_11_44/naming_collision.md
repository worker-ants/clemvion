# 신규 식별자 충돌 검토 결과

## 발견사항

### 요약: 본 PR 의 변경이 도입하는 신규 식별자

본 PR(`spec-draft-2-navigation-hygiene.md`) 이 실제로 도입하거나 변경하는 식별자는 다음 두 가지뿐이다.

| 변경 | 영향 식별자 |
| --- | --- |
| A. `spec/2-navigation/14-execution-history.md` 줄 3 헤더 blockquote — `[PRD 실행 내역](./14-execution-history.md)` 링크 제거 | 링크 텍스트·앵커 식별자 삭제. 신규 ID 없음 |
| B. `spec/1-data-model.md §2.10 Integration` 표 직후 — `autoRefresh: boolean` derived 필드 설명 단락 추가 | `autoRefresh` (DTO 필드명), `IntegrationDto` (타입명 언급), `ServiceDefinition.supportsTokenAutoRefresh` (registry 속성명) |

---

### 점검 결과

- **[INFO]** `autoRefresh` 필드명 — 기존 코퍼스 내 동일/유사 이름 없음
  - target 신규 식별자: `autoRefresh: boolean` (응답 DTO 전용 derived 필드)
  - 기존 사용처: `spec/1-data-model.md §2.10` Integration 테이블의 DB 컬럼 목록(`service_type`, `name`, `auth_type`, `credentials`, `scope`, `status`, `install_token`, `token_expires_at`, ...) — `autoRefresh` 컬럼 없음. `spec/2-navigation/4-integration.md` 는 코퍼스에 포함되지 않아 직접 확인 불가이나, target draft §3.2 와 plan 의 `§9.1 IntegrationDto` 참조로 볼 때 이미 통합 화면 spec 에 정의된 개념을 data-model 에 cross-ref 로 명시하는 것
  - 상세: `autoRefresh` 는 이번 변경에서 새로 명명된 것이 아니라, 이미 `spec/2-navigation/4-integration.md §9.1` 에 정의되어 있는 기존 필드를 data-model 단에 설명 단락으로 끌어오는 것. DB 컬럼과 이름·유형 충돌 없음
  - 제안: 충돌 없음. 추가 단락의 표현(`ServiceDefinition.supportsTokenAutoRefresh`)이 실제 backend service registry 의 속성명과 일치하는지는 구현 코드(`backend/src/`) 검토 단계에서 확인 권장 (spec 점검 범위 밖)

- **[INFO]** `IntegrationDto` 타입명 언급 — 기존 코퍼스 내 충돌 없음
  - target 신규 식별자: `IntegrationDto` (단락 내 타입 이름 언급)
  - 기존 사용처: `spec/1-data-model.md §2.10` Integration 엔티티는 별도 DTO 이름을 spec 내에서 명시적으로 정의하지 않음. `spec/2-navigation/4-integration.md §9.1` 에 기존 정의가 있다고 plan 에서 참조
  - 상세: 충돌 없음. 동일 DTO 를 두 문서가 각자 다른 의미로 사용하는 구조가 아님. 본 단락은 `IntegrationDto` 를 새로 정의하는 것이 아니라 기존 정의를 참조
  - 제안: 이상 없음

- **[INFO]** 링크 제거 — 식별자 충돌 없음
  - target 신규 식별자: 없음 (링크 제거만 수행)
  - 기존 사용처: 기존 줄 3 의 `[PRD 실행 내역](./14-execution-history.md)` 는 자기 참조 순환 링크. 제거 후 남는 4개 링크(`[Spec 대시보드]`, `[Spec 워크플로우 목록]`, `[Spec 실행/디버깅]`, `[데이터 모델 - Execution]`)는 모두 기존에 있던 링크로 충돌 없음
  - 상세: 다른 문서에서 `14-execution-history.md` 를 `[PRD 실행 내역]` 텍스트로 참조하는 사례가 코퍼스에서 발견되지 않아 링크 제거가 외부 참조를 단절시키지 않음
  - 제안: 이상 없음

---

## 요약

본 PR 이 도입하는 신규 식별자는 극소량이다. 변경 A(자기 참조 링크 제거)는 식별자를 신규 도입하지 않으며, 변경 B(`autoRefresh` derived 필드 설명 단락 추가)는 `spec/2-navigation/4-integration.md §9.1` 에 이미 정의된 기존 개념을 data-model 문서에 cross-ref 로 기술하는 것이다. 코퍼스 전체에서 `autoRefresh`, `IntegrationDto`, `ServiceDefinition.supportsTokenAutoRefresh` 와 이름 또는 의미가 충돌하는 기존 식별자는 발견되지 않았다. 파일 경로 신규 생성도 없으므로 파일명 충돌도 없다. 신규 식별자 충돌 관점에서 이 변경을 차단할 사유가 없다.

## 위험도

NONE
