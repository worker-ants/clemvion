# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-path-guard-oracle-census.md`

## 검토 범위 메모

- target 은 `spec/data-flow/12-workspace.md` §Rationale 두 문장에 대한 **취소선 정정**을 제안하는 plan draft(`--spec` 모드)다. 실제 `spec/` 파일을 아직 건드리지 않은 사전 검토 단계.
- 번들에 완전 포함된 정식 규약은 `spec/conventions/error-codes.md` 하나뿐이다. 나머지(swagger.md, node-output.md, cafe24-*, makeshop-*, migrations.md, secret-store.md 등)는 컨텍스트 예산 초과로 절단되어 있다. 다만 target 내용(워크스페이스 인가 오라클 관련 spec Rationale 정정)은 Swagger 데코레이터·cafe24/makeshop 카탈로그·마이그레이션·secret-store 와 직접 접점이 없어, 절단된 규약들이 이 target 판정에 실질적으로 관여하지 않는다고 판단했다.

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 찾지 못했다.

### 참고용 확인 사항 (비-위반, 교차검증만)

- **에러 코드 명명**: target 이 언급하는 `CANNOT_TRANSFER_PERSONAL`·`OWNER_REQUIRED`(및 인접 커밋의 `NOT_A_MEMBER`)는 `error-codes.md §1`의 "의미 기반 명명 + UPPER_SNAKE_CASE" 원칙에 부합한다(조건의 의미를 그대로 기술, 구현 세부 없음). 이 코드들은 `error-codes.md §3`(historical-artifact 예외 레지스트리)·`§5`(rename 이력) 어디에도 등재돼 있지 않지만, target 은 이 코드들을 **신설·rename 하는 문서가 아니라** 이미 구현·커밋된(`1f616ef05`) 코드를 spec 서술에 반영하는 사후 정정이므로 레지스트리 갱신 의무가 이 target 문서 자체에 발생하지 않는다. (레지스트리 등재 필요 여부는 `spec/data-flow/12-workspace.md` 본문/§1.x 쪽의 문제이지 이 오라클-census 정정문의 범위 밖이다.)
- **문서 구조 (Overview/본문/Rationale)**: target 은 도입 단락(사실상 Overview 역할) → `## 변경 — …` (본문) → `## Rationale` 3단 구성을 갖추고 있어 CLAUDE.md 가 spec 문서에 권장하는 구조와 형태상 부합한다. 다만 이 권장은 명시적으로 "Spec 문서" 대상이고 target 은 `plan/in-progress/` 소속 plan draft 라 엄밀히는 강제 대상이 아니다 — 위반이 아니라 대상 외(out-of-scope) 사안.
- **frontmatter**: `worktree: workspace-path-guard` 가 실제 작업 디렉터리(`.claude/worktrees/workspace-path-guard`)와 일치, `spec_impact` 가 실재 경로(`spec/data-flow/12-workspace.md`) 단일 항목 리스트로 정상 기재. `spec/conventions/**` 소관은 아니나 CLAUDE.md 표와 교차 확인해 이상 없음.
- **정정 표기 관행(취소선 + "(YYYY-MM-DD 정정)" 각주)**: target Rationale 은 이 관행이 "같은 절이 이미 쓰는" 기존 선례를 따른 것이라고 스스로 근거를 대고 있다. 이 패턴 자체를 강제하는 spec/conventions 문서를 번들 내에서 확인하지 못했으나(절단된 파일들에 있을 가능성 있음), 강제 규약 위반이 아니라 문서 내부 일관성 차원의 선택이라 CRITICAL/WARNING 사유가 되지 않는다.

## 요약

target 은 `spec/data-flow/12-workspace.md` Rationale 의 오라클 실측치를 "두 메서드→세 메서드"로 좁게 정정하는 plan draft이며, 원문을 취소선으로 보존하고 정정 근거·실측(RED 6 → GREEN, 커밋 해시)을 함께 기록하는 방식을 취하고 있다. 완전히 로드된 `error-codes.md` 규약과 대조했을 때 명명·안정성 정책 위반이 없고, 문서 구조도 CLAUDE.md 가 권장하는 형태(비록 강제 대상은 아니지만)를 자연스럽게 따르고 있다. 절단되어 검토하지 못한 다수의 conventions 파일은 target 의 실제 내용(워크스페이스 인가 오라클)과 접점이 없어 판정에 영향을 주지 않는다고 판단된다. 정식 규약 준수 관점에서 이 target 문서는 문제가 없다.

## 위험도

NONE
