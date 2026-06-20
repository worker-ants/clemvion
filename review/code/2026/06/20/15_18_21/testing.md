# Testing 리뷰 결과

## 발견사항

### [INFO] plan-frontmatter.test.ts — `plans.length > 20` 임계값 경직성
- **위치**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` line 468
- **상세**: 현재 임계값 `> 20`은 현재 파일 수(61개)와 여유가 있지만, 대규모 plan complete 이동 시 vacuous pass 방어가 약화될 수 있다. 이 임계값의 선택 근거가 주석에 명시되지 않아 의도 파악이 어렵다.
- **제안**: `> 30` 으로 상향하거나 "현재 active plan 최소 보장 수" 의도를 주석으로 명시.

### [INFO] plan-frontmatter.test.ts — 구조 검증 교체의 개선 적절성 확인
- **위치**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` lines 472–479
- **상세**: 이번 변경은 특정 파일명 하드코딩(`knowledge-base-quality-improvements.md`)을 제거하고, discovery가 `plan/in-progress/` 하위의 `.md` 파일만 반환하는지 검증하는 방식으로 교체했다. 이는 테스트의 fragility 문제를 올바르게 해결한다. `every()` 검증은 `plans`가 비어 있을 때도 `true`를 반환(vacuous truth)하지만, 앞선 `plans.length > 20` 가드가 이를 막으므로 실질적 위험 없음.
- **제안**: 추가 조치 불필요. 현행 구조 유지.

### [INFO] eslint.config.mjs — 테스트 파일 override에 `no-unnecessary-type-assertion: off` 추가
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs` lines 214–216
- **상세**: 테스트 더블·방어적 캐스트(`as T`)가 spec 파일에 흔하게 등장해 warn 노이즈 유발 가능성이 있었다. 이 변경은 `*.spec.ts`/`*.e2e-spec.ts`/`test/**/*.ts` override 블록에만 `off`를 적용하고, 프로덕션 코드(`warn`)는 유지한다. 범위 분리가 적절하다.
- **제안**: 추가 조치 불필요.

### [INFO] eslint.config.mjs — lint gate 변경이 기존 테스트 커버리지에 미치는 영향
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs`, `/Volumes/project/private/clemvion/codebase/backend/package.json`
- **상세**: `lint` 스크립트가 `--fix` 포함 → report-only 로 전환되었다. 이전에는 `lint` 실행이 자동 수정을 수행했기에 CI/pre-commit hook에서 `lint` 를 게이트로 사용했다면 이 변경으로 동작이 달라진다. `no-unnecessary-type-assertion`이 `warn`으로 추가되어 281건의 기존 위반이 경고로 가시화된다. 이 위반들이 테스트 코드에는 영향 없으나, 프로덕션 코드에서 warn 축적이 향후 에러 승격 시 테스트 실패로 연결될 수 있다.
- **제안**: RESOLUTION에 기록된 대로 `pnpm --filter backend lint:fix`로 281건 정리 백로그를 별도 추적하는 것이 바람직하다.

## 요약

이번 변경의 핵심 테스트 관련 수정은 `plan-frontmatter.test.ts`에서 특정 파일명 하드코딩을 제거하고 구조적 검증(경로 패턴 + `.md` 확장자)으로 대체한 것이다. 이 교체는 선행 리뷰(WARNING #1)에서 지적된 fragility를 올바르게 해소한다. `every()` vacuous truth 위험은 `plans.length > 20` 가드로 방어되어 실질적 문제 없음. ESLint config의 테스트 파일 override(`no-unnecessary-type-assertion: off`) 추가도 프로덕션 규칙과의 범위 분리가 적절히 이루어졌다. 임계값 `> 20`의 선택 근거 주석 부재와 프로덕션 코드 내 281건 warn 축적 백로그가 경미한 개선 여지로 남아 있으나, 모두 비차단 수준이다.

## 위험도

LOW
