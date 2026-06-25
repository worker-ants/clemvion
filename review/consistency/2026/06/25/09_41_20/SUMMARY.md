# Consistency Check 통합 보고서 (--impl-done, 2차/terminal)

**BLOCK: NO** — Critical 없음. 대상 `91f596fe` (W3·W4 spec 보강 반영). 본 run 이 terminal 게이트.

> **이전 09_30_58 run 의 정당 findings(W3 invariant·W4 WS §4.4)는 spec 보강 후 본 run 에서 재flag 되지 않음 → 해소 확인.**
> cross_spec 은 본 run 에서 fatal(출력 미생성)이나, 09_30_58 run 에서 success 로 동일 관점(W1~W4)을 이미 커버.

## 전체 위험도
**MEDIUM** — Critical 0 / WARNING 5(전부 비차단·아래 처분) / INFO 11.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | Checker | 보고 | 처분 |
|---|---------|------|------|
| W1 | Rationale | execution.message EIA §5.2 미등재 | **FALSE POSITIVE** — §5.2 L387 + R18 실재(`git show HEAD: \| grep -c`=6). 4회째 동일 체커 blind-spot(대형 multi-file diff 의 spec hunk 누락). 메모리[consistency main-baseline FP]대로 git 반증·진행 |
| W2 | Rationale | resetSession SDK §3 미반영 | **FALSE POSITIVE** — §3 L86 + 설명 L91 실재. §5 ChatInstance 미포함은 **의도**(host→iframe 명령, 공개 SDK 메서드 아님; §3 에 "host→iframe 전용·서버 미변경" 명시) |
| W3 | Naming | execution.message vs `EXECUTION_MESSAGE_TOO_LONG` 접두어 공유 | 비-이슈 — 별 네임스페이스(이벤트 타입 vs 에러코드). enum JSDoc 에 무관 명시(I8/I12). 체커도 "JSDoc 으로 족함" |
| W4 | Naming | `PRESENTATION_NODE_TYPES` vs `PRESENTATION_COMPONENTS` 혼동 | 수용 — JSDoc 에 form 제외·소비처 명시로 구분. optional rename(`NON_BLOCKING_...`)은 review_guard 재무장 회피 위해 보류(체커도 "JSDoc 으로 구분됨, 현 이름 유지 가능") |
| W5 | Convention | `spec_impact` in-progress frontmatter 선언 | **complete-move 시 처리** — plan-lifecycle Gate C(완료 이동)가 실제 enforcement 지점. impl-prep INFO(I5) 도 "현행 유지, 완료 이동 시 갱신" 판정. PR(push) 단계에선 비차단 |

## 참고 (INFO) — 처분
- I1(newChat ChatInstance 미반영): W2 와 동일 — 의도된 host 전용. 
- I2(2-column Rationale): admin-console §6 R7 에 기재됨(FALSE).
- I6(plan Phase 4(b) "§8 매핑 테이블" stale 참조): plan 내부 cosmetic 노트 — 실제 구현은 §5.2/R18 로 정확. 재무장 회피 위해 미수정, 본 노트로 정정 기록.
- I3·I4·I5·I7·I8·I9·I10·I11: 위반 없음 확인 또는 별 plan/백로그(직교).
- cross_spec fatal: 09_30_58 run(success)에서 커버. 재무장 루프 회피 위해 재실행 안 함.

## Checker별
- Rationale Continuity: MEDIUM (W1·W2 FALSE) — 본 run 에서 성공(이전 09_30_58 에선 fatal 이던 것 복구)
- Convention: LOW (W5, complete-move 처리)
- Plan Coherence: LOW (I6 cosmetic, 구현 정확)
- Naming: LOW (W3·W4 JSDoc 구분)
- Cross-Spec: fatal(본 run) → 09_30_58 커버

## 종합
BLOCK:NO. 정당 findings(이전 W3·W4)는 spec 보강 완료·재검증됨. 잔여 WARNING 은 전부 false-positive(W1·W2, git 반증)·비-이슈(W3·W4)·complete-move 시점(W5). 머지 가능.
