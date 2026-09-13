# 의존성(Dependency) 리뷰

## 검증 방법

프롬프트 diff(98개 파일, 라운드 1~4 누적 리뷰/컨시스턴시 산출물 포함)를 읽은 뒤, 실제 워크트리에서
직접 재검증했다. 저장소는 뮤테이션하지 않았다(`git status --short` — 이 세션이 만든 `review/code/2026/09/13/16_04_15/`·
`review/consistency/2026/09/13/16_04_45/` untracked 산출물만 존재).

- `git diff --stat origin/main...HEAD -- '**/package.json' 'package.json' '**/pnpm-lock.yaml' 'pnpm-lock.yaml' '**/yarn.lock' '**/package-lock.json'` → 출력 없음(매치 0건).
- `git diff --name-only origin/main...HEAD -- 'codebase/**'` → 5개 파일만 실 코드 변경분(그 외 93개는 `plan/`·`review/**`·`CHANGELOG.md`·`PROJECT.md`).
- `grep -n "^import"` 로 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 의 import 표면을 직접 확인.
- 라운드 1~4 가 각각 지적·처분했다고 주장하는 두 항목(sibling stale 참조, `composeTexts` 과다 수집)을
  현재 HEAD(`6b4c03af6`)의 실제 소스에서 재확인.

## 발견사항

- **[INFO]** 신규 외부 패키지 추가 없음 — 확인됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:1-13`, `guide-identifier-scan.ts` (전체)
  - 상세: `git diff --stat origin/main...HEAD` 로 전체 changeset 을 대조한 결과 `package.json`/`pnpm-lock.yaml`(루트·워크스페이스 전부) 변경이 0건이다. `guide-identifier-existence.test.ts` 의 import 는 `vitest`(기존 devDependency) · `node:fs` / `node:path`(Node 내장) · 동일 디렉터리 기존 유틸(`./tree-walk`, `./impl-anchor-parse`) · 이 PR 이 함께 추가하는 sibling 모듈(`./guide-identifier-scan`)뿐이며, `guide-identifier-scan.ts` 자체는 `import` 문이 0개인 순수 모듈이다(직접 확인). 실 코드 변경분은 `codebase/**` 5개 파일뿐(구 `guide-error-code-*` 2개 삭제, 신 `guide-identifier-*` 2개 신규, `guide-sanitized-message-parity.test.ts` 주석 1줄). 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 — 전부 N/A(신규 의존성이 없으므로).

- **[INFO]** 내부 의존성(sibling 크로스레퍼런스) — 라운드 1 이 지적한 stale 참조가 라운드 2에서 실제로 해소된 상태 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 라운드 1(`review/code/2026/09/13/14_41_14/dependency.md`)은 이 파일의 JSDoc 이 삭제된 `guide-error-code-existence.test.ts` 를 옛 이름 그대로 "자매"로 인용해 존재하지 않는 파일을 가리키는 죽은 참조라고 지적했다. 현재 HEAD 를 `Read` 로 직접 확인한 결과 `자매 \`guide-identifier-existence.test.ts\`(\`#1330\` 당시 \`guide-error-code-existence.test.ts\`)는` 로 신·구 이름을 병기하는 형태로 정정돼 있다. `grep -rn "guide-error-code" codebase/ CHANGELOG.md PROJECT.md spec/` 결과 남은 참조는 3건(`guide-identifier-scan.ts:9`, 위 sibling 파일 각주, `CHANGELOG.md:77`)뿐이며 전부 의도된 역사 서술이지 활성 import/require 경로가 아니다. 실 결함 없음.

- **[INFO]** env/compose 기준집합 수집의 파일 스코프 — 라운드 1 이 지적한 과다 수집이 좁혀진 상태 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-57`
  - 상세: 라운드 1 은 `composeTexts` 가 저장소 루트의 확장자 기준(`.yml`/`.yaml`) 전부를 읽어(`pnpm-lock.yaml` 784KB 포함) "compose 파일"이라는 이름·의도보다 넓은 파일 집합에 암묵 결합한다고 지적했다. 현재 HEAD 에서 필터는 `/^docker-compose.*\.ya?ml$/` 로 확인되며, 직전 줄 주석(`docker-compose* 로 좁힌다. 종전 판은 루트의 모든 .yml/.yaml 을 읽어 …`)이 변경 경위를 남기고 있다. 저장소 루트의 무관 대형 파일(락파일 등)에 대한 암묵 의존이 제거된 상태다.

## 요약

이번 changeset(98개 파일)의 실 코드 diff 는 `codebase/frontend/src/lib/docs/__tests__/` 하위 5개 파일뿐이며, `package.json`/lockfile 변경이나 신규 외부 패키지 도입은 전혀 없다(전체 브랜치 대조로 재확인). import 표면은 Node 내장 모듈·기존 devDependency(`vitest`)·저장소에 실재하는 내부 유틸(`tree-walk`, `impl-anchor-parse`)·같은 PR 이 제공하는 sibling 모듈(`guide-identifier-scan`)로만 구성돼 있어 버전 고정·라이선스·취약점·번들 크기·호환성 관점의 지적 사항이 없다. 이전 라운드들이 의존성 관점에서 유일하게 잡았던 두 항목(sibling 파일의 stale 파일명 참조, `composeTexts` 의 과도한 파일 스코프)은 현재 HEAD 에서 직접 재검증한 결과 둘 다 실제로 해소된 채 유지되고 있다. 나머지 93개 파일은 `CHANGELOG.md`/`PROJECT.md` 카탈로그 문구 갱신과 `plan/`·`review/**` 산출물로, 의존성 표면에 영향이 없다. 신규 발견 사항 없음.

## 위험도

NONE
