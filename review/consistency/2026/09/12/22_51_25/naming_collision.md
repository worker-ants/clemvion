# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 요약

이번 `--impl-prep spec/5-system/` 검토의 실질 target 은 `plan/in-progress/keyset-cursor-uuid-validation.md`
(worktree `filter-pg-invalid-text`)다. 이 plan 은 `spec/5-system/*.md` 본문을 새로 쓰지 않고,
기존 트래커 항목("`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다")을 재실측해
① 필터 수정은 won't-do 로 종결하고 ② `login-history.service.ts`/`background-runs.service.ts` 의
`decodeCursor` 두 곳에 id 검증을 추가하는 코드 레벨 버그 픽스다. 신규 식별자 도입 여부를
관점별로 실측했다.

## 발견사항

관점 1~6 모두에서 **target 이 새로 부여하는 식별자가 없음**을 확인했다.

- **요구사항/에러코드 ID** — plan 이 사용하는 `INVALID_CURSOR` 는 이미
  `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:167`
  에 존재하는 기존 코드다(`grep -rn "INVALID_CURSOR" codebase/ content/` → 1건). plan 은 이
  코드를 새로 만드는 게 아니라 기존 발행 조건에 `i`(id) 검증 실패 사유를 추가할 뿐이다.
  `spec/5-system/3-error-handling.md` §1.3 카탈로그에는 `INVALID_CURSOR` 가 등재돼 있지 않지만,
  이는 **기존에도 미등재였던 상태**이지 이번 plan 이 새로 만든 미등재 항목이 아니다(카탈로그
  완결성은 별도 checker 소관).
- **엔티티/타입명** — 새 DTO·인터페이스 없음. `LoginHistory.id`/`NodeExecution.id` 는 이미
  `@PrimaryGeneratedColumn('uuid')` 로 선언된 기존 엔티티 필드다.
- **API endpoint** — 새 endpoint 없음. `GET /api/users/me/login-history`,
  `GET /api/executions/:id/background-runs/:id` 모두 기존 endpoint 이고 `cursor` 쿼리 파라미터
  명명도 `spec/5-system/4-execution-engine.md §8.2` 에 이미 문서화된 것과 동일 이름을 재사용한다.
- **이벤트/메시지명** — webhook/queue/SSE 신규 이벤트 없음.
- **환경변수·설정키** — 신규 ENV/config key 없음.
- **파일 경로** — 신규 spec 파일·소스 파일 없음. 수정 대상
  (`codebase/backend/src/modules/auth/login-history.service.ts`,
  `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`)과
  그 `.spec.ts` 는 전부 기존 파일임을 `find` 로 확인했다. plan 이 쓰겠다는 검증 함수
  `isUuidShaped` 도 `common/utils/uuid.ts` 에 이미 존재하며, 형제 함수 `isValidUuid` 와의 의미
  구분(“Postgres uuid 컬럼 파싱 가능 여부” vs “우리가 발급한 RFC UUID 인가”)도 그 파일
  docstring 에 이미 정의돼 있어 plan 이 새로 이름을 붙이는 것이 아니다.

추가로 다음 두 가지를 교차 확인했으나 충돌은 아니었다(참고용, 등급 부여 없음):

- **트래커 항목 동일성** — plan 이 "착수 계기"로 인용한 문구
  ("`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다 — 파이프 밖 유입 경로는 여전히
  500 마스킹")는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목과
  글자 그대로 동일하다. 다른 트래커에서 유사 문구로 별도 재등록된 것이 아니라 **같은 항목을
  가리키는 단일 참조**임을 확인했다(요구사항 ID 중복 아님).
- **인접 in-progress plan 과의 대상 겹침** — 동시에 진행 중인
  `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 도 "UUID 미검증 → SQLSTATE 22P02 →
  500 마스킹"이라는 같은 결함 *클래스*를 다루지만, 대상 지점이 다르다(컨트롤러
  `@Param(':id', ParseUUIDPipe)` vs 본 plan 의 keyset 커서 `decodeCursor`). 두 plan 이 수정하는
  파일 집합은 겹치지 않으며(`decodeCursor` 를 다루는 다른 in-progress plan 은 없음을
  `grep -rl decodeCursor plan/in-progress/*.md` 로 확인 — 결과 1건, 본 plan 자신뿐), 본 plan
  자체도 스코프 고지 문단에서 이미 이 구분을 인지하고 있다.

## 요약

target(`keyset-cursor-uuid-validation.md`, scope `spec/5-system/`)은 spec 본문을 수정하지 않는
코드 버그 픽스 plan이며, 사용하는 모든 식별자(`INVALID_CURSOR`, `isUuidShaped`, 엔티티 필드,
API endpoint, 쿼리 파라미터 `cursor`)가 기존에 정의·사용 중인 것을 그대로 재사용한다. grep 전수
확인 결과 새로 도입되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로가
하나도 없어 충돌 후보 자체가 존재하지 않는다.

## 위험도

NONE
