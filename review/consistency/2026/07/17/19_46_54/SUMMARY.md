# Consistency SUMMARY — `--impl-done spec/7-channel-web-chat/` (19_46_54)

## BLOCK: NO

Critical 0건. 5 checker 전원 완료.

| checker | 위험도 | 요지 |
| --- | --- | --- |
| cross_spec | LOW | 인용 line-by-line 대조 — 데이터모델·API 계약·요구사항 ID·상태전이·RBAC·계층책임 전 차원 모순 없음. INFO 2건 |
| rationale_continuity | NONE | **A-6 되돌림은 기각된 대안의 재도입이 아니라 conformance 회복** — 독립 확인 |
| convention_compliance | WARNING | `§110` 이 실제 heading 구조와 불일치 (→ 처리함, 아래 판정) |
| plan_coherence | WARNING | 이월이 developer plan 하단 산문으로만 존재 → 유실 위험 (→ 처리함) |
| naming_collision | NONE | 신규 식별자 충돌 0 |

## checker 간 충돌 판정 — `§NNN` 표기

두 checker 가 **정면으로 충돌**해 직접 판정했다.

- `naming_collision`: "`§<행번호>` 는 저장소의 **기존 관행**" — 선례 `http-request.handler.ts:353`
  (`spec §105`), `ai-turn-orchestrator.service.ts:647`, `re-run.e2e-spec.ts:191`.
- `convention_compliance`: "`§N` = **실제 heading 번호** 규약과 충돌. `2-sdk.md` 최대 섹션은 `§5` 라
  `§110` 은 존재하지 않는 섹션. 실제 조항은 `§3`."

**판정: 둘 다 부분적으로 맞다.** 행번호 관행은 실재하지만(그래서 내가 "내가 만든 표기" 라 한 건
틀렸다), `2-sdk.md` 는 heading 이 `§1`~`§5` 뿐이라 `§110` 은 **없는 섹션을 가리켜 오도**한다.
직접 확증: 해당 불릿(L110)은 `## 3. host ↔ iframe postMessage 프로토콜`(L93) 아래다.

→ **41건을 `§3(재전송)` 으로 교체**. 섹션 번호는 지배적 규약을 따르고, 조항명이 정밀도를 회복하며,
행 드리프트가 원리적으로 불가능하다. 애초 `§106` 드리프트를 부른 취약성이 함께 사라져 planner
이월도 불필요해졌다.

## 처리

| 발견 | 처리 |
| --- | --- |
| `convention_compliance` — `§110` 표기 | ✅ `§3(재전송)` 41건 교체 (위 판정) |
| `plan_coherence` — 이월 유실 위험 | ✅ [`plan/in-progress/webchat-command-failure-is-not-termination.md`](../../../../../plan/in-progress/webchat-command-failure-is-not-termination.md) 분리 (owner: project-planner). 리뷰어 지적대로 **이 plan 자신이 A-6 에 대해 경고한 바로 그 이월 유실 유형**이었다 |
| `cross_spec` INFO — `12-webhook.md §3.2` stale 인용 | ⏸ **선행 결함**(target 무관, 이 PR 이 만들지 않음) — 별도 트랙 |
| `cross_spec`/`convention_compliance` INFO — header backlink 일관성 | ⏸ 경미, 규약 강제 아님 |

## 검증

`--impl-done` 대상 diff 는 `spec/7-channel-web-chat/2-sdk.md` frontmatter 4줄이 전부이며(나머지
5개 spec 문서는 origin/main 과 byte-identical), 3명의 checker 가 각자 `git diff` 로 독립 확인했다.

교체 후: channel-web-chat tsc 통과 · **390 passed**(22 파일).
