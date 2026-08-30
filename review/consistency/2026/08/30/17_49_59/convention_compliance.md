# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-else-branch-transaction.md`

검토 모드: spec draft 검토 (`--spec`)

## 발견사항

- **[INFO]** 도입부에 하위 헤더가 없어 형제 `spec-draft-*` 문서 스타일과 미세하게 다름
  - target 위치: 파일 상단, `# spec draft — ...` 직후 "ai-review `17_36_15` 의 **SPEC-DRIFT 1건**..." 문단
  - 위반 규약: 정식 규약 아님 — `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3 은 "본문 끝에 `## Rationale`" 만 의무화하고 도입부 헤더는 강제하지 않음
  - 상세: 같은 폴더의 자매 문서(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)는 도입부를 `## 왜` 서브헤더로 감싸는데, 본 target 은 헤더 없이 바로 본문 문단으로 시작. 강제 규약 위반은 아니고 스타일 편차 수준.
  - 제안: 선택 사항. 굳이 고칠 필요는 없음 — 통일하고 싶으면 `## 왜` 헤더 추가.

- **[INFO]** "왜 planner 턴인가" 절이 자기-반증형 소정정 예외의 5조건 중 조건 2만 인용
  - target 위치: `## 왜 planner 턴인가` 절
  - 위반 규약: 없음 — CLAUDE.md §자기-반증형 소정정의 조건 2("예고·트리거 문장만 해당, 소급 각주는 이력 서술이라 미충족")를 정확히 인용해 결론(planner 턴 필요)은 규약과 일치
  - 상세: 다만 조건 1("대상 문장을 developer 자신이 그 문서에 썼다")도 이 케이스에서 독립적으로 실패한다 — `#1242` 의 소급 각주는 `docs(spec): ... (#1242)` 커밋으로 project-planner 가 작성했고 developer 가 쓴 문장이 아니다(`git log` 로 확인). 조건 2 하나만으로도 결론은 이미 정당하므로 규약 위반은 아니지만, 조건 1을 함께 적으면 다음 사람이 "developer 가 썼다면 조건 2만으로 예외를 시도할 수 있었을까"라는 오독 여지를 줄인다.
  - 제안: 선택 사항 — Rationale 에 "조건 1도 이 각주는 developer 저작이 아니다" 한 줄을 보태면 근거가 더 닫힌다.

## 점검 관점별 확인 결과

1. **명명 규약**: `plan/in-progress/spec-draft-<name>.md` 패턴은 `project-planner/SKILL.md` §3 이 규정한 그대로이고, 저장소 내 기존 선례(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)와도 일치. `updateExecutionStatus`/`linkedNodeExec`/else 분기 등 target 이 인용하는 식별자는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 실제 코드와 대조해 정확함(라인 8607 `if (linkedNodeExec)`, else 분기의 `dataSource.transaction` 래핑 등). 위반 없음.
2. **출력 포맷 규약**: target 은 API 응답·이벤트 payload·에러 코드 형식을 다루지 않는다 (내부 트랜잭션 경계·소급 각주 서술만). 해당 관점 자체가 적용 대상 아님.
3. **문서 구조 규약**: Overview/본문/Rationale 3섹션은 `spec/**` 문서에 적용되는 규약이며(`project-planner/SKILL.md` §Spec 문서 구조), target 은 그 대상이 아니라 `plan/in-progress/` 의 draft 문서다. draft 에 요구되는 유일한 구조 의무("본문 끝에 `## Rationale`")는 충족(파일 끝 `## Rationale` → `### 왜 이 PR 에 함께 넣나` / `### 기각한 대안 — 별도 planner PR`, `migrations.md §7`·`raw-query-results.md` 의 "### 기각한 대안 —" 패턴과 동형). Frontmatter 는 `worktree`/`started`/`owner` 필수 3필드 모두 존재하고, `spec_impact` 는 bare string 이 아니라 list 형식(Gate C 스키마)이며 가리키는 `spec/5-system/4-execution-engine.md` 는 실존 파일. 위반 없음.
4. **API 문서 규약**: target 은 OpenAPI/Swagger/DTO 관련 내용을 포함하지 않는다. 해당 관점 적용 대상 아님.
5. **금지 항목**: `spec/conventions/**` 전수에서 "금지" 키워드로 스캔한 결과, target 의 서술 영역(실행 엔진 트랜잭션 원자성)에 저촉되는 명시적 금지 패턴 없음. `raw-query-results.md`(불변식 (a): `UPDATE … RETURNING` 튜플 반환, `8332d9a20` 이 두 부호를 동시에 고쳤다는 서술)와 target 의 서술이 정확히 합치하며, `node-cancellation.md` 의 §2.4 소급 각주(같은 2026-08-30 자 시리즈)와도 사실관계가 충돌하지 않음 — target 이 수정 대상으로 지목한 각주는 `4-execution-engine.md` §1.1 소재(커밋 `5fbcd20b8` diff 로 확인)이고 `node-cancellation.md` 의 별도 각주(§2.4 3·4번째 불릿용)와는 다른 지점이라 `spec_impact` 를 `4-execution-engine.md` 하나로 좁힌 것도 정확함.

## 부가 확인 (참고, 등급 없음)

- target 이 서술하는 "else 분기를 `dataSource.transaction` 안으로 옮겼다"는 코드 변경은 현재 worktree 의 미커밋 diff(`git diff HEAD`)에 실제로 존재 — `updateExecutionStatus` else 분기가 `manager.query` 로 트랜잭션 콜백 안에 들어가 있고, 주석 "**트랜잭션으로 감싸는 이유**(`18_19_33` concurrency INFO 9)"가 target 의 "가드가 막으려던 무기한 대기가 가드가 발동한 순간에 생긴다"는 문장과 정확히 대응한다. (사실관계 검증은 본 checker 의 1차 관점은 아니나, target 이 인용하는 커밋/코드가 실재하는지는 명명·근거 규약 준수 판단에 필요해 확인함.)

## 요약

target 문서(`plan/in-progress/spec-draft-else-branch-transaction.md`)는 `plan/in-progress/spec-draft-<name>.md` 명명 규약, draft 문서의 `## Rationale` 종결 의무, `worktree`/`started`/`owner` frontmatter 3필드, `spec_impact` 리스트 스키마(Gate C) 를 모두 정확히 따른다. Overview/본문/Rationale 3섹션 규약과 API 문서(Swagger/DTO) 규약은 이 문서 유형(spec 본문이 아니라 그 변경안을 담은 plan draft)에는 애초에 적용 대상이 아니며, 출력 포맷 규약 역시 target 이 다루는 내용(내부 트랜잭션 원자성 서술)과 무관하다. `spec/conventions/raw-query-results.md`·`node-cancellation.md`·실제 커밋 이력(`5fbcd20b8`, 진행 중 `1a12088f2` 관련 미커밋 diff)과 대조해도 target 이 인용하는 사실·식별자·수정 지점이 모두 정확해 정식 규약을 위반하는 지점을 찾지 못했다. 발견한 두 건은 모두 INFO 수준의 선택적 스타일 제안이다.

## 위험도

NONE
