# 보안(Security) Review

## 검토 범위 메모

이번 diff(41개 파일)는 실질적으로 세 부류로 나뉜다:

1. **테스트 전용 정적 스캐너** — `codebase/backend/src/common/__test-utils__/source-scan.ts`(`countRawUpdateReturning`/`hasRawUpdateReturning` 신설), `source-scan.spec.ts`, `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(`findUnguarded` 순수 함수 + `discover()`/`listSources()` 발견형 가드). 전부 jest 스펙/`__test-utils__` 이며 프로덕션 번들에 포함되지 않는다.
2. **프로덕션 코드 1건, 타입 주석만 변경** — `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`: `.query<T>()` 제네릭 타입 인자를 `{...}[]`(거짓 선언)에서 `[{...}[], number]`(실제 튜플)로 정정. SQL 문자열·파라미터 바인딩(`$1` / `[knowledgeBaseId]`)은 diff 전후 동일하며, 반환값은 여전히 소비되지 않는다 — 컴파일 타임에만 영향을 주는 변경이다.
3. **문서/plan/이전 리뷰 라운드 산출물** — `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`, `review/code/2026/08/30/{12_41_15,13_15_58}/**`, `review/consistency/2026/08/30/12_17_21/**`. 전부 마크다운/JSON 리포트로 코드가 아니다.

직접 검증한 것:
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(`KbStatsHelper.refresh`)를 `Read`로 열어 SQL 이 `$1` placeholder + `[knowledgeBaseId]` 파라미터로 이미 파라미터화돼 있음을 확인 — SQL 인젝션 경로 없음.
- 신규 `CALL` 정규식(`/\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)/g`, `source-scan.ts:111-112`)의 catastrophic backtracking 여부를 저장소 밖 scratch 디렉터리(`node -e`)에서 직접 벤치마크했다 — 병리적 입력(닫히지 않은 제네릭 `n`개, 중첩 `<a>` 반복 `n`개)에 대해 `n`을 1e3→8e4로 늘려도 실행시간이 선형에 가깝게 증가(미세초~1ms대)했고 지수적 증가는 관측되지 않았다. 정적 형태(대안 분기가 시작 문자 `<`/비-`<` 로 상호 배타적)와 실측 벤치마크가 일치한다. 저장소 파일은 수정하지 않았다(scratch 전용, `git status --short` 변경 없음 확인).
- `git diff origin/main...HEAD` 전체를 시크릿 패턴(`api[_-]?key`, `secret`, `password`, `token`, `-----BEGIN`, JWT/AWS/Slack 토큰 정규식 등)으로 grep — 실제 자격증명·연결 문자열은 발견되지 않음. `secret-store.md` 등은 파일명 인용일 뿐이다.
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts`의 `listSources()`/`discover()`가 `join(__dirname, '..', '..')`(저장소 내 고정 상수)만 재귀 탐색하고, 외부/사용자 입력이 경로 구성에 개입할 여지가 없음을 확인 — path traversal 표면이 아니다.

## 발견사항

- **[INFO]** 신설 `countRawUpdateReturning`(`codebase/backend/src/common/__test-utils__/source-scan.ts`, 함수 정의)은 저장소 자신의 1st-party 소스만 읽는 테스트 전용 정적 분석 함수다. 외부 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS 어느 축에도 해당하지 않는다 — 위 "검토 범위 메모"의 벤치마크로 직접 확인.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts`(함수 `countRawUpdateReturning`)
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts`의 실질 변경은 `.query<>()` 제네릭 타입 인자뿐이며, SQL 리터럴·파라미터 바인딩·`refresh(knowledgeBaseId: string): Promise<void>` 공개 시그니처는 그대로다. 반환값 미소비도 diff 전후 동일해 런타임 보안 동작에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(`KbStatsHelper.refresh`)
  - 제안: 조치 불요.

- **[INFO]** `update-returning-rows.spec.ts`의 `discover()`/`listSources()`가 신규로 재귀 파일시스템 스캔을 도입하지만, 대상 디렉터리는 상수(`SRC = join(__dirname, '..', '..')`)로 고정되고 `readdirSync`가 돌려주는 실제 엔트리만 이어붙인다 — 외부 입력이 경로 구성에 개입할 여지가 없어 path traversal 이 아니다. 읽기 전용(쓰기·삭제 없음)이며 `node_modules`/`dist`는 명시적으로 제외한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(`listSources`, `discover`)
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서·JWT/AWS/Slack 형태) 전무 — 변경된 코드·테스트·문서·plan·이전 리뷰 라운드 산출물(md/json) 전체를 시크릿 정규식으로 grep해 확인. `review/**` 하위 `_retry_state.json` 등에 로컬 절대경로(`/Users/gehrig/orca/workspaces/...`)가 다수 노출되나, 이는 개발자 로컬 워크트리 파일시스템 경로일 뿐 자격증명이 아니고 이 저장소의 review 산출물 관례상 정상 패턴이다.
  - 위치: 전체 diff
  - 제안: 조치 불요.

- **[정보 확인 — 발견 없음]** 인증/인가/세션 관리, 암호화 알고리즘, 평문 전송, 에러 메시지의 민감정보 노출, 의존성(패키지) 변경 — 이번 diff 어디에도 해당 표면이 없다. 신규 라이브러리 추가·버전 변경 없음, 인증/세션 관련 코드 변경 없음, 사용자에게 노출되는 에러 경로 변경 없음(스캐너·타입 주석·문서·리뷰 산출물뿐).

## 요약

이번 diff는 raw `UPDATE/DELETE … RETURNING` 회귀 가드를 손으로 고른 파일 목록에서 `src/**` 전수 발견형으로 확장하는 **테스트 인프라** 변경(신규 정적 스캐너 `countRawUpdateReturning`/`hasRawUpdateReturning`, 순수 판정 함수 `findUnguarded`, 재귀 파일시스템 스캔)과, 그 과정에서 발견된 `kb-stats.helper.ts`의 제네릭 타입 오선언(행 배열 → 실제 튜플) 정정 1건, 그리고 이전 두 리뷰 라운드(`12_41_15`, `13_15_58`)와 consistency-check(`12_17_21`) 산출물의 신규 커밋으로 구성된다. 신설 정적 스캐너와 파일시스템 순회는 전부 테스트 시점에 저장소 자신의 1st-party 소스만 대상으로 하며 외부/사용자 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS 어느 축에도 해당하지 않는다 — 정규식은 자체 벤치마크로 선형 시간을 직접 확인했다. `kb-stats.helper.ts`의 유일한 프로덕션 변경은 이미 파라미터화된 SQL의 컴파일 타임 타입 주석 정정으로 런타임 동작·공격 표면에 변화가 없다. 하드코딩된 시크릿, 인증/인가 회귀, 암호화 취약점, 민감정보 노출 에러 처리, 의존성 취약점 어느 항목도 발견되지 않았다. 이 결론은 같은 diff에 대한 이전 두 라운드의 독립 security 리뷰(`review/code/2026/08/30/12_41_15/security.md`, `13_15_58/security.md`)와도 일치한다.

## 위험도

NONE
