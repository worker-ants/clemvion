# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** `npm run lint` / `npm install` 등 README 전체가 pnpm 전환 이전의 `npm` 명령 기반으로 남아 있음
  - 위치: README.md lines 7–9 (실행 섹션), 스크립트 표 전체
  - 상세: 이번 변경이 `lint` 행과 `lint:fix` 행을 정확하게 반영했으나, 동일 파일의 `npm install`, `npm run start:dev` 등은 pnpm 전환(PR #646) 미반영 상태. RESOLUTION.md INFO #7 에서 "별도 처리" 로 보류한 것과 일치하며 본 변경의 의도(lint 스크립트 표 정정)는 완전히 달성됨.
  - 제안: 별도 PR 에서 전수 `npm` → `pnpm` 교체 (본 변경 범위 외, 차단 요인 없음)

### 파일 2: codebase/backend/eslint.config.mjs

- **[INFO]** `no-unnecessary-type-assertion: warn` 이 프로덕션 코드에만 적용되고 테스트 override 에서 `off` 처리된 구조는 의도에 부합함
  - 위치: eslint.config.mjs lines 184–190 (프로덕션), lines 215–217 (테스트 override)
  - 상세: 주석에 281건 누적 배경과 `--fix` cascade 이유가 명시돼 있어 의도가 명확함. `error` → `warn` 전환 후 `--fix` 없이 report-only 게이트로 전환한 것은 다른 패키지와의 일관성을 맞추는 의도적 정책 변경.
  - 제안: 없음

- **[INFO]** spec/conventions 에 ESLint 게이트 정책(report-only vs. error)을 명세하는 문서가 없음
  - 위치: 변경 전반 (eslint.config.mjs, package.json `lint` 스크립트)
  - 상세: `spec/` 어느 문서도 backend lint 게이트의 `--fix` 포함 여부·severity level 을 정의하지 않는다. 코드 변경이 spec 위반인지 판단할 수 있는 spec 본문 없음 → INFO (spec 누락, 코드 버그 아님).
  - 제안: 해당 없음 (코드 유지). 필요 시 `spec/conventions/` 에 lint gate 정책 명세 추가는 `project-planner` 위임.

### 파일 3: codebase/backend/package.json

- **[INFO]** `lint` 스크립트에서 `--fix` 제거, `lint:fix` 신규 추가 구조는 기능 완전성 충족
  - 위치: package.json `scripts.lint`, `scripts.lint:fix`
  - 상세: 두 스크립트 모두 동일한 glob(`{src,apps,libs,test}/**/*.ts`)를 대상으로 하며 의미 분리가 정확함. CI/CD 에서 `lint` 가 report-only 로 전환됨에 따라 기존에 `--fix` 가 자동 수정하던 사이드이펙트(커밋 미포함 파일 수정)가 제거됨 — 명시된 목표와 일치.
  - 제안: 없음

### 파일 4: codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts

- **[INFO]** 특정 파일명(`knowledge-base-quality-improvements.md`) 하드코딩 제거 후 구조 검증으로 대체한 것은 요구사항 충족
  - 위치: plan-frontmatter.test.ts lines 403–411 (변경 후)
  - 상세: `plans.every(p => p.endsWith('.md') && p.includes('plan/in-progress/'))` 검증은 `collectTopLevelPlans` 함수의 path 조합 로직을 검증하는 구조적 sanity check. `collectTopLevelPlans` 가 절대경로를 반환하므로 `path.sep` 사용이 정확함(cross-platform). 현재 in-progress 파일 수 = 61개로 임계값 `> 20` 은 여유롭게 충족.
  - 제안: 없음 (임계값 강화는 INFO 수준, 차단 요인 아님)

- **[INFO]** `plans.length > 20` 임계값은 vacuous pass 방어로 충분하나, 대규모 plan 정리 시 취약해질 수 있음
  - 위치: plan-frontmatter.test.ts line 469
  - 상세: 현재 61개이므로 단기 위험 없음. 장기적으로 plan 이 대규모 정리되면 임계값이 무의미해질 수 있음.
  - 제안: 임계값을 `> 30` 으로 상향하거나 주석에 의도(스캔 디렉토리 오판 방어) 명시 (선택적, 차단 아님)

### 파일 5: plan/complete/exec-single-node.md

- **[INFO] [SPEC-DRIFT]** `spec_impact` YAML 리스트에서 섹션 참조(`§1.3·§9·R` 등)를 제거하고 파일 경로만 남긴 변경은 코드가 올바르고 spec 이 낡음
  - 위치: plan/complete/exec-single-node.md frontmatter `spec_impact`; `.claude/docs/plan-lifecycle.md §5 Gate C`
  - 상세: `plan-lifecycle.md §5 Gate C` 예시(line 68)는 `- spec/5-system/4-execution-engine.md` 형식(파일 경로만)을 보여주며, 이전 값(`spec/3-workflow-editor/3-execution.md §1.3·§9·R`)은 섹션 참조를 포함해 형식이 예시와 불일치했음. 변경 후 파일 경로만 남긴 것이 spec 예시와 일치하는 올바른 형식이나, spec 은 "섹션 참조 불포함 필수"를 명시하지 않아 침묵 상태 → SPEC-DRIFT.
  - 제안: 코드 유지. `project-planner` 가 `plan-lifecycle.md §5 Gate C`(line 67–69)에 "리스트 항목은 실존 파일 경로만 허용, 섹션 참조(`§N`) 불포함"을 명시하도록 spec 갱신 위임.

### 파일 6: review/code/2026/06/20/15_02_56/RESOLUTION.md (신규)
### 파일 7: review/code/2026/06/20/15_02_56/SUMMARY.md (신규)

- **[INFO]** RESOLUTION 과 SUMMARY 는 이전 리뷰 산출물로, 요구사항 관점의 분석 대상 코드가 아님
  - 위치: review/ 하위 두 파일
  - 상세: RESOLUTION 의 조치 항목(WARNING #1, #2, INFO #5)이 실제 코드 변경(파일 1~4)에 정확히 반영됐음을 확인. 보류 항목(WARNING #3, INFO #1/#7)도 범위 내 미조치 근거가 명확히 기술됨.
  - 제안: 없음

---

## 요약

이번 변경의 핵심 의도는 backend lint 게이트를 `--fix` 포함에서 report-only 로 전환하고, 그에 따른 README 문서 갱신과 테스트 fragility 수정이다. 세 핵심 변경(package.json 스크립트 분리, eslint.config.mjs 규칙 추가, README 스크립트 표 갱신)은 선언된 목적을 완전히 달성하며 에러 시나리오나 엣지 케이스가 존재하는 성격의 변경이 아니다. 테스트 코드 개선(파일명 하드코딩 → 구조 검증)도 올바르게 구현됐다. SPEC-DRIFT 1건(`plan-lifecycle.md §5 Gate C` 의 `spec_impact` 섹션 참조 허용 여부 침묵)은 코드가 옳고 spec 이 낡은 케이스로, 코드 버그 없음. Critical 발견 0건.

---

## 위험도

LOW
