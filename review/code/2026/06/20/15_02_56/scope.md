# 변경 범위(Scope) Review

## 발견사항

### [INFO] eslint.config.mjs — 신규 규칙 추가 및 상세 주석
- 위치: `codebase/backend/eslint.config.mjs` +7줄 (라인 88~94)
- 상세: `@typescript-eslint/no-unnecessary-type-assertion` 규칙을 `'warn'`으로 추가하고, 이유를 5줄 주석으로 설명. 주석 내용은 `lint` 스크립트에서 `--fix`를 제거한 결정의 배경(281건 누적, orphan import cascade 방지)을 직접 설명. package.json 의 `lint` / `lint:fix` 분리와 직접 연동되는 변경이므로 scope 내 변경으로 판단.
- 제안: 수용. 주석이 길지만 비직관적인 설계 결정(warn-only, --fix 제거)의 근거를 명시하므로 유지 적절.

### [INFO] package.json — `lint` 스크립트 분리
- 위치: `codebase/backend/package.json` 라인 171~172
- 상세: `"lint"` 에서 `--fix` 제거 후 `"lint:fix"` 신규 추가. 다른 패키지와의 일관성(report-only 게이트) 목적. eslint.config.mjs 의 `no-unnecessary-type-assertion: warn` 추가와 직결되어 있어 동일 작업 범위 내 변경.
- 제안: 수용. 단순 스크립트 분리이며 기능 동작 변경 없음.

### [INFO] plan-frontmatter.test.ts — 앵커 파일명 교체
- 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 라인 301
- 상세: `"knowledge-base-quality-improvements.md"` → `"competitive-analysis-n8n-flowise.md"` 로 교체. 테스트 목적은 `plan/in-progress/` 스캔이 정상 동작하는지 확인하는 앵커 파일명 검증. 이전 파일이 `plan/complete/`로 이동되어 앵커가 존재하지 않게 된 상황에서 현존 파일로 교체하는 것은 테스트 유지보수 범위 내.
- 제안: 수용. 테스트 동작 보정 목적의 최소 변경.

### [INFO] plan/complete/exec-single-node.md — frontmatter `spec_impact` 형식 변경
- 위치: `plan/complete/exec-single-node.md` 라인 4~7
- 상세: `spec_impact` 필드가 인라인 문자열(`"spec/... §1.3·§9·R; ..."`)에서 YAML 리스트(`- spec/...` 3개 항목)로 변환. 세부 섹션 참조(`§1.3·§9·R`, `§15(C3)`, `§2.13`)는 제거됨. 이 변경의 목적이 무엇인지 diff 컨텍스트에 설명 없음. `plan/complete/` 파일이므로 완료 기록의 소급 수정이며, 기능 영향은 없으나 이미 완료·머지된 파일의 정보 손실에 해당.
- 제안: WARNING 수준 검토 권고. 완료 plan 의 `spec_impact` 세부 섹션 정보(§1.3·§9·R / §15(C3) / §2.13)가 리스트 변환 시 누락됨. 만약 schema validator 나 lint 가 이 형식을 요구한다면 변경 의도가 명확하지만, 변경 배경 주석이 없어 의도 불명. 현재 작업의 주요 목적(eslint 게이트 수정)과 직접 관련 없는 파일 수정임.

## 요약

전체 4개 파일 변경 중 3개(eslint.config.mjs, package.json, plan-frontmatter.test.ts)는 lint 게이트 report-only 전환이라는 단일 목적과 직접 연결된 최소 범위 변경이다. `plan/complete/exec-single-node.md`의 `spec_impact` 형식 변환은 현재 작업 목적과 직접 관련이 없는 완료 파일의 소급 수정이며, 세부 섹션 참조 정보가 삭제되어 정보 손실이 발생한다. 나머지 변경에서 불필요한 리팩토링·기능 확장·임포트 변경·포맷팅 혼입은 발견되지 않았다.

## 위험도

LOW
