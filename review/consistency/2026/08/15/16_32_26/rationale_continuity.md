# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (`finalizeStalledExhausted` 트랜잭션화)

## 검토 범위 확인

프롬프트 번들의 `## 구현 변경 사항` 섹션(git diff)은 예산 초과로 생략되어 있었다. 대상
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, env 의
Working directory 와 동일)에서 `git diff origin/main...HEAD` 를 직접 실측했다.

`spec/5-system/` 아래 실제 변경은 `spec/5-system/4-execution-engine.md` 단 1개 파일, 8줄
추가·1줄 삭제뿐이다. 대응 코드 변경은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
(+`.spec.ts`) 의 `finalizeStalledExhausted`(BullMQ stalled 재배달 소진 →
`WORKER_HEARTBEAT_TIMEOUT` dead-letter 마감) 함수 — Execution UPDATE 와 자식 NodeExecution
cascade UPDATE 를 `dataSource.transaction` 으로 묶는 버그 수정이다.

이 세션에는 동일 diff 를 대상으로 한 두 차례 선행 라운드가 이미 존재한다
(`review/consistency/2026/08/15/15_54_20/rationale_continuity.md`,
`review/consistency/2026/08/15/16_19_57/rationale_continuity.md`, 둘 다 위험도 NONE). 본
라운드는 그 두 결론을 재검증하고, 두 번째 라운드가 남긴 INFO(제안)가 그사이 실제로 반영됐는지
`git log` 로 확인했다.

## 발견사항

없음(CRITICAL/WARNING 없음).

- **§1.1 "원자성 보장"(line 82) 원칙과 정합, 위반 아님**: 문서는 이미 "`running ↔
  waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경과 **단일 DB 트랜잭션**으로
  묶여 commit/rollback 된다"는 불변식을 §1.1 에 선언해 두었다. `finalizeStalledExhausted` 는
  이 불변식이 **아직 적용되지 않았던 한 경로**였고(코드 diff 확인: 종전엔 `executionRepository`
  UPDATE 와 `nodeExecutionRepository` UPDATE 가 각각 독립 `createQueryBuilder().execute()` —
  autocommit), 자매 함수 `cancelParkedExecution`(:1023)·`markWebChatIdleTimeout`(:1152)은
  이미 `dataSource.transaction` 패턴이었음을 코드에서 직접 확인했다. 이번 diff 는 그 불변식을
  **위반이 아니라 완성**한다.
- **기각된 대안의 재도입 아님**: `4-execution-engine.md` 전체(§1.1, §7.1 PR3/PR4 Rationale)
  어디에도 "이 경로는 트랜잭션이 불필요하다/개별 autocommit 이 의도적 트레이드오프다"라고
  명시적으로 채택한 과거 결정이 없다(§Rationale "PR4 — BullMQ stalled 자동 재배달" 원문에는
  트랜잭션 경계에 대한 언급 자체가 이번 정정 전엔 없었다). 즉 이번 변경이 뒤집는 "기각된
  대안"은 존재하지 않는다 — 단순 누락(자매 하드닝 미적용)의 시정이다.
- **결정 번복 시 새 Rationale 요구 — 충족됨**: 이번 변경은 새 설계 결정이 아니라 기존
  원칙(§1.1)에 미달하던 구현의 정정이지만, 그럼에도 `## Rationale` 절 "PR4 — BullMQ stalled
  자동 재배달" 항목(line 1464) 에 "**dead-letter 마감의 원자성 (2026-08-15 정정)**" 신규
  불릿이 추가되어 배경·문제(부분 커밋 시 유령 `RUNNING`)·비교 대상(자매 함수)·해법(단일
  트랜잭션)을 명시한다. `git log` 로 이력을 추적하면, 코드 수정 커밋(`3e64f2a0a`)에서는 §7.1
  본문 인라인 각주 1문장만 추가됐고, `## Rationale` 절 불릿은 후속 커밋(`749488801`, 커밋
  메시지 "INFO2 — 4-execution-engine.md Rationale 'PR4' 절에 원자화 정정을 미러. 본문
  §7.1 에만 있고 Rationale 에 없어 서술이 분산돼 있었다")에서 추가됐다 — 이는 선행
  16:19:57 라운드가 남긴 동일 취지의 INFO 제안("`## Rationale` 절에도 1줄 포인터를 남기면
  좋겠다")을 그대로 반영한 것으로 보인다. 결과적으로 본 라운드 시점 기준으로는 인라인
  각주(§7.1)와 `## Rationale` 서브섹션(PR4 항목) 양쪽에 정합된 서술이 존재해, 이 문서의
  다른 유사 정정(예: "Pre-park read-window 정규화")이 따르는 "본문 인라인 + `## Rationale`
  독립 항목" 관례와도 맞다.
- **암묵적 invariant 우회 아님**: cascade 대상 조건(`status='running'` WHERE, id 매칭),
  no-op 조건(`affected=0`), 커밋 후 best-effort emit 순서("WebSocket 이벤트 발행은
  트랜잭션 commit 후 수행" — §1.1) 는 diff 전후로 그대로다. 트랜잭션 경계 도입은 기존
  invariant 를 우회하지 않고, 오히려 부분 커밋으로 그 invariant 가 깨지던 창(유령
  `RUNNING`)을 닫는다. at-least-once 재실행 경계(§Rationale "PR4")도 diff 로 바뀌지 않는다.

## 요약

동일 diff 를 대상으로 한 3차 라운드 누적 결론이 일관된다: 이번 변경(`finalizeStalledExhausted`
트랜잭션화)은 문서가 §1.1 에서 이미 선언한 "짝 상태 갱신 = 단일 트랜잭션" 원칙을 자매 함수와
동형으로 미적용 경로에 확장 적용한 정정이며, 과거 Rationale 이 기각한 대안을 재도입하거나
합의 원칙을 우회하는 지점은 없다. 결정 번복이 아니라 누락의 시정이지만, 그럼에도 배경·근거를
설명하는 새 Rationale 불릿이 `## Rationale` 절에 실제로 추가돼 있어(선행 라운드의 형식적 INFO
제안까지 반영된 상태) 문서화 완결성도 갖췄다. 추가로 지적할 CRITICAL/WARNING/INFO 는 없다.

## 위험도

NONE
