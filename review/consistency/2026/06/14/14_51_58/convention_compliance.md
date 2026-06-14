# 정식 규약 준수 검토 결과

**Target**: `spec/5-system/14-external-interaction-api.md`
**검토 모드**: spec draft (`--spec`)
**검토 기준**: `spec/conventions/` 전체

---

## 발견사항

### [WARNING] 에러 응답 `details` 필드 구조 — 규약 shape 와 불일치

- **target 위치**: §5.1 에러 응답 예시 블록, EIA-IN-10 요구사항, §5.1 에러 표 `VALIDATION_FAILED` 행
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3`
- **상세**: `api-convention.md §5.3` 은 `details` 를 **배열** (`[]`) 로 정의하며 각 원소는 `{ field, message, code: "INVALID_FIELD" }` 구조다. 본 target 문서는 `details` 를 **객체** `{ "fieldErrors": [ { "field", "reason", "expected", "actual" } ] }` 로 정의하고 있다. 두 가지 차이: (1) `details` 가 array 가 아닌 object — 봉투 shape 불일치. (2) 원소 키가 `message`/`code` 가 아닌 `reason`/`expected`/`actual` 이며 `fieldErrors` 네스팅 레이어가 규약에 없는 추가 depth 를 도입한다. 목표 문서는 §5.1 에서 "api-convention §5.3 의 컨벤션을 따른다" 고 명시하므로 불일치가 선언과 상충한다.
- **제안**: `details` 를 배열로 변경하거나(`{ "details": [{ "field": "amount", "message": "...", "code": "INVALID_FIELD" }] }`), EIA 표면에서 `details` 가 객체임을 유지하려면 이 shape 를 `api-convention §5.3` 의 공식 예외로 Rationale 에 등록해 "EIA-specific extension" 임을 명문화한다.

---

### [WARNING] 에러 응답에서 `requestId` 누락

- **target 위치**: §5.1 에러 응답 예시 블록 및 에러 표 전체
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3`
- **상세**: `api-convention §5.3` 은 "`requestId`: 모든 에러 응답에 **항상** 포함되는 추적용 UUID (`GlobalExceptionFilter` 가 매 응답마다 발급한다)" 를 강제한다. EIA 에러 응답 예시(`§5.1`)와 각 상태 코드 표에 `requestId` 가 전혀 등장하지 않는다. `GlobalExceptionFilter` 가 EIA 엔드포인트에도 적용된다면 wire 에는 포함되지만 spec 문서가 이를 은폐해 API 소비자가 혼동할 수 있다.
- **제안**: 에러 응답 예시 블록에 `"requestId": "..."` 필드를 추가하거나, EIA 가 `requestId` 를 제외하는 의도가 있다면 Rationale 에 명시하고 `api-convention §5.3` 에 예외로 등록한다.

---

### [WARNING] Hooks 컨트롤러에 `@ApiSecurity({})` 패턴 처방 — swagger 규약 상충

- **target 위치**: §10.1 "Swagger / API 문서" 마지막 줄 "Hooks 진입점(`/api/hooks/:endpointPath`)은 기존대로 `@Public()` + `@ApiSecurity({})` 패턴 유지"
- **위반 규약**: `spec/conventions/swagger.md §2-1`
- **상세**: `swagger.md §2-1` 은 두 가지를 명시한다: (1) "`@Public()` 전용 컨트롤러(auth, health, **hooks**)는 `@ApiBearerAuth`를 넣지 않습니다" — hooks 를 직접 예시로 든다. (2) 혼합 컨트롤러에서도 "`@Public()` 엔드포인트에는 `@ApiSecurity({})` **대신** 설명에서 '인증 불필요'를 명시합니다." 즉 `@ApiSecurity({})` 는 swagger.md 에서 대체 대상이며 권장 패턴이 아니다. target spec 이 "기존대로 유지" 라고 공식화하면 규약과 어긋나는 패턴을 선례로 고정한다.
- **제안**: 해당 줄을 "Hooks 진입점은 `@Public()` 전용 컨트롤러 — `@ApiBearerAuth` 불필요 (`swagger.md §2-1` 의 hooks 예시 패턴 준수)" 로 수정하고 `@ApiSecurity({})` 처방을 제거한다. 기존 구현 코드에 `@ApiSecurity({})` 가 이미 있다면 구현 fix 도 함께 진행 필요.

---

### [INFO] api-convention §5.3 기본 에러 코드와 EIA 커스텀 코드 관계 미명시

- **target 위치**: §5.1 에러 표 도입부
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` (기본값 표)
- **상세**: `api-convention §5.3` 은 상태 코드별 기본 `code` 를 정의한다 (400=`VALIDATION_ERROR`, 409=`RESOURCE_CONFLICT` 등). EIA 는 `VALIDATION_FAILED`, `STATE_MISMATCH`, `EXECUTION_TERMINATED` 등 커스텀 코드를 사용한다. §5.1 은 "신규 endpoint 는 신컨벤션 채택" 이라 하지만 커스텀 코드가 기본값 테이블의 override 인지 추가 분류인지 설명하지 않아 구현자 혼동 가능성이 있다.
- **제안**: §5.1 에 "EIA 에러 코드는 `api-convention §5.3` 기본값을 상황별 커스텀 코드로 교체(override) 한다" 를 한 줄 추가하면 충분.

---

### [INFO] 문서 구조 — Overview 범위와 본문 섹션 구분 불명확

- **target 위치**: `## Overview (제품 정의)` 절 이후 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 는 3섹션 권장 구성을 제시한다. target 문서는 `## Overview` 아래 §1·§2 만 두고 `---` 구분선 이후 `## 3. 요구사항` 이하를 본문으로 전개한다. 본문 섹션에 명시적 `## 본문` 헤더가 없어 Overview 경계가 불명확하다. `## Rationale` 은 마지막에 존재해 3섹션 중 2·3번은 충족된다.
- **제안**: 허용 가능한 구조이며 강제 변경 불필요. 다음 개정 시 `---` 이후에 `## 본문` 또는 `## 기술 명세` 헤더를 삽입해 3섹션 구분을 명확히 하는 것을 고려.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 frontmatter(`status: partial` + `pending_plans`), Rationale 존재, API 경로 명명(`kebab-case`, 복수형) 등 주요 규약을 준수한다. 그러나 세 가지 명시 규약 이탈이 발견됐다: (1) `details` 필드가 `api-convention §5.3` 의 배열 shape 가 아닌 객체(`{ fieldErrors: [...] }`)로 정의되어 선언("api-convention §5.3 컨벤션을 따른다")과 불일치, (2) 동일 규약이 강제하는 `requestId` 가 모든 에러 응답 예시에서 누락, (3) Hooks 컨트롤러에 `@ApiSecurity({})` 를 처방하는 것이 `swagger.md §2-1` 의 "대신 설명에서 '인증 불필요'를 명시" 지침에 위배된다. 세 항목은 규약 위반 또는 규약과의 불일치를 명문화하지 않은 채 사실상 다른 shape 를 확립하므로 정정 또는 예외 등록이 필요하다.

## 위험도

MEDIUM
