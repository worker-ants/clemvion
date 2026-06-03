---
worktree: fix-bg-context-followups
started: 2026-05-31
owner: developer
---

# Background context-key race — 선택적 후속 backlog

> **완료된 본체는 분리됨** (2026-06-01 split): background ExecutionContext Map 키 분리
> race 본 수정(PR #406, `pendingContinuations` 의 `contextKeyOf` 격리 + finally 정리)과
> ai-review INFO #1~#10 결정 기록은 [`plan/complete/background-context-key-race.md`](../complete/background-context-key-race.md).
> 본 문서는 그 PR 에서 **별 PR 로 미룬 선택적/조건부 후속**만 남긴 잔여 추적이다.
> 커밋된 약속이 아니라 "필요 시 검토" 수준 — 착수 시 worktree 로 승격.

## 처리 중 (worktree fix-bg-context-followups, 2026-06-03 착수 — INFO#7 + INFO#3)

> 사용자 결정(2026-06-03): INFO#7 + INFO#3 을 본 PR 에서 처리. interactive fail-fast 가드는 보류 유지(아래 §보류).

### INFO#3 — `createContext` options-bag 리팩터
구현 결정: 필수 식별자 2개(`executionId`, `workflowId`)는 위치 인자 유지, optional 후행 3개(`initialVariables`/`recursionDepth`/`contextKey`)를 단일 `options` 객체로 묶는다. 이로써 bg 호출이 `({}, 0, bgKey)` 처럼 중간 기본값을 억지로 명시할 필요가 없어진다 (`{ contextKey: bgKey }`). 규약 정합: execution-context.md §Rationale 의 "기각된 `ExecutionOptions` 추출" 은 **`ExecutionContext` 필드(핸들러 소비 표면)** 를 묶는 안의 기각이지, **`createContext` 메서드 인자 ergonomics** 와는 별개 사안 — 충돌 없음.

- [x] 시그니처 변경 (`execution-context.service.ts`) — `options: CreateContextOptions = {}` (commit f102dc0b, interface 추출 06c92d41)
- [x] 호출처 3곳 + 테스트 갱신 (f102dc0b). bg 호출 `({}, 0, bgKey)` → `{ contextKey: bgKey }`
- [x] spec §6.1 드리프트 — SPEC-DRIFT 경로로 반영 완료 (commit 139b8411, `/consistency-check --spec` BLOCK: NO 후)

### INFO#7 — context 미존재 시 진단 warn
`setStructuredOutput`/`setEngineResolvedConfig` 의 silent no-op 에 `logger.warn` 추가 (no-op 동작 자체는 유지 — best-effort cache). 기존 `[ctx-trace]` prefix 컨벤션 따름.

- [x] warn 추가 (`warnContextMissing` 헬퍼, 06c92d41) + 단위 테스트 (no-op 유지 + warn 검증 + strict setNodeOutput throw 대비 테스트)

### 워크플로 체크리스트
- [x] 3. `/consistency-check --impl-prep` → **BLOCK: NO** (LOW, INFO 5건 — 전부 execution-context.md spec-doc polish, project-planner 후속). 산출: `review/consistency/2026/06/03/20_14_41/`
- [x] 5–7. 테스트 선작성 + 구현 (commit f102dc0b)
- [x] 8. TEST WORKFLOW — lint PASS · **backend unit PASS** (292 suites / 5677) · build PASS(docker 포함) · e2e PASS(144). ⚠️ unit 전체는 FAIL 표기 — 원인은 **본 변경과 무관한 기존 frontend 실패** `spec-frontmatter.test.ts` (cafe24-api-catalog 222파일 `id`/`status` frontmatter 누락, 444건). **main HEAD 66f4ffd9 에서 동일 444건 재현 확인 → pre-existing, 본 PR 회귀 아님**. spec-domain 이슈(project-planner) — 아래 §보류 로 분리.
- [x] 9. `/ai-review` (`review/code/2026/06/03/20_36_54/`) — CRITICAL 1건은 **검증된 false positive**(3 호출처 이미 options-bag, dismissed in RESOLUTION.md), WARNING 7건 중 W1·W2·W4·W5·W7 fix (06c92d41), W3 deferred, W6/SPEC-DRIFT spec 반영(139b8411). resolution-applier 처리 + RESOLUTION.md. `--impl-done` (`review/consistency/2026/06/03/21_09_33/`, code+spec 정렬 후 재실행).

### 후속 (project-planner — 비차단 INFO)
consistency-check INFO 중 spec-doc 보완 권장(developer read-only 영역). **INFO#4 는 본 PR SPEC-DRIFT 로 이미 반영(139b8411)**. 나머지는 별 작업:
- INFO#1: §원칙 4 선례 목록에 `engineResolvedConfigCache` 추가 or §1 각주 SoT 위임
- INFO#2: §원칙 1 `variables` 에 `__`-prefix 런타임 변수 SoT(`execution-engine §6.1`) 위임 문구
- INFO#3(checker): §원칙 1 각주에 `loopContext`/`itemContext` 원칙 2 소급 비적용 근거
- ~~INFO#4~~: ✅ 반영 완료 (§Rationale 기각 범위 한정 주석, 139b8411)
- INFO#5: frontmatter `pending_plans: []` 줄 삭제

## 보류 (별 PR — 미착수)

- [ ] **(pre-existing, 본 PR 무관)** `spec-frontmatter.test.ts` 444건 실패 — `spec/conventions/cafe24-api-catalog/**` 222 파일이 `id`/`status` frontmatter 없이(`resource`/`entity`/`cafe24_docs`/`source` 만) 커밋됨(#447 d9512d7b). frontmatter guard 가 `id` non-empty + `status` enum 을 요구. **main HEAD 에서 이미 red**. 조치 방향(project-planner 결정 필요): (a) catalog 파일에 `id`/`status` 추가 or (b) guard 의 검사 대상에서 cafe24-api-catalog 제외. 본 backend 변경과 무관해 별 task.
- [ ] **(검토)** background 본문 interactive 노드 fail-fast 가드 + 에러코드(`BACKGROUND_INTERACTIVE_UNSUPPORTED`) — spec(12-background §4/§6) 변경 동반, project-planner 선행. 현재는 격리+타임아웃으로 안전 종결만 보장 (완료 기록 §1 "잔여 한계" 참조).
