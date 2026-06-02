# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-error-codes.md` → 격상 시 `spec/conventions/error-codes.md`

---

## 발견사항

- **[INFO]** `code:` frontmatter 대상 파일이 `error-codes.ts` 인데, `3-error-handling.md` 의 `code:` 와 겹치지 않는다는 draft 주장이 사실임을 확인
  - target 위치: draft "## 결정·맥락" "code: 대상" 항
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` frontmatter `code:` — `http-exception.filter.ts` / `validation.pipe.ts` / `error-response.dto.ts` (envelope 생산·filter·pipe 파일)
  - 상세: draft 가 `codebase/backend/src/nodes/core/error-codes.ts` 를 `code:` 대상으로 지정하는 것은 기존 `3-error-handling.md` 의 `code:` 와 물리적으로 겹치지 않는다. 두 spec 이 동일 파일을 `code:` 로 이중 등록하는 상황은 없다.
  - 제안: 현행 유지. 별도 조치 불요.

- **[INFO]** `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규정이 target 의 "표기 재선언하지 않음" 방침과 일치함을 확인
  - target 위치: draft `## Overview` 4번째 bullet `표기(UPPER_SNAKE_CASE)` 역참조
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` §3.2 ("code 는 UPPER_SNAKE_CASE")
  - 상세: `node-output.md §3.2` 는 이미 `code: UPPER_SNAKE_CASE` 를 선언하고 있고, target 은 이를 재선언하지 않겠다고 명시한다. 역참조 방향이 올바르다.
  - 제안: 현행 유지.

- **[INFO]** `4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 이 "(c) 의미 기반 명명 선례 예외" 라고만 기술하고, 정식 SoT 레지스트리를 아직 지정하지 않는다
  - target 위치: draft `## 3. Historical-artifact 예외 레지스트리` 표의 "근거" 열: `4-integration.md Rationale` → "(정식 SoT 는 본 §3)"
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 1419–1425 Rationale "(c) 의미 기반 명명 선례 예외" — 현재 forward 참조 없음
  - 상세: 모순은 아니다. `4-integration.md` 는 "신규 코드는 예외를 따르지 않는다"는 정책만 서술하며, 격상 후 `conventions/error-codes.md §3` 이 생기면 정식 SoT 가 중복으로 분산될 가능성이 있다. draft 체크리스트 §3번 항목이 이를 해소(forward 참조 추가)하도록 이미 포함하고 있다.
  - 제안: 격상 체크리스트 3번 실행 시 해소됨. 현재 draft 상태에서는 INFO 수준.

- **[INFO]** `spec/0-overview.md §8` 문서 맵에 `spec/conventions/error-codes.md` 행 미등재
  - target 위치: draft "격상(promotion) 시 동반 갱신 체크리스트" 2번 항
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/0-overview.md` §8 문서 맵 "정식 규약 | spec/conventions/ | 노드 Output 규약, Swagger 패턴 등"
  - 상세: 현재 `spec/0-overview.md §8` 의 `conventions/` 행은 "노드 Output 규약, Swagger 패턴 등" 으로 예시를 열거하되 완전 목록을 나열하지 않는다고 명시하고 있다 ("구체 파일 목록은 본 문서가 박제하지 않는다"). 신규 `error-codes.md` 추가가 §8 에 반드시 반영되어야 하는 것은 아니나, draft 가 이를 INFO로 체크리스트에 포함한 것은 적절하다.
  - 제안: `spec/0-overview.md` §8 의 해당 행이 완전 목록이 아니라면 수동 추가 불요. 단, `conventions/` 디렉토리 진입 문서가 별도로 존재한다면 그 목록에 추가. 낮은 우선순위.

- **[WARNING]** draft 가 예시 코드로 제시하는 `INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH` 는 `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode` enum) 에 존재하지 않는다
  - target 위치: draft `## 1. 의미 기반 명명 (핵심 원칙)` — `CAFE24_INSTALL_INVALID_HMAC`, `INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH` 를 의미 기반 명명의 긍정 예시로 제시
  - 충돌 대상: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode` enum) — `INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH` 는 enum 에 없음. `CAFE24_INSTALL_INVALID_HMAC` 도 `ErrorCode` enum 외부에 문자열 리터럴로 사용됨
  - 상세: `INTEGRATION_INCOMPLETE` 는 노드 핸들러 내부에서 문자열 리터럴(`'INTEGRATION_INCOMPLETE'`)로 사용되며 `ErrorCode` enum 에는 없다. `OAUTH_STATE_MISMATCH` 역시 `auth-oauth.service.ts` 에서 문자열 리터럴로만 사용된다. draft 가 이 코드들을 "의미 기반 명명" 의 긍정 예시로 제시하는데, target 의 `code:` 소유 대상은 `error-codes.ts` 의 `ErrorCode` enum 만이다. 그러면 draft 가 예시로 드는 코드 중 일부가 명시적 소유 범위 바깥의 코드다 — 독자가 혼동할 수 있다. `error-codes.ts` 밖의 코드들이 이 명명 규약의 적용 대상인지 여부가 불명확하다.
  - 제안: draft §1 의 예시를 `ErrorCode` enum 에 실제로 정의된 코드(`HTTP_5XX`, `LLM_RATE_LIMIT`, `CODE_TIMEOUT` 등)로 교체하거나, "이 규약은 `ErrorCode` enum 뿐 아니라 프로젝트 전체 에러 코드 문자열에 적용된다"고 명시적으로 스코프를 확장하는 문장을 추가해야 한다. 현재 draft 의 `code:` frontmatter 는 `error-codes.ts` 만 가리키지만, §1 예시는 더 넓은 범위를 암시한다.

- **[WARNING]** `spec/5-system/3-error-handling.md` 가 명명 규율 위임을 아직 기술하지 않는다 — SoT 경계 모호
  - target 위치: draft "격상(promotion) 시 동반 갱신 체크리스트" 4번 항: `3-error-handling.md` 에 "에러 코드 명명 규율은 `conventions/error-codes.md`" 위임 한 줄 추가
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §3.2 — `code` 필드를 "UPPER_SNAKE_CASE 에러 코드 (`error-codes.ts` 의 `ErrorCode` enum 참조)" 라고 정의. 명명 규율에 대한 별도 문서 참조 없음
  - 상세: 현재 `3-error-handling.md §3.2` 가 에러 코드의 포맷(UPPER_SNAKE_CASE)과 정식 목록 위치(`error-codes.ts`)를 함께 기술한다. `conventions/error-codes.md` 격상 전까지는 SoT 가 `3-error-handling.md` 에 있다. 격상 후 두 문서가 모두 에러 코드 명명에 대해 서술하면 SoT 분산이 발생한다. draft 체크리스트 4번이 이를 해소(위임 한 줄 추가)하도록 명시하고 있다.
  - 제안: 격상 체크리스트 4번 실행이 필수다. 누락 시 `3-error-handling.md §3.2` 와 `conventions/error-codes.md §1` 이 같은 내용을 이중으로 정의하게 된다. 격상과 동시에 반드시 실행.

---

## 요약

target draft(`spec/conventions/error-codes.md` 신설안)는 기존 spec 과 직접 모순되는 항목이 없다. 데이터 모델·API 계약·상태 전이·RBAC 영역에는 영향을 주지 않는다. 발견된 주요 이슈는 두 가지다: (1) draft §1 의 의미 기반 명명 긍정 예시(`INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH`)가 `code:` frontmatter 가 지정한 `ErrorCode` enum 범위 밖의 코드를 지칭해 규약의 적용 스코프가 불명확하다 (WARNING); (2) 격상 후 `spec/5-system/3-error-handling.md §3.2` 가 여전히 명명 규율의 SoT 처럼 읽혀 이중 진실이 발생할 수 있으나, 이는 draft 체크리스트 4번이 이미 파악하고 있다 (WARNING). 두 WARNING 은 격상 시 함께 처리해야 하며, 이를 누락하면 `spec/conventions/error-codes.md` 가 신설되어도 독자가 어느 문서를 SoT 로 봐야 하는지 혼동한다. INFO 항목들은 모두 draft 체크리스트에 이미 포함되어 있어 별도 위험이 없다.

---

## 위험도

MEDIUM
