# 보안(Security) 코드 리뷰 — `error-codes-layer-split` (라운드 4, `21_12_31`)

## 리뷰 범위 및 방법

이번 diff 는 두 종류로 구성된다.

1. **실질 코드 변경** (파일 1~8): `error-codes.ts` 에 `EngineErrorCode` const 신설 +
   `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`shutdown-state.service.ts`
   9개 지점의 맨 문자열 에러 코드를 상수 참조로 치환 + 신규 AST 기반 repo-guard 3파일
   (`engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`) + `CHANGELOG.md`.
2. **이전 라운드(`20_27_29`/`20_43_35`/`20_59_14`)의 리뷰 산출물·plan 이동 문서**(파일 9 이후,
   대부분): 이미 커밋된 리뷰 리포트/메타데이터/RESOLUTION 파일로, 실행되는 코드가 아니다.

실제 소스(`codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`,
`error-codes.ts`)를 `Read` 로 직접 열어 대조했고, 치환 전후 문자열 값이 정확히 동일함을
확인했다(`grep -n "LLM_RATE_LIMIT\|LLM_CALL_FAILED" error-codes.ts` → `'LLM_CALL_FAILED'`/
`'LLM_RATE_LIMIT'`, diff 리터럴과 byte-identical). `git status --short` 로 이번 세션 시작·종료
시점 모두 저장소가 클린함을 확인했다(리뷰 산출물 디렉터리 외 변경 없음, 저장소 뮤테이션 없음).

## 발견사항

없음. 인젝션·하드코딩된 시크릿·인증/인가·입력 검증·OWASP Top 10·암호화·에러 메시지 노출·
의존성 관련해 새로 도입되는 위험이 확인되지 않았다.

참고로 확인한 항목 (문제 없음, 기록용):

- 9개 리다이렉트 지점은 전부 `'LITERAL'` → `ErrorCode.KEY` / `EngineErrorCode.KEY` (값이
  `KEY: 'KEY'` 자기거울 패턴)로, 런타임 동작·DB 영속값·직렬화 형태·에러 메시지 내용에
  변화가 없는 순수 치환이다. 공격 표면이 넓어지지도 좁아지지도 않는다.
- 신규 repo-guard(`engine-error-code-anchor-guard.ts`)는 `ENGINE_DIR`/`CODES_SOURCE` 두
  상수(하드코딩된 저장소 상대경로)만 읽으며, 사용자 입력이나 외부 데이터로 경로가
  구성되는 지점이 없다 — 경로 탐색(path traversal) 위험 없음. `fs.readFileSync`/
  `fs.readdirSync` 호출은 전부 읽기 전용이고, CI/테스트 전용 도구라 런타임 공격 표면도
  아니다(프로덕션 barrel 에서 `__tests__/*` 를 재수출하지 않음 — 기존 라운드 side_effect
  리뷰가 이미 확인).
- `UPPER_SNAKE` 정규식(`/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/`)은 중첩 정량자가 없는 선형
  패턴 — ReDoS 우려 없음.
- `ai-turn-orchestrator.service.ts` 의 `classifyLlmError`/`extractAiTurnErrorPayload` 는
  이번 diff 전후 모두 에러 메시지 정제 경로(`sanitizeLastErrorMessage`)를 그대로 거친다 —
  이번 변경은 `code` 필드만 리터럴→enum 참조로 바꿨고 메시지 새니타이징 로직은 건드리지
  않았다.
- 이전 라운드(`20_43_35`) documentation 리뷰가 병렬 리뷰어의 미커밋 뮤테이션
  (`collectBoundCodes(repoRoot, relDir)` → `collectBoundCodes(repoRoot, undefined)`)을
  관측·보고한 바 있으나, 이번 라운드 시작 시점 `git status --short` 는 클린 — 해당
  뮤테이션은 남아있지 않다.
- plan/review 문서 이동·신규 파일에 시크릿·자격증명·API 키 등 민감정보 포함 없음(grep 대조).

## 요약

이번 변경은 엔진 레이어 에러 코드 문자열을 타입 앵커(enum 상수)로 리다이렉트하는 기계적
리팩터로, 치환 전후 문자열 값이 완전히 동일해 동작·계약에 영향이 없다. 동봉된 AST 기반
repo-guard 는 오히려 향후 "맨 문자열 코드" 회귀(오탈자로 인한 DB persist / FE·알림 분기
오작동)를 예방하는 방향의 하드닝이며, 그 자체도 읽기 전용·고정 경로만 다뤄 새로운 공격
표면을 만들지 않는다. 이전 세 라운드(`20_27_29`/`20_43_35`/`20_59_14`)의 security 리뷰
결론(NONE)과 일치하며, 이번 라운드에서 재검토한 결과도 동일하다. 인젝션·시크릿·인증/인가·
입력 검증·암호화·에러 노출·의존성 어느 관점에서도 새로 도입된 취약점이 없다.

## 위험도

NONE
