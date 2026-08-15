# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 조사 방법 메모

target 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`·
`plan/in-progress/eia-*.md` 등 실제 관련 파일 본문이 대부분 절단돼 있었다("본문 생략됨").
번들에 없다는 사실을 근거로 삼지 않고, 저장소에서 직접 `Read`/`grep`으로 대상 문서와
plan 원문을 열어 대조했다. 검토 시점에 워킹트리 코드(`execution-engine.service.ts`,
`retry-turn.service.ts` 등)가 실시간으로 수정되고 있어(같은 세션의 구현 작업 진행 중으로
추정) 코드 상태 관찰은 스냅샷 참고용으로만 썼고, 판단은 문서(spec·plan) 레벨 정합성에 집중했다.

신규(미커밋) plan `plan/in-progress/eia-db-wire-invariant.md`가 이번 --impl-prep 의 실질
target이다 — `spec_impact: spec/5-system/14-external-interaction-api.md` 하나만 선언하고
§5.3(REST 상태 조회)·§6.5(cancelled 이벤트)의 `durationMs` 불변식을 마저 닫는 작업이다.

## 발견사항

- **[WARNING]** 새 plan이 기존 "정본" 트래커의 동일 항목을 참조 없이 재등재 — 자매 트래커 미동기화 패턴의 5번째 재발 위험
  - target 위치: `plan/in-progress/eia-db-wire-invariant.md` 전체(특히 ①②③ 항목, `:15-63`)와 frontmatter(`spec_impact`)
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:221-249`("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다" 절 — "자매 1곳"·"CANCELLED 분기에 `.returning(['duration_ms'])`" 체크박스)와 `:305-310`("REST `GET /api/external/executions/:id` 에 `durationMs` 부재" 체크박스)
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md:108`("durationMs | 구현됨(2026-08-15)")
    - `plan/in-progress/backend-lint-gate-broken-on-main.md:774-780`(같은 코드 지점 `failRetryExecution`/`emitCancellationEvent`을 겨냥하는 인접 항목)
  - 상세: `eia-db-wire-invariant.md`의 항목 ①(`finalizeCancelledExecution`이 guarded UPDATE 결과를 안 본다)·②(retry-turn CANCELLED 재진입 DB≠emit)·③(REST 재조회에 `durationMs` 없음)은 **문구까지 거의 동일하게** `spec-sync-external-interaction-api-gaps.md`에 이미 "정본"으로 추적 중이다(같은 원인 분석·같은 처방·같은 "2026-08-15 실측" 근거). 그런데 새 plan은 이 트래커를 한 번도 인용하지 않고, 완료 후 그쪽 체크박스를 동기화하는 절차도 체크리스트에 없다. 이 저장소는 정확히 같은 결함 클래스("자매 트래커 미동기화")를 바로 이 durationMs 작업 계열에서 이미 4번 반복했다 — `eia-terminal-payload.md:201`("자매 트래커 미동기화가 이 plan 에서 네 번째다")·`:283-294`("다른 plan 과의 관계 — 교차 참조 없이 등재했었다" 절, 3개 트래커 명시)·`:319-321`("자매 plan 갱신 — 3개가 아니라 4개였다. … 전수 grep 으로 발견, 체커가 놓친 것"). 같은 패턴이 다시 한번 새 plan에서 재발할 조건을 갖췄다: 항목 ①②③을 구현·커밋하면서 `eia-db-wire-invariant.md`만 체크하고 `spec-sync-external-interaction-api-gaps.md:228-244`·`:307-310`의 대응 체크박스를 stale로 남길 위험.
  - 제안: `eia-db-wire-invariant.md`에 `eia-terminal-payload.md`가 쓴 것과 같은 "다른 plan 과의 관계" 절을 추가해 `spec-sync-external-interaction-api-gaps.md`(정본)·`spec-draft-eia-notification-payload-contract.md`를 명시적으로 링크하고, 체크리스트에 "자매 트래커 동시 갱신"을 별도 항목으로 넣을 것. 구현 커밋과 **같은 턴에** 두 문서를 함께 닫을 것(`eia-terminal-payload.md:202-203`이 이미 이 교훈을 기록해 뒀다 — "회고를 쓰는 것과 그 회고가 가리키는 행동을 하는 것은 별개다").

- **[INFO]** 검토 시점 워킹트리 코드가 plan 체크리스트보다 앞서 있다(체크리스트-커밋 시차 재발 위험)
  - target 위치: `plan/in-progress/eia-db-wire-invariant.md:72-79`(체크리스트, 전항목 미체크)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md:315-318`("체크리스트가 커밋 메시지보다 늦는 것이 이 plan 에서만 세 번째다")
  - 상세: 검토 시점 `git status`에 `execution-engine.service.ts`/`.spec.ts`·`retry-turn.service.ts`/`.spec.ts`가 이미 수정 중(uncommitted)이었고, 코드 diff는 항목 ①("persisted 확인 후 emit skip")과 항목 ②(CANCELLED 분기 `.returning(['duration_ms','finished_at'])`)의 구현으로 읽혔다. 반면 plan의 체크리스트는 `①②③ 구현 + 회귀 테스트`가 전부 미체크다. 진행 중 스냅샷이라 그 자체는 결함이 아니지만, 이 plan 계열(`eia-terminal-payload.md`)이 "선언 시점과 표시 시점이 다르다"를 이미 3라운드 겪은 이력이 있어 같은 함정을 반복할 소지가 있다.
  - 제안: 커밋 직전에 체크박스를 함께 스테이징하는 절차(이미 `eia-terminal-payload.md`가 채택한 관행)를 그대로 따를 것.

- **[INFO]** 같은 emit 호출부를 겨냥하는 열린 후속 항목과의 순서 조율 참고
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`의 `failRetryExecution`/`emitCancellationEvent` 호출부(코드, 참고용)
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md:364`("`EXECUTION_CANCELLED` payload 에 `cancelledBy` 추가" — P2, 미완료) · `plan/in-progress/backend-lint-gate-broken-on-main.md:774-780`(같은 항목의 별도 등재)
  - 상세: 두 항목 모두 `failRetryExecution`의 CANCELLED emit payload를 손보는 작업이라, `eia-db-wire-invariant.md` 항목②(같은 emit 경로의 `durationMs`)와 코드 인접성이 있다. 결정 충돌은 아니지만(다른 필드, 다른 처방) 같은 코드 블록을 별개 PR이 순차로 건드리게 되므로 병합 시 리베이스 마찰 가능성이 있다.
  - 제안: 특별한 조치는 불요 — 순서만 인지하고 진행. (동시 세션/브랜치 경합 자체는 본 검토 범위 밖.)

## 확인했으나 문제 없음 (근거로 남김)

- spec §5.3(REST 조회) 현재 응답 예시(`spec/5-system/14-external-interaction-api.md:455-488`)에는 `durationMs`가 없다 — 항목③의 전제("REST 재조회에 `durationMs`가 없다")와 정확히 일치, 신규 결정 우회 없음.
- spec §6.5(`:803-823`)의 "알려진 예외 1건"(retry-turn 재진입 durationMs 불일치) 서술은 항목②가 닫으려는 바로 그 갭이며, `spec-sync-external-interaction-api-gaps.md:815`가 이미 같은 트래커를 가리키고 있다 — 문서 간 상호 참조 자체는 정합적이다(다만 위 WARNING대로 새 plan 쪽 링크만 비어 있다).
- `eia-db-wire-invariant.md`의 `spec_impact`는 `14-external-interaction-api.md` 단일 파일만 선언했는데, 이 durationMs 필드를 미러링하는 다른 spec 문서(`chat-channel-adapter.md`·`3-execution.md`·`data-flow/3-execution.md`)는 직전 PR(#1171, `eia-terminal-payload.md`)에서 이미 "구현됨"으로 동기화가 끝난 상태라 이번 작업(②③의 세부 정정)이 그 문서들을 다시 건드릴 필요는 없어 보인다 — frontmatter 스코프는 적절하다.
- `spec-draft-eia-r8-alignment.md`(idempotency 캐시 §R8 정합)는 완전히 다른 관심사(4xx/2xx 캐시 대상)라 겹치지 않는다.
- `eia-context-schema-followups.md`가 이미 완료한 DTO 파일 위치 리팩터(`dto/responses/execution-status-response.dto.ts`)는 항목③ 구현 시 참고할 현재 위치일 뿐, 결정 충돌 없음.

## 요약

신규 plan `eia-db-wire-invariant.md`는 spec §5.3/§6.5의 현재 서술과 내용상 충돌하지 않고, 겨냥하는
결함(①②③)의 전제도 spec·코드와 일치한다. 다만 이 세 항목은 이미 `spec-sync-external-interaction-api-gaps.md`가
"정본"으로 추적 중인 항목과 사실상 동일한데 새 plan이 그 트래커를 전혀 인용하지 않아, 이 저장소가
같은 durationMs 작업 계열에서 이미 네 번 반복한 "자매 트래커 미동기화" 결함이 다섯 번째로 재발할
조건을 갖췄다(WARNING). 미해결 결정을 우회하는 CRITICAL 급 충돌은 발견되지 않았다.

## 위험도
MEDIUM
