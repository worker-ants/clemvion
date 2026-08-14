# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

`origin/main...HEAD`(9 커밋, `git diff --stat -- spec/` = **빈 결과, 직접 확인**)는
`spec/**` 를 전혀 건드리지 않고 아래 코드만 바꾼다 — `llmCalls` external-strip 을
공유 유틸(`shared/utils/strip-external-only-fields.ts`)로 승격하고, REST 단발 조회
`GET /api/external/executions/:id`(`interaction.service.ts getStatus()`)의 세 출구
(waiting `nodeOutput` · terminal `result` · terminal `error`)에 **대칭 적용**한
보안 수정이다. target 지시에 따라, 프롬프트에서 컨텍스트 예산 초과로 생략된
`spec/5-system/14-external-interaction-api.md`(101,724자)·`6-websocket-protocol.md`
관련 절·`<git diff>` 는 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff`/`Read`/`grep` 로 직접 재확인했다.

이 diff 는 **이전 두 라운드**(`review/consistency/2026/08/14/12_06_21/cross_spec.md`
CRITICAL 1, `review/consistency/2026/08/14/14_30_36/cross_spec.md` CRITICAL)가
지적한 문제의 **연속선**이다 — 코드 쪽은 그 두 라운드가 요구한 수정(REST 경로에도
strip 적용 → 이번엔 세 출구 전부 대칭)을 계속 이행했지만, 두 라운드가 함께 요구한
**spec 텍스트 갱신은 이번에도 포함되지 않았다.** 아래 CRITICAL 은 그 미해소 상태의
3번째 재확인이다.

---

## 발견사항

### [CRITICAL] `spec/5-system/14-external-interaction-api.md` §R17 이 이번 diff 로 더 벌어진 코드-스펙 간극을 그대로 반증된 문장으로 유지한다 (3라운드 연속 미해소)

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 신규
  `redactAndStrip()` 헬퍼(주석이 `12_06_21`/`14_30_36` CRITICAL 을 SoT 로 직접 인용) —
  waiting `nodeOutput`(`:349` 부근) · terminal `result`/`error`(`:408~421` 부근) **세 출구
  전부**에 `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))` 적용.
  직전 라운드(`14_30_36`)가 지적한 "`nodeOutput` 만 strip 받고 `result`/`error` 는
  `deepRedactSecrets` 단독" 비대칭은 이번 커밋(`7fa12301c`)으로 **해소됐다** — 세 출구가
  같은 헬퍼를 호출하므로 구조적으로 재분리 불가능.
- **충돌 대상**:
  - `spec/5-system/14-external-interaction-api.md:1346-1352`(§R17 "표면 제약(보안)") —
    *"getStatus 는 nodeOutput 전체 + terminal result(COMPLETED)/error(FAILED)의
    outputData 를 deepRedactSecrets 로 마스킹한다(REST 는 sanitizePayloadForWs
    미적용 경로라 필수). 마스킹은 secret-shape 만 치환(정상 결과 데이터는
    copy-on-change 로 보존)."*
  - `spec/5-system/6-websocket-protocol.md:519`(§4.4) — *"strip 대상은 본 WS 이벤트
    필드뿐이며, DB 영속 경로 `NodeExecution.output_data.meta.turnDebug[i].llmCalls`
    및 그를 출처로 하는 실행 이력 디버그 패널은 영향 없다."*
  - `spec/5-system/6-websocket-protocol.md:1056-1064`(Rationale, 동일 문구 반복)
- **상세**: 위 세 지점은 지금도 "REST `getStatus()` 는 `deepRedactSecrets`(값 마스킹)만
  거치고, 필드 제거(strip)는 WS 이벤트/fanout 전용" 이라고 **정상 동작으로 서술**한다.
  그런데 이번 diff 로 `getStatus()` 의 **세 출구 모두**가 `stripExternalOnlyFields` 를
  거치게 됐고, 그 강도도 depth-1(top-level)이 아니라 **깊이 무관 재귀**다(`5df89cda6`).
  즉 spec 이 "그런 일 없다"고 말하는 바로 그 동작이, 3라운드 전엔 waiting 출구 하나에서만,
  이번엔 세 출구 전부에서 실제로 일어난다 — 코드가 fix 될수록 spec 문장과의 거리는 좁혀지지
  않고 오히려 **적용 범위 면에서 더 벌어졌다**(반증 사례가 1개→3개).
  `git diff origin/main...HEAD --stat -- spec/` 가 빈 결과인 것으로 spec 미변경을 직접
  재확인했다. 다만 이번 diff 는 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  (신규 241줄)에 항목 (7)로 정확한 처방 문구를 준비해 뒀다 — *"§R17: `getStatus` 는
  `deepRedactSecrets` 로 값 마스킹한 뒤 `stripExternalOnlyFields`(필드 제거)를 병행한다.
  세 출구(waiting `nodeOutput`·terminal `result`/`error`) 전부"* + *"§4.4: 'strip 대상은
  본 WS 이벤트 필드뿐' → 'WS fanout + EIA REST `getStatus()` 양쪽'"*. 즉 **답은 이미
  적혀 있으나 planner 가 실제 `spec/` 에 반영하지 않은 상태**다(해당 draft 자체의 체크리스트
  `- [ ] spec 반영 (6항목)` 이 미완료로 남아 있음, 직접 확인).
  이 프로젝트는 정확히 이 클래스의 spec staleness 가 리뷰어를 오도한 전례가 있다
  (`plan/complete/eia-strip-llmcalls.md:48` — reviewer 가 draft 의 "Before" 블록을
  현행 spec 으로 오인).
- **제안**:
  1. (project-planner) `spec-draft-eia-62-waiting-payload.md` 항목 (7)을 그대로
     `spec/5-system/14-external-interaction-api.md` §R17 + `6-websocket-protocol.md` §4.4·
     Rationale 에 반영 — draft 는 이미 정확한 문구를 갖고 있으므로 새로 작성할 것이 없다.
  2. §R17 갱신 시, 이번 라운드에 새로 대칭화된 사실(세 출구 모두 적용, 비대칭 아님)도
     함께 반영해 draft 작성 시점(비대칭이던 시점)보다 갱신된 서술을 쓴다.
  3. `eia-terminal-payload.md`(이번 diff 신규)는 이미 이 draft 를 "차단 해제 조건"으로
     정확히 참조하고 있으므로 추가 조치 불필요 — draft 확정만 하면 두 plan 이 함께 풀린다.

### [INFO] 이전 라운드(`14_30_36`) WARNING — `nodeOutput`/`result`/`error` 방어 비대칭 — 이번 diff 로 해소됨

- **target 위치**: `interaction.service.ts` `redactAndStrip()` 신규 — 세 출구 공통 호출
- **충돌 대상**: 없음(해소 확인용 기록)
- **상세**: `14_30_36` WARNING 이 지적한 "`Execution.outputData` 는 구조상 `.meta` 를
  못 가져 우연히 안전"이라는 미문서화 전제에 기댄 비대칭은, 커밋 `7fa12301c` 가 헬퍼로
  묶어 구조적으로 재발 불가능하게 만들며 사라졌다(직접 diff 확인). 이 상태 변화는
  CRITICAL 판정에 영향 없음 — 위 CRITICAL 은 정확도가 아니라 **spec 텍스트가 실제 동작과
  반대로 서술**하는 문제이기 때문.
- **제안**: 없음(정보성).

---

## 요약

이번 diff 는 REST `getStatus()` 의 세 출구(waiting/terminal `result`/terminal `error`)
전부에 대칭적으로 `stripExternalOnlyFields`(깊이 무관 필드 제거)를 적용해, 직전 라운드
(`14_30_36`)가 지적한 방어 비대칭 WARNING 은 코드 레벨에서 올바르게 해소한다. 그러나
그 라운드와 그 이전 라운드(`12_06_21`)가 함께 요구한 spec 갱신
(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4·
Rationale)은 이번에도 포함되지 않았다(`git diff --stat -- spec/` 빈 결과로 직접 재확인) —
두 문서는 여전히 "REST `getStatus` 는 값-마스킹만 받고 필드 strip 은 WS/fanout 전용"이라고
서술하는데, 이번 diff 로 그 서술이 반증하는 실제 동작의 적용 범위가 **1개 출구에서 3개
출구로 넓어졌다.** 다행히 이번 diff 가 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
에 정확한 처방 문구를 이미 준비해 뒀으므로, 남은 작업은 planner 가 그 draft 를 실제
`spec/` 파일에 반영하는 것뿐이다. 이 영역은 spec staleness 가 과거 리뷰 판정을 오도한
전례(`eia-strip-llmcalls.md` C-1 false positive)가 있어 재발 위험이 실증적이다.

## 위험도

CRITICAL
