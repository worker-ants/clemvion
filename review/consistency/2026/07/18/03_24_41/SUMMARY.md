# Consistency SUMMARY — `--impl-done spec/7-channel-web-chat/` (03_24_41)

## BLOCK: NO

Critical 0건. 5 checker 전원 완료. 마지막 `--impl-done`(19_46_54) 이후 재설계·게이트로 spec 연결 코드가
크게 바뀌어 재실행했다.

| checker | 위험도 | 요지 |
| --- | --- | --- |
| cross_spec | LOW | 광범위한 코드 변경에도 실제 spec 본문 diff 는 `2-sdk.md` frontmatter 4줄뿐. 동작 변경은 전부 인메모리 client ref 한정, backend/엔티티/엔드포인트/RBAC 표면 변경 0 |
| rationale_continuity | LOW/INFO | **A-6 되돌림은 순변경 0(origin/main 과 바이트 동일)·근거 정확 — Rationale 위반 아닌 자가 교정. 재설계도 기존 invariant 전부 보존** |
| convention_compliance | NONE | `§3(재전송)` 표기 정식 규약 부합(선례 존재), 살아있는 인용부 `§106`/`§110` 잔존 0 |
| plan_coherence | WARNING | apiBase 갭이 산문-only(→ 처리) |
| naming_collision | NONE | 신규 식별자 8개 전부 로컬·비-export, 충돌 0 |

## 핵심 판정 — 재설계·되돌림은 spec 정합

`rationale_continuity` 가 두 하드윈 결정을 독립 검증:
1. **A-6 되돌림**: shipped diff 순변경 0, origin/main 과 바이트 동일한 최종 상태로 수렴. 근거
   (`3-auth-session.md §3.1-3` 정리 조건 닫힌 열거에 비-410 실패 없음) 정확 — 기각 대안 재도입이
   아니라 PR 내부 자가 발견·교정.
2. **boot축→`sessionEstablished` 재설계**: EIA `R-replay-unavailable`·EIA-RL-07·`§R9` single-flight
   coalesce 등 기존 invariant 전부 보존. 원칙 위반·기각 대안 재도입 없음.

## 처리 (WARNING)

- **apiBase 갭 산문-only**(plan_coherence) → ✅ 전용 plan 분리
  [`webchat-session-apibase-binding.md`](../../../../plan/in-progress/webchat-session-apibase-binding.md)
  (형제 이월 command-failure·usewidget-extraction 과 같은 처분).
- **spec `## Rationale` 문서화 갭**(rationale_continuity) → ⏸ **planner 이월**. `sessionEstablished` 불변식·
  "비-410 실패는 종료 아님" 근거가 코드/plan 에만 있고 spec Rationale 엔 없다. developer 는 `spec/`
  read-only 라 planner 트랙 후속(§NNN 규약 명문화와 함께). plan 에 기록. 비차단(문서화 durability).

## INFO (비차단)

- cross_spec: `12-webhook §3.2` 인용 drift(pre-existing, 이 PR 무관), impl-vs-spec gap(전용 plan 추적 중).
- convention_compliance: `§N` 표기 규약 미명문화(planner 이월됨), `_product-overview` 백링크(pre-existing).
- naming_collision: 완료 plan `webchat-usewidget-split.md` 와 이름 근접(다른 스코프), predicate 명명(검토 완료).
- plan_coherence: cross-plan 전제 stale, archive 시 깨질 상대 링크.

## 검증

`--impl-done` 대상 spec diff 는 `2-sdk.md` frontmatter 4줄이 전부(5개 checker 가 각자 3-dot merge-base
로 독립 확인, 페이로드 오염 0). 코드 변경은 `codebase/channel-web-chat/**` 한정.
</content>
