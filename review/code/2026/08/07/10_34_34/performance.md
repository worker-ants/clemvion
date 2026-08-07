# 성능(Performance) 리뷰

## 리뷰 대상 요약

이번 changeset 은 실행 코드 변경이 없다 — 3개 파일 전부 의존성 선언/문서:

1. `codebase/frontend/package.json` — `devDependencies` 에 `@types/mdast`, `github-slugger`,
   `mdast-util-from-markdown`, `mdast-util-to-string` 4개 추가.
2. `plan/in-progress/harness-review-gate-ci-backstop.md` — 부록 섹션 추가 (순수 문서, 코드 없음).
3. `pnpm-lock.yaml` — 위 의존성 추가에 따른 lockfile 재생성 (peer-dependency 조합 변경으로 인한
   `ts-jest`/`jest-cli`/`eslint-import-resolver-typescript` 관련 220여 줄 diff, 신규 패키지 해석
   항목, `deprecated` 노트 1건, 일부 optional dep 의 `libc:` 필드 제거 — 전부 lockfile 정규화이며
   런타임 동작과 무관).

## 발견사항

- **[INFO]** 신규 4개 패키지가 `dependencies` 가 아닌 `devDependencies` 에 정확히 배치됨
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: `mdast-util-from-markdown`/`mdast-util-to-string`/`github-slugger`/`@types/mdast` 는
    `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 에서만 import 되며, 이 파일은
    `__tests__` 디렉터리 아래에 있고 오직 같은 디렉터리의 `*.test.ts` 3개에서만 참조된다
    (`spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `spec-links.test.ts`). 프로덕션
    번들이나 `next build` 산출물에는 포함되지 않아 클라이언트 번들 크기·초기 로드 성능에 영향이 없다.
    이번 PR 이 고치는 결함(계획 문서의 "#6 `spec-link-integrity` 가 미선언 의존으로 CI 에서만 실패")이
    바로 이 선언 누락이었고, `devDependencies` 배치는 그 원인 진단과 일치한다.
  - 제안: 없음 — 올바른 스코프. 참고로 기재.

- **[INFO]** `pnpm-lock.yaml` diff 는 신규 4개 패키지 추가에 따른 정상적인 peer-dependency 재해석
  결과이며 규모가 작음(129 삽입/135 삭제, 순증분 크지 않음)
  - 위치: `pnpm-lock.yaml` (importers 섹션 `@types/mdast`/`github-slugger`/
    `mdast-util-from-markdown`/`mdast-util-to-string` 추가 항목, 및 `ts-jest`/`jest-cli` 의
    `esbuild`/`ts-node` peer 조합 변경)
  - 상세: `ts-jest`/`jest-cli`/`eslint-import-resolver-typescript` 관련 변경은 이 PR 의 신규
    devDependency 추가가 pnpm 의 peer-dependency 기반 dedup 그래프를 재계산하면서 생긴 부수
    효과로 보이며, 새 패키지 자체와 직접 관련은 없다. install 시간에 미미한 영향(신규 4개 패키지
    + 그 transitive dep 인 `micromark`, `unist-util-*` 계열 소수) 외 런타임 성능 영향 없음.
  - 제안: 없음 — CI/로컬 재현성만 확인되면 충분.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 는 부록(문서) 추가만이며 코드
  실행 경로가 없어 성능 관점 검토 대상 아님
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:458-497` (부록 섹션 전체)
  - 상세: 문서가 언급하는 결함(#5 packages prepare stale dist, #7 override floors 등)은 이
    changeset 에 코드로 포함되어 있지 않다 — 별도 커밋/PR 로 이미 처리되었거나 처리 예정으로
    기록만 남아 있다. 따라서 이번 리뷰 범위에서 그 코드 자체는 평가할 수 없다.
  - 제안: 없음.

## 요약

이번 변경은 순수 의존성 선언 정정(devDependencies 4건) + lockfile 재생성 + 문서 부록 추가로,
알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O·데이터 구조 등 어떤 성능 관점에서도 실질적 위험이
없다. 신규 패키지는 테스트 전용 스코프에 정확히 위치해 프로덕션 번들·런타임에 영향을 주지 않으며,
lockfile diff 규모도 작다. Critical/Warning 없음.

## 위험도

NONE
