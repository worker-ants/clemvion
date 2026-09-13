# 부작용(Side Effect) 리뷰 — guide-identifier-existence (라운드 3, `15_03_06` 이후)

## 검증 방법

`git diff --stat origin/main...HEAD`(44→71개 파일, 3개 fix 커밋 누적: `d03141e6e` → `69847f45f`
→ `938060138`)로 전체 changeset 을 확인하고, 실제 부작용 표면이 있는 파일만 워크트리에서 직접
`Read`했다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (전체)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (전체)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (헤더)
- `git show 938060138` (라운드 2 fix 커밋 diff 전체)

나머지(`CHANGELOG.md`·`PROJECT.md`·`plan/**`·`review/**`)는 문서/리포트 산출물이라 부작용
관점에서 해당 없음으로 스킵했다. 저장소는 뮤테이션하지 않았다 — `git status --short` 확인 결과
이 세션이 만든 것은 `review/code/2026/09/13/15_24_12/`·`review/consistency/2026/09/13/15_23_53/`
뿐이고, 리뷰 시작 전부터 있던 untracked 항목이다.

## 발견사항

라운드 1(`14_41_14/side_effect.md`)이 지적한 WARNING 2건을 재확인했다 — **둘 다 해소됨**.

- 자매 파일 죽은 참조: `guide-sanitized-message-parity.test.ts:16` 이 이제
  `` 자매 `guide-identifier-existence.test.ts`(`#1330` 당시 `guide-error-code-existence.test.ts`) ``
  로 신·구 이름을 병기한다. `grep -rn "guide-error-code-scan\|guide-error-code-existence"
  codebase/ .claude/` 재확인 결과 남은 유일한 히트가 바로 이 의도된 역사 각주다 — 활성 참조
  0건.
- `composeTexts` 과확장: `guide-identifier-existence.test.ts:55-58` 이
  `f.endsWith(".yml") || f.endsWith(".yaml")` 에서 `/^docker-compose.*\.ya?ml$/` 로 좁혀졌고,
  바로 위 주석에 종전 판이 `pnpm-lock.yaml`(784KB)까지 읽었다는 실측과 자기 진단이 남아 있다.
  이제 무관 대형 파일에 대한 암묵적 읽기 의존이 제거됐다.

라운드 2(`938060138`)의 유일한 프로덕션-경로 변경은
`guide-identifier-existence.test.ts` 한 파일이며, 순수 추가(신규 `describe` 블록 5건 — 합성
입력만 다루는 `collectEnvDeclarations` 분기별 대조군)와 `const` 선언 두 개(`root`,
`readIfPresent`/`envExampleTexts`)를 `describe` 블록 밖으로 끌어올린 리팩터, 그리고 bare
`hh_mm_ss` 인용을 전체 경로로 교체한 주석 수정뿐이다. 새로 추가된 테스트 5건 전부
`collectEnvDeclarations(합성 배열, 합성 배열)` 직접 호출이라 부작용 표면(파일시스템·env·네트워크)이
없다.

- **[INFO]** 신규 코드는 순수 함수·읽기 전용 파일시스템 접근으로 유지됨 (재확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체,
    `guide-identifier-existence.test.ts` 전체
  - 상세: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 인자로
    받은 텍스트만 다루는 순수 함수다. 부작용은 `fs.readFileSync`/`fs.readdirSync`/
    `fs.existsSync` 를 통한 **읽기**뿐이며 쓰기·삭제·네트워크 호출·`process.env` 변경은 여전히
    없다. `GUIDE_EXTERNAL_VOCABULARY`(모듈 top-level export, 원소 1개)는 다른 파일에서
    import 되지 않고(`grep -rn "GUIDE_EXTERNAL_VOCABULARY" codebase/` — 정의처 1곳 + 사용처
    1개 테스트 파일뿐) 런타임에 변형되지도 않는다.
  - 제안: 없음(정보성).

- **[INFO]** 옛 스캐너 모듈 삭제에 따른 깨진 import 없음 — 재확인
  - 위치: 저장소 전수 grep (`guide-error-code-scan`/`guide-error-code-existence` import 참조,
    `codebase/` + `.claude/` 범위)
  - 상세: 삭제된 두 파일(`guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`)을
    참조하던 곳은 그 둘 자신뿐이었고, 둘 다 이번 changeset 에서 함께 삭제됐다. 현재 남은 유일한
    문자열 매치는 위에서 확인한 의도된 역사 각주다. 시그니처/인터페이스 삭제가 다른 호출자에
    영향을 주지 않는다.
  - 제안: 없음(정보성).

- **[INFO]** 라운드 2 diff 는 review/consistency 산출물 다수를 신규 커밋했으나 전부
  `review/code/2026/09/13/15_03_06/**`·`review/consistency/2026/09/13/15_03_36/**` 하위의
  정적 마크다운/JSON 리포트다 — 실행 시 파일시스템·전역 상태에 영향을 주는 코드가 아니다.
  - 위치: `938060138` diff 의 파일 목록 (`review/**` 24개 파일)
  - 상세: 이 저장소의 관례(리뷰 산출물을 커밋해 감사 추적을 남긴다)를 따른 것이며, 이번 diff 로
    새로 생기는 부작용 표면이 아니다.
  - 제안: 없음(정보성, 범위 확인용).

## 뮤테이션/원복 메모

이번 라운드에서 저장소 파일을 고쳐 재현한 가설은 없었다 — 직접 `Read`/`grep` 로만 확인했다.
`git status --short` 재확인 결과 이 세션이 만든 산출물 외 변경 없음.

## 요약

라운드 1이 지적한 두 WARNING(자매 파일의 죽은 파일명 참조, `composeTexts` 의 의도보다 넓은 파일
스캔)은 라운드 2 fix 커밋에서 이미 해소됐고, 이번 라운드에서 소스를 직접 열어 재확인한 결과 둘 다
그대로 유지되고 있다. 라운드 2 자체의 유일한 프로덕션-경로 변경(`guide-identifier-existence.test.ts`)은
합성 입력만 다루는 신규 테스트 5건과 인용 문구 정정, `const` 선언 위치 리팩터뿐이라 새로운 부작용
표면을 만들지 않는다. 전역 상태 변경·환경변수 읽기/쓰기(변수 *이름*만 문자열로 수집하고 값은
버림)·네트워크 호출·시그니처/공개 인터페이스 파괴적 변경·이벤트/콜백 변경 어느 것도 이번
changeset 에 없다. 신규 WARNING/CRITICAL 없음.

## 위험도

NONE
