# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-error-codes.md` → (신설 예정) `spec/conventions/error-codes.md`

---

## 발견사항

### 발견사항 1
- **[INFO]** `swagger.md §2-4` 참조 앵커가 실제 섹션명과 불일치
  - target 위치: target 문서 §1 (봉투 설명) — `"HTTP 상태 코드 선택은 [swagger.md §2-4]"` 참조
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` — 실제 섹션명은 `### 2-4. 상태 코드 응답 규칙` (HTTP status 선택이 아니라 NestJS `@ApiOkResponse` 등 데코레이터 규칙)
  - 상세: target 은 "HTTP 상태 코드 선택의 SoT" 로 `swagger.md §2-4` 를 지목하나, 실제 swagger.md §2-4 는 데코레이터 선택 규칙이다. HTTP 상태 코드 매핑의 실질 SoT 는 `spec/5-system/2-api-convention.md §6` 이다. 또한 `4-integration.md` Rationale 의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 항에서 `swagger.md §2-4 — 중복/충돌은 409` 로 동일 섹션을 참조하고 있어 이미 기성 인용 패턴이 존재하지만, "HTTP 상태 코드 선택의 SoT" 라는 표현이 target 에 추가되면 독자 혼란을 심화한다.
  - 제안: target §1 의 SoT 링크를 `spec/5-system/2-api-convention.md §6` 으로 수정하거나, swagger.md 참조를 "데코레이터 패턴" 으로 용도를 명시할 것.

---

### 발견사항 2
- **[WARNING]** `spec/5-system/3-error-handling.md` 와 명명 원칙 간 책임 경계 불명확
  - target 위치: target 문서 전체 (§1 · §2 · §Rationale)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` — 에러 코드 목록(§1.1~§1.5)·형식(`UPPER_SNAKE_CASE`, §2.1 예시)·생산 지점(`http-exception.filter.ts`, frontmatter)을 이미 정의
  - 상세: `3-error-handling.md` 는 에러 코드 목록·HTTP 매핑·응답 형식을 정의하고, 코드 값에 `UPPER_SNAKE_CASE` 를 사실상 전제한다(`code: "VALIDATION_ERROR"` 등). target 은 이 위에서 "명명 원칙" 을 새 규약으로 격상하는데, `3-error-handling.md` 에 동일 frontmatter(`http-exception.filter.ts`, `error-response.dto.ts`)가 존재하고 두 문서 간 "누가 에러 코드 형식의 SoT 인가" 가 명시되지 않는다. target 의 Rationale 이 "SoT 분리" 를 천명하지만, 독자 입장에서 `3-error-handling.md §1` 와 `conventions/error-codes.md §1` 중 어느 것을 먼저 읽어야 하는지 불명확하다.
  - 제안: target §Overview 에 "`spec/5-system/3-error-handling.md` 는 코드 목록·HTTP 매핑의 SoT 이며, 본 문서는 그 코드들의 명명 규율만 다룬다" 를 명시. 또는 `3-error-handling.md` 의 도입 부분에서 본 conventions 문서로 역참조 추가.

---

### 발견사항 3
- **[WARNING]** `spec/1-data-model.md §2.10` (`status_reason` 의 `snake_case` ↔ `UPPER_SNAKE_CASE` 이중 표기 결정) 와 target 의 형식 원칙 간 연결 누락
  - target 위치: target §1 "형식" — `"UPPER_SNAKE_CASE"` 로 단일화 표현
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.10 `status_reason` 필드 설명 — `"DB 저장값은 snake_case, 동일 의미의 API 에러 코드는 OAUTH_* UPPER_SNAKE_CASE (의도적 분리)"` + `spec/2-navigation/4-integration.md` Rationale §`oauth_token_exchange_failed` — `"status_reason 의 저장값은 snake_case ... API 응답·callback HTML 의 에러 코드는 UPPER_SNAKE_CASE"`
  - 상세: target §1 은 에러 코드를 `UPPER_SNAKE_CASE` 로 정의하면서 괄호 안에 `"DB 컬럼의 snake_case status_reason 과는 별개 표기 — 동일 의미의 두 표기 매핑은 도메인 spec 이 정의"` 라고 부연한다. 이 부연은 정확하나 `4-integration.md §10.4` 를 링크하는 수준에서 끝나, 향후 새 도메인이 비슷한 이중 표기 패턴을 도입할 때 어디서 매핑 정책을 찾아야 하는지 불명확하다. 충돌이 아닌 정책 누락으로 WARNING.
  - 제안: target §1 의 괄호 부연에 `spec/1-data-model.md §2.10 status_reason` 을 정식 역참조로 추가하거나, "DB-API 이중 표기 패턴이 존재하며 각 도메인 spec 이 매핑을 보유한다" 를 한 줄로 명시.

---

### 발견사항 4
- **[INFO]** `4-integration.md` Rationale 의 Historical-artifact 예외 설명과 target §4 레지스트리의 내용이 사실상 동일하나 단일 진실 지정 없음
  - target 위치: target §4 "Historical-artifact 예외 레지스트리" 표
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` Rationale `CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정` (line 1419~1427)
  - 상세: 두 위치 모두 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 Historical artifact 사유·진실·기각 결정을 기술한다. 동일 사실이 두 문서에 분산되면 향후 추가 예외 등록 시 어느 쪽이 canonical 인지 불명확하다. 현재는 내용 일치이므로 CRITICAL 아님.
  - 제안: target §4 가 신설되면 `4-integration.md` Rationale 의 해당 항목 끝에 `본 레지스트리의 정식 SoT 는 spec/conventions/error-codes.md §4` 라는 역참조를 추가하고, `4-integration.md` 의 본문 설명을 summary 로 축약하거나 유지하면서 규범적 정의는 conventions 로 위임.

---

### 발견사항 5
- **[INFO]** `spec/conventions/node-output.md §3.2` 가 노드 레벨 에러 코드의 `UPPER_SNAKE_CASE` 를 이미 규정하고 있으며 target 과 범위 중첩
  - target 위치: target §1 "형식" (`UPPER_SNAKE_CASE`)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` §3.2 — `"code 는 UPPER_SNAKE_CASE"` (노드 실행 에러 포트 출력 형식)
  - 상세: `node-output.md §3.2` 는 노드 레벨의 `output.error.code` 에 `UPPER_SNAKE_CASE` 를 이미 규정한다. target 은 API 레벨(`error.code`) 까지 포함하는 더 넓은 범위에서 동일 형식을 재규정한다. 내용 충돌은 없지만 두 conventions 가 동일 원칙을 중복 선언하는 형태이므로 동기화 관리 필요.
  - 제안: target §1 에 `spec/conventions/node-output.md §3.2` 를 "노드 레벨 에러 코드도 동일 형식을 따름 (SoT: node-output §3.2)" 로 역참조하거나, node-output §3.2 에서 신설 conventions 로 위임 표기 추가.

---

### 발견사항 6
- **[INFO]** `spec/0-overview.md §8` 의 문서 맵에 `spec/conventions/error-codes.md` 가 아직 미등재
  - target 위치: target 전체 (신설 예정 경로 `spec/conventions/error-codes.md`)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/0-overview.md` §8 문서 맵 — `spec/conventions/` 하위로 `node-output.md`, `swagger.md` 등은 나열되나 `error-codes.md` 는 미등재
  - 상세: 신설 conventions 문서를 채택하면 `0-overview.md §8` 및 `0-overview.md §4 영역별 진입 문서` 표에 한 행 추가가 필요하다. 충돌이 아닌 누락.
  - 제안: target 채택 후 `spec/0-overview.md §8` 에 `| 에러 코드 명명 규약 | — | spec/conventions/error-codes.md |` 행 추가.

---

## 요약

target 문서(`spec/conventions/error-codes.md` 신설 draft)는 기존 spec 과 직접 모순되는 CRITICAL 충돌은 없다. 형식(`UPPER_SNAKE_CASE`)·봉투(`error.code`)·의미 기반 명명·안정성 정책 모두 현행 `spec/5-system/3-error-handling.md`, `spec/2-navigation/4-integration.md` Rationale, `spec/conventions/node-output.md §3.2`, `spec/1-data-model.md §2.10` 의 사실 진술과 일치한다. 그러나 WARNING 수준의 문제가 2건 존재한다. 첫째, `3-error-handling.md` 와 target 이 동일 코드 파일(`http-exception.filter.ts`, `error-response.dto.ts`)을 frontmatter 에 공유하면서 "에러 코드 형식의 SoT" 가 어디에 있는지 명시되지 않아 독자 혼란이 예상된다. 둘째, `1-data-model.md` 의 DB-API 이중 표기(`snake_case` / `UPPER_SNAKE_CASE`) 결정이 target §1 에서 간략히 언급되지만 정식 역참조 없이 `4-integration.md §10.4` 로만 링크되어, 새 도메인 도입 시 패턴을 찾기 어렵다. 나머지 4건은 INFO 수준(참조 앵커 오기재, 이중 기술, 문서 맵 미등재)이며 채택 이후 순차적으로 수정하면 된다.

---

## 위험도

LOW
