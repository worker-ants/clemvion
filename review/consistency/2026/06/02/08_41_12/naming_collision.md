# 신규 식별자 충돌 검토 결과

target: `plan/in-progress/spec-draft-error-codes.md` → 신설 예정 `spec/conventions/error-codes.md`

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. target 이 새로 부여하는 frontmatter `id: error-codes` 는 기존 spec 파일 어디에도 사용되지 않는다.
- 기존 spec 에서 사용 중인 `id: error-handling` (`spec/5-system/3-error-handling.md`), `id: error-empty-states` (`spec/2-navigation/11-error-empty-states.md`) 와 이름이 다르므로 충돌 없음.

### 엔티티/타입명 충돌

충돌 없음. target 이 도입하는 개념 명칭 (`Historical-artifact 예외 레지스트리`, `도메인 prefix`, `의미 기반 명명`) 은 기존 spec 어느 영역에서도 다른 의미의 타입명·엔티티명으로 사용되지 않는다.

### API endpoint 충돌

해당 없음. target 은 convention 문서이며 새 API endpoint 를 정의하지 않는다.

### 이벤트/메시지명 충돌

해당 없음. target 은 에러 코드 명명 원칙을 정의하며 webhook·queue·SSE 이벤트명을 신규 등록하지 않는다.

### 파일 경로 충돌

충돌 없음. 대상 경로 `spec/conventions/error-codes.md` 는 현재 존재하지 않는다. 기존 `spec/conventions/` 목록에 동일 파일명이 없으며, 근접한 이름인 `swagger.md`·`node-output.md`·`execution-context.md` 와도 명확히 다르다.

### 환경변수·설정키 충돌

해당 없음. target 은 환경변수나 설정 키를 신규 정의하지 않는다.

### code 파일 중복 소유권 충돌 (INFO)

- **[INFO]** target frontmatter 의 `code` 필드에 두 파일을 claim 하고 있으나, 동일 파일이 다른 spec 에서도 이미 claim 됨

  - target 신규 claim: `codebase/backend/src/common/filters/http-exception.filter.ts`, `codebase/backend/src/common/swagger/error-response.dto.ts`
  - 기존 claim: `spec/5-system/3-error-handling.md` 및 `spec/5-system/2-api-convention.md` 가 동일 두 파일을 `code:` frontmatter 에 이미 포함
  - 상세: spec 에서 `code:` frontmatter 의 의미는 "본 spec 이 SoT 인 구현 파일" 이다. 동일 파일이 세 spec 에 claim 되면 SoT 가 분산되어 혼선을 유발할 수 있다. target (`error-codes.md`) 의 관심사는 에러 코드 식별자 명명 원칙이지 필터·DTO 파일의 구현 계약 자체가 아니다.
  - 제안: target 이 최종 `spec/conventions/error-codes.md` 로 격상될 때 `code:` frontmatter 항목을 제거하거나, 명명 원칙이 실제로 집행되는 코드 파일(예: `src/nodes/core/error-codes.ts` 또는 domain-specific 핸들러) 로 교체한다.

### 기존 SoT 중복 선언 (INFO)

- **[INFO]** target 이 `spec/2-navigation/4-integration.md` Rationale 의 self-contained 진술을 정식 규약으로 격상함을 명시하고 있으나, 두 문서의 기술 내용이 병렬로 존재하는 기간 동안 명확성 저하 가능

  - target 신규 식별자: `spec/conventions/error-codes.md` (신설)
  - 기존 사용처: `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정 (c)" (line 1419~1425)
  - 상세: target 의 §4 예외 레지스트리가 `4-integration.md` Rationale 의 코드명 유지 결정을 인용 링크로 참조하는 구조는 적절하다. 다만 target 이 `spec/conventions/` 로 이동되면 `4-integration.md` Rationale 에 역참조("정식 규약: `conventions/error-codes.md` §4") 를 추가해야 기존 독자가 SoT 변경을 인지할 수 있다.
  - 제안: 격상 시 `4-integration.md` Rationale 의 해당 섹션에 한 줄 forward reference 를 추가한다. 현재 target draft 자체는 충돌이 아님.

---

## 요약

target `spec-draft-error-codes.md` 가 도입하는 신규 식별자(`id: error-codes`, 파일 경로 `spec/conventions/error-codes.md`)는 기존 spec 어디에서도 같은 이름·같은 경로로 사용되지 않는다. 실질적 충돌은 없으며, frontmatter `code:` 필드에 기존 두 spec 이 이미 claim 하는 구현 파일이 중복 포함된 점과 격상 후 역참조 누락 가능성이 각각 INFO 수준 개선 사항으로 식별된다. 두 사항 모두 명명·식별자 충돌이 아니라 소유권 표기 관행 문제이므로 blocking 요인이 아니다.

## 위험도

NONE
