# Testing Review

## 발견사항

### 파일 1 & 2: `eslint.config.mjs` + `package.json` (lint gate 변경)

- **[INFO]** `no-unnecessary-type-assertion: warn` 강등 — 테스트 파일용 룰 오버라이드 필요 여부 확인
  - 위치: `eslint.config.mjs` lines 111–120 (test override block)
  - 상세: 기존 test 파일용 override 블록(`*.spec.ts`, `*.e2e-spec.ts`, `test/**/*.ts`)은 `no-unsafe-*` 류를 off로 치환한다. `no-unnecessary-type-assertion`은 테스트 코드에서도 warn 으로 노출될 것이나, 테스트에서 mock 타입 단언(`as SomeType`)이 광범히 사용되는 경우 warn 누적이 예상된다. 현재 스펙으로는 테스트용 에러 suppressant가 없어도 warn-only이므로 빌드는 깨지지 않지만, 기존 281건 중 테스트 파일 비중이 알려지지 않아 watch 중 noise가 될 수 있다.
  - 제안: `*.spec.ts` / `*.e2e-spec.ts` override 블록에 `'@typescript-eslint/no-unnecessary-type-assertion': 'off'`를 추가하여 테스트 코드의 방어적 `as T` 단언에 의한 warn 노이즈를 명시 제거할 것을 권장한다(선택적 개선, CI 차단 아님).

- **[INFO]** `lint` 스크립트에서 `--fix` 제거 — CI 게이트 동작 변화 확인
  - 위치: `package.json` line 20 (diff 기준)
  - 상세: `.claude/test-stages.sh`의 `cmd_lint()`는 `pnpm --filter backend lint`를 직접 호출한다. 이전에는 `--fix` 가 게이트 내부에서 암묵적으로 실행되어 수정되고도 커밋되지 않는 코드가 발생했다. 변경 후 `lint` 는 report-only이므로 warn 위반이 있어도 exit code 0으로 통과된다(eslint 기본 동작 — warn은 exit 0, error만 exit 1). 이 변경이 게이트를 "느슨하게" 만드는 것인지 아니면 "의도한 report-only"인지는 주석에 명시되어 있어 이해 가능하다.
  - 제안: 테스트 목적이라면 추가 테스트 필요 없음. 다만, `no-unnecessary-type-assertion` 위반이 warn이므로 **단독으로는 lint 게이트를 통과**한다. 향후 error로 승격할 시점을 plan에 기록하면 기술 부채 추적에 유용하다.

---

### 파일 3: `plan-frontmatter.test.ts` (known-file sentinel 교체)

- **[WARNING]** hardcoded sentinel 파일명 — 파일이 `complete/`로 이동하거나 삭제되면 다시 깨짐
  - 위치: `plan-frontmatter.test.ts` line 362 (diff 기준)
  - 상세: 기존 sentinel `"knowledge-base-quality-improvements.md"` 가 `plan/complete/`로 이동되어 테스트가 깨진 것을 수정하여 `"competitive-analysis-n8n-flowise.md"` 로 교체했다. 이 패턴은 구조적으로 취약하다 — "plan 1개가 반드시 존재하는가"를 특정 파일에 묶으면, 해당 파일이 완료/삭제될 때마다 동일 패턴의 패치가 반복된다. 현재 `competitive-analysis-n8n-flowise.md`는 `plan/in-progress/`에 존재하여 단기 통과가 보장되지만, 이 파일이 `complete/`로 이동하면 다시 false-negative 실패가 발생한다.
  - 제안: sentinel 검증 로직을 특정 파일명에서 분리한다. 예를 들어, `collectTopLevelPlans`의 결과가 `> 20`인 것만 검증하고, 구체적인 "알려진 파일 존재 여부" 검사는 `plan/in-progress/0-*.md` 같은 안정적 index 파일이나 README로 대체한다. 또는, sentinel을 `"(none)" → skip` 방식으로 제거하고 count 검증만 남긴다.

- **[INFO]** `plans.length > 20` 임계값 하드코딩
  - 위치: `plan-frontmatter.test.ts` line 360
  - 상세: 현재 top-level `.md` 파일이 61개로 `> 20` 조건은 충분히 통과한다. 그러나 대규모 plan 정리(complete 이동)가 발생하면 `> 20` 이 맞지 않을 수 있다. 더 나쁜 케이스는 임계값이 너무 낮아 repoRoot가 잘못 resolve되어도 21개만 발견되면 통과한다는 점이다.
  - 제안: 임계값을 의미 있는 값(예: 현재 61개의 절반인 `> 30` 등)으로 올리거나, 주석으로 "최소 XX개 — 이 숫자가 맞지 않으면 대규모 plan 정리가 일어난 것"을 설명한다.

- **[INFO]** `worktree`, `started`, `owner` 필드 외에 `spec_impact` 필드는 검증 대상 아님
  - 위치: `plan-frontmatter.test.ts` lines 387–413 (field validation its)
  - 상세: `plan/complete/exec-single-node.md`의 `spec_impact` 필드가 문자열에서 YAML 배열로 변경되었으나, `plan-frontmatter.test.ts` 는 `spec_impact` 타입을 검증하지 않는다. `plan/complete/` 파일들은 `collectTopLevelPlans`의 스캔 범위(in-progress만)에서 제외되므로 이 변경은 테스트에 영향을 미치지 않는다 — 정상.
  - 제안: N/A (현재 설계 의도에 부합).

---

### 파일 4: `plan/complete/exec-single-node.md` (frontmatter 형식 교정)

- **[INFO]** 비-테스트 파일 변경 — 테스트 관점에서 직접 영향 없음
  - 위치: `plan/complete/exec-single-node.md` frontmatter `spec_impact` 필드
  - 상세: `complete/` 디렉토리는 `collectTopLevelPlans`의 스캔 범위 밖이다. `plan-frontmatter.test.ts` 테스트 입장에서는 이 파일 변경이 테스트 결과에 영향을 미치지 않는다. YAML 형식이 배열로 정규화된 것은 파싱 안정성을 높이는 올바른 변경이다.
  - 제안: N/A.

---

## 요약

이번 변경의 핵심은 두 가지다: (1) backend lint gate를 report-only로 전환하며 `no-unnecessary-type-assertion` warn 추가, (2) `plan-frontmatter.test.ts`의 known-file sentinel 교체. 테스트 구조 관점에서 가장 주목해야 할 점은 sentinel 파일명이 특정 plan 파일에 묶여 있어 해당 파일이 `complete/`로 이동할 때마다 동일 패치를 반복해야 하는 구조적 취약성이다. `no-unnecessary-type-assertion` warn 추가는 테스트 파일 내 방어적 타입 단언에 warn 노이즈를 유발할 가능성이 있으나 CI 차단 요인은 아니다. 전반적으로 기능 로직 변경이 없는 lint 설정 및 plan 메타데이터 정리 성격의 변경이므로 심각한 테스트 갭은 없으며, 위의 WARNING 하나가 중기적으로 반복 패치 비용을 초래할 수 있다.

## 위험도

LOW
