# 보안(Security) Review

## 검토 범위 메모

이번 diff(누적 81개 파일)의 실질 코드/문서 변경은 7개 파일 — `CHANGELOG.md`,
`codebase/backend/src/common/__test-utils__/source-scan.ts`(+`.spec.ts`),
`codebase/backend/src/common/utils/update-returning-rows.spec.ts`,
`codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(+`.spec.ts`),
`plan/in-progress/update-returning-tuple-shape.md` — 뿐이다. 나머지 74개 파일은
`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02,14_33_52}/**` 와
`review/consistency/2026/08/30/{12_17_21,14_43_41}/**` 로, 이 세션 안에서 이미 수행된
5차례 코드 리뷰 라운드 + 2차례 consistency-check 라운드의 산출물이다. 이전 라운드의
독립 security 리뷰 5건(`12_41_15`~`14_33_52` 각 `security.md`) 전부 위험도 **NONE** 으로
수렴했고, 매 라운드가 새 커밋을 직접 열람·재검증했다.

이번 라운드에서 직접 재검증한 것 — 저장소 파일은 전혀 수정하지 않았다(`git status --short`
로 확인, 이 리뷰 세션 자체의 신규 출력 디렉터리 외 잔여 없음):

- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` 를 `Read` 로 직접
  열람 — SQL 은 여전히 `$1` placeholder + `[knowledgeBaseId]` 파라미터 배열로 파라미터화돼
  있고, 변경은 `.query<...>()` 의 **제네릭 타입 인자**(`{...}[]` → `[{...}[], number]`)뿐이다.
  타입 인자는 컴파일 타임에 소거되므로 런타임 SQL·바인딩·공격 표면에 변화가 없다.
- `codebase/backend/src/common/__test-utils__/source-scan.ts` 를 `Read` 로 직접 열람 —
  `countRawUpdateReturning`/`hasRawUpdateReturning` 은 인자로 받은 소스 문자열만 정규식으로
  스캔하는 순수 함수다. 파일시스템·네트워크·전역 상태 접근이 없다.
- 신규 `CALL` 정규식(`/\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)/g`)의
  catastrophic backtracking 여부를 저장소 밖(scratch, `node -e`)에서 직접 벤치마크했다 —
  (1) `.query<` + 미종결 `<` 1천~3.2만 반복, (2) `.query<` + `a<b` 혼합 패턴 1천~5만 반복,
  (3) `.query` + 미종결 `<` 1천~5만 반복 세 축 전부 실행 시간이 0ms 대(서브밀리초)로
  길이에 무관하게 유지 — 지수적 증가 없음을 실측 확인했다. 정적 형태도 이를 뒷받침한다:
  외곽 반복 그룹의 두 대안(`[^<>]` vs `<[^<>]*>`)이 시작 문자(`<` 여부)로 상호 배타적이라
  같은 입력을 여러 방식으로 분할할 모호성이 없다 — 이전 3라운드(`13_15_58`, `13_46_53`)의
  독립 벤치마크 결과와도 일치한다.
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 의 `discover()`/
  `listSources()` 가 `join(__dirname, '..', '..')`(저장소 내 고정 상수)만 `readdirSync`/
  `readFileSync` 로 재귀 탐색함을 확인 — 외부/사용자 입력이 경로 구성에 개입할 여지가 없어
  path traversal 표면이 아니다. 읽기 전용(쓰기·삭제 없음).
- `git diff origin/main...HEAD` 전체와 신규 `review/**` 산출물(누적 74개 파일)을 시크릿
  패턴(`api[_-]?key`, `secret`, `password`, `token`, `-----BEGIN`, JWT/AWS 형태)으로
  대조 — 하드코딩된 자격증명·연결 문자열은 없다. `_retry_state.json`/`_resolution_state.json`
  등에 로컬 절대경로가 다수 노출되나 개발자 워크트리 파일시스템 경로일 뿐 시크릿이 아니다.

## 발견사항

- **[INFO]** 신설 `countRawUpdateReturning`/`hasRawUpdateReturning` 은 저장소 자신의
  1st-party 소스(`src/**`)만 읽는 **테스트 전용** 정적 스캐너이며, 정규식은 실측 벤치마크로
  선형 시간임을 확인했다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (함수
    `countRawUpdateReturning`, `hasRawUpdateReturning`)
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 유일한 실질 변경은 `.query<>()` 제네릭 타입 인자
  정정이며 SQL 리터럴·파라미터 바인딩·공개 시그니처(`refresh(knowledgeBaseId: string):
  Promise<void>`)는 diff 전후 동일하다. SQL 인젝션 경로 없음(리터럴 SQL + `$1` 파라미터).
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`
    (`KbStatsHelper.refresh`)
  - 제안: 조치 불요.

- **[INFO]** `update-returning-rows.spec.ts` 의 `discover()`/`listSources()`/`findUnguarded`
  는 저장소 내부 고정 경로만 재귀 스캔하는 읽기 전용 테스트 유틸이며, `ALLOWED` 허용목록도
  이 diff 이후 파일 단위 전면 면제가 아니라 (파일, 사유, 검토 지점 수) 3-tuple 로 개수
  상한을 받는다. 이는 회귀 가드의 **정밀도** 문제이지(선행 라운드 requirement/testing
  리뷰가 이미 다뤘다), 사용자 입력이 개입하는 보안 표면이 아니다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts`
  - 제안: 조치 불요(보안 관점 해당 없음 — 정밀도 개선 사항은 requirement/testing 리뷰 참조).

- **[INFO]** 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서·JWT/AWS 형태) 전무 —
  실질 변경 7개 파일 + 신규 리뷰/consistency 산출물 74개 파일 전체를 시크릿 정규식으로
  대조 확인.
  - 위치: 전체 diff
  - 제안: 조치 불요.

- **[정보 확인 — 발견 없음]** 인증/인가/세션 관리, 암호화 알고리즘, 평문 전송, 에러 메시지의
  민감정보 노출, 의존성(패키지) 변경 — 이번 diff 에 해당 표면이 없다. 신규 라이브러리
  추가·버전 변경 없음, 인증/세션 코드 변경 없음, 사용자 노출 에러 경로 변경 없음(테스트
  스캐너·타입 주석·문서·리뷰 산출물뿐).

## 요약

이번 diff 는 raw `UPDATE/DELETE … RETURNING` 회귀 가드를 손으로 고른 파일 목록에서
`src/**` 전수 발견형으로 확장하는 **테스트 인프라** 변경(신규 정적 스캐너
`countRawUpdateReturning`/`hasRawUpdateReturning`, 순수 판정 함수 `findUnguarded`, 재귀
파일시스템 스캔)과, 그 과정에서 발견된 `kb-stats.helper.ts` 의 제네릭 타입 오선언 정정
1건(런타임 동작 불변), 그리고 이 세션 내 5차례 코드 리뷰 + 2차례 consistency-check 라운드의
산출물로 구성된다. 신설 정적 스캐너와 파일시스템 순회는 전부 테스트 시점에 저장소 자신의
1st-party 소스만 대상으로 하며 외부/사용자 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS
어느 축에도 해당하지 않는다 — 이번 라운드에서 직접 실행한 벤치마크로도 정규식이 선형
시간임을 재확인했다(이전 두 라운드의 독립 벤치마크와 일치). `kb-stats.helper.ts` 의 유일한
프로덕션 변경은 이미 파라미터화된 SQL 의 컴파일 타임 타입 주석 정정으로 런타임 보안 동작에
영향이 없다. 하드코딩된 시크릿, 인증/인가 회귀, 암호화 취약점, 민감정보 노출 에러 처리,
의존성 취약점 어느 항목도 발견되지 않았다. 이 결론은 같은 diff 계열에 대한 5차례 독립
security 리뷰(`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02,14_33_52}/security.md`)
와도 일치한다.

## 위험도

NONE
