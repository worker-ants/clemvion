#!/usr/bin/env bash
#
# required status check 와 `paths:` 필터의 데드락을 피하기 위한 변경 경로 판정.
#
# ## 왜 필요한가
#
# GitHub 의 required check 는 "그 이름의 체크가 보고될 때까지" 기다린다. 그런데 워크플로에
# `on.pull_request.paths` 필터가 걸려 있으면 무관한 PR 에서는 워크플로가 **아예 실행되지
# 않고**, 실행이 없으면 보고도 없다 — 실패가 아니라 **영원한 대기**(`Expected — Waiting for
# status to be reported`)로 남아 머지가 막힌다.
#
# 그래서 `paths:` 필터를 **워크플로에서 걷어내고**(항상 실행) 이 스크립트가 관련성을 판정한다.
# 무관하면 잡의 실제 스텝들이 `if:` 로 건너뛰어지되 **잡 자체는 success 로 보고**되므로
# required check 가 정상 통과한다.
#
# > **잡 전체를 `if:` 로 skip 하지 않는 이유**: skip 된 잡의 conclusion 은 `skipped` 이고,
# > 그것이 required check 를 만족하는지는 문서상 모호하다. 그 모호함에 기대면 이 스크립트가
# > 없애려는 데드락이 그대로 재발할 수 있어, **잡은 항상 돌리고 스텝만 게이팅**한다.
#
# ## 사용
#
#   scripts/ci-paths-changed.sh 'codebase/frontend/**' 'pnpm-lock.yaml'
#
# `$GITHUB_OUTPUT` 에 `relevant=true|false` 를 쓴다. 글롭은 **git pathspec** 으로 해석된다.
#
# ## fail-safe 방향
#
# 판정이 불확실하면 **항상 `true`**(= 실제 검사를 돌린다). 조용히 건너뛰는 쪽이 아니라
# 불필요하게 도는 쪽으로 기울인다 — 이 저장소가 반복해서 데인 것이 "게이트가 조용히 안 도는"
# 실패다(Actions 12주 비활성, harness-checks paths 갭 6회 등).
#
# 불확실한 경우: schedule/workflow_dispatch(비교할 diff 없음) · base SHA 부재 ·
# 얕은 클론으로 merge-base 계산 실패 · git 실패.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <pathspec> [pathspec...]" >&2
  exit 2
fi

emit() {
  echo "relevant=$1" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  echo "relevant=$1"
}

# 이벤트별 비교 기준.
#
# - pull_request : base…head (merge-base 로 정규화)
# - push         : before…after. 종전 `on.push.paths` 필터가 하던 일을 대신한다 —
#                  넘겨주지 않으면 main 으로의 **모든** push(문서·plan 머지 포함)가
#                  전체 잡을 돌려 목적 범위를 넘는 광역화가 된다(ai-review W4).
#                  first push·force-push 는 before 가 0으로 채워져 오는데, 그때는
#                  비교 기준이 없으므로 fail-safe 로 떨어진다.
# - 그 외        : schedule·workflow_dispatch 등 — 비교 대상 자체가 없다 → 돌린다.
case "${GITHUB_EVENT_NAME:-}" in
  pull_request)
    BASE_SHA="${PR_BASE_SHA:-}"
    HEAD_SHA="${PR_HEAD_SHA:-}"
    ;;
  push)
    BASE_SHA="${PUSH_BEFORE_SHA:-}"
    HEAD_SHA="${PUSH_AFTER_SHA:-}"
    # all-zero 는 "부모 없음"(브랜치 신규 생성) 신호다.
    if [[ "$BASE_SHA" =~ ^0+$ ]]; then
      echo "!! push before=0…0 (신규 브랜치) — 검사를 수행한다(fail-safe)."
      emit true
      exit 0
    fi
    ;;
  *)
    echo "!! event=${GITHUB_EVENT_NAME:-unknown} — diff 비교 대상이 없어 검사를 수행한다(fail-safe)."
    emit true
    exit 0
    ;;
esac

if [[ -z "$BASE_SHA" || -z "$HEAD_SHA" ]]; then
  echo "!! base/head SHA 를 받지 못했다 — 검사를 수행한다(fail-safe)."
  emit true
  exit 0
fi

# base 가 조상이 아닐 수 있다(force-push·재작성). merge-base 로 정규화하고, 실패하면 돌린다.
if ! MERGE_BASE=$(git merge-base "$BASE_SHA" "$HEAD_SHA" 2>/dev/null); then
  echo "!! merge-base 계산 실패(얕은 클론?) — 검사를 수행한다(fail-safe)."
  emit true
  exit 0
fi

if ! CHANGED=$(git diff --name-only "$MERGE_BASE" "$HEAD_SHA" -- "$@" 2>/dev/null); then
  echo "!! git diff 실패 — 검사를 수행한다(fail-safe)."
  emit true
  exit 0
fi

if [[ -n "$CHANGED" ]]; then
  echo "관련 변경 발견:"
  echo "$CHANGED" | sed 's/^/  - /'
  emit true
else
  echo "관련 경로 변경 없음 (대조 pathspec: $*)"
  emit false
fi
