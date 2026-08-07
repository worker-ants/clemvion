# 신규 식별자 충돌 검토 — spec/4-nodes (--impl-done)

## 검토 전 확인: diff-base 정합성

본 검토를 시작하기 전, target 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379`)에서 `origin/main...HEAD` 실제 diff 를 절대경로 `git -C` 로 직접 확인했다:

```
$ git -C ".../harness-review-ci-backstop-91f379" diff origin/main...HEAD --stat
.claude/tests/README.md                            |   1 +
.claude/tests/test_packages_prepare_contract.py    | 216 ++++++++++
.github/workflows/harness-checks.yml               |   5 +
codebase/packages/*/package.json (7개)             |   각 2 +-  (버전 bump 뿐)
review/code/2026/08/06/18_55_02/*  (직전 코드 리뷰 산출물, 신규 추가)
28 files changed, 966 insertions(+), 7 deletions(-)
```

`spec/4-nodes/**` 및 `codebase/backend/src/nodes/**` 어느 쪽도 이 diff 에 **전혀 등장하지 않는다**. 추가로 확인:

- `git log -1 --format=%H -- spec/4-nodes` → `dc81d21c9b7f59d242e1bb7ccbecb4cfda64a5a4`
- 이 커밋이 `origin/main` 의 조상인지 확인 → `git merge-base --is-ancestor dc81d21c9... origin/main` → **YES**

즉 `spec/4-nodes` 는 이 워크트리의 HEAD 와 `origin/main` 사이에서 **단 한 줄도 변경되지 않았다**. 이 워크트리는 현재 `claude/packages-prepare-stale-dist` 브랜치(harness CI 백스톱 / packages prepare 관련 작업)에 있으며, `spec/4-nodes` 작업과는 무관하다.

프롬프트가 첨부한 `spec/4-nodes` 전체 번들(0-overview, 1-logic/0-common, 1-if-else, 2-switch, 3-loop, 4-variable-declaration, 5-variable-modification, 7-map, 8-filter, 9-foreach 등)은 diff 의 `+` 라인이 아니라 **변경 없는 기존 spec 본문 전체**다. 프롬프트 말미의 "컨텍스트 예산 초과로 생략된 파일 33개" 목록에는 실제 코드 diff 자리에 `<git diff origin/main...HEAD -- code_areas>` 라는 **미치환 placeholder 문자열**이 그대로 들어 있다 — orchestrator 가 diff 산출 단계에서 실패했거나 placeholder 를 채우지 않은 채 payload 를 조립한 것으로 보인다.

**결론**: 이 naming_collision 검토 요청은 실제 target 변경사항과 매칭되는 diff 가 없는 상태로 조립되었다. "target 문서가 새로 도입하는 식별자"가 이 changeset 안에 존재하지 않으므로, 본 관점(신규 식별자 충돌)에서 보고할 CRITICAL/WARNING 대상이 원천적으로 없다.

## 발견사항

- **[WARNING]** 검토 요청 scope 와 실제 diff 불일치 (신규 식별자 없음)
  - target 신규 식별자: 없음 — `spec/4-nodes` 는 `origin/main` 대비 무변경
  - 기존 사용처: N/A. 참고로 diff 에 실제 등장하는 변경은 `.claude/tests/test_packages_prepare_contract.py`(신규), `.github/workflows/harness-checks.yml`, `codebase/packages/*/package.json` 버전 bump, `review/code/2026/08/06/18_55_02/**`(직전 코드 리뷰 산출물) 뿐이며 이들은 `spec/4-nodes` 영역과 무관하다
  - 상세: 프롬프트의 `## Target 문서` 섹션이 `spec/4-nodes` 전체를 "번들"로 첨부했지만 이는 diff 가 아니라 현재(=origin/main 과 동일한) 상태의 전문이다. 실제 diff 자리에는 `<git diff origin/main...HEAD -- code_areas>` 미치환 placeholder 가 남아 있다. 이 상태로 "신규 식별자 충돌"을 판정하면 무변경 기존 콘텐츠를 신규로 오인해 오탐(false positive)을 만들거나, 반대로 진짜 신규 변경(다른 세션에서 이미 진행 중일 수 있는 spec/4-nodes 작업)을 놓치는 거짓 음성을 만들 위험이 있다.
  - 제안: orchestrator 에게 diff-base 재계산을 요청. `code_areas` placeholder 가 실제로 치환되지 않은 근본 원인(빈 diff를 빈 문자열로 접었어야 했는데 리터럴 문자열이 남음, 혹은 diff 산출 파이프라인 오류)을 별도로 조사할 것을 권장. 이 요청이 다른 task/브랜치(원래 `spec/4-nodes` 를 다루던 세션)의 잔존 payload 가 이 워크트리에 잘못 라우팅된 것인지도 확인 필요.

## 보충: 번들 본문(무변경 기존 콘텐츠) 자체 감사

위 사유로 "신규" 관점의 검토는 성립하지 않지만, 첨부된 기존 spec/4-nodes 본문 자체에 명백한 식별자 충돌이 있는지 best-effort 로 훑었다(§Rationale 절 등). 발견된 사항은 없다 — 오히려 `0-overview.md §Rationale "동적 포트 ID 모델"` 은 과거 존재했던 UUID-vs-slug 서술 불일치(§1.3 옛 서술 "UUID v4 는 사용하지 않는다" vs 실제 구현)를 이미 2026-06-20 자로 정정·일원화해 문서에 반영한 상태였다. 이는 이번 diff 와 무관한 과거 정정이며 현재도 유효하다.

## 요약

이번 naming_collision 검토는 target 으로 지정된 `spec/4-nodes` 가 `origin/main` 대비 **실제로는 아무 것도 변경하지 않았음**을 절대경로 `git -C` 로 확인했다(마지막 관련 커밋 `dc81d21c9` 는 이미 `origin/main` 의 조상). 프롬프트에 첨부된 대용량 번들은 diff 가 아니라 기존 spec 전문이며, 실제 코드 diff 자리는 미치환 placeholder 로 남아 있다. 따라서 "신규 식별자가 기존 사용처와 충돌하는가"라는 본 관점에서 판정할 대상 자체가 없다 — 새로 도입된 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·파일 경로가 이 changeset 에 없다. 이 결과를 신뢰성 있는 PASS 로 소비하기 전에 orchestrator 는 diff-base/scope 계산 로직을 먼저 재확인해야 한다.

## 위험도
NONE
