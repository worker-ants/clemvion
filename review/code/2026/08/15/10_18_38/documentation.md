STATUS=success

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들이 대부분 코드 파일(1~6번)의 "전체 파일 컨텍스트"를 크기 제한으로 생략해, `Read`/`Bash(git diff origin/main --)`로 `execution-engine.service.ts`, `terminal-duration.ts`, `execution.entity.ts`, `V001__initial_schema.sql` 를 직접 열어 diff·인용 수치를 대조했다. 위치는 프롬프트 게이트 숫자가 있는 경우 그대로 쓰고, 직접 `Read`로 확인한 실제 파일 줄 번호도 함께 표기했다(둘이 일치함을 확인).

## 발견사항

- **[WARNING]** 이전 라운드의 CRITICAL 버그를 고친 SQL 상수 옆에, 고치기 **전** 동작을 설명하는 주석이 그대로 남아 최신 동작과 어긋난다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3352` (`finalizeStalledExhausted`, `git diff origin/main` 기준으로도 동일 줄 — 신규 추가 줄)
  - 상세: `// \`GREATEST(0, …)\` — 시계 역행이 음수를 만들면 수신자의 산술이 깨진다.` 라는 주석이 `durationMs: () => TERMINAL_DURATION_MS_SQL,` 바로 위에 있다. 그런데 `TERMINAL_DURATION_MS_SQL` (`codebase/backend/src/shared/utils/terminal-duration.ts:87-90`)의 **현재** 정의는 `GREATEST(0, …)` 가 아니라 `CASE WHEN … THEN NULL ELSE LEAST(2147483647, …) END` 다 — 같은 세션의 `review/code/2026/08/15/09_58_24/RESOLUTION.md` "🔴 CRITICAL" 항목이 정확히 이 SQL 을 "음수는 `GREATEST(0,…)`→`0`" 에서 "`CASE WHEN … THEN NULL`" 로, 그리고 상한 클램프(`LEAST(2147483647, …)`)를 새로 추가하는 방식으로 고쳤다고 기록하고 있다. `terminal-duration.ts` 자체의 JSDoc(:81)은 `GREATEST(0, …)` 를 "종전엔"(과거형)으로 정확히 표기하는데, 이 호출부 인라인 주석만 과거형 표시 없이 현재형처럼 남아 있다. `grep -rn "GREATEST(0" codebase/` 로 확인한 결과 프로덕션 코드에서 이 표현이 남아 있는 유일한 자리다(다른 두 곳은 `terminal-duration.ts` 의 "종전엔" 과거 서술과 `.spec.ts` 의 `not.toContain('GREATEST(0')` 음성 단언). 이 자리는 하필 이번 PR 이 실제로 겪은 CRITICAL(24.8일 초과 시 UPDATE 전체 실패 → 영구 고착) 이 고쳐진 지점이라, 다음 편집자가 이 주석만 보고 "음수만 0으로 클램프하면 된다"고 오해하면 방금 고친 상한 클램프를 실수로 되돌릴 위험이 있다(이 프로젝트 메모리의 "방어를 한 방향으로만 세우는 반복 형태"와 정확히 같은 함정).
  - 제안: 주석을 실제 동작과 맞춘다. 예: `// int4 상한은 LEAST(2147483647, …), 시계 역행은 THEN NULL — 종전 GREATEST(0,…) 방어를 CRITICAL 로 교체했다(RESOLUTION 09_58_24 참조).` 또는 아예 `TERMINAL_DURATION_MS_SQL` 의 JSDoc 링크만 남기고 호출부 주석은 삭제(SoT 를 헬퍼 쪽에 둔다는 이 PR 의 다른 자리들과 일관됨).

- **[WARNING]** 같은 PR 안에서 "취소 경로 중 몇 곳이 DB write 확장이 필요했는가" 수치가 문서마다 다르다 (4 vs 5)
  - 위치: `plan/in-progress/spec-draft-eia-notification-payload-contract.md:188` — "cancelled 6곳(그중 **5곳**은 DB write·시그니처 확장 필요)"
  - 상세: 같은 diff 안의 다른 두 문서는 "4"로 일관된다.
    - `plan/in-progress/eia-terminal-payload.md` 재판정 ④ 표(게이트 222~223줄): `cancelled | 2곳(finalizeCancelledExecution·retry isCancelled arm) | O | payload 한 줄` / `cancelled | **4곳**(emitCancellationEvent 호출부 전부) | **X** | raw UPDATE SET + 헬퍼 시그니처` — 6곳 중 **4곳**이 X(DB write 확장 필요).
    - `CHANGELOG.md:9`(게이트) — "엔티티를 로드하지 않는 **5경로**(park 취소 · 위젯 idle 취소 · 재개 실패 취소 · 큐 대기 타임아웃 · **stalled 소진**)" — cancelled 4곳 + failed(stalled) 1곳 = 5. cancelled 만 떼면 4다.
    - `spec/5-system/14-external-interaction-api.md` §6.5(2026-08-15 구현 노트): "취소 경로 6곳 중 **4곳**은 엔티티를 로드하지 않는 raw UPDATE" — 정본(spec) 도 4로 적었다.
    - 실측: `grep -n "emitCancellationEvent(" execution-engine.service.ts` 결과 호출부는 `cancelParkedExecution`(:1077)·`markWebChatIdleTimeout`(:1208)·`markExecutionCancelled`(:2859)·`markQueueWaitTimeout`(:2908)·`finalizeCancelledExecution`(:4885) 5곳인데, 이 중 `finalizeCancelledExecution` 만 엔티티가 이미 로드돼 있어 raw UPDATE 확장이 불필요하다(`resolveTerminalDurationMs(savedExecution)` 직접 호출) — 즉 raw UPDATE 확장이 필요했던 곳은 4곳이 맞다.
    결과적으로 `spec-draft-eia-notification-payload-contract.md:188` 의 "5곳" 만 다른 3개 소스(같은 plan 의 자매 표, CHANGELOG, spec 정본)와 어긋나는 이상치다.
  - 제안: `spec-draft-eia-notification-payload-contract.md:188` 을 "cancelled 6곳(그중 **4곳**은 DB write·시그니처 확장 필요)" 로 정정.

## 그 외 확인 결과 (문제 없음 — 이 PR 의 문서화 품질은 전반적으로 높음)

- **CHANGELOG**: 신규 항목이 직전 항목의 예고("후속으로 분리")를 정확히 이어받고, breaking-change 성격(수신자가 `null` 을 방어해야 함)과 REST `GET /api/external/executions/:id` 비대칭(아직 미채움)을 명시적으로 고지한다. 비대칭은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(게이트 177~179줄) 에도 후속 항목으로 등재돼 있어 orphan 아니다.
- **spec 동반 갱신(API 문서 관점)**: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표·§6.3/§6.4 JSON 예제(`"durationMs": 4242` 추가)·§6.5 프로즈·`interaction` Planned 캐비엇 인용 전부가 이번 구현과 동기화됐다. "Planned" 캐비엇을 삭제하지 않고 취소선+"(해소)" 로 보존해 왜 한동안 비어 있었는지 이력을 남기는 이 저장소의 컨벤션을 그대로 따랐다.
- **JSDoc 품질**: 신규 `codebase/backend/src/shared/utils/terminal-duration.ts` 는 함수 3개(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`) 전부에 "왜 이 값인가"(재계산 금지 이유, `null` vs `undefined` 구분, int4 상한 클램프의 실측 근거, 음수 sentinel 통일 이유)를 근거와 함께 적은 상세 JSDoc 이 있다. `@returns` 도 명시.
- **인라인 주석**: `execution-engine.service.ts`/`retry-turn.service.ts` 의 `if (lastNodeId)` 블록 밖으로 옮긴 `finishedAt`/`durationMs` 계산 5곳 전부에 "왜 조건 밖인가"(outputData 만 마지막 노드에 의존, 이 PR 이 실제로 겪은 회귀) 설명이 붙어 있다.
- **타입 문서**: `chat-channel/types.ts` 의 `durationMs?: number | null` 3곳(EiaCompletedEvent/EiaFailedEvent/EiaCancelledEvent) 모두 "producer 는 항상 키를 싣지만 optional 을 유지하는 이유(consumer 계약, 레거시 재생 이벤트, 29개 fixture 실측)"를 동일하게 반복해 명시 — 세 타입이 같은 근거를 각자 들고 있어 drift 위험이 낮다.
- **예제 코드**: §6.3/§6.4 는 갱신된 JSON 예제가 있다. §6.5(cancelled) 는 이번 PR 이전부터 JSON 예제 자체가 없어 프로즈만 있는 상태이며, 이 PR 이 새로 만든 갭은 아니다(하위 우선순위 개선 여지로만 기록).
- **변경 이력 cross-doc 동기화**: `spec-draft-eia-notification-payload-contract.md`(필드 표 durationMs 행)·`spec-sync-external-interaction-api-gaps.md`(체크박스 분리)·`eia-terminal-payload.md`(재판정 ④) 세 트래커가 서로를 인용하며 갱신됐고, 수치 불일치(위 WARNING 2) 를 제외하면 서술은 일관된다.
- **주석-코드 일치(그 외)**: `execution.entity.ts:56`(`started_at` non-nullable + `default: () => 'NOW()'`) 과 `V001__initial_schema.sql:223`(`duration_ms INTEGER`) 인용을 직접 대조해 정확함을 확인했다.

## 요약

이번 PR 의 문서화 수준은 이 저장소 기준으로도 상당히 높다 — CHANGELOG·spec 3개 파일·convention 문서·plan 트래커 3개가 모두 동기화됐고, 신규 헬퍼(`terminal-duration.ts`)는 "왜"를 근거와 함께 적은 JSDoc 을 갖췄다. 다만 두 가지 실측 결함을 발견했다: (1) 직전 라운드에서 고친 CRITICAL SQL 버그(int4 상한 클램프 부재) 바로 옆의 인라인 주석이 여전히 고치기 전 동작(`GREATEST(0, …)`)을 설명하고 있어, 방금 고친 방어를 다음 편집자가 실수로 되돌릴 미끼가 된다. (2) 같은 diff 안의 plan 트래커 하나가 "취소 경로 중 DB write 확장이 필요했던 곳"의 수를 5로 적어, 같은 PR 의 자매 문서·CHANGELOG·spec 정본(모두 4)과 어긋난다. 두 건 모두 런타임 동작을 바꾸지 않는 순수 문서 결함이지만, 전자는 향후 회귀 위험을 키우는 성격이라 WARNING 으로 판정한다.

## 위험도

MEDIUM
