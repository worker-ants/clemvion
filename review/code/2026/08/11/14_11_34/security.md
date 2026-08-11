# 보안(Security) Review

대상: `docs-guard-walker` — 문서 가드(테스트 인프라) 손수 짠 DFS 6벌을 `tree-walk.ts`
`walkTree` 하나로 통합 + Gate C 판정 함수 이전 + plan 완료 이동. 지시대로 세 관점을
직접 실행/확인했다 (`Read`로 실제 소스 대조 + `node -e`로 `makeSpecExists` 재현).

## 발견사항

- **[INFO]** `walkTree` 의 `bases` 세그먼트가 `path.join(root, base)` 로만 결합되고
  `..` 상위 이탈에 대한 런타임 가드가 없다. 공유 primitive 자체는 이 형태를 허용한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:82` (결합부),
    `:41-58` (`WalkOptions`/`bases` 계약을 문서화하는 자리)
  - 상세: `path.join(root, "../../etc")` 는 `root` 밖으로 정규화된다 — `path.join` 은
    `..` 를 걸러주지 않는다. 다만 실제 호출부를 전수 확인한 결과 5곳
    (`impl-anchor-parse.ts:112`, `plan-scan.ts:70`, `spec-frontmatter-parse.ts:89`,
    `spec-links.ts:160,332`) 전부 **리터럴 문자열 상수**(`"spec"`, `path.join("plan", bucket)`
    의 `bucket` 도 taxonomy 상 고정 버킷명, `CODEBASE_SOURCE_ROOTS` 상수 배열, `subPath` 도
    호출부에서 `"codebase/frontend/src/content/docs"` 류 리터럴)만 넘긴다 — 사용자/외부
    입력이 `base` 로 흘러드는 경로가 현재 존재하지 않는다. 게다가 이 함수 자체 주석
    (`:78-81`)이 "절대경로를 받는 분기를 넣었다가 어떤 테스트로도 관측되지 않아 지웠다"고
    명시한다 — 직전 리뷰 라운드에서 동일한 이유(도달 불가 분기·뮤테이션 생존)로 이미
    제거된 방어였다. 이 저장소의 확립된 방침("실제로 exercise 되지 않는 방어 분기는 넣지
    않는다")과 일치하는 선택이다.
  - 제안: 현재로선 조치 불요 — CRITICAL/WARNING 으로 올릴 근거(실제 도달 가능한 오염 경로)가
    없다. 다만 이 함수가 exported 된 공유 primitive이므로, 향후 `base` 를 frontmatter
    필드·CLI 인자·환경변수 등 **비-리터럴** 값에서 파생하는 호출부가 생기는 순간 이 갭이
    실제 경로 탈출로 바뀐다는 점을 인지해 둘 것 (같은 파일의 `makeSpecExists` 가 이미 겪은
    "문자열 접두사만으로는 부족하다 → 정규화 후 판정" 교훈을 그때 그대로 적용하면 된다).

- **[없음/양호]** `makeSpecExists` 의 `spec/` 하위 제한 검사를 `node -e` 로 직접 재현했다 —
  `spec_impact: ["spec/../CLAUDE.md"]`, `["CLAUDE.md"]`, `["spec"]`(디렉터리), `[""]`
  전부 `false` 로 정상 거부되고, `["spec/conventions/spec-impl-evidence.md"]` 만 `true`.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:430-451`
    (`specRoot`/`resolved` 비교는 `:439-441`)
  - 상세: `path.resolve(root, p)` 로 먼저 정규화한 뒤 `specRoot`(정규화된 절대경로)와
    비교하므로 `"spec/../CLAUDE.md"` 처럼 `startsWith("spec/")` 문자열 접두 검사만으로는
    통과했을 형태가 정규화 단계에서 `root/CLAUDE.md` 로 풀려 `specRoot` 하위 조건에
    걸린다. 이전 라운드에서 지적된 "정규화 전 문자열 술어" 결함이 이번 diff 에서 올바르게
    수정된 상태로 확인된다.

- **[없음/양호]** `mkdtempSync`/`rmSync` fixture 정리 경로 전수 확인 — `spec-links.test.ts`,
  `plan-scan.test.ts`, `tree-walk.test.ts` 의 모든 `rmSync` 호출이 `mkdtempSync` 가 반환한
  변수를 **가공 없이 그대로** 인자로 받는다 (`path.join`/문자열 결합으로 파생된 하위경로가
  아님). `os.tmpdir()` 기준 새 임시 디렉터리만 지우므로 `root` 밖을 지울 수 있는 경로가
  없다.

- **[정보]** 하드코딩된 시크릿(API 키·토큰·비밀번호·인증서) — 전체 diff 를 패턴 검색했으나
  0건.
- **[정보]** 인젝션(SQL/XSS/커맨드/LDAP) — 이 PR 은 로컬 파일시스템 순회 + gray-matter
  frontmatter 파싱만 다루며, `eval`/`Function`/`child_process`/`exec` 계열 호출이 diff 대상
  파일 어디에도 없다. `matterNoCache`(`plan-scan.ts:...`)로 통합된 `matter(raw, {})` 호출은
  캐시 우회를 위한 옵션 전달이며 새 파싱 엔진이나 스키마 완화가 아니다 — 읽는 대상도
  저장소 내부 `spec/`·`plan/` markdown 뿐이라 외부/사용자 입력 경로가 아니다.
- **[정보]** 이 변경은 런타임 서비스 코드가 아니라 `__tests__/` 하위 문서 가드(빌드/CI
  테스트 인프라)이므로 인증/인가·세션·암호화·평문 전송 표면이 원천적으로 없다.

## 요약

이번 PR 은 6벌의 손수 짠 디렉터리 순회를 `walkTree` 공용 primitive 로 통합하는
리팩터이며, 실제 보안 표면(런타임 서비스·사용자 입력·인증)이 없는 로컬 테스트/문서 가드
코드다. 지시된 세 관점을 직접 실행 확인한 결과: (1) `walkTree` 의 `bases` 파라미터는
이론상 `..` 이탈을 막는 런타임 가드가 없지만 현재 5개 호출부가 전부 리터럴 상수만 넘기고,
직전 라운드가 같은 이유로 미사용 방어 분기(`path.isAbsolute`)를 이미 제거한 전례가 있어
실제 공격 경로가 존재하지 않는다 — INFO 로만 남긴다. (2) `makeSpecExists` 의 `spec/` 경계
검사는 `path.resolve` 정규화 후 비교라 `spec/../CLAUDE.md` 류 우회를 실제로 막는 것을
`node -e` 재현으로 직접 검증했다 — 오히려 이전 라운드의 문자열-접두 결함을 올바르게
고친 상태다. (3) fixture 정리(`rmSync`)는 전부 `mkdtempSync` 반환값을 그대로 쓰므로
`root` 밖 삭제 위험이 없다. 하드코딩 시크릿·인젝션·안전하지 않은 암호화 패턴도 발견되지
않았다. 새로 발견된 CRITICAL 은 없다.

## 위험도
NONE

STATUS: OK
