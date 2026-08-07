# Cross-Spec 일관성 검토 — target: `spec/4-nodes`

## 절차 관련 사전 경고 (검토 유효성에 영향)

- 이 호출은 `--impl-done`(scope=`spec/4-nodes`, diff-base=`origin/main`) 모드였지만, 프롬프트에 포함되어야 할 `## 구현 변경 사항` diff 섹션이 **컨텍스트 예산 초과로 실제로는 비어 있었다** (프롬프트 내 "생략된 파일" 목록에 `<git diff origin/main...HEAD -- code_areas>` 자체가 항목으로 나열됨 — 즉 diff 본문이 통째로 누락).
- 직접 확인한 결과, 이 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379`)는 현재 **`claude/packages-prepare-stale-dist` 브랜치**(폴더 slug `harness-review-ci-backstop-91f379` 와 무관한 다른 작업)에 있고, `git diff origin/main...HEAD -- spec/` 결과가 **완전히 비어 있다**. `spec/4-nodes/0-overview.md` 등 target 파일들의 마지막 커밋은 2026-07-08(`72e3193f7` 등)로, 이번 세션에서 변경된 바가 없다.
- 즉 이번 호출의 "target 문서(draft)"는 실제로는 **새 diff 가 전혀 없는, 이미 origin/main 과 동일한 기존 spec**이다. 이는 사용자 메모리에 기록된 "worktree 재사용/병렬 세션 충돌 → 델타 0" 패턴과 일치한다.
- 아래 발견사항은 이 전제 하에 — 즉 "신규 변경분의 충돌 검사"가 아니라 "현재 `spec/4-nodes` 스냅샷과 다른 spec 영역 간의 기존 정합성 스팟체크"로 — 이해해야 한다. Critical 신규 리스크는 없다(애초에 신규 변경이 없으므로).

---

## 발견사항

- **[INFO]** impl-done 리뷰이지만 target 에 대한 diff 가 0 — 워크트리가 다른 작업으로 재사용된 것으로 보임
  - target 위치: 프롬프트 헤더 `## 검토 모드` (`--impl-done, scope=spec/4-nodes, diff-base=origin/main`)
  - 충돌 대상: 워크트리 실제 상태 (`git branch`, `git diff origin/main...HEAD -- spec/`)
  - 상세: 위 "절차 관련 사전 경고" 참조. 현재 체크아웃 브랜치는 `claude/packages-prepare-stale-dist`이며 이 브랜치의 diff(28 files)는 `.claude/tests/`, `.github/workflows/`, `codebase/packages/*/package.json`, `review/code/**` 만 건드리고 `spec/4-nodes/**` 는 전혀 건드리지 않는다. `spec/4-nodes` 자체도 origin/main 대비 무변경.
  - 제안: orchestrator 는 이 호출을 올바른(spec/4-nodes 를 실제로 변경한) 브랜치/워크트리에서 재실행하거나, 델타가 정말 0 이라면 이번 cross-spec 라운드를 폐기하고 재트리거하지 말 것.

- **[WARNING]** `spec/1-data-model.md` §2.6 Node "Node.type 전체 목록" 표에 `trigger` 카테고리(`manual_trigger`) 행이 누락
  - target 위치: `spec/4-nodes/0-overview.md` §2.0 "Trigger 노드 (1종)", §1.2 "category: `trigger`/`logic`/`flow`/`ai`/`integration`/`data`/`presentation`" — trigger 를 7개 카테고리 중 하나이자 실제 노드 타입(`manual_trigger`)을 가진 정식 카테고리로 정의. `spec/4-nodes/7-trigger/0-common.md` · `1-manual-trigger.md` 도 `manual_trigger` 를 Node.type 값으로 전제.
  - 충돌 대상: `spec/1-data-model.md` §2.6 Node, "**Node.type 전체 목록**" 표 (`spec/1-data-model.md:171-202`)
  - 상세: 같은 §2.6 안에서 `category` 필드 설명은 "trigger / logic / flow / ai / integration / data / presentation (7종 — `trigger` 는 V003 에서 추가, Manual Trigger 시작 노드용)"이라고 명시하고, 바로 아래 제약 조건 목록에서도 "트리거 카테고리 노드(`manual_trigger` 등)는 `container_id`를 가질 수 없음"이라며 `manual_trigger` 를 실존 타입처럼 인용한다. 그런데 바로 다음 "Node.type 전체 목록" 표는 `logic`(12) → `flow`(1) → `ai`(3) → `integration`(5) → `data`(2) → `presentation`(5) 순으로 28개 행만 나열하고 **trigger 카테고리 행(`trigger | manual_trigger | ...`)이 없다**. `spec/4-nodes/0-overview.md` 의 노드 총 개수(1+12+1+3+5+2+5=29종)와 맞춰보면 정확히 1행(trigger)이 빠진 것 — 이 표 자체가 "전체 목록"이라 자칭하므로 데이터 모델 SoT 로서 불완전하다.
  - 제안: `spec/1-data-model.md` §2.6 표에 `| trigger | manual_trigger | 워크플로우 시작 트리거 |` 행을 추가해 `spec/4-nodes/0-overview.md`·`7-trigger/*` 와 개수·카테고리를 맞출 것 (project-planner 소관, `spec/1-data-model.md` 갱신).

---

## 요약

이번 호출은 `spec/4-nodes` 를 target 으로 한 impl-done cross-spec 검토였지만, 실측 결과 이 워크트리는 해당 task 와 무관한 다른 브랜치(`claude/packages-prepare-stale-dist`)로 재사용되어 있었고 `spec/4-nodes` 는 `origin/main` 대비 실제 diff 가 0 이었다(프롬프트의 diff 섹션도 컨텍스트 예산 초과로 실제 내용 없이 생략 표시만 있었음) — 즉 검사 대상 "변경분" 자체가 존재하지 않는다. 이런 전제 하에서도 현재 스냅샷 기준으로 target(`spec/4-nodes`: overview·logic 카테고리 공통·개별 노드 문서)과 인접 영역(`spec/1-data-model.md` Node/Edge, `spec/3-workflow-editor/1-node-common.md` 포트·에러처리·auto-form 규약, `spec/5-system/4-execution-engine.md` 컨테이너/에러정책, `spec/0-overview.md` 시스템 아키텍처, `spec/conventions/node-output.md` 5필드 Principle)을 스팟체크했다. 포트 모델, 에러 처리 2-레이어(`config.errorPolicy` vs `config.errorHandling.policy`) 구분, 컨테이너 오버라이트 컨트랙트, Node/Edge 엔티티 정의, 카테고리 enum 등은 서로 잘 정렬되어 있고 다수의 과거 spec-drift 결정이 Rationale 로 문서화되어 있어 CRITICAL 급 모순은 발견되지 않았다. 유일한 실질 콘텐츠 이슈는 `spec/1-data-model.md` 의 Node.type "전체 목록" 표에서 trigger/`manual_trigger` 행이 누락된 기존(이번 세션 무관) 문서 불완전성이다.

## 위험도
LOW
