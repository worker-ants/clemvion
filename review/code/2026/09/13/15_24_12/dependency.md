# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지/라이브러리 추가 없음 — 확인됨
  - 위치: 전체 변경분 (`CHANGELOG.md`, `PROJECT.md`, `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`(삭제) / `guide-error-code-scan.ts`(삭제) / `guide-identifier-existence.test.ts`(신규) / `guide-identifier-scan.ts`(신규) / `guide-sanitized-message-parity.test.ts`, `plan/in-progress/*.md`, `review/**`)
  - 상세: `git diff --stat origin/main...HEAD -- '**/package.json' '**/pnpm-lock.yaml' '**/package-lock.json' '**/yarn.lock'` 로 브랜치 전체를 대조했고 매치 0건이다. 신규 파일(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`)의 import 는 `vitest`(기존 devDependency) · `node:fs` · `node:path`(Node 내장) · 동일 디렉터리의 기존 내부 유틸(`./tree-walk`, `./impl-anchor-parse`)뿐이며 둘 다 저장소에 실재한다. 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 — 전부 해당 없음(N/A), 새 의존성이 없으므로.

- **[INFO]** 내부 의존성(sibling 상호 참조) — 직전 라운드(`review/code/2026/09/13/14_41_14`)에서 WARNING 으로 지적된 두 항목이 이번 라운드 diff 에서 실제로 고쳐져 있음을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` (파일 7 diff) / `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:50-57` (`composeTexts` 필터)
  - 상세: (1) `guide-sanitized-message-parity.test.ts` 의 JSDoc 이 리네임된 자매 파일을 옛 이름(`guide-error-code-existence.test.ts`)으로만 가리키던 stale 크로스 레퍼런스는 이번 diff 에서 `guide-identifier-existence.test.ts`(`#1330` 당시 옛 이름 병기)로 갱신됐다. `grep -rn "guide-error-code-scan\|guide-error-code-existence\.test\|from \"\./guide-error-code" codebase/` 로 재확인한 결과, 남은 유일한 매치는 그 병기된 역사적 언급뿐이고 실제 import/require 형태의 깨진 참조는 0건이다. (2) `composeTexts` 가 루트의 모든 `.yml`/`.yaml`(락파일 포함)을 읽던 스코프 과다 문제도 `/^docker-compose.*\.ya?ml$/` 필터로 좁혀져 있다(현재 파일 라인 50-57 확인). 둘 다 이전 라운드 RESOLUTION.md 의 처분과 일치한다 — 재열거만 하고 신규 지적은 아니다.
  - 제안: 없음(이미 처리됨). 참고용 기록.

- **[INFO]** 리뷰 중 관측 — 병렬 세션이 같은 워킹트리에서 `guide-identifier-scan.ts` 를 일시적으로 수정(`envLine` 정규식 실험)했다가 원복하는 것을 목격
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (내부 `collectEnvDeclarations`)
  - 상세: 리뷰 도중 `git status --short` 를 두 차례 실행했는데, 1차에는 이 파일이 modified 상태(`^#?\s*(...)=` → `^(...)=`)였고 `.ts.bak` untracked 파일이 있었으며, 이후 `.bak2` grep 매치도 순간적으로 관측됐다. 곧이어 재확인하니 파일 내용은 원본(`^#?\\s*(${UPPER_SNAKE})=`)으로 복원돼 있었고 두 `.bak*` 파일 모두 사라져 `git status --short` 가 깨끗하다(내가 만든 리뷰 산출물 디렉터리 2개만 untracked). 나는 이 파일에 어떤 쓰기도 하지 않았다 — 이 프롬프트의 병렬 fan-out 경고("다른 reviewer 들이 같은 워킹트리를 동시에 읽고 있다")와 일치하는, 다른 세션의 가설 검증용 뮤테이션+원복으로 보인다. 현재는 정상 원복된 상태이므로 별도 조치는 불요하나, 다음 사람이 같은 파일을 다시 열었을 때 유사한 순간적 diff 를 보더라도 이 리뷰의 결함으로 오인하지 않도록 기록해 둔다.
  - 제안: 조치 불요(이미 원복 확인됨). 만약 다음 리포트에서 이 파일이 실제로 mutated 상태로 남아 있다면 그것은 별개의 새 관측이다.

## 요약

이번 diff 는 `guide-error-code-*` 가드를 `guide-identifier-*` 로 스코프 확장(에러 코드 → 식별자 전반: 에러 코드 + 환경변수) 리네임한 순수 내부 test/tooling 변경과 관련 문서(`CHANGELOG.md`, `PROJECT.md`, `plan/`)·리뷰 산출물(`review/`) 갱신으로 구성된다. `package.json`/lockfile 변경은 브랜치 전체에서 0건이며, 신규 파일이 사용하는 import 는 전부 Node 내장 모듈·기존 devDependency(`vitest`)·저장소에 실재하는 내부 유틸(`tree-walk`, `impl-anchor-parse`)뿐이다. 따라서 새 의존성·버전 고정·라이선스·취약점·번들 크기·기존 의존성 충돌 항목은 전부 해당 없음이다. 유일하게 챙길 만한 내부 의존성(모듈 간 상호 참조) 축은 직전 리뷰 라운드가 지적한 두 항목(sibling 파일의 stale 파일명 참조, `composeTexts` 의 과도하게 넓은 스캔 범위)인데 둘 다 이번 diff 에서 이미 고쳐져 있음을 확인했다 — 신규 지적 사항은 없다.

## 위험도

NONE
