# 변경 범위(Scope) 리뷰

## 검토 방법

`meta.json` 대상 9개 파일과 프롬프트에서 diff 가 생략된 파일(`source-scan.spec.ts`,
`nullable-type-lie-cast-guard.ts`, `nullable-type-lie-cast.spec.ts`)은 `git diff
origin/main..HEAD -- <path>` 로 전문을 직접 열어 확인했다. 두 신규 항목
(walker 통합·신규 stale-cast 가드)이 이번 배치에서 갑자기 추가된 것인지, 이전부터
추적되던 후속 항목인지 확인하기 위해 `git show <first-commit>~1:plan/...md` 로 각 커밋
직전 plan 상태를 대조했다. `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,...}/**`
가 diff 에 다수 포함된 이유(신규 파일 61개)도 `git show --stat` 으로 각 커밋에 확인했다.
저장소에는 아무것도 쓰지 않았다(뮤테이션 없음).

## 발견사항

- **[INFO]** 신규 함수(`collectTsFiles`/`stripLiterals`/`widenedEntityFields`/
  `findStaleSpecCasts`) 2건 모두 이번 배치에서 즉흥적으로 추가된 것이 아니라, 같은 plan
  문서에 이전 리뷰 라운드에서 이미 체크박스로 걸려 있던 후속 항목이었다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` — walker 통합은
    `git show 63d5cdaa6~1:plan/...md` 기준 "후속 — `repo-guards/__tests__/` 의 공용
    walker 추출 (리뷰 W5)" 항목(당시 `- [ ]`), stale-cast 가드는
    `git show 46f464583~1:plan/...md` 기준 "후속 — 넓혀진 필드를 겨눈 낡은 `.spec.ts`
    캐스트 가드" 항목(당시 `- [ ]`)으로 사전에 존재.
  - 상세: 두 항목 모두 이번 diff 에서 `- [x]` 로 전환되며 완료 서술이 채워졌다. 즉
    "요청 이상의 추가 수정"이 아니라 이미 스코프에 들어와 있던 미완료 백로그를 이번
    라운드에서 마감한 것.
  - 제안: 없음(정보 제공용).

- **[INFO]** 각 가드 파일(`audit-action-binding-guard.ts`,
  `engine-error-code-anchor-guard.ts`, `masked-reject-callers-guard.ts`,
  `redis-fail-open-catalog-guard.ts`)에서 개별 `walk`/`walkTsFiles`/`listSourceFiles`/
  `listProductionSources` 구현을 지우고 `collectTsFiles` 호출로 교체하면서, 더 이상
  쓰이지 않게 된 `import * as fs` 도 `audit-action-binding-guard.ts` 한 곳에서만 제거됐다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` 상단
    import 블록(unified diff 게이트 7~10행 부근, `-import * as fs from 'node:fs';`).
  - 상세: `grep -n "fs\."` 로 나머지 3개 가드 파일을 확인한 결과 모두 `fs.readFileSync`
    를 여전히 직접 호출하므로 import 를 유지한 것이 맞고, `audit-action-binding-guard.ts`
    만 `fs` 를 더 이상 안 써서 제거한 것도 맞다 — drive-by 정리가 아니라 리팩터에 따른
    필연적 변경.
  - 제안: 없음.

- **[INFO]** plan 문서 하단에 추가된 "한 자리만 고치는 버릇 — 이 plan 에서 네 번
  반복했다" 절(표 + 절차 정정 + "숫자를 어디에 쓸 수 있나" 규칙)은 단순 체크박스 완료
  서술을 넘어서는 약 90줄 분량의 회고/절차 문서다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` (unified diff 게이트
    289~329행, `## 한 자리만 고치는 버릇` 이하).
  - 상세: 엄격히 보면 "walker 추출"·"신규 가드" 두 체크리스트 항목을 완료 처리하는 데
    필요한 최소 서술을 넘어선다. 다만 `git log`(`docs(plan): 배치 3 리뷰 2R`,
    `docs(plan): --impl-done INFO 2건` 등)를 보면 이 plan 문서 자체가 여러 라운드에
    걸쳐 "리뷰에서 드러난 절차적 교훈을 그 자리에 기록"하는 것을 일관되게 반복해 온
    문서이므로, 이번 추가가 이 문서만의 돌출된 스코프 확장은 아니다. 코드 변경은 없고
    문서 내부에 국한된다.
  - 제안: 없음 — 프로젝트가 이미 채택한 이 plan 고유의 관례로 판단, 조치 불요.

- **[INFO]** 이번 diff 에 `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,
  02_57_22,03_17_44}/**` (신규 파일 61개, +5,459줄)가 대량 포함돼 있다.
  - 위치: `review/code/2026/09/04/01_48_39/meta.json` 외 다수 (파일 10~70).
  - 상세: `git show --stat <commit>` 으로 확인한 결과 각 파일은 코드 변경이 있던
    커밋(`6c5b3b74a`, `79bce075e`, `df552e4c8`, `59a229943`, `93cd244af`)에 그 라운드의
    리뷰 산출물이 함께 커밋된 것이다. `CLAUDE.md` 의 "코드 리뷰 산출물 →
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 저장 위치 규약과 일치하고,
    `review/` 는 gitignore 대상이 아니므로 의도된 배치다. scope 관점의 "무관한 파일
    수정"에는 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** `masked-reject-callers-guard.ts` 는 `collectTsFiles(rootDir, { includeSpec:
  true })` 로 교체하면서 옵션 필요성을 설명하는 주석 2줄을 새로 추가했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (unified diff 게이트 49~52행).
  - 상세: 기존 `listSourceFiles` 는 `.spec.ts` 를 걸러내지 않는 전수 스캔이었고, 새
    `collectTsFiles` 는 기본값이 `.spec.ts` 제외이므로 `includeSpec: true` 로 동작을
    보존한 것 — 동작 변경 없는 정당한 치환. 주석도 왜 이 옵션이 필요한지 설명하는
    최소한의 내용이라 불필요한 주석 추가로 보지 않는다.
  - 제안: 없음.

## 요약

리뷰 대상 9개 파일(소스 5개, 가드 3개 교체, plan 1개) 모두 `git log -S`/`git show` 로
역추적한 결과, 이번 배치에서 완료된 두 기능(`repo-guards/__tests__/` 공용 walker
`collectTsFiles` 로 통합, 넓혀진 nullable 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드
`findStaleSpecCasts` 신설)은 모두 같은 plan 문서에 이전 라운드부터 미해결 체크박스로
걸려 있던 "후속" 항목이며, 이번 커밋들에서 처음 등장한 범위 확장이 아니다. import
정리는 실제로 안 쓰이게 된 곳에서만 이뤄졌고, 나머지 3개 가드는 여전히 `fs` 를 쓰므로
import 를 유지했다 — drive-by 정리와 필요한 정리를 혼동한 흔적이 없다. `review/code/**`
하위 대량 신규 파일은 프로젝트가 규정한 리뷰 산출물 저장 위치이자 이 저장소의 확립된
커밋 관행(리뷰 라운드 산출물을 같은 라운드의 fix 커밋에 동봉)과 일치해 무관한 파일
수정으로 보지 않는다. plan 문서에 덧붙은 "한 자리만 고치는 버릇" 회고 절은 체크박스
완료에 엄밀히 필요한 서술보다는 크지만, 이 plan 문서가 여러 라운드에 걸쳐 반복해 온
자기 관례이며 코드에는 영향이 없다. 포맷팅만 바뀐 줄, 기능 과잉 설계, 설정 파일 변경,
무관한 코드 영역 수정은 발견되지 않았다.

## 위험도

NONE
