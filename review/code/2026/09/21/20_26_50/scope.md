# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff origin/main HEAD --stat` 로 실제 diff 를 프롬프트의 19개 파일 목록과 대조 — 완전히 일치(파일 수·경로 모두 동일, 숨겨진 추가 변경 없음). 대표 파일 2개(`auth-config-delete-concurrency.e2e-spec.ts`, `integration-delete-concurrency.e2e-spec.ts`)는 `git diff origin/main HEAD -- <path>` 로 재조회해 프롬프트에 실린 unified diff 와 바이트 단위로 동일함을 확인. 저장소 뮤테이션 없음(`git status --short` 는 리뷰 산출물 디렉터리만 untracked로 표시).

## 발견사항

- **[INFO]** 새 헬퍼에 plan 이 명시하지 않은 방어 로직(`fires.length < 2` 가드)이 추가됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:43` (`if (fires.length < 2) { throw new Error(...) }`)
  - 상세: `plan/in-progress/e2e-race-helper.md` §B 의 시그니처 스케치·§D "하지 않는 것" 목록에는 이 유효성 검사가 명시돼 있지 않다. 다만 함수 자체의 목적("겹침을 만들려면 2개 이상")과 직결된 5줄짜리 가드이고, 새로 도입하는 재사용 헬퍼의 오용을 막는 최소한의 안전장치라 범위를 벗어난 기능 확장으로 보기는 어렵다.
  - 제안: 조치 불요. 다음에 이 헬퍼를 확장할 때 이 가드가 "요청하지 않은 기능"으로 오인되지 않도록 plan 체크리스트에 한 줄만 남기면 충분.

- **[INFO]** `review/consistency/2026/09/21/19_59_55/**` 8개 파일(SUMMARY.md·`_retry_state.json`·meta.json·5개 checker 출력)이 diff 에 포함
  - 위치: `review/consistency/2026/09/21/19_59_55/` 디렉터리 전체
  - 상세: 코드 변경과 무관해 보일 수 있으나, `CLAUDE.md` 는 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무"라고 규정하고 그 산출물 저장 위치를 `review/consistency/**` 로 명시한다. plan 체크리스트에도 이 게이트 실행(`BLOCK: NO`)이 기록돼 있어, 이 파일들은 이번 작업 자체가 통과해야 했던 필수 프로세스 산출물이지 무관한 수정이 아니다.
  - 제안: 조치 불요.

## 스코프 정합성 확인 (문제 없음)

- **프로덕션 코드 변경 0**: `codebase/backend/src/**` 어떤 파일도 diff 에 없음 — plan §D "하지 않는 것" 서술과 일치.
- **단언(assertion) 변경 0**: 10개 e2e spec 파일 전부에서 `expect(...)` 문의 기대값·에러 코드(`RESOURCE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND`·`MEMBER_NOT_FOUND`·`WEBAUTHN_CREDENTIAL_NOT_FOUND`·`WORKSPACE_NOT_FOUND`·`NOT_A_MEMBER` 등)와 상태 코드 배열이 리팩터 전후 완전히 동일. 사라진 것은 헬퍼로 이동한 `expect(raced).toBe('pending')` 공허성 가드 자체뿐.
- **`integration-rotate-concurrency` 제외**: plan §B 가 "single-fire·update-merge 구조라 축이 다르다"는 실측 근거로 명시적으로 제외 결정했고, 실제로 diff 에 그 파일이 등장하지 않아 결정과 실행이 일치.
- **매직 넘버 처리**: `1_500`(공허성 가드 대기)만 헬퍼 내부 상수 `VACUITY_GUARD_MS` 로 통합됐고, `60_000`/`120_000`(jest timeout)은 plan 이 명시적으로 "일괄 상수화하지 않는다"고 밝힌 대로 각 파일에 그대로 남아 있음 — 계획과 실행이 정확히 일치.
- **불필요한 리팩토링·포맷팅 혼입 없음**: 각 diff 는 `BEGIN/try/finally` 블록을 헬퍼 호출로 치환하는 최소 변경이며, 무관한 줄의 재포맷·공백 변경·주석 삭제는 관찰되지 않음. 주석은 헬퍼로 이동한 로직을 가리키는 한 줄(`공허성 가드는 헬퍼가 건다 — helpers/concurrency.ts`)로 대체됐을 뿐 정보 손실 없음.
- **임포트**: 10개 spec 파일 모두 `raceUnderHeldLock` 단일 신규 임포트만 추가, 다른 임포트 변경 없음.
- **plan 문서**: `plan/in-progress/e2e-race-helper.md` 신설은 프로젝트 컨벤션(`plan/in-progress/<name>.md`, frontmatter `worktree` 명시)을 그대로 따름.

## 요약

10개 e2e concurrency 테스트 파일에서 중복된 "BEGIN → 락 → 두 요청 발사 → 1.5초 공허성 가드 → COMMIT" 블록을 신설 헬퍼 `raceUnderHeldLock()`(`helpers/concurrency.ts`)로 추출하는 순수 테스트 리팩터로, 실제 diff(`git diff origin/main HEAD`)가 리뷰 프롬프트의 19개 파일과 정확히 일치했다. 프로덕션 코드 변경 0, 단언 변경 0, 명시적으로 제외 결정한 `integration-rotate-concurrency` 미포함, 매직넘버 처리 범위까지 plan 문서의 사전 실측·설계와 실행이 정확히 일치해 의도한 범위를 벗어난 변경이 없다. plan/consistency-check 산출물 포함은 프로젝트가 강제하는 게이트의 정상 부산물이며, 헬퍼의 최소 방어 로직(`fires.length < 2`) 하나만 plan에 명시적으로 적혀 있지 않았으나 헬퍼 자체의 목적에 종속된 사소한 추가라 범위 위반으로 보기 어렵다.

## 위험도

NONE
