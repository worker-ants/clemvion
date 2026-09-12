# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 방어선이 "사전 예방(파이프+정적 가드)" 한 겹에만 의존 — exception filter 계층에 안전망이 없다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`HttpException` / http-error-like / `isPostgresUniqueViolation`(23505) 세 분기만 존재, `QueryFailedError` SQLSTATE 22P02 는 미분기 — 직접 확인함) · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:46`(`isIdShaped`)
  - 상세: 이번 변경은 22P02→500 마스킹을 "그 자리에 `ParseUUIDPipe` 를 붙이고, 앞으로 생기는 동일 결함을 이름-휴리스틱 기반 정적 가드(`isIdShaped`: `id` 또는 `…Id` 접미)로 잡는다"는 **예방 전용 전략**으로 닫았다. `GlobalExceptionFilter` 자체는 그대로다. 즉 (a) 컬럼이 `uuid` 타입인데 파라미터 이름이 `id`/`*Id` 형태가 아닌 경우, (b) `ParseUUIDPipe` 를 감싼 커스텀 파이프(문자열 부분일치 `pipes.includes('ParseUUIDPipe')` 검사를 통과 못 하는 별칭/래퍼)인 경우, 가드가 스스로 문서화한 한계(별칭 import 0건 실측이라 "오늘은 안전") 밖에서는 같은 500 마스킹이 재발할 여지가 남는다. 계층형 방어(파이프 + 가드 + 필터 레벨 안전망)가 아니라 두 계층(파이프+가드)만으로 닫힌 단일 실패점 구조다.
  - 제안: 지금 당장 고칠 필요는 없으나(가드가 baseline 0·전수 커버 중이라 즉각적 위험은 낮음), `GlobalExceptionFilter` 에 `QueryFailedError`(22P02 invalid_text_representation)를 400 `VALIDATION_ERROR` 로 매핑하는 **네 번째 분기**를 두면 가드의 이름 휴리스틱이 놓치는 자리까지 fail-closed 로 커버된다. 후속 항목으로 트래커에 남겨둘 만하다.

- **[INFO]** 가드(코드)가 정책 문서(SoT)보다 먼저 넓어진 상태 — 이미 인지되고 별도 planner 항목으로 분리되어 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:34`(`swagger.md §5-4` 출처 주석) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(`swagger.md §5-4` 체크리스트... 런타임 축을 안 적는다" 항목)
  - 상세: 신설 가드는 `ParseUUIDPipe` 축(런타임)과 `@ApiParam({format:'uuid'})` 축(문서) 둘 다 baseline 0 으로 강제하는데, 전자는 `swagger.md §5-4` 에 명시된 계약이 아니라 "실측 관례를 가드로 승격"한 것이다 — 정본 규약 문서가 코드가 실제로 강제하는 것보다 좁다. 이 자체는 결함이 아니라 거버넌스 절차상 developer 가 spec 을 직접 넓힐 권한이 없어(자기-반증형 소정정 조건 1 미충족) planner 항목으로 올바르게 분리해 둔 것이다.
  - 제안: 별도 조치 불필요 — 이미 plan 에 등재됨. 다만 리뷰 관점에서 "코드가 SoT 를 일시적으로 앞서가는 상태"라는 사실 자체는 기록해 둔다.

- **[INFO]** `param-uuid-pipe-guard.ts` 의 `ParseUUIDPipe` 탐지가 텍스트 부분일치이며, 커스텀 합성 파이프를 오탐(false positive)할 수 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:119-122`(docstring), 판정 로직은 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:171` (`pipes.includes('ParseUUIDPipe')`)
  - 상세: 향후 "UUID 파싱 + 추가 비즈니스 검증"을 겸하는 합성 파이프(`@Param('id', SomeCompositeIdPipe)`)가 도입되면, 그 파이프가 내부적으로 `ParseUUIDPipe` 를 쓰더라도 텍스트에 `ParseUUIDPipe` 문자열이 없으면 가드가 오탐한다. 이미 docstring 이 별칭 import 케이스를 한계로 명시했지만 합성 파이프 케이스는 언급되어 있지 않다. 이는 구조적 결함이라기보다 정적 텍스트 스캐너가 원리적으로 갖는 스코프 한계다.
  - 제안: 지금 실측(별칭 0건)에서는 안전하다는 판단이 맞다. 향후 합성 파이프가 생기면 그 시점에 가드를 갱신하면 되므로 즉각 조치는 불필요.

## 요약

변경 규모는 작고 목적이 뚜렷하다 — `rotateBotToken` 엔드포인트에 형제 6곳과 동일한 `ParseUUIDPipe`/`@ApiParam({format:'uuid'})` 계약을 채워 넣는 컨트롤러 레벨 수정이 핵심이며, 나머지는 그 계약을 저장소 전체에 대해 baseline 0 으로 고정하는 순수-로직 AST 가드(`scanUuidParams`) + 소비 테스트 + 스캔 루트 밖에 격리된 fixture, 그리고 잘못 귀속된 문서/주석(에러 코드, 환경변수명) 정정으로 구성된다. SRP·모듈 경계·추상화 수준 모두 이 저장소의 기존 `repo-guards/` 관례(가드-로직/소비-spec/fixture 3분할, allowlist 대신 구조적 판별)를 그대로 따르고 있어 일관성이 높고, 판정 로직과 vacuity-floor 카운터를 같은 순회에서 도출하도록 통합해 드리프트 가능성을 구조적으로 차단한 점도 견고하다. 컨트롤러(프레젠테이션) 레이어에 입력 검증(파이프)을 두고 예외 변환은 `GlobalExceptionFilter` 에 위임하는 기존 레이어 책임 분리도 유지된다. 유일하게 짚을 만한 것은 이번 수정이 "예방(파이프 데코레이터) + 정적 가드"라는 단일 방어선에 의존하고, 예외 필터 레벨의 안전망(22P02 → 400 매핑)은 손대지 않아 가드의 이름-휴리스틱 스코프 밖에서는 같은 클래스의 결함이 재발할 여지가 남는다는 점인데, 현재 실측 범위(136/136 전수 커버) 안에서는 위험이 낮고 이미 코드가 spec 보다 앞선 상태임을 스스로 인지해 별도 planner 항목으로 올바르게 분리해 두었다. 순환 의존성, 안티패턴, 레이어 침범은 관찰되지 않았다.

## 위험도
LOW
