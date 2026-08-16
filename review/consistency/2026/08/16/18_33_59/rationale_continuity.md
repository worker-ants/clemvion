# Rationale 연속성 검토 — spec/5-system/ (EIA 내부 읽기 경로 마스킹 followup, 4라운드 fix 반영 후)

## 검토 방법 메모

prompt_file 번들이 컨텍스트 예산 초과로 `<git diff origin/main...HEAD -- code_areas>` 원문과 `4-execution-engine.md`·`1-auth.md` 등 15개 파일을 절단했으므로, 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`, HEAD=`95e7a56e8`)에서 `git diff origin/main...HEAD` 를 직접 실행해 실제 target diff(spec 6개 파일 + 관련 코드)를 확보했다. 관련 spec 의 `## Rationale` 원문(`spec/5-system/14-external-interaction-api.md` §R17, `spec/2-navigation/14-execution-history.md` R-5, `spec/conventions/secret-store.md`)과 구현 코드(`executions.service.ts`, `background-runs.service.ts`, `redact-stored-error.ts`)를 절대경로로 대조했다.

이번 diff 대상: `spec/5-system/14-external-interaction-api.md`(§7.1 캐비엇 + §R17) · `spec/5-system/6-websocket-protocol.md`(§4.1 이벤트 표) · `spec/1-data-model.md`(§2.14) · `spec/2-navigation/14-execution-history.md`(R-5) · `spec/4-nodes/1-logic/12-background.md`(§8.2) · `spec/conventions/secret-store.md`(§1).

또한 같은 세션의 직전 라운드(`review/consistency/2026/08/16/18_20_34/rationale_continuity.md`)가 이미 이 diff 의 조기 버전을 검토해 INFO 1건(§R17 자기-인용 부정확)만 남겼고, 그 직후 커밋(`95e7a56e8`, "4라운드 리뷰")이 그 INFO 를 포함해 3건의 impl-done INFO 를 모두 반영했다. 본 라운드는 그 fix 가 실제로 반영됐는지 + 새 회귀가 없는지를 확인하는 데 집중했다.

## 발견사항

없음.

## 정합성 확인 — 위반 없음 (근거 기록)

1. **§R17 구판의 "미결(open item)"을 이번에 확정** — 과거 Rationale 은 "내부 REST 마스킹 여부는 아직 정하지 않았다" 는 명시적 **미결** 상태였지 기각된 대안이 아니었다. target 은 그 미결을 결정으로 전환하면서 근거(형제 필드 우회·R-5 원용·잔여 3가지 명시)를 같은 커밋 안에 함께 기술했다 — 검토 관점 3("결정의 무근거 번복")의 요구를 충족한다.

2. **`egress-only` invariant 준수 확인** — §R17 기존 원칙("내부 소비처는 faithful 텍스트 유지, DB 는 원문 보존")을 이번 확장이 우회하지 않는다. 코드 확인(`executions.service.ts`, `background-runs.service.ts`) 결과 `redactStoredErrorForResponse` 는 `findById`/`getChain`/`stop`/`toExecutionDto`/`BackgroundRunsService` 의 **응답 조립 지점에서만** 호출되고, DB write 경로·워크플로우-어시스턴트 LLM 도구(`explore-tools.service.ts`, 이번 diff 에서 미변경 — `git diff --stat` 확인)에는 적용되지 않는다. "잔여(범위 밖) ③" 캐비엇("`explore-tools.service.ts` 에 값-패턴 마스킹을 단순 합성하면 안 된다")과 실제 코드 범위가 일치한다.

3. **R-5(`spec/2-navigation/14-execution-history.md`) 원칙 원용의 스코프 오염 방지** — target 은 "R-5 의 boundary masking parity 원칙은 근거로 원용됐을 뿐, R-5 가 `Execution.error`/`nodeExecutions[].error` 를 이미 규정하진 않았다" 고 명시적으로 선을 그어, 두 정책(Config echo=write-time 마스킹 vs error=egress-time 마스킹)을 혼동하지 않도록 방어한다.

4. **직전 라운드 INFO 수정 확인** — `18_20_34` 라운드가 지적한 "종전 서술이 이 갭을 '내부 REST vs WS' 라 불렀는데" 라는 부정확한 자기-인용은 `95e7a56e8` 에서 "종전 서술은 이 갭을 *'내부 REST 와의 비대칭은 미결이다'* 로 REST 표면에 한정해 적었는데" 로 정정됐다(현재 §R17 라인 1494). 원문(구판 diff 확인: "**내부 REST 와의 비대칭은 미결이다**: `GET /api/executions/:id` 는 `Execution.error` **원문**을 반환하므로...")과 이제 축자적으로 일치한다. 동일 커밋에서 [API 규약 §5.3] 앵커도 이 문서 내부(`#53-단발-상태-조회`, 오류)가 아니라 `2-api-convention.md#53-에러-응답` 로 바르게 걸었다 — 저장소 내 동일 헤더를 가리키는 다른 6곳(`3-error-handling.md`, `12-webhook.md`, `1-manual-trigger.md` 등)과 앵커 슬러그가 일치함을 grep 으로 확인했다.

5. **`secret-store.md` 신규 비대상 예외(`Trigger.config.interaction.triggerToken`)의 논리 결함도 이번 라운드에 수정됨** — 문서 서두 원칙("모든 도메인 모듈은 SecretResolver 를 경유")에 대한 예외 신설이지만 (a) 기존 `AuthConfig.config` 예외와 "같은 종류가 아님"을 명시 구분, (b) 근거 a/b/c 를 독립적으로 세움, (c) "평문 보관 일반의 선례로 인용 금지" 캐비엇. 이번 라운드 직전 발견(같은 세션 `17_12_34`/`18_14_50` security INFO)이 근거 (a)("timing-safe 비교하려면 평문이 필요")가 반례(해시+`timingSafeEqual`)로 무너짐을 지적했고, 현재 HEAD 는 (a)를 "비용 근거이지 필요성 근거가 아니다"로 낮추고 반례를 본문에 명시하며 실질 근거를 (c)로 못박았다 — 근거 자체가 무너진 상태로 방치되지 않았다.

6. **`spec/4-nodes/1-logic/12-background.md` §8.4 권한 정책과의 정합** — "역할 기반 추가 제한 미구현, workspace 멤버면 viewer 도 조회 가능" 이라는 기존 문서화된 정책이 새 마스킹 근거("viewer 포함 전원이 조회하고 프런트가 배너에 원문을 렌더")와 정확히 부합한다.

7. **잔여 갭의 정직한 열거** — target 은 "적용 범위는 총칭이 아니라 열거"라며 잔여 3가지(① WS `execution.node.*` emit 원문 ② `inputData`/`outputData` 비대칭 미해결 ③ workflow-assistant LLM 도구의 키-기반 마스킹과 값-마스킹 단순 합성 금지)를 명시했다. "문서화된 보장이 구현보다 넓으면 안 된다"는 이 저장소의 반복 실패 패턴을 스스로 예방했다.

8. **`stopInternal` 반환 지점 수 정정(4라운드 fix)** — JSDoc/테스트 제목이 "반환 지점 넷" → "return 문 셋(+`?? execution` 폴백 포함 여섯 가지)" 으로 정정됐다. 이 수치는 "단일 관문(`toResponseExecution`)으로 마스킹을 몰아야 한다"는 설계 근거로 쓰이므로, 수치 오류가 설계 결정 자체를 무효화하지는 않지만(관문 설계는 반환 지점이 3이든 4든 유효) 근거 서술의 정확성이 개선됐다.

## 요약

target(§R17 "내부 읽기 경로" 마스킹 확장·WS `execution.snapshot` 캐비엇·`1-data-model.md` §2.14 신규 행·`12-background.md` §8.2 캐비엇·`secret-store.md` 신규 명시적 비대상 예외)은 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하지 않았다. 오히려 이전에 "미결(open item)"로 명시돼 있던 항목을 결정으로 전환하면서 근거·기각 사유·잔여 스코프를 같은 변경 안에 충실히 기술했고, `egress-only`/`boundary masking parity`/`Roles 게이트 없음` 등 기존 설계 원칙과 충돌 없이 정합했다. 특히 같은 세션 내 이전 리뷰 라운드(`review/consistency/.../18_20_34`)가 지적한 자기-인용 부정확(§R17)과 근거 논리 결함(secret-store.md triggerToken 예외 근거 (a))이 후속 커밋(`95e7a56e8`)에서 실측 근거와 함께 정정된 것을 확인했다 — 남은 미해결 rationale-continuity 발견사항은 없다.

## 위험도
NONE
