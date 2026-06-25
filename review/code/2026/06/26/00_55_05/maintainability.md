# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/nodes/presentation/table/table.handler.ts

- **[INFO]** 변경 자체는 식별자 rename만이며 로직 변경 없음
  - 위치: line 235(`catch (e)` → `catch (err)`), line 248(`e instanceof Error` → `err instanceof Error`)
  - 상세: `e`라는 단일 문자 변수명은 의미를 전달하지 못한다. `err`로 통일함으로써 코드베이스 전반의 catch 변수 네이밍이 일관성을 얻는다. `safeEvaluate` 함수 내 나머지 코드(PII 키 추출·로깅 패턴)는 변경 없이 잘 구조화되어 있고, 단일 책임(표현식 평가 실패 격리)을 준수한다.
  - 제안: 없음. 변경 방향이 올바르다.

- **[INFO]** `execute` 메서드 길이 (약 100줄)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m4-catch-name-ec6f44/codebase/backend/src/nodes/presentation/table/table.handler.ts` line 132–274
  - 상세: 이번 PR과 직접 관련은 없으나, `execute`가 static/dynamic 분기·정렬·페이징·config echo·버튼 분기를 한 함수 안에서 모두 처리하여 순환 복잡도가 높다. `resolveDataSource`, `resolveColumnLabels`는 이미 추출되어 있으나 `static` 행 필터링이나 정렬·페이징 블록도 내부 헬퍼로 분리할 수 있다.
  - 제안: 장기적으로 `buildStaticRows`, `buildDynamicRows`, `applySortAndPage` 등의 private 메서드로 분리 검토. 현 PR 범위 외.

### 파일 2: pnpm-lock.yaml

- **[INFO]** `eslint-plugin-unicorn@56.0.1` 도입으로 전이 의존성 12종 추가
  - 위치: pnpm-lock.yaml 내 `eslint-plugin-unicorn` 스냅샷 블록
  - 상세: `read-pkg-up@7`, `normalize-package-data@2.5`, `hosted-git-info@2.8.9`, `spdx-*`, `semver@5.7.2`, `validate-npm-package-license` 등 구형 major 패키지들이 전이 의존성으로 진입한다. 이 패키지들은 devDependency 전용이므로 런타임 영향은 없지만, lockfile 변경 비용이 다소 크다.
  - 제안: 수용 가능한 범위. commit message에 이미 v56 고정 근거(v57+ peer floor 초과)가 명시되어 있어 미래 업그레이드 시 참조 가능하다.

- **[INFO]** `resolve@1.22.12`의 `optional: true` 플래그 제거
  - 위치: pnpm-lock.yaml line ~19292 (`resolve@1.22.12` 스냅샷에서 `-    optional: true` 삭제)
  - 상세: 이전에 optional로 처리되던 `resolve` 패키지가 `eslint-plugin-unicorn`의 전이 의존(`normalize-package-data` → `resolve`)으로 필수 경로에 포함되면서 optional 플래그가 제거된다. 동작 차이가 발생할 가능성은 낮지만, 기존에 이 패키지를 optional로 표시했던 다른 의존이 있다면 잠재적 충돌이 될 수 있다.
  - 제안: 현재 CI(lint·build·unit)에서 이미 검증됐으므로 수용 가능. 추가 확인 불필요.

### ESLint 설정 (codebase/backend/eslint.config.mjs)

- **[INFO]** 규칙 SoT 주석이 코드와 나란히 배치되어 있어 가독성 우수
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m4-catch-name-ec6f44/codebase/backend/eslint.config.mjs` line 71–76
  - 상세: `'unicorn/catch-error-name'` 규칙 바로 위에 한국어 인라인 주석으로 "왜 이 룰인가", "왜 `err`인가", "왜 preset 전체가 아닌가"가 모두 설명되어 있어 유지보수 맥락을 보존한다. 향후 담당자가 규칙을 변경하거나 unicorn 버전을 올릴 때 결정 근거를 즉시 파악할 수 있다.
  - 제안: 없음. 모범 사례.

- **[INFO]** unicorn 플러그인을 별도 블록에 선언(plugins 등록)하고, 실제 규칙은 다른 블록(rules)에 위치
  - 위치: `eslint.config.mjs` line 16–20(plugins 블록), line 76(rules 블록)
  - 상세: ESLint flat config에서 plugins와 rules가 별도 블록에 있으면 "이 플러그인은 어디서 사용되는가"를 한눈에 파악하기 어렵다. 그러나 파일 전체가 짧고 주석이 충분해 현 구성에서 혼란을 일으킬 가능성은 낮다.
  - 제안: 가능하다면 unicorn plugins 선언과 `unicorn/catch-error-name` 규칙을 동일 설정 객체 안에 배치하면 응집도가 높아진다. 강제 권고 수준은 아님.

## 요약

이번 변경은 `catch` 파라미터 변수명을 `err`로 통일하는 순수 식별자 rename + ESLint 규칙 추가로 구성된다. `table.handler.ts`에서의 `e` → `err` 변경은 가독성·일관성 두 관점 모두에서 개선이다. ESLint 설정 파일은 규칙의 의도와 버전 고정 근거를 인라인 주석으로 잘 문서화하여 향후 유지보수 비용을 낮춘다. `pnpm-lock.yaml`의 전이 의존성 증가는 devDependency 범위로 런타임에 영향이 없으며, `optional` 플래그 제거도 CI 검증을 통과하여 안전하다. `execute` 메서드의 높은 복잡도는 이번 PR과 무관한 기존 부채이며 장기 개선 과제로 남긴다.

## 위험도

NONE
