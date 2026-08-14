# Rationale 연속성 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검증 방법

prompt_file 이 컨텍스트 예산 초과로 target 본문과 `git diff` 를 생략했으므로, HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, HEAD=`9482cc0c0`)를
절대경로/`git -C` 로 직접 열어 실제 diff·Rationale 원문을 대조했다.

- `git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md spec/5-system/14-external-interaction-api.md spec/1-data-model.md` 전문
- `spec/5-system/14-external-interaction-api.md` R17 전문, `spec/5-system/6-websocket-protocol.md` "`llmCalls` 외부 수신자 strip" Rationale 전문
- `spec/5-system/2-api-convention.md` §5.4 (부재 표현 null vs 키 생략) 및 그 Rationale
- `spec/5-system/15-chat-channel.md` CCH-ERR-04 (null 분기 소비 측)
- 직전 라운드(`15_36_59`) `rationale_continuity.md` 산출물 + 그 이후 4개 커밋
  (`5eb12695a`·`dfc63bbb7`·`a78ab029e`·`9482cc0c0`)의 diff/커밋 메시지
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` `## 체크리스트` 현재 상태

이 시점은 오늘 다수의 `/ai-review`+`/consistency-check` 라운드(00:00~16:44)를 거쳐 수렴한 상태다.

## 발견사항

이번 diff 가 포함하는 결정 번복은 직전 라운드(`15_36_59`)가 확인한 것과 동일한 두 건이며,
그 이후 커밋(`5eb12695a`~`9482cc0c0`)은 해당 결정을 뒤집지 않고 문서 정확성만 보강했다:

1. **strip 깊이: top-level(depth-1)-only → 필드명 기준 깊이 무관.** WS §"`llmCalls` 외부 수신자
   strip" 항목에 `> (2026-08-14 갱신)` blockquote 로 번복 사유·근거 커밋(`81f2c60d6`·`5df89cda6`·
   `34e32e62f`·`7fa12301c`)을 명시했고, EIA R17 에도 대응하는 `> 값 마스킹만으로는 부족하다` blockquote
   를 추가했다. 두 문서 모두 "무근거 번복"에 해당하지 않는다.
2. **`getStatus` 값-마스킹-only → 값 마스킹 + 필드 삭제 병행.** EIA R17 의 "기각된 대안: 값-레벨
   마스킹은…" 문단(WS §Rationale)은 삭제되지 않고 그대로 남아 있다 — 이는 llmCalls 자체를 마스킹
   대안으로 되돌린 것이 아니라, strip 메커니즘(필드 삭제)의 **적용 범위**(WS fanout 단독 → WS
   fanout + EIA REST `getStatus()`, top-level → 깊이무관)를 넓힌 것이므로 기각된 대안의 재도입이
   아니다.

직전 라운드 이후 추가된 4개 커밋을 개별 확인한 결과, 신규 Rationale 연속성 위반은 없다:

- `dfc63bbb7` — EIA §6.2 에 "debug 전용 필드는 이 표면으로 나가지 않는다" caveat 를 **추가만** 했다
  (§R17·WS §4.4 역참조, 공용 유틸 SoT 목록 갱신). 기존 결정을 뒤집지 않고, 직전 라운드가 지적할 수
  있었던 "고쳤다고 선언한 지점에 실제로 방어 문서가 없던" 갭을 메운 보강이다.
- `5eb12695a` — normative 필드집합 표의 `error` 행에 nullable 정정을 반영하고, `details?` 필드의
  계보를 `output_data.error.details`(node-output.md §3.2)로 정정. 새 결정이 아니라 기존 R17/§5.4
  결정의 표기 누락을 메운 것.
- `a78ab029e` — 코드 주석/plan 실측치 정정(성능 벤치마크 기록). spec `## Rationale` 변경 없음.
- `9482cc0c0` — 테스트 타이틀 버그 수정. spec 변경 없음.

`1-data-model.md` 의 `Execution.error.{nodeId,code}` nullable 화는 `spec/5-system/2-api-convention.md`
§5.4 "부재 표현 — null vs 키 생략" 의 **기본 규칙(스칼라·항상-present 필드는 `null`)** 을 그대로
따르고, 소비 측(`chat-channel.md` CCH-ERR-04 `error.code === null` → `executionFailedInternal`
fallback)이 이미 이 형태를 전제로 문서화돼 있어 신규 invariant 우회가 아니라 기존 관행의 명문화다.
데이터모델 문서 자체에 이 필드를 "항상 non-null" 로 못박은 과거 Rationale 항목은 존재하지 않는다
(`spec/1-data-model.md` `## Rationale` 에 관련 항목 부재 확인) — 즉 뒤집을 과거 결정이 없다.

`§4.4 wire 필드 caveat` Rationale(2026-07-14, 2026-08-13 갱신)이 정한 "외부 클라이언트 소비 매핑
SoT = EIA §6.2, WS 내부 부가 식별자 SoT = WS §4.4" 오너십 분리 원칙도 이번 diff 에서 그대로
유지된다 — EIA §6.2 신규 문구가 `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 을 "WS §4.4 가
소유한다(의도된 스코프 분리)"고 명시적으로 재확인한다.

직전 라운드가 남긴 INFO(`spec-draft-eia-62-waiting-payload.md` 체크리스트 stale)는 이미 해소됐다 —
현재 `## 체크리스트`의 "spec 반영 — 7항목" 항목이 `[x]` 로 체크되어 있고 커밋 `4b13ca5ae` 를 근거로
남겼다. 신규로 보고할 항목 없음.

## 요약

이번 diff 의 두 결정 번복(strip 깊이 확장, `getStatus` 마스킹→마스킹+삭제 병행)은 모두 대응 spec
`## Rationale`(WS §"`llmCalls` 외부 수신자 strip", EIA `R17`) 항목을 같은 브랜치 내에서 함께
갱신했고, "기각된 대안" 문단은 삭제 없이 보존됐다. 직전 라운드(`15_36_59`) 이후의 4개 커밋은 모두
문서 정확성·테스트 보강이며 새로운 결정 번복이나 원칙 위반을 만들지 않았다. `1-data-model.md` 의
nullable 정정도 기존 API 규약 §5.4 기본 규칙과 정합하고 뒤집을 과거 결정이 없다. Rationale
연속성 관점에서 CRITICAL/WARNING 에 해당하는 항목을 찾지 못했다.

## 위험도

NONE
