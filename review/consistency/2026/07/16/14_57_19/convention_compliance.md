# 정식 규약 준수 검토 — spec/4-nodes/3-ai/ (--impl-done final pass)

검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md` (diff-base `origin/main`)
추가 확인 대상 (본 pass 신규): `spec/conventions/cafe24-api-metadata.md` frontmatter 수정 재검증, `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 신규 plan stub, `1-ai-agent.md` frontmatter `pending_plans` 추가 항목.

## 사전 확인 — 이전 회차(14_46_28) WARNING 정정 여부

`spec/conventions/cafe24-api-metadata.md` frontmatter `code:` 리스트에 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` 가 추가된 것을 확인했다.

```
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/**
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts   # 신규 추가
  ...
```

- 파일 실존 확인: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` (export `buildOperationJsonSchema` 등) — 실존.
- 본문 §7 도 `cafe24-mcp-tool-provider.buildJsonSchema()` → `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()`(cafe24/makeshop 공유 pure 함수) 로 정확히 갱신되어 코드와 정합.
- `spec-code-paths.test.ts` (`cafe24-api-metadata` 대상) 실행 결과 PASS — glob 매치 확인.

**결론: 이전 WARNING 은 정정 완료. 재발 없음.**

---

## 발견사항

### [CRITICAL] `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` frontmatter 에 필수 `worktree:` 필드 누락 — 빌드 가드 실제 실패

- target 위치: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 상단 frontmatter (1~4행)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다." (CLAUDE.md `## 정보 저장 위치` 표에서 "진행 중 작업" 행이 이 문서를 SoT 로 직접 지정 — `plan/in-progress/<name>.md` (frontmatter 에 `worktree` 명시))
- 상세: 현재 frontmatter 는 아래와 같이 `started`/`owner` 두 필드만 있고 `worktree` 가 통째로 빠져 있다.

  ```yaml
  ---
  started: 2026-07-16
  owner: project-planner
  ---
  ```

  `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 를 로컬에서 직접 실행해 실패를 재현·확인했다 (impl-done 규약상 "미구현/위반" CRITICAL 은 재확인 의무 — 절대경로 워킹트리 기준으로 실행):

  ```
  FAIL src/lib/docs/__tests__/plan-frontmatter.test.ts
    > plan/in-progress/spec-drift-ai-agent-outport-countmax.md
    > `worktree` is set and not a legacy placeholder
  AssertionError: plan/in-progress/spec-drift-ai-agent-outport-countmax.md: worktree missing
  Test Files  1 failed (1)
  Tests  1 failed | 120 passed (121)
  ```

  이 가드는 `plan_coherence`(동시 작업 충돌 감지)와 `plan-stale-audit.sh` 가 실데이터로 동작하기 위한 전제이며, `worktree` 부재는 placeholder(`TBD` 등)보다 더 심한 "완전 누락" 케이스 — 다른 파일명(`0-`/`_` prefix 아님, top-level)이라 예외 대상도 아니다. 이 상태로는 `codebase/**` 변경이 있는 PR 의 push gate(`guard_review_before_push.py`)가 도달 시 frontend unit test 단계에서 CI 가 막힌다.
- 제안: frontmatter 에 `worktree: <현재 worktree 디렉토리명>` 한 줄 추가. 본 문서가 만들어진 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`)의 디렉토리명인 `funny-mahavira-50d003` 을 값으로 쓰는 것이 규약과 가장 정합적이다 (§4 "worktree: 이 plan 이 살아있는 worktree 디렉토리 이름"). 수정 후 `plan-frontmatter.test.ts` 재실행으로 통과 확인 필요.

### [WARNING] `1-ai-agent.md` `pending_plans` 신규 항목이 컨벤션이 정의한 "미구현 surface 추적" 의미론과 어긋남

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter — `pending_plans:` 리스트에 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 추가
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans` 필드 정의: "미구현 surface 를 책임지는 plan 경로." §Overview 도 본 필드군의 목적을 "spec 가 약속한 surface 와 실제 구현 코드 사이의 정적 증거" 로 명시 — 즉 **구현 완결성** 추적 필드다.
- 상세: 신규 plan stub 자신의 본문이 밝히듯 이 plan 은 "성격: `spec/` 내부 자기모순 2건 (코드가 아니라 spec 문서끼리 어긋남)" 이며 Rationale 도 "코드 변경 없이 spec 문서만 정정하는 project-planner 작업" 이라고 명시한다. 즉 `1-ai-agent.md` 에 대해 **구현이 빠진 surface 가 아니라 spec 문서 간 서술 불일치를 spec 쪽에서 바로잡는** 작업이다. 이를 `pending_plans:` (구현 완결성 게이트) 에 얹으면:
  1. `spec-status-lifecycle.test.ts` 규칙 (c) — "partial 의 pending_plans 모두 complete 인데 status 미승격" — 는 **두 plan 모두** complete 로 이동해야 `implemented` 승격이 허용된다. `ai-agent-tool-connection-rewrite.md`(진짜 구현 갭)가 먼저 끝나도, 순수 spec 정정 작업인 `spec-drift-ai-agent-outport-countmax.md` 가 열려 있는 한 `status: partial` 이 인위적으로 묶여 남는다 — 필드가 원래 측정하려는 "구현 완결성" 신호가 왜곡된다.
  2. 이 필드를 보는 독자/도구(`plan-stale-audit.sh`, `/spec-coverage` 등)는 "AI Agent 에 아직 구현 안 된 부분이 있다"고 오독할 수 있으나 실제로는 spec 서술 정합성 이슈다.
- 제안: (a) 규약 문언대로 엄격히 가려면 `pending_plans:` 대신 `1-ai-agent.md` 본문 또는 §6/§Rationale 에 "spec 자기모순 미해결" 각주로 텍스트 링크만 남기고 frontmatter 필드에서는 제외 — 다만 이 경우 plan-lifecycle 의 durable-anchor 손실 문제(plan 이 다른 곳에서 참조되지 않아 stale-audit 사각지대가 됨)가 재발할 수 있다. (b) 현 상태(`pending_plans` 에 편입)를 유지하려면, `spec-impl-evidence.md §2.1` 의 `pending_plans` 정의에 "구현 갭 추적 외에도 spec 자기모순 해소를 책임지는 plan 을 포함할 수 있다" 는 예외 문구를 명시적으로 추가해 규약 자체를 갱신하는 편이 실제 사용 패턴과 정합된다. 어느 쪽이든 현재는 규약 문언과 실제 사용 사이에 괴리가 있다는 점만 결정권자가 인지하면 되는 수준의 WARNING이다 (build 가드는 통과, 로직 파괴는 없음).

### [INFO] plan stub 에 checkbox 형식의 실행 항목 부재

- target 위치: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 전체 본문
- 위반 규약: 명확한 강제 규약은 아니나 `.claude/docs/plan-lifecycle.md §1/§6.1` 이 in-progress 판정·`plan-stale-audit.sh` 진행률 표시(`7/12 done`)를 체크박스(`- [ ]`) 기반으로 전제한다.
- 상세: 본 문서는 "Critical 1"/"Critical 2" 산문 + "처분:" 문장으로만 구성되어 있어 명시적 `- [ ]` 항목이 0개다. 기능적으로는 §2 "분류 기준"의 "결정 필요" 신호로 in-progress 분류가 되어 가드를 통과하지만, `plan-stale-audit.sh` 진행률 계산은 0/0 으로 나와 다른 plan 과 다른 방식으로 보고된다.
- 제안: "처분:" 문장을 `- [ ] (a) ...` / `- [ ] (b) ...` 형태의 체크리스트로 변환하면 stale-audit 도구 출력과 다른 plan 과의 형식 일관성이 개선된다. 필수는 아님.

---

## 요약

이번 --impl-done 최종 pass 에서 이전 회차가 지적한 `cafe24-api-metadata.md` frontmatter `code:` 누락(`operation-tool-schema.ts`)은 정확히 정정되었고 본문 §7 서술도 코드와 일치함을 확인했다. `1-ai-agent.md` 의 `pending_plans` 신규 항목(`spec-drift-ai-agent-outport-countmax.md`)은 `spec-pending-plan-existence`/`spec-code-paths`/`spec-status-lifecycle` 빌드 가드를 모두 통과하지만, 그 신규 plan stub 자체의 frontmatter 에 `plan-lifecycle.md §4` 가 top-level in-progress plan 에 강제하는 `worktree:` 필드가 통째로 빠져 있어 `plan-frontmatter.test.ts` 를 실제로 실패시키는 CRITICAL 위반을 새로 발견했다(로컬 재현 완료). 아울러 그 plan 이 `pending_plans:`(구현 완결성 추적용으로 정의된 필드)에 spec 자기모순 정정이라는 이질적 성격의 항목으로 편입된 점은 규약 문언과 실사용 사이의 의미론적 괴리로 WARNING 처리했다. 두 항목 모두 수정 비용이 낮다(전자는 frontmatter 한 줄 추가, 후자는 규약 문구 보강 또는 필드 분리 결정).

## 위험도
HIGH
