# 보안(Security) Review

## 검토 범위 메모

이번 diff 는 대부분 (a) 백엔드 **테스트 전용** 유틸리티/스펙 파일, (b) `kb-stats.helper.ts` 의
**타입 인자(제네릭) 정정 1건**, (c) `CHANGELOG.md`·plan 문서, (d) 직전 리뷰 라운드
(`review/code/2026/08/30/12_41_15/**`, `review/consistency/2026/08/30/12_17_21/**`)의
산출물 신규 커밋으로 구성된다. 저장소 밖 scratch 디렉터리에서 신규 정규식(`CALL`)의
catastrophic-backtracking 여부를 직접 프로브했다 (`.query` + `<` 1천~5만 반복, `.query<` +
비-종료 문자 1천~5만 반복) — 전부 서브밀리초, 길이에 선형으로 증가해 ReDoS 우려 없음을 확인.
저장소 파일은 전혀 수정하지 않았다(`git status --short` 로 확인, scratch 산출물만 생성).

## 발견사항

- **[INFO]** 신설된 `countRawUpdateReturning`/`hasRawUpdateReturning` (`codebase/backend/src/common/__test-utils__/source-scan.ts`, 함수 `countRawUpdateReturning` — 라인 100~121) 은 **테스트 전용** 정적 스캐너다. 입력은 저장소 자신의 `src/**` 소스 파일(신뢰된 1st-party, 빌드 시 `tsconfig.build.json` 제외 대상)뿐이고 프로덕션 번들에 포함되지 않는다. 외부/사용자 입력이 개입할 여지가 없어 인젝션·경로 탐색·ReDoS 표면이 아니다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (함수 `countRawUpdateReturning`)
  - 상세: `CALL` 정규식(`/\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)/g`)을 scratch 환경에서 직접 프로브했다 — 대안 분기(`[^<>]` vs `<[^<>]*>`)가 시작 문자로 상호 배타적이라 모호성이 없고, 실측 시간이 입력 길이에 선형으로 증가해(1천→5만자, 서브밀리초 유지) catastrophic backtracking 없음을 확인.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 신설 `describe` 블록의 `discover()`/`listSources()` 는 `readdirSync`/`readFileSync` 로 `join(__dirname, '..', '..')`(저장소 내 고정 경로)를 재귀 스캔한다. 경로가 사용자 입력이 아니라 하드코딩된 상수이고, 실행 컨텍스트도 테스트 스위트(jest)뿐이라 경로 탐색(path traversal) 취약점이 아니다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (함수 `listSources`, `discover`)
  - 상세: 대상 디렉터리는 상대 경로 리터럴로 고정돼 있고 외부에서 주입 가능한 파라미터가 없다. `node_modules`/`dist` 는 명시적으로 제외한다.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 실질 변경은 `.query<>()` 제네릭 **타입 인자**를 `{...}[]` 에서 `[{...}[], number]` 로 정정한 것뿐이다. 런타임 SQL 문자열·파라미터 바인딩(`WHERE id = $1`, `[knowledgeBaseId]`)은 변경 전과 동일하게 이미 파라미터화돼 있고, 반환값도 여전히 소비되지 않는다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (메서드 `KbStatsHelper.refresh`)
  - 상세: 타입 주석만 바뀌었으므로 컴파일 타임 타입 체크 외 런타임 동작·공격 표면 변화 없음. SQL 인젝션 경로 없음(리터럴 SQL + `$1` 파라미터).
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서) 전무 확인 — 변경된 코드/테스트/문서 파일 전체(소스 3건, 스펙 3건, `CHANGELOG.md`, plan 문서, 직전 리뷰 라운드 산출물 8건)를 통틀어 자격증명·연결 문자열류 리터럴 없음. `review/code/2026/08/30/12_41_15/_retry_state.json` 등에 절대경로가 다수 노출되나 로컬 워크트리 파일시스템 경로일 뿐 시크릿이 아니다.
  - 위치: 전체 diff
  - 제안: 조치 불요.

- **[INFO]** 인증/인가/세션 관리, 암호화 알고리즘, 에러 메시지의 민감정보 노출, 의존성(패키지) 변경 — 이번 diff 에 해당 표면이 존재하지 않는다(신규 라이브러리 추가·의존성 버전 변경 없음, 인증/세션 관련 코드 변경 없음).
  - 위치: 전체 diff
  - 제안: 조치 불요.

## 요약

이번 diff 는 raw `UPDATE/DELETE … RETURNING` 회귀 가드를 손으로 고른 파일 목록에서 `src/**` 전수 발견형으로 확장하는 **테스트 인프라** 변경과, 그 과정에서 발견된 `kb-stats.helper.ts` 의 제네릭 타입 오선언(`{...}[]` → `[{...}[], number]`) 1건 정정, 그리고 직전 리뷰/일관성 검토 라운드의 산출물 파일 추가로 구성된다. 신설 정적 스캐너와 파일 시스템 순회는 전부 테스트 시점에 저장소 자신의 1st-party 소스만 대상으로 하며 외부/사용자 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS 어느 축에도 해당하지 않는다(정규식은 scratch 환경에서 직접 실측해 선형 시간을 확인). `kb-stats.helper.ts` 변경은 SQL 리터럴·파라미터 바인딩을 그대로 두고 타입 주석만 정정해 런타임 보안 동작에 영향이 없다. 하드코딩된 시크릿, 인증/인가 회귀, 암호화 취약점, 민감정보 노출 에러 처리, 의존성 취약점 어느 항목도 발견되지 않았다.

## 위험도
NONE
