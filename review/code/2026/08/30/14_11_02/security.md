# 보안(Security) Review

## 검토 범위 메모

이번 diff(52개 파일, 누적 4라운드)는 실질적으로 세 부류다:

1. **테스트 전용 정적 스캐너 신설** — `codebase/backend/src/common/__test-utils__/source-scan.ts`
   (`countRawUpdateReturning`/`hasRawUpdateReturning`), `source-scan.spec.ts`,
   `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(`findUnguarded` 순수 함수 +
   `discover()`/`listSources()` 발견형 가드). 전부 jest 스펙/`__test-utils__`이며 프로덕션
   번들에 포함되지 않는다.
2. **프로덕션 코드 1건, 타입 주석만 변경** — `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`:
   `.query<T>()` 제네릭 타입 인자를 `{...}[]`(거짓 선언)에서 `[{...}[], number]`(실제 튜플)로
   정정. SQL 문자열·파라미터 바인딩(`$1` / `[knowledgeBaseId]`)은 diff 전후 동일하며, 반환값은
   여전히 소비되지 않는다.
3. **문서/plan/이전 리뷰 라운드 산출물** — `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md`,
   `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/**`, `review/consistency/2026/08/30/12_17_21/**`.
   전부 마크다운/JSON 리포트로 코드가 아니다.

직접 검증한 것:

- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`(`KbStatsHelper.refresh`)를
  직접 열어 SQL이 `$1` placeholder + `[knowledgeBaseId]` 파라미터 배열로 이미 파라미터화돼
  있음을 재확인 — SQL 인젝션 경로 없음. 변경은 제네릭 타입 인자 한 줄뿐이고 TypeScript 제네릭은
  컴파일 타임에 지워지므로 런타임 동작·공격 표면에 영향이 없다.
- 신규 `CALL` 정규식(`source-scan.ts` `countRawUpdateReturning`, `/\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)/g`)의
  구조를 직접 분석했다 — 중첩 그룹 `(?:[^<>]|<[^<>]*>)*` 의 두 대안은 시작 문자로 상호
  배타적이다(`[^<>]`는 `<`/`>`를 제외, `<[^<>]*>`는 반드시 `<`로 시작). 임의 위치에서 두
  대안이 동시에 후보가 되는 경우가 없어 모호성에 의한 지수적 백트래킹 경로가 원리적으로
  성립하지 않는다. 이 정적 판단은 이전 두 라운드(`13_15_58/security.md`, `13_46_53/security.md`)가
  scratch 환경에서 직접 수행한 벤치마크(입력 길이 1e3→8e4, 서브밀리초~1ms대 선형 증가, 지수
  증가 미관측)로도 뒷받침된다.
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 전체를 직접 읽었다.
  `listSources()`/`discover()`는 `SRC = join(__dirname, '..', '..')`(저장소 내 고정 상수 경로)만
  `readdirSync`/`readFileSync`로 재귀 탐색하고, 외부/사용자 입력이 경로 구성에 개입할 여지가
  없다 — path traversal 표면이 아니다. 쓰기·삭제 없음(읽기 전용), `node_modules`/`dist` 명시
  제외.
- `git diff origin/main...HEAD` 전체를 시크릿 패턴(`api[_-]?key`, `secret`, `password`, `token`,
  `-----BEGIN`, JWT류)으로 확인 — 실 자격증명·연결 문자열 없음. `review/**` 하위 JSON에 로컬
  절대경로가 다수 노출되나 개발자 워크트리 파일시스템 경로일 뿐 시크릿이 아니다.
- 최신 커밋(`94985c55a`, 3라운드 WARNING 4건 fix)의 실 diff를 `git show`로 직접 확인 — CTE
  접두(`WITH … UPDATE … RETURNING`) blind spot을 docstring + 캐너리 테스트로 명시하는 문서/테스트
  전용 추가이고, 프로덕션 코드 변경은 없다.

## 발견사항

- **[INFO]** 신설 `countRawUpdateReturning`/`hasRawUpdateReturning`(`codebase/backend/src/common/__test-utils__/source-scan.ts`,
  함수 `countRawUpdateReturning`)은 저장소 자신의 1st-party 소스(`src/**`)만 읽는 테스트 전용
  정적 분석 함수다. 외부/사용자 입력이 개입하지 않아 인젝션·경로 탐색·ReDoS 어느 축에도
  해당하지 않는다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (함수 `countRawUpdateReturning`, `hasRawUpdateReturning`)
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/src/common/utils/update-returning-rows.spec.ts`의 `discover()`/`listSources()`가
  재귀 파일시스템 스캔을 도입하지만, 대상 디렉터리는 상수(`SRC`)로 고정되고 `readdirSync`가
  돌려주는 실제 엔트리만 이어붙인다 — path traversal 아님, 읽기 전용.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (함수 `listSources`, `discover`)
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts`의 실질 변경은 `.query<>()` 제네릭 타입 인자뿐이며, SQL
  리터럴·파라미터 바인딩(`$1` / `[knowledgeBaseId]`)과 `refresh(knowledgeBaseId: string): Promise<void>`
  공개 시그니처는 그대로다. 반환값 미소비도 diff 전후 동일해 런타임 보안 동작에 영향이 없다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (`KbStatsHelper.refresh`)
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서) 전무 — 신규/변경된 코드·테스트·문서·plan·
  이전 3개 리뷰 라운드 및 consistency-check 산출물 전체를 통틀어 자격증명·연결 문자열류 리터럴
  없음. 로컬 절대경로 노출은 시크릿이 아니라 정상적인 워크플로 산출물 패턴이다.
  - 위치: 전체 diff
  - 제안: 조치 불요.

- **[정보 확인 — 발견 없음]** 인증/인가/세션 관리, 암호화 알고리즘, 평문 전송, 에러 메시지의
  민감정보 노출, 의존성(패키지) 변경 — 이번 diff 어디에도 해당 표면이 없다. 신규 라이브러리
  추가·버전 변경 없음, 인증/세션 관련 코드 변경 없음, 사용자 대면 에러 경로 변경 없음.

## 요약

이번 diff는 raw `UPDATE/DELETE … RETURNING` 회귀 가드를 손으로 고른 파일 목록에서 `src/**`
전수 발견형으로 확장하는 테스트 인프라 변경(신규 정적 스캐너, 순수 판정 함수 `findUnguarded`,
재귀 파일시스템 스캔)과, 그 과정에서 발견된 `kb-stats.helper.ts`의 제네릭 타입 오선언 정정
1건, 그리고 이전 3개 리뷰 라운드(`12_41_15`, `13_15_58`, `13_46_53`)와 consistency-check
산출물의 누적 커밋으로 구성된다. 신설 정적 스캐너와 파일시스템 순회는 전부 테스트 시점에
저장소 자신의 1st-party 소스만 대상으로 하며 외부/사용자 입력이 개입하지 않아 인젝션·경로
탐색·ReDoS 어느 축에도 해당하지 않는다(정규식 구조 분석 + 이전 라운드의 실측 벤치마크가
일치). `kb-stats.helper.ts`의 유일한 프로덕션 변경은 이미 파라미터화된 SQL의 컴파일 타임 타입
주석 정정으로 런타임 동작·공격 표면에 변화가 없다. 하드코딩된 시크릿, 인증/인가 회귀, 암호화
취약점, 민감정보 노출 에러 처리, 의존성 취약점 어느 항목도 발견되지 않았다. 이 결론은 같은
PR에 대한 이전 3라운드의 독립 security 리뷰와 일치한다.

## 위험도
NONE
