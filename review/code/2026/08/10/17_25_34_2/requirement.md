# 요구사항(Requirement) 리뷰 — `17_25_34_2`

## 검토 범위와 방법

이 라운드의 diff 자체(`_prompts/requirement.md`)에는 `codebase/channel-web-chat/**` 소스 diff 가
포함돼 있지 않다 — 파일 1~12 는 이전 라운드들의 리뷰 산출물(json/md)이 새 커밋으로 편입된 것이고,
실질 검토 대상은 파일 13 `spec/7-channel-web-chat/3-auth-session.md` 뿐이다. 지시에 따라
`Read`/`Grep` 으로 스펙 전문과 실제 구현 파일(`use-widget.ts`, `use-token-refresh.ts`,
`session-store.ts`, `eia-client.ts`, `use-widget-eager-start.test.ts`, `plan/in-progress/webchat-auth-session-status-reconcile.md`)
을 직접 열어 §3.1-2·§R4 원문과 line-level 로 대조했다.

## 판정 요약 — "닫은 것 vs 남긴 것" 구분은 정직하다

- **404 → `[ended]`+storage 정리**: `seedWaitingFromStatus` catch 의 `err.status === 404` 분기가
  `finalizeEnded("execution.not_found")` 를 호출 (`use-widget.ts:622-625`). spec §3.1-2 3번째
  불릿(`404 EXECUTION_NOT_FOUND`)과 일치.
- **401 → 낙관적 refresh 1회 → 성공 시 복원 / 재차 `401`·`410` → 종료 확정**: `recoverFromExpiredToken`
  (`use-widget.ts:419-477`) 이 `refreshErr.status === 401 || refreshErr.status === 410` 을 terminal 로
  판정해 `finalizeEnded("execution.token_revoked")` 호출. spec §3.1-2 4번째 불릿(`use-widget.ts:89`
  변경분 — "재차 `401`·`410` 이면 종료로 간주")과 §R4(`3-auth-session.md:104-108`) 문언 그대로.
- **storage 정리 책임(§3.1-3)**: `finalizeEnded`→`teardownSession()`→`clearSession()` 한 경로로
  SSE terminal·seed-terminal(200)·404·복구불가 401/410·명령 `410 Gone`(`sendCommand`,
  `use-widget.ts:758-763`) 다섯 진입점이 전부 수렴한다. spec 열거와 1:1 대응.
- **원인 A(`scheduleRefresh` 소실) 닫힘 확인**: `start()`(`use-widget.ts:733`)·`applyConfig()`
  (`use-widget.ts:1090`) 양쪽 모두 `outcome`/`deferStream` 값과 무관하게 `scheduleRefresh()` 를
  무조건 호출한다(`openStream` 만 조건부로 건너뜀). 직접 읽어 확인했다.
- **원인 B(스트림 부재) 미해결 — 등재 정확함**: `openStream(` 호출부를 `widget/*.ts`(테스트 제외)
  전수 grep 하면 `use-widget.ts:732`·`:1089` 두 곳뿐이고 둘 다 `refresh_deferred`/`deferStream` 에서
  건너뛴다. `use-token-refresh.ts` 는 `openStream` 을 **0회** 호출한다(grep 확인) — 주기 갱신이
  아무리 성공해도 스트림을 못 연다는 plan 의 주장이 실측과 일치한다. `plan/in-progress/webchat-auth-session-status-reconcile.md`
  의 "미해결" 절(처방 3택 a/b/c)이 정확히 이 갭을 등재하고 있고, 이 PR 의 스코프(REST 오류 분기
  구현)와 원인 B(설계 변경 필요)는 실제로 표면이 다르다 — 스코프 분리가 인위적이지 않다.
- **testing CRITICAL 재발 방지(RESOLUTION #1) 확인**: `use-widget-eager-start.test.ts:448-499`
  (네트워크 오류)와 `:501-544`(`500`)가 **같은 `scheduleRefresh` 사이클 진행 여부**(before/after
  refresh 호출 횟수 비교)를 동일하게 단언한다 — "한쪽만 보강" 재발이 없음을 코드로 확인.

## 발견사항

- **[WARNING] [SPEC-DRIFT] §3.1-2 의 `401` 불릿과 §R4 가 세 번째 갈래(`refresh_deferred`)를 문서화하지 않는다**
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`(§3.1-2 401 불릿), `spec/7-channel-web-chat/3-auth-session.md:104-108`(§R4) / 구현: `codebase/channel-web-chat/src/widget/use-widget.ts:94-106`(`SeedOutcome` JSDoc), `codebase/channel-web-chat/src/widget/use-widget.ts:447-463`(non-terminal 분기)
  - 상세: spec 본문은 401 처리 결과를 "성공 시 SSE 재연결로 복원" / "재차 `401`·`410` 이면 종료" 두 갈래로만 서술한다(§R4 도 동일하게 "만료면 복구, 재차 실패면 종료"). 그런데 실제 구현은 `refreshToken` 요청 자체가 `401`/`410` **아닌** 이유(네트워크·5xx)로 실패하는 세 번째 경우를 별도로 처리한다 — `"refresh_deferred"`: 스트림은 열지 않지만 `scheduleRefresh` 는 유지해, "죽은 토큰으로 SSE 를 여는 것"(구 `"continue"` 결함, `16_42_07` CRITICAL)과 "갱신 사이클 자체가 끊기는 것"(구 `"stale"` 결함, `16_56_39` CRITICAL) 둘 다를 피한다. §3.1 상단 배너(`3-auth-session.md:66`)의 "그 외 status·오류는 여전히 `catch` soft-fail 후 SSE 로 진행한다"는 `getStatus` 자체의 바깥 catch(404/401 이외 상태코드)를 가리키는 문장이라 이 안쪽 refresh 실패 갈래를 가리지 않으며, 오히려 두 문맥을 구분 없이 읽으면 "그 외는 SSE 로 진행한다"로 오독될 여지가 있다(실제로는 SSE 를 **건너뛴다**).
  - 판단: 코드가 옳다(테스트 `use-widget-eager-start.test.ts:501-544` 가 이 축을 전용으로 겨냥해 고정) — 두 개의 독립 CRITICAL 이력을 거쳐 도달한 의도적 설계다. spec 이 이 갈래를 아직 못 따라간 SPEC-DRIFT.
  - 제안: 코드는 유지. `3-auth-session.md` §3.1-2 401 불릿에 세 번째 sub-bullet(요지: "refresh 요청 자체가 `401`/`410` 아닌 사유로 실패하면 종료 확정하지 않는다 — 스트림은 이번 사이클에 열지 않되 주기 갱신은 유지한다") 추가, §R4 Rationale 에도 같은 취지 한 문장 반영. `project-planner` 세션에서 처리.

- **[INFO] `getStatus` 의 방어적 `410` 처리가 401 과 같은 종료 판정 경로를 안 탄다(spec 이 이 경우를 배제해 실질 영향 없음)**
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:99`(`getStatus` 의 `res.status === 410` 특수 처리), `codebase/channel-web-chat/src/widget/use-widget.ts:610-639`(`seedWaitingFromStatus` catch — 404/401 만 특별 분기, 그 외는 soft-fail `"continue"`)
  - 상세: `getStatus` 가 `410` 을 받으면 `EiaError(410)` 을 던지지만, 호출부 catch 는 404/401 만 갈래를 두고 나머지(410 포함)는 전부 soft-fail 로 흘려 SSE 를 연다. spec §3.1-2 는 "EIA-IN-12 의 `410 Gone` 은 명령(interact) 전용이라 상태 조회에는 나타나지 않는다"고 명시적으로 이 경우를 배제하므로 현재는 이론상 도달 불가 경로다.
  - 제안: 조치 불요(spec 이 발생 자체를 배제). 향후 상태 조회에 410 이 실제로 나타나는 변경이 생기면 이 분기도 재검토 대상임을 기억할 것 — 별도 액션 없음.

## 요약

이 라운드에서 실질적으로 검토 가능한 코드 변경은 없고(diff 는 이전 라운드 리뷰 산출물 편입 +
spec 문서 갱신뿐), 스펙 원문·구현 원문을 직접 열어 대조한 결과 `404`·`401`(성공/재차실패)·`410`
REST 분기와 storage 정리 책임(§3.1-3)은 spec §3.1-2·§R4 문언과 정확히 line-level 로 일치하며,
"cause A(scheduleRefresh 소실) 닫힘·cause B(스트림 부재) 미해결" 이라는 PR 자신의 스코프 구분도
grep/코드 추적으로 실측 검증된다 — 정직한 구분이다. 유일한 발견은 spec 본문이 구현이 이미 갖춘
세 번째 갈래(`refresh_deferred`: 비-401/410 refresh 실패 시 스트림 스킵+갱신 유지)를 아직 명문화하지
않은 SPEC-DRIFT(WARNING) 하나로, 코드를 되돌릴 사안이 아니라 spec 갱신 누락이다.

## 위험도
LOW
