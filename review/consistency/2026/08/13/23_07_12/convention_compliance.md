# 정식 규약 준수 검토 — `spec/5-system/`

## 검토 범위 확인

`diff-base=origin/main` 대비 `git diff origin/main...HEAD` 를 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, branch `claude/raw-query-audit-followups`)에서 직접 재확인했다. **`spec/5-system/**` 는 이번 diff 에 파일이 하나도 없다** (`git diff origin/main...HEAD --stat -- spec/5-system/` 출력 0줄). 변경분은 전부 코드 레벨이다:

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규) + `.spec.ts`
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (주석·기대값 갱신)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` + `.spec.ts`
- `plan/in-progress/ie-resume-turn-boundary-cancel.md`, `plan/in-progress/update-returning-tuple-shape.md`(신규)

내용은 `UPDATE`/`DELETE ... RETURNING` 이 TypeORM 0.3.31 + pg 조합에서 `[rows, rowCount]` 튜플을 반환한다는 사실을 놓쳐 7개 지점의 조건부 UPDATE 판정(`rows.length`)이 항상 같은 값으로 사문화돼 있던 버그의 수정이다. `spec/5-system/*.md` 본문·frontmatter 는 이번 라운드에 손대지 않았으므로, target 문서(spec/5-system/) 자체에 대한 명명·출력 포맷·구조·API 문서·금지항목 신규 위반은 존재하지 않는다.

## 참고 확인 — 코드 변경이 기존 spec 서술과 충돌하지 않는지

`spec/5-system/4-execution-engine.md` 는 이미 (버그 수정 전부터) admission UPDATE·`updateExecutionStatus` 의 "조건부 UPDATE `affected=0` → 종결 이벤트 발행도 함께 skip" 동작을 [node-cancellation §2.4](../../spec/conventions/node-cancellation.md) 로 링크하며 서술해 왔다 (예: L79, L1540). 이번 수정은 그 서술이 가리키는 코드 경로가 **실제로는 항상 `length>0`/`length===1` 로 평가돼 그 분기를 타지 않던** 잠복 결함을 고쳐, 코드를 spec 서술에 맞춘 것이다. 즉:

- spec 문서의 주장 자체는 변경되지 않았고 재검증도 필요 없다 (문서가 넓게 약속하고 있던 게 아니라, 코드가 그 약속을 충족하지 못하고 있었을 뿐).
- `spec/conventions/node-cancellation.md` frontmatter `code:` 는 이미 `execution-engine.service.ts` 를 포함하므로 이번 변경으로 `code:` 글로브 추가·수정 의무는 없다. 신규 공용 헬퍼 `common/utils/update-returning-rows.ts` 는 `execution-engine`/`auth`/`knowledge-base` 세 모듈에 걸친 범용 유틸이라 특정 spec 영역의 "약속된 surface" 가 아니며, [`spec-impl-evidence.md` R-1](../../spec/conventions/spec-impl-evidence.md) 의 글로브 허용 원칙상 `code:` 에 개별 등재할 의무도 없다.
- `spec-code-paths.test.ts` 가 요구하는 "`code:` 글로브 ≥1 매치" 조건은 기존 항목(`execution-engine.service.ts` 등)으로 계속 충족된다.

## 발견사항

없음 — target 문서(`spec/5-system/**`)가 이번 diff 에서 변경되지 않았고, 관련 코드 변경도 spec/conventions 의 명명·출력 포맷·문서 구조·API 문서·금지항목 규정 어느 것과도 충돌하지 않는다.

### 참고용 INFO (비차단)

- **[INFO] 버그 수정 이력의 spec 측 흔적 부재**
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1/§7.5 각주, `spec/conventions/node-cancellation.md` §6 구현 현황 표
  - 위반 규약: 없음 (conventions 문서 구조 규약 직접 위반 아님 — 참고 제안)
  - 상세: 이번 수정 전까지 `updateExecutionStatus` 의 "동시 cancel 이 이미 terminal 로 옮겼으면 종결 이벤트 skip" 분기가 실제로는 한 번도 타지 않고 있었다(admission UPDATE 도 동일). spec 문서는 이 동작을 이미 구현된 것으로 서술해 왔는데, 실제로는 이번 커밋에서야 참이 됐다.
  - 제안: 필수는 아니나, `node-cancellation.md` §6 표의 해당 행 또는 `4-execution-engine.md` Rationale 에 "2026-08-13 UPDATE RETURNING 튜플 파싱 수정으로 이 가드가 실질적으로 유효해짐" 한 줄을 남기면 향후 코드 고고학 비용을 줄인다. spec 서술 자체는 정정할 필요 없음(주장은 처음부터 옳았다).

## 요약

이번 라운드는 `spec/5-system/**` 문서를 전혀 건드리지 않은 순수 백엔드 버그 수정(PG `UPDATE/DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을 반환한다는 사실을 놓쳐 조건부 UPDATE 판정이 사문화돼 있던 결함, 7곳 중 3곳을 이번 diff 가 수정)이다. target 문서의 명명·출력 포맷·문서 구조(Overview/본문/Rationale, frontmatter `id`/`status`/`code`/`pending_plans`)·API 문서 규약·금지 패턴 어느 관점에서도 신규 위반이 없으며, 수정된 코드는 오히려 기존 spec 서술(`node-cancellation.md` §2.4, `4-execution-engine.md` §1.1/§7.5)이 이미 약속했던 동작을 실제로 충족시키는 방향이다. `spec-impl-evidence.md` 의 `code:` 글로브 매치 요건도 그대로 유지된다.

## 위험도

NONE
