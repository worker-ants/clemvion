# 보안(Security) 코드 리뷰

## 리뷰 범위

핵심 코드 변경(9개 파일):
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- `codebase/backend/src/nodes/core/error-codes.ts` / `error-codes.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}` (신규)
- `plan/complete/exec-intake-followups.md` / `plan/in-progress/exec-intake-followups.md` (plan lifecycle 이동, 문서만)
- `CHANGELOG.md`

나머지 다수 파일(44개)은 이전 4개 리뷰 라운드(`20_27_29`, `20_43_35`, `20_59_14`, `21_12_31`)의
`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/reviewer 리포트 산출물이다 — `review/`
디렉터리가 gitignore 대상이 아니라 이력으로 커밋되는 이 저장소의 확립된 관례이며, 그 자체는 실행되는
"코드"가 아니다. 내용은 전부 과거 리뷰 텍스트(마크다운 서술·JSON 메타데이터)이고, 시크릿·자격증명·실행
가능한 페이로드는 포함하지 않음을 확인했다.

## 변경 성격

엔진 레이어 에러 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT` / `WORKER_HEARTBEAT_TIMEOUT` /
`SERVER_INTERRUPTED` / `WEBCHAT_IDLE_TIMEOUT`)와 이미 `ErrorCode` 에 있던 `LLM_RATE_LIMIT` /
`LLM_CALL_FAILED` 를 하드코딩 문자열 리터럴에서 신설 `EngineErrorCode` / 기존 `ErrorCode` const
참조로 치환하는 **순수 리팩터**다(9지점). 각 치환 지점을 대조한 결과 문자열 값 자체는 완전히
동일하다 — 런타임 동작·DB 영속값·직렬화 형태에 변화가 없다. 동반된 신규 AST 기반 repo-guard(3파일,
테스트 전용)는 향후 동일 결함(오탈자가 앵커 없이 DB 에 영속되는 경로)의 재발을 막는 방향의 하드닝이다.

## 발견사항

없음. 인젝션·시크릿 하드코딩·인증/인가·입력 검증·암호화·에러 메시지 노출·의존성 관련해 새로 도입되는
위험이 확인되지 않았다.

참고로 직접 확인한 항목 (문제 없음, 기록용):

- `git diff origin/main -- .` 전체(핵심 코드 + plan 문서 이동 포함)에 대해
  `password|secret|token|api[_-]?key|BEGIN … PRIVATE KEY` 패턴을 grep — 실제 매치는 전부
  `ts.SyntaxKind.EqualsToken` 문자열의 `Token` 부분 매칭뿐인 false positive였고, 하드코딩된
  자격증명·API 키는 없다. `EngineErrorCode`/`ErrorCode` 값(`SERVER_INTERRUPTED` 등)과 픽스처의
  `FIXTURE_*` 값은 도메인 에러 코드일 뿐 시크릿이 아니다.
- `ai-turn-orchestrator.service.ts` 의 `classifyLlmError`/`extractAiTurnErrorPayload` 는 이번
  diff 전후 모두 원시 에러 메시지를 정제하는 기존 로직(`sanitizeLastErrorMessage` 등, 이번 diff가
  건드리지 않은 영역)을 그대로 거친다 — 이번 변경은 `code` 필드만 리터럴 → enum 참조로 바꿨을 뿐,
  클라이언트/DB 로 노출되는 에러 메시지 새니타이징 경로는 손대지 않았다.
- 신규 repo-guard(`engine-error-code-anchor-guard.ts`)는 `ts.createSourceFile` 로 고정된
  저장소-상대 경로 상수(`ENGINE_DIR`, `CODES_SOURCE`)만 읽고, `readFileSync`/`readdirSync` 는 전부
  읽기 전용이다 — 사용자 입력이나 외부 데이터로 경로가 구성되지 않아 경로 탐색(path traversal)
  위험이 없고, `*.spec.ts` 만 Jest 가 수집하므로(`-guard.ts`/`-fixture.ts` 자체는 실행되지 않음)
  CI/테스트 전용 도구라 프로덕션 공격 표면이 아니다.
- `UPPER_SNAKE` 정규식(`/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/`)은 중첩 정량자가 없는 선형 패턴이라
  ReDoS 우려가 없다.
- `EngineErrorCode`/`ErrorCodeValue` 신규 export 는 barrel(`index.ts`) 재수출이 없어 3개 소비
  파일(`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`shutdown-state.service.ts`)
  밖으로 API 표면이 넓어지지 않는다.
- `plan/complete/exec-intake-followups.md` 로 이동/확장된 plan 문서는 순수 텍스트(설계 근거·검증
  로그)이며 시크릿·개인정보·내부 인프라 상세를 포함하지 않는다.

## 요약

이번 변경은 엔진 레이어 에러 코드 문자열을 타입 앵커(enum 상수)로 리다이렉트하는 기계적 리팩터로,
치환 전후 문자열 값이 완전히 동일해 런타임 동작·계약에 영향이 없다. 동봉된 AST 기반 repo-guard 는
오히려 향후 "맨 문자열 코드" 회귀(오탈자로 인한 DB persist / FE·알림 분기 오작동)를 예방하는 방향의
하드닝이며, 읽기 전용·고정 경로·테스트 전용이라 그 자체로 새로운 공격 표면이 되지 않는다. 함께
포함된 44개 파일은 과거 리뷰 라운드의 산출물(마크다운/JSON)로 시크릿이나 실행 가능한 위험을 담고
있지 않다. 인젝션·시크릿 하드코딩·인증/인가·입력 검증·암호화·에러 노출·의존성 어느 관점에서도 새로
도입된 취약점이 없다. 동일 코드 변경을 대상으로 한 4차례 선행 보안 리뷰(`20_27_29`/`20_43_35`/
`20_59_14`/`21_12_31`)도 전부 위험도 NONE 으로 일관되게 판정했다.

## 위험도

NONE
