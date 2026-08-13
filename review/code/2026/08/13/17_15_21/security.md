# Security Review — chat-channel dispatcher / execution-engine / executions.service / plan·review 문서

## 발견사항

없음.

이번 diff 는 5개 코드 파일(테스트 3건 + production 변경 2건)과 다수의 plan/review 마크다운 문서로
구성된다. 각 항목을 점검한 결과는 다음과 같다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `admitExecutionOrDefer`
  의 admission UPDATE 결과에 `Array.isArray(rows)` 런타임 가드를 추가하고, 조건 불충족 시
  `throw new Error(...)` 한다(함수명·블록: `admitExecutionOrDefer`, `if (!Array.isArray(rows))` 블록).
  - **인젝션**: `executionId`/`typeof rows` 를 템플릿 문자열로 `Error` 메시지에 넣을 뿐 SQL·쉘·경로
    조합에는 쓰이지 않는다. SQL 자체는 상단 `UPDATE ... WHERE id = $1 ...` 로 파라미터 바인딩만 사용.
  - **에러 처리/정보 노출**: 이 예외는 `runExecutionFromQueue` → `ExecutionRunProcessor`(BullMQ 워커)
    경로에서 발생하며 HTTP 응답으로 직접 반환되지 않는다(`executionId` 는 이미 호출자가 아는 내부
    UUID로 PII/시크릿 아님). fail-closed(트랜잭션 롤백) 방향이 유지되어 이전 라운드(`14_01_46`
    side_effect WARNING 1: `return false`(defer)로 삼켜 트랜잭션이 커밋될 뻔했던 회귀)가 이미 `throw`
    로 정정됐음을 코드에서 확인했다.
  - **인증/인가**: 이 가드는 admission 카운트/락 로직을 바꾸지 않는다.

- `codebase/backend/src/modules/executions/executions.service.ts` — `SNAPSHOT_CACHE_MAX_ENTRIES` 를
  `const` → `export const` 로만 바꿨다(값 256 불변).
  - **인증/인가**: `snapshotCache` 는 execution UUID 로만 키잉되지만, export 는 가시성만 바꿀 뿐
    캐시 조회 이전에 컨트롤러 레이어에서 수행되는 workspace 소유권 검증 경로 자체를 바꾸지 않는다
    (이번 diff 는 `executions.controller.ts` 를 건드리지 않음). IDOR/캐시 오염 표면 증가 없음.

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`,
  `execution-engine.service.spec.ts`, `executions.service.spec.ts` — 전부 테스트 코드 추가
  (로그 레벨 분기 양방향 고정, admission fail-closed 회귀, LRU 캐시 상한/방향 고정). 프로덕션 동작을
  바꾸지 않으며 하드코딩 시크릿·인젝션 벡터 없음. `chat-channel.dispatcher.spec.ts:534` 의
  `'SECRET SYSTEM PROMPT'` 리터럴은 이번 diff 범위 밖(기존 코드, `@@ -699,50 +700,159 @@` 훅 이전)의
  선재 테스트 픽스처로, outbound 이벤트에 시스템 프롬프트가 새어나가지 않는지 검증하는 회귀
  테스트용 더미 값이다 — 실제 시크릿이 아니다.

- `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md`,
  `review/code/2026/08/13/14_01_46/*`, `review/consistency/2026/08/13/{14_18_42,17_05_10}/*` —
  전부 마크다운 문서(작업 이력·이전 리뷰/일관성 검토 산출물 기록)이며 실행되는 코드가 아니다.
  자격증명·API 키·토큰 형태의 문자열은 없다(코드 리뷰 산출물 내 "SECRET SYSTEM PROMPT" 언급은 위
  테스트 픽스처를 가리키는 서술일 뿐 실제 값 노출이 아님). 이 문서들이 다루는 EIA outbound
  notification payload spec drift(`14_18_42` cross_spec CRITICAL, PR #1166 로 이미 종결 기록됨)는
  API 계약 완전성/문서-구현 정합성 문제로, 인젝션·인증우회·시크릿노출·암호화 등 보안 카테고리에
  해당하지 않아 본 리뷰 범위에서는 다루지 않는다.

## 확인한 보안 관점 (해당 없음)

- 인젝션(SQL/커맨드/경로/XSS): 신규 SQL·쉘·파일경로 조합 없음. 유일한 SQL 은 파라미터 바인딩된
  기존 `UPDATE ... WHERE id = $1` (변경 없음).
- 하드코딩된 시크릿: 없음(위 `'SECRET SYSTEM PROMPT'` 는 유출 방지 검증용 더미).
- 인증/인가: 캐시 export·admission 가드 모두 기존 workspace 소유권 검증·admission 락 구조를 바꾸지
  않음.
- 입력 검증: `Array.isArray(rows)` 가드는 오히려 드라이버 반환값 검증을 강화하는 방향.
- 암호화/평문 전송: 해당 변경 없음.
- 에러 처리: 신규 `Error` 메시지는 내부 execution UUID·`typeof` 문자열만 포함하고 BullMQ 워커
  경로에서만 소비되어 HTTP 클라이언트로 직접 노출되지 않는다.
- 의존성 보안: 신규/변경 의존성 없음.

## 요약

이번 diff 는 테스트 커버리지 보강 3건과 방어적 admission 가드 1건(트랜잭션 롤백 불변식을 지키는
`throw` 방향으로 이미 정정 완료), 상수 `export` 전환 1건, 그리고 이력 기록용 plan/review 마크다운
다수로 구성된다. 인젝션·하드코딩 시크릿·인증/인가 우회·입력 검증 미비·안전하지 않은 암호화·민감정보
노출·의존성 취약점 어느 관점에서도 신규 결함을 발견하지 못했다. `Array.isArray` 가드는 오히려
드라이버 반환값 검증을 강화하고 fail-closed 방향을 명시적으로 보존하는 견고성 개선이다.

## 위험도

NONE
