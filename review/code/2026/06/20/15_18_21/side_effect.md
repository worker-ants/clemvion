### 발견사항

- **[INFO]** `package.json` — `lint` 스크립트에서 `--fix` 플래그 제거
  - 위치: `codebase/backend/package.json` lint 스크립트 행
  - 상세: `lint` 스크립트가 `eslint ... --fix` 에서 `eslint ...` (report-only) 로 변경됨. 기존에 `npm run lint` 또는 `pnpm --filter backend lint` 를 CI/husky pre-commit 훅 등에서 호출하던 파이프라인이 있다면, 동일 명령이 더 이상 파일을 자동 수정하지 않는다. 단, 이는 의도된 동작 변경이며 `lint:fix` 라는 명시적 스크립트로 분리됨. 기존 lint 결과가 수정 없이 exit code 1 을 반환하는 상황이 늘 수 있으나, 이는 report-only 전환의 정상 결과다.
  - 제안: CI/CD 파이프라인 및 Git 훅에서 `lint` 를 호출하는 지점을 확인해 의도치 않은 blocking 이 없는지 점검. (기존 훅이 `--fix` 효과를 기대했다면 `lint:fix` 로 변경 필요)

- **[INFO]** `eslint.config.mjs` — `no-unnecessary-type-assertion: warn` 추가
  - 위치: `codebase/backend/eslint.config.mjs` 프로덕션 rules 블록
  - 상세: 프로덕션 코드 전역에 `warn` 규칙이 추가됨. 이 규칙 자체는 파일을 수정하거나 상태를 변경하지 않는다. 다만 281건의 기존 위반이 warn 으로 가시화됨에 따라 lint 출력이 대폭 증가하고, 일부 CI 툴에서 warn 을 stderr 로 처리하는 경우 노이즈 증가 부작용이 있을 수 있다. 테스트 파일 override(`off`) 가 올바르게 추가되어 테스트 더블 캐스트로 인한 노이즈는 차단됨.
  - 제안: 현 설정 적절. CI가 lint warn 개수를 threshold로 추적한다면 임계값 재설정 필요.

- **[INFO]** `plan-frontmatter.test.ts` — 파일시스템 스캔 범위 변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` sanity 검증 블록
  - 상세: 특정 파일명 하드코딩 검증에서 `plan/in-progress/` 경로 및 `.md` 확장자 구조 검증으로 대체됨. `collectTopLevelPlans` 함수는 `fs.readdirSync` 로 파일시스템을 읽으며 테스트 실행 시 실제 디렉토리를 스캔한다. 이는 기존 동작과 동일하며, 부작용(상태 변경, 파일 생성/수정)은 없다. 읽기 전용 스캔이므로 안전.
  - 제안: 없음.

- **[INFO]** `plan/complete/exec-single-node.md` — YAML frontmatter 포맷 변경
  - 위치: `plan/complete/exec-single-node.md` frontmatter `spec_impact` 필드
  - 상세: `spec_impact` 가 인라인 문자열에서 YAML 리스트로 변경됨. 이 파일을 파싱하는 도구(플랜 라이프사이클 도구, consistency-checker 등)가 `spec_impact` 를 문자열로 기대한다면 타입 불일치가 발생할 수 있다. 단, `plan/complete/` 파일은 읽기 참조용이며 완료 상태이므로 실운영 영향은 낮다.
  - 제안: `spec_impact` 필드를 파싱하는 스크립트가 있다면 리스트 타입을 처리하는지 확인.

- **[INFO]** `review/` 문서 파일들 — 부작용 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/test-gaps-signal-paralleldepth/review/code/2026/06/20/15_02_56/RESOLUTION.md`, `SUMMARY.md`
  - 상세: 새로 생성된 리뷰 산출물 문서. 순수 마크다운이며 어떤 런타임 상태, 전역 변수, 네트워크 호출, 이벤트도 변경하지 않는다.
  - 제안: 없음.

### 요약

이번 변경 세트는 backend lint 게이트를 `--fix` 자동 수정에서 report-only 로 전환하고(`package.json`, `eslint.config.mjs`, `README.md`), 테스트 fragility를 구조 검증으로 개선하며(`plan-frontmatter.test.ts`), plan 메타데이터 포맷을 정비(`exec-single-node.md`)하는 소범위 변경이다. 전역 변수 도입, 파일시스템 쓰기, 네트워크 호출, 이벤트/콜백 변경, 환경 변수 읽기/쓰기는 전혀 없다. 유일하게 주의할 부작용은 `lint` 스크립트의 `--fix` 제거로 인한 CI/훅 동작 변화이나, 이는 의도된 설계 변경이며 `lint:fix` 로 대체 경로가 명확히 제공된다. 함수 시그니처나 공개 API 변경은 없다.

### 위험도
LOW
