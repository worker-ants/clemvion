# 의존성(Dependency) 리뷰 — guide-identifier-existence (라운드 4, `15_24_12` 이후)

## 검증 방법

`git diff --stat origin/main...HEAD -- '**/package.json' 'package.json' '**/pnpm-lock.yaml' 'pnpm-lock.yaml' '**/package-lock.json' '**/yarn.lock'` 로 전체 changeset(`d32886607..HEAD`)을 대조했고 매치 0건이다. `git log --oneline -6` 으로 라운드 3(`15_24_12`) 이후 새로 얹힌 커밋을 확인했는데, 최상단(`2253d27a4`)은 `plan/in-progress/*.md` 체크박스 정정뿐인 `chore(plan)` 커밋이라 코드 의존성과 무관하다. `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts` 를 직접 `Read`/`grep` 해 import 표면을 재확인했다. 저장소에는 아무것도 쓰지 않았다(`git status --short` 로 시작·종료 시점 대조 — 이 세션이 만든 것은 `review/code/2026/09/13/15_42_54/`·`review/consistency/2026/09/13/15_43_24/` 뿐).

## 발견사항

- **[INFO]** 새 외부 패키지/라이브러리 추가 없음 — 확인됨 (4라운드 연속 동일 결론)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:1-13`, `guide-identifier-scan.ts`(import 0개), `guide-sanitized-message-parity.test.ts:1-5`
  - 상세: 신규·변경 파일의 import 는 `vitest`(기존 devDependency) · `node:fs`/`node:path`(Node 내장) · 동일 디렉터리 기존 유틸(`./tree-walk`, `./impl-anchor-parse`) · 이 PR 이 함께 제공하는 sibling 모듈(`./guide-identifier-scan`)뿐이다. `guide-identifier-scan.ts` 는 import 문이 0개인 순수 모듈이다. `package.json`/lockfile(루트·워크스페이스 전부) 변경은 changeset 전체에서 0건. 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 — 전부 N/A(신규 의존성이 없으므로).

- **[INFO]** 내부 의존성(sibling 상호 참조) — 이전 라운드들이 지적·처분한 두 항목은 이번 라운드에도 고쳐진 상태로 유지됨, 신규 회귀 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` / `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` 의 `composeTexts` 필터(`/^docker-compose.*\.ya?ml$/`)
  - 상세: (1) 자매 파일의 "자매" crossref 는 `guide-identifier-existence.test.ts`(`#1330` 당시 옛 이름 병기)로 갱신된 상태다. `grep -rn "guide-error-code" codebase/` 로 재확인한 결과 남은 매치는 그 병기 각주와 `guide-identifier-scan.ts` 헤더의 의도된 역사 서술뿐, 활성 import/require 참조는 0건이다. (2) `composeTexts` 는 여전히 `docker-compose*.ya?ml` 로 좁혀져 있어(라운드 2 fix 유지) 루트의 무관 대형 YAML(`pnpm-lock.yaml` 등)에 대한 암묵 의존은 재발하지 않았다.
  - 제안: 없음(이미 처리됨, 재확인만).

- **[INFO]** 리뷰 중 관측 — 공유 워크트리에서 병렬 세션으로 추정되는 일시적(커밋되지 않은) 뮤테이션을 `guide-identifier-scan.ts` 에서 목격했으나, 재확인 시점엔 자체 원복되어 있었음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `CODE_FIELD` 정규식 정의 줄(`git show HEAD:<path>` 기준 106행)
  - 상세: 첫 확인 시 `git status --short` 가 이 파일을 `M`(modified, unstaged)으로 표시했다. `git diff` 로 보면 `` const CODE_FIELD = new RegExp(`"?code"?\s*:\s*"(${UPPER_SNAKE})"`, "g"); `` 가 `` const CODE_FIELD = new RegExp(`(?<![A-Za-z])"?code"?\s*:\s*"(${UPPER_SNAKE})"`, "g"); `` 로 바뀌어 있었다(부정 lookbehind 추가 — `"code"` 앞에 알파벳이 오면 매치를 제외하는 방향의 실험으로 보인다). `git show HEAD:<path>` 로 대조한 커밋 버전은 원본 그대로였다 — 즉 이 변경은 리뷰 대상 diff(`origin/main...HEAD`)의 일부가 아니라 워크트리에만 있던 미커밋 상태였다. 5초 뒤 재확인해도 남아 있었으나, 그 뒤 `dependency.md` 를 작성하는 사이 다시 확인하니 `git status --short`/`git diff` 모두 이 파일에 대해 깨끗해져 있었다 — 다른 reviewer(추정: `CODE_FIELD` 오탐 가설 검증 뮤테이션)가 스스로 원복한 것으로 보인다. 이는 라운드 3 RESOLUTION.md INFO#7 이 이미 등재한 "리뷰 in-flight 중 병렬 세션 뮤테이션이 관측 후 자체 원복" 패턴의 재발현이다. **나는 이 파일에 어떤 쓰기도, 어떤 되돌림도 하지 않았다** — 관측만 했다.
  - 제안: 조치 불요(현재 시점엔 깨끗함). 다음 사람이 이 파일을 열 때 유사한 순간적 diff 를 보더라도 본 PR 의 결함으로 오인하지 말 것.

## 요약

이번 라운드(`15_24_12` 이후)의 유일한 신규 커밋은 `plan/in-progress/*.md` 체크박스 정정(`chore(plan)`)뿐이라 코드 레벨 의존성 변경은 없다. `package.json`/lockfile 매치는 changeset 전체에서 0건이며, 신규 파일이 사용하는 import 는 전부 Node 내장·기존 devDependency(`vitest`)·저장소에 실재하는 내부 유틸로만 구성돼 있어 새 의존성·버전 고정·라이선스·취약점·번들 크기·호환성 항목은 4라운드 연속 해당 없음이다. 이전 라운드들이 지적한 내부 의존성(sibling crossref, `composeTexts` 스코프) 결함은 이번 라운드에도 고쳐진 채로 유지되고 있다. 리뷰 중 워크트리에서 `guide-identifier-scan.ts` 의 일시적·미커밋 수정(`CODE_FIELD` 정규식에 부정 lookbehind 추가)을 관측했으나, 확인 결과 리뷰 대상 diff 밖의 상태였고 이후 자체 원복돼 최종적으로 저장소는 깨끗하다 — 본 PR 의 결함이 아니며 판정에 반영하지 않았다.

## 위험도

NONE
