# 의존성(Dependency) 리뷰 — guide-identifier-existence (리뷰 라운드 2, RESOLUTION 반영분)

## 검증 방법

프롬프트 diff(44개 파일, `ce454e046..HEAD`)를 읽은 뒤 실제 워크트리 파일을 직접 열어 교차검증했다.
저장소는 뮤테이션하지 않았다(`git status --short` 확인 — 이 세션이 만든 것은
`review/code/2026/09/13/15_03_06/`·`review/consistency/2026/09/13/15_03_36/` 산출물뿐, 리뷰 시작
전부터 있던 untracked 항목).

- `git diff --stat ce454e046..HEAD -- '*/package.json' 'package.json' '*/pnpm-lock.yaml' 'pnpm-lock.yaml'`
  → 출력 없음(매치 0건). 이번 diff 44개 파일 목록 전수(`git diff --stat ce454e046..HEAD`)에도
  매니페스트·lockfile 이 없음을 확인.
- `grep -n "^import" guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 를 직접 열어
  import 표면을 확인.
- 이전 라운드(`review/code/2026/09/13/14_41_14/dependency.md`)가 지적한 내부 의존성 WARNING(자매
  파일 crossref 죽은 참조)과, 자매 리뷰어(architecture/side_effect/maintainability/documentation)가
  지적한 `composeTexts` 스코프 과다 문제가 이번 라운드(RESOLUTION.md 처분표 #1·#2)에서 실제로
  고쳐졌는지를 소스에서 직접 재확인.

## 발견사항

- **[INFO]** 신규 외부 패키지 추가 없음 — 확인됨 (재확인, 전 라운드와 동일 결론)
  - 위치: 전체 diff (44개 파일)
  - 상세: `guide-identifier-existence.test.ts` 의 import 는 `vitest`(기존 devDependency) ·
    `node:fs` / `node:path`(Node 내장) · 동일 디렉터리 기존 유틸(`./tree-walk`,
    `./impl-anchor-parse`) · 이번 PR 이 함께 제공하는 sibling 모듈(`./guide-identifier-scan`)뿐이다.
    `guide-identifier-scan.ts` 는 `import` 문이 0개인 순수 모듈(직접 확인)이다.
    `package.json`/`pnpm-lock.yaml`(루트·워크스페이스 모두) 변경이 diff 에 없다. 버전 고정·라이선스·
    취약점·번들 크기·기존 의존성과의 충돌 — 전부 N/A(신규 의존성 없음).

- **[INFO]** 내부 의존성(모듈 간 크로스레퍼런스) — 전 라운드 WARNING 이 이번 라운드에서 해소됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 전 라운드(`14_41_14/dependency.md` 발견사항 #1, `side_effect`/`architecture`/
    `maintainability`/`documentation`/`requirement` 6개 리뷰어 수렴)는 이 자매 파일의 JSDoc 이
    삭제된 `guide-error-code-existence.test.ts` 를 옛 이름 그대로 "자매" 로 인용해 존재하지 않는
    파일을 가리키는 죽은 참조를 지적했다. 이번 라운드에서 `자매 \`guide-identifier-existence.test.ts\`
    (\`#1330\` 당시 \`guide-error-code-existence.test.ts\`)는` 로 신·구 이름을 병기하는 형태로 수정된
    것을 직접 `Read` 로 확인했다. `grep -rn "guide-error-code" codebase/` 결과 남은 참조는 2건뿐이며
    (`guide-identifier-scan.ts:9` 의 `#1330 은 이 가드를 에러 코드 전용으로 만들었다(guide-error-code-*)`,
    그리고 위 자매 파일의 각주) 둘 다 의도된 역사 서술이지 활성 참조가 아니다 — 결함 없음.

- **[INFO]** env/compose 기준집합 수집의 암묵적 파일 스코프 결합 — 전 라운드 WARNING 이 좁혀짐(내부
  의존 표면 축소)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:48-59`
  - 상세: 전 라운드에서 `composeTexts` 가 저장소 루트의 확장자 기준(`.yml`/`.yaml`) 전부를
    읽어(`pnpm-lock.yaml` 784KB 포함) "compose 파일" 이라는 이름·의도보다 넓은 파일 집합에 암묵
    결합한다는 지적이 있었다(사실상 저장소 루트에 새 YAML 이 추가되는 것에 대한 취약한 의존).
    이번 라운드에서 필터가 `/^docker-compose.*\.ya?ml$/` 로 좁혀졌고, 위 필터 직전 주석에
    `docker-compose* 로 좁힌다. 종전 판은 루트의 모든 .yml/.yaml 을 읽어 …` 라는 변경 근거가 남아
    있음을 확인했다. 저장소 루트의 무관 대형 파일(락파일 등)에 대한 암묵 의존이 제거됐다 —
    의존성(파일 스코프) 관점의 결함 해소.

## 요약

이번 라운드(직전 리뷰의 RESOLUTION 반영분)는 `package.json`/lockfile 변경이나 신규 외부 패키지
도입이 전혀 없는 순수 내부 test/tooling 수정이다. `git diff --stat` 전수 확인으로 매니페스트 변경
0건을 재확인했고, import 표면은 Node 내장·기존 devDependency(vitest)·동일 폴더 내부 유틸로만
구성돼 있어 버전 고정·라이선스·취약점·번들 크기·호환성 항목은 해당 없음이다. 전 라운드가 의존성
관점에서 지적한 유일한 항목(내부 모듈 crossref 죽은 참조)은 이번 라운드에서 신·구 이름 병기로
정정된 것을 직접 확인했고, 자매 리뷰어들이 지적한 인접 결함(compose 스코프 과다 — 내부 파일-경로
의존이 이름보다 넓었던 문제)도 `docker-compose*.yml` 글롭으로 좁혀져 함께 해소됐다. 남은 의존성
관점의 발견사항은 없다.

## 위험도

NONE
