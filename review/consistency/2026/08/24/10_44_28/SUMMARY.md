# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 있음 (근거: 아래 §직접 검증 메모 참조 — 5개 checker 중 하나가 보고한 CRITICAL 은 직접 재확인 결과 문면상 전제가 이미 해소돼 있었으나, 같은 재확인 과정에서 **다른, 더 근본적인 권한 경계 Critical**이 드러났다)

## 직접 검증 메모 (요약자가 수행 — 반드시 먼저 읽을 것)

이 세션의 target(`spec/5-system/**`)에는 이미 **로컬 커밋 `e6a017a18`**(`fix(security): envelope.output
도 fail-closed allowlist — 내가 쓴 유예 근거가 틀렸다`, 2026-08-24 10:50)이 반영돼 있다.
`git status --porcelain` 은 `plan/in-progress/node-output-envelope.md` 수정 1건과 리뷰 산출물
디렉토리만 uncommitted 로 보여준다 — 즉 spec/코드 정정 자체는 **이미 이 worktree 의 로컬 HEAD 에
커밋된 상태**다(`git diff origin/main --stat` 기준으로는 아직 "차이"로 보이므로 일부 checker 가
"uncommitted" 로 오분류했다).

- **cross_spec 의 CRITICAL 재확인**: `spec/5-system/6-websocket-protocol.md` §4.4 와
  `spec/5-system/14-external-interaction-api.md` §R17 을 직접 `grep`/`Read` 한 결과, cross_spec 이
  "아직 옛 유예 근거를 담고 있다"고 지적한 그 문장은 **이미 취소선 처리되고 2026-08-24 재정정
  블록(fail-closed allowlist, 실측 표, `nodeOutputCache` 폴백 잔여 위험 caveat 포함)으로 교체돼
  있다** — cross_spec 이 지적한 "code 와 spec 문면의 정면 충돌"은 **현재 시점엔 존재하지 않는다**.
  이는 rationale_continuity·plan_coherence 가 이미 `git diff`/`git status` 로 독립 확인한 것과
  일치한다(둘 다 이 사실을 INFO/WARNING 으로 반영).
- **cross_spec / plan_coherence / naming_collision 의 "`spec_impact` 에 `conversation-thread.md`
  누락" 지적도 재확인 결과 사실이 아니다** — `plan/in-progress/node-output-envelope.md` frontmatter
  를 직접 Read 하면 `spec/conventions/conversation-thread.md` 가 **이미 세 번째 항목으로 등재**돼
  있고, 그 위에 "CLAUDE.md 「자기-반증형 소정정」 절" 을 인용하는 주석까지 붙어 있다. 세 checker
  모두 예산 절단/동결 스냅샷 때문에 이 frontmatter 전문을 못 본 것으로 보인다.
- **그런데 바로 그 frontmatter 주석이 새로운, 더 근본적인 Critical 을 드러낸다.** CLAUDE.md 의
  자기-반증형 소정정 예외는 **조건 2** 에서 "제품 정의·요구사항·**API 계약**은 해당 없음" 을
  명시한다. `spec/5-system/14-external-interaction-api.md`(EIA) 와
  `spec/5-system/6-websocket-protocol.md`(WS) 는 정의상 이 프로젝트의 **API 계약 문서 그 자체**이고,
  이번에 고쳐진 §R17/§4.4 내용은 "SSE/fanout 응답에서 어떤 필드가 걸러지는가" 라는 **wire 계약**을
  직접 기술한다 — "예고·트리거" 문장이 아니다. 그럼에도 commit `e6a017a18` 는 developer 소유
  plan(`owner: developer`, `started: 2026-08-24`) 안에서, 자기-반증형 소정정 예외를 인용하는 동일
  frontmatter 주석 아래 **이 두 API-계약 파일까지 함께** 정정해 커밋했다. plan 자신의 작업
  체크리스트는 이 정정을 "**(planner 턴)**" 항목으로 명시해 두었으나(line 104 부근, 여전히 `[ ]`
  미체크), 실제로는 별도 planner 세션 없이 이미 diff 가 만들어져 로컬 HEAD 에 들어가 있다(이
  프로젝트는 모든 역할이 동일 git identity `worker-ants` 로 커밋하므로 저자만으로는 role 구분이
  안 되지만, 커밋 메시지 전문이 1인칭 "내가 쓴 유예 근거가 틀렸다" 개발자 서술이고 plan
  frontmatter·체크리스트가 이를 뒷받침한다).
  - **결론**: 정정의 **내용**(fail-closed allowlist, e2e 285건 + 실 DB 조회 근거)은 신뢰할 만해
    보이지만, 그 정정이 **API 계약 spec 을 developer 턴이 직접 고쳤다**는 절차 자체가 CLAUDE.md
    조건 2 위반 소지가 있다 — 이는 developer 권한 밖 문제이므로 아래 §planner 인계 로 넘긴다.

## 전체 위험도
**HIGH** — 코드-스펙 실질 충돌은 이미 해소돼 있으나(문면상 위험 없음), 그 해소 자체가 API 계약
spec 을 developer 턴이 자기-반증형 소정정 예외 범위 밖에서 직접 수정한 결과일 수 있어 절차적
Critical 이 남는다. 그 외 checker 5종이 보고한 WARNING/INFO 는 대부분 사소하거나 이미 문서에
자각·기록돼 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | 직접 검증 (cross_spec 원 지적을 재확인 과정에서 재구성) | EIA §R17 / WS §4.4 의 API-계약 정정이 developer 소유 plan 안에서, 자기-반증형 소정정 예외(조건2: API 계약 제외)를 인용하며 planner 턴 없이 직접 커밋(`e6a017a18`)됨. (cross_spec 이 원래 지적한 "spec 문면이 code 와 충돌한다"는 상태는 직접 재확인 결과 **이미 해소** — §4.4/§R17 본문이 이미 fail-closed allowlist 로 정정돼 code 와 정합함) | `spec/5-system/14-external-interaction-api.md` §R17 표+정정블록, `spec/5-system/6-websocket-protocol.md` §4.4 caveat, `plan/in-progress/node-output-envelope.md` frontmatter 주석 | `CLAUDE.md` §자기-반증형 소정정 조건 2 ("제품 정의·요구사항·API 계약은 해당 없음") | planner 턴으로 이 두 파일의 정정 내용을 명시적으로 재검토·추인(ratify) — 내용 자체를 다시 쓸 필요는 없어 보이나(실측 근거 충분), "누가 이 결정을 승인했는가"를 절차적으로 채워야 한다 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 호출자(developer) 권한 밖이다. **여기 실려도 등급은 CRITICAL 그대로이고
> `BLOCK: YES` 도 그대로다** — 아래 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/14-external-interaction-api.md`·`spec/5-system/6-websocket-protocol.md` 는 API 계약 문서라 자기-반증형 소정정 예외(조건2)가 적용되지 않음 — developer 단독 수정 권한 밖 | project-planner | `spec/5-system/14-external-interaction-api.md` §R17 표 행 + "재정정 (2026-08-24)" 블록, `spec/5-system/6-websocket-protocol.md` §4.4 caveat — 내용(fail-closed allowlist, e2e 285건 + 실 postgres 조회) 자체는 검증 결과 타당해 보이므로 **재작성이 아니라 planner 세션이 동일 결정을 검토 후 명시적으로 승인/재커밋**하는 절차적 정정으로 충분할 가능성이 높음 | commit `e6a017a18`, `plan/in-progress/node-output-envelope.md` (체크리스트 line 104 "(planner 턴)" 항목, 여전히 미체크) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `background:run:{id}` Socket.IO 채널이 §3.2 "채널 패턴" 표에서 누락 — §3.3 인가 표에만 등장 (직접 재확인으로 현재도 유효함을 확인) | `spec/5-system/6-websocket-protocol.md` §3.2 표 | `spec/conventions/redis-keys.md` §4 (이 문서를 해당 채널의 SoT 로 지목) | §3.2 표에 `background:run:{id}` 행 추가하거나, `redis-keys.md` §4 포인터를 `4-nodes/1-logic/12-background.md §8.5` 로 정정 (이번 작업 범위 밖의 기존 gap — 후속으로 처리 가능) |
| 2 | naming_collision | `output` 식별자가 wire envelope 최상위(= `NodeHandlerOutput` 래퍼 전체)와 그 안의 도메인 값(`NodeHandlerOutput.output`) 두 레벨에서 같은 이름으로 쓰이는데 spec 서술이 이를 구분하지 않음 (직접 재확인 결과 §4.1 표 문구 현재도 미정정 상태로 확인됨) | `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed` 행 설명 | `execution-engine.service.ts`/`ai-turn-orchestrator.service.ts` 실제 emit 구조, `plan/in-progress/node-output-envelope.md` 의 실 DB 프로브 결과 | planner 턴(위 §planner 인계 항목 1과 같은 커밋 범위)에서 "wire `output` = `NodeExecution.outputData` 전체(= `NodeHandlerOutput`), `output.error` 는 한 겹 더 중첩된 `output.output.error` 를 가리킨다" 식으로 래퍼/도메인값을 명시적으로 분리 서술 |
| 3 | rationale_continuity, plan_coherence | `plan/in-progress/node-output-envelope.md` 체크리스트가 실제 진행 상태와 어긋남 — 배선·캐너리 3종·`#1208` 잔여 캐너리 뒤집기·§R17/§4.4/conversation-thread.md 정정까지 이미 커밋(`e6a017a18`)됐는데 관련 체크박스(line 98~101, 104, 107~108)가 전부 `[ ]` 미체크 (직접 재확인으로 확정) | `plan/in-progress/node-output-envelope.md` `## 작업` 체크리스트 | 실제 코드/spec 상태 (commit `e6a017a18`) | 커밋 완료된 항목을 `[x]` 로 동기화 — 남은 항목(뮤테이션 검증 추가분·TEST WORKFLOW·`/ai-review`)만 미체크로 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, naming_collision | `execution.node.failed` 의 실제 emit payload 는 `output`(=`nodeExecution.outputData`) 필드를 포함하지만 WS §4.1 표 정의에는 누락(직접 재확인 결과 현재도 그대로) | `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` 행 | planner 턴(§4.4/§R17 정정과 같은 커밋 범위)에서 `output` 열 추가해 표를 code 와 맞출 것 |
| 2 | convention_compliance | `duration` vs `durationMs` 필드명 차이 — target 문서가 이미 "의도적으로 남긴 표기 차이" 로 자각·기록해 둠 | `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 | 조치 불요 — 문구 유지 |
| 3 | convention_compliance | `spec/conventions/swagger.md` (REST DTO 규약) 은 Socket.IO 프로토콜 문서인 target 에 적용 대상 아님 | (해당 없음) | 조치 불요 (커버리지 확인 기록용) |
| 4 | 직접 검증 | cross_spec·plan_coherence·naming_collision 이 보고한 "`spec_impact` 에 `conversation-thread.md` 누락" 은 재확인 결과 **사실이 아님** — frontmatter 에 이미 3번째 항목으로 등재돼 있고 자기-반증형 소정정 주석까지 붙어 있음. 세 checker 모두 컨텍스트 예산 절단/동결 스냅샷으로 frontmatter 전문을 보지 못한 것으로 추정 | `plan/in-progress/node-output-envelope.md` frontmatter | 조치 불요 — 다만 위 Critical #1 이 바로 이 항목의 존재 자체에서 파생됨에 유의 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH (보고값) → 직접 재확인 결과 원 CRITICAL 의 문면상 전제는 해소됨, 그러나 같은 지점에서 더 근본적인 권한-경계 Critical 확인 | spec-code 불일치로 보고했으나 실제로는 이미 정정 완료 상태(단, 그 정정의 절차적 정당성이 새 쟁점) |
| rationale_continuity | LOW | §R17 번복이 취소선-보존형 정정 + 실측 근거로 적법하게 처리됐음을 working tree 직접 대조로 확인(모범 사례). plan 체크리스트 stale 만 INFO |
| convention_compliance | LOW | conventions 준수도 전반적으로 높음. `background:run:{id}` 채널 문서 누락 WARNING 1건 |
| plan_coherence | LOW | 실질 충돌 없음. `spec_impact`/체크리스트 "부기 갭" WARNING 2건 (그중 spec_impact 건은 이번 요약자 재확인으로 반증됨) |
| naming_collision | LOW | 신규 식별자 충돌 없음. `output` 래퍼/도메인값 혼용 서술 WARNING 1건 (전신 #1208 실수와 동일 패턴 재발 위험 지적 — 타당) |

## 권장 조치사항

1. **(BLOCK 해소 우선)** planner 턴을 열어 `spec/5-system/14-external-interaction-api.md` §R17 /
   `spec/5-system/6-websocket-protocol.md` §4.4 의 2026-08-24 정정(commit `e6a017a18`)을 검토하고
   명시적으로 승인/추인한다. 내용을 다시 쓸 필요는 없어 보이며(e2e 285건 + 실 postgres 조회 근거가
   충분), planner 세션이 동일 diff 를 재검토했다는 기록(plan frontmatter 갱신 또는 별도 커밋)을
   남기는 것으로 충분할 가능성이 높다.
2. `plan/in-progress/node-output-envelope.md` 체크리스트를 실제 완료 상태(배선·캐너리 3종·
   `#1208` 잔여 캐너리 뒤집기·spec 정정까지 이미 커밋됨)에 맞게 `[x]` 동기화한다.
3. (planner 턴과 같은 범위로 처리 가능) WS §4.1 `execution.node.completed`/`.failed` 표 설명에서
   `output` 식별자의 wrapper(`NodeHandlerOutput` 전체) vs 도메인값(`NodeHandlerOutput.output`) 두
   레벨을 명시적으로 구분 서술하고, `.failed` 행에 누락된 `output` 열을 추가한다.
4. (이번 작업 범위 밖, 후속 처리 가능) WS §3.2 "채널 패턴" 표에 `background:run:{id}` 행을 추가하거나
   `redis-keys.md` §4 포인터를 정정해 SoT 불일치를 해소한다.