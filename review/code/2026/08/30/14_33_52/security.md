# 보안(Security) Review

## 검토 범위 메모

이번 세션(`14_33_52`)은 `raw-update-guard-scope` PR 의 5라운드 누적 리뷰다. `origin/main...HEAD`
의 실질 코드/문서 변경은 여전히 7개 파일뿐이다(`git diff --stat origin/main...HEAD -- ':!review/**'`):

- `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md` — 문서
- `codebase/backend/src/common/__test-utils__/source-scan.ts`, `source-scan.spec.ts` — 테스트 전용 정적 스캐너(`countRawUpdateReturning`/`hasRawUpdateReturning`)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 + `findUnguarded` 순수 함수
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`, `.spec.ts` — `.query<T>()` 제네릭 타입 인자 정정 1건

나머지(파일 8~63, `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02}/**` ·
`review/consistency/2026/08/30/12_17_21/**`)는 이 저장소가 CLAUDE.md 로 강제하는 리뷰/일관성
검토 워크플로가 이전 4개 라운드에서 생성한 산출물(md/json 리포트)이며 애플리케이션 코드가 아니다.

이번 라운드에 실제로 새로 추가된 유일한 커밋은 `1d606f7d0`("허용목록의 선언값도 실측과 맞춘다 +
멀티라인 축을 소스에서 떼어낸다")로, `git show 1d606f7d0 --stat` 로 직접 열람했다. 내용은 (1)
`ALLOWED` 3-tuple 의 선언 개수가 `discover()` 실측과 정확히 일치하는지 검증하는 테스트 신설,
(2) 백틱 리터럴 멀티라인 매칭 축을 합성 캐너리로 고정, (3) `CHANGELOG.md`/plan 배너/3라운드
RESOLUTION 의 수치 정정(음성 7→8) 뿐이다 — 전부 테스트/문서이고 production 코드 변경이 없다.

## 독립 재검증 (저장소 뮤테이션 없이 Read + scratch 로만 확인)

이전 4라운드 security 리뷰가 모두 "NONE"으로 결론 내렸으므로, 그 결론을 그대로 받지 않고 핵심
근거 세 가지를 이번 라운드에서 직접 재현했다(저장소 파일은 전혀 수정하지 않음, `git status --short`
로 이번 세션 산출 디렉터리 외 변경 없음을 확인):

1. **SQL 인젝션 없음** — `kb-stats.helper.ts` 를 직접 열어 확인. `UPDATE knowledge_base SET
   ... WHERE id = $1 RETURNING ...` 이 `$1` placeholder + `[knowledgeBaseId]` 파라미터 배열로
   이미 파라미터화돼 있고, 이번 diff 의 변경은 `.query<T>()` 의 **제네릭 타입 인자**
   (`{...}[]` → `[{...}[], number]`)뿐이다. TypeScript 제네릭은 컴파일 타임에 지워지므로 SQL
   문자열·바인딩·런타임 동작에 변화가 없다.
2. **ReDoS 없음** — 신규 `CALL` 정규식(`source-scan.ts`, `countRawUpdateReturning`)을 저장소
   밖에서 직접 벤치마크했다: `.query` + `<` 를 1,000~80,000자로 늘려도 매칭 시간이 0ms 대에
   머물렀다(선형, 지수적 증가 없음) — 병리적 백트래킹 경로가 관측되지 않는다. 두 대안
   (`[^<>]` / `<[^<>]*>`)이 시작 문자로 상호 배타적이라는 정적 구조 판단과도 일치한다.
3. **하드코딩된 시크릿 없음** — `git diff origin/main...HEAD -- ':!review/**'` 전체를 시크릿
   패턴(`api[_-]?key`, `secret`, `password`, `token`, `-----BEGIN`, `AKIA`, `Bearer `)으로
   grep 했다 — 매치 0건.

## 발견사항

- **[INFO]** 신설 `countRawUpdateReturning`/`hasRawUpdateReturning`(`codebase/backend/src/common/__test-utils__/source-scan.ts`, 함수 `countRawUpdateReturning`)은 저장소 자신의 1st-party 소스(`src/**`)만 읽는 테스트 전용 정적 분석 함수다. 외부/사용자 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS 어느 축에도 해당하지 않는다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (함수 `countRawUpdateReturning`, `hasRawUpdateReturning`)
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/src/common/utils/update-returning-rows.spec.ts`의 `discover()`/`listSources()`가 재귀 파일시스템 스캔을 도입하지만, 대상 디렉터리는 상수(`SRC = join(__dirname, '..', '..')`)로 고정되고 `readdirSync`가 돌려주는 실제 엔트리만 이어붙인다 — 경로 구성에 외부 입력이 개입할 여지가 없어 path traversal 이 아니다. 쓰기·삭제 없이 읽기 전용이다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (함수 `listSources`, `discover`, `SRC` 상수)
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts`의 실질 변경은 `.query<>()` 제네릭 타입 인자뿐이며, SQL 리터럴·파라미터 바인딩(`$1` / `[knowledgeBaseId]`)과 `refresh(knowledgeBaseId: string): Promise<void>` 공개 시그니처는 그대로다. 반환값 미소비도 diff 전후 동일해 런타임 보안 동작에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (`KbStatsHelper.refresh`)
  - 제안: 조치 불요.

- **[INFO]** 신규 `ALLOWED` 선언-개수 대 `discover()` 실측 일치 테스트(`update-returning-rows.spec.ts`, 4라운드 W1 fix)는 requirement 관점의 정밀도 개선이지 보안 표면이 아니다 — `ALLOWED` 목록은 여전히 저장소 자신의 소스 파일 상대경로 문자열만 다루며 외부 입력을 받지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`ALLOWED`, `findUnguarded`)
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서) 전무 — 이번 라운드에서 신규/변경된 코드·테스트·문서(`CHANGELOG.md`, plan 배너) 전체를 시크릿 패턴으로 grep 해 재확인. `review/**` 하위 JSON 에 로컬 절대경로가 다수 노출되나 이는 개발자 워크트리 파일시스템 경로일 뿐 자격증명이 아니며, 이 저장소의 리뷰 산출물 관례상 정상 패턴이다.
  - 위치: 전체 diff
  - 제안: 조치 불요.

- **[정보 확인 — 발견 없음]** 인증/인가/세션 관리, 암호화 알고리즘, 평문 전송, 에러 메시지의 민감정보 노출, 의존성(패키지) 변경 — 이번 diff 어디에도 해당 표면이 없다. 신규 라이브러리 추가·버전 변경 없음, 인증/세션 관련 코드 변경 없음, 사용자 대면 에러 경로 변경 없음.

## 요약

이번 5라운드에서 실제로 새로 추가된 유일한 커밋(`1d606f7d0`)은 4라운드 requirement WARNING(허용목록 선언 개수가 실측과 교차검증되지 않음)을 영속 테스트로 닫고, 판정 축 서술(음성 7→8)의 문서 오기를 정정한 것으로 — 둘 다 테스트/문서 변경이며 production 코드나 보안 표면에 영향이 없다. 핵심 신규 로직(`countRawUpdateReturning`/`hasRawUpdateReturning`, `findUnguarded`, discover 기반 발견형 가드)은 저장소 자신의 1st-party 소스만 읽는 테스트 전용 정적 분석기이고, `kb-stats.helper.ts`의 유일한 프로덕션 변경은 이미 파라미터화된 SQL의 컴파일 타임 제네릭 타입 주석 정정뿐이다. 이번 라운드에서 SQL 인젝션 부재(파라미터화 확인), ReDoS 부재(직접 벤치마크, 선형 시간 확인), 하드코딩 시크릿 부재(패턴 grep)를 저장소를 뮤테이션하지 않고 직접 재검증했으며, 이전 4개 라운드의 독립 security 리뷰 결론(NONE)과 일치한다. 인증/인가, 암호화, 에러 처리, 의존성 보안 어느 축에서도 신규 위험이 관측되지 않았다.

## 위험도

NONE
