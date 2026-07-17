# 보안(Security) Review

## 검토 범위 확인

실질 프로덕션 코드 변경은 `codebase/channel-web-chat/src/widget/use-widget.ts` 1개 파일뿐이다. 나머지는:
- `webauthn.controller.spec.ts` / `use-widget-eager-start.test.ts` — 테스트 전용(신규 assertion 추가, 프로덕션 로직 무변경)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/7-channel-web-chat/1-widget-app.md` — 문서
- `review/code/2026/07/17/02_04_13/**`(RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `meta.json`, 9종 reviewer 산출물) — 직전 ai-review 라운드의 기록 산출물을 저장소에 커밋하는 것뿐, 코드 아님

이므로 실질 공격면 분석은 `use-widget.ts` 에 집중한다.

## 발견사항

- **[INFO]** `use-widget.ts` 의 이번 변경은 순수 방어적 강화이며 새 공격면을 만들지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `finalizeEnded` 헬퍼 신설, `seedWaitingFromStatus` 의 `sessionRef.current !== session` staleness 가드, `applyConfig`(세션 복원)에서 `seedWaitingFromStatus` 반환값(`ended`)으로 후속 `openStream`/`scheduleRefresh` 게이팅
  - 상세: 수정 전에는 세션 복원(`applyConfig`) 경로가 `seedWaitingFromStatus` 의 신규 teardown 부작용에 무방비였다 — 이미 종료된 execution 을 복원한 경우 teardown 직후 (a) 무효화된 per-execution 토큰으로 SSE 스트림을 재오픈하고 (b) `refreshToken` 성공 시 방금 `clearSession()` 한 `sessionStorage` 를 종료된 세션 데이터로 되살릴 수 있었다. 이번 diff 는 반환값 계약(`Promise<boolean>`)으로 세 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백) 모두를 게이팅해 이 경로를 닫았다. 추가로 fire-and-forget 폴백 호출에 대해 `sessionRef.current !== session` ref 비교로 stale 응답을 폐기해, 지연 응답이 이미 교체된 세션에 유령 상태(WAITING 재현/오탐 ENDED)를 그리는 것도 차단한다. 인증·세션 데이터를 다루는 로직이라는 점에서 보안 인접 영역이지만, 이번 변경은 클라이언트 측 세션 위생(stale 토큰으로 스트림을 다시 열지 않음, 종료된 세션을 storage 에 재기록하지 않음)을 개선하는 방향이며 신규 파싱기·신규 신뢰 경계·권한 상승 경로를 추가하지 않는다.
  - 제안: 조치 불필요. 참고로 클라이언트 측 게이팅은 UX/상태 일관성 보강이지 보안 경계 자체는 아니다 — 실질 보안 경계는 서버가 이미 종료된 execution 에 대한 SSE 구독·`refresh-token` 요청을 토큰 만료/execution 상태 검증으로 거부하는 것이어야 한다(본 diff 범위 밖). 서버 측이 이 방어를 이미 갖추고 있는지(예: 종료된 execution 의 `per_execution` 토큰을 즉시 invalidate 하는지) 별도로 확인해두면 defense-in-depth 관점에서 안심할 수 있다.

- **[INFO]** host 로 전달되는 `reason` 값은 고정 allow-list 기반이라 인젝션 경로 없음
  - 위치: `use-widget.ts` `finalizeEnded(reason: string)` → `bridgeRef.current?.sendEvent("conversationEnded", { reason })`, 호출부 `handleEiaEvent`(`TERMINAL_EVENTS` 문자열 리터럴 union) / `seedWaitingFromStatus`(`` `execution.${status.status}` `` 를 `TERMINAL_EVENTS` 로 먼저 필터링한 뒤에만 도달)
  - 상세: 이번 라운드에서 `reason` 산출·전달 경로 자체가 바뀌진 않았고(직전 라운드 security reviewer 가 이미 "allow-list 검증 후에만 반영"으로 확인), 신설된 `finalizeEnded` 헬퍼도 동일 인자를 그대로 위임하는 리팩터라 신뢰 경계에 변화 없음. 서버가 예기치 않은 `status.status` 값을 반환해도 `TERMINAL_EVENTS` 밖이면 분기 자체가 스킵돼 임의 문자열이 postMessage 로 host 에 실리지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 fixture 는 실제 시크릿이 아님
  - 위치: `webauthn.controller.spec.ts` 신규 `it('maps nullable fields ...)` (credential id `'cred-2'`, 날짜 리터럴), `use-widget-eager-start.test.ts` 신규 `it('복원된 세션이 이미 terminal ...)` (`token: "iext_prev"` 등)
  - 상세: 모두 mock 응답/사전 저장 fixture 용 더미 값이며 고엔트로피 문자열·실제 키 포맷(JWT 서명, API 키 패턴)이 아니다. 프로덕션 인증 로직 변경도 없다(컨트롤러/서비스 코드는 이 diff 범위 밖).
  - 제안: 조치 불필요.

- **[INFO]** review 산출물(`RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/`meta.json`/reviewer `.md` 9종) — 시크릿·자격증명 없음
  - 위치: `review/code/2026/07/17/02_04_13/**`
  - 상세: `_retry_state.json` 에 담긴 값은 로컬 워크트리 절대경로(파일시스템 경로)뿐이며 API 키/토큰/자격증명류는 없음. 코드 로직 변경도 없는 문서/메타데이터 커밋.
  - 제안: 조치 불필요.

- **[INFO]** 에러 처리 — 민감정보 노출 없음, 기존 soft-fail 관례 보존
  - 위치: `use-widget.ts` `seedWaitingFromStatus` catch 블록(이번 diff 로 로직 변경 없음, `return false` 만 추가), 대응 회귀 테스트 `use-widget-eager-start.test.ts` 기존 "폴백 getStatus 실패 시 soft-fail"
  - 상세: `getStatus` 실패 시 `console.warn` 으로만 로깅하고 예외 원문·스택을 UI/host 로 노출하지 않는 기존 패턴이 이번 반환 타입 확장(`Promise<void>` → `Promise<boolean>`) 이후에도 그대로 유지됨을 확인.
  - 제안: 조치 불필요.

## 요약

이번 diff 의 유일한 프로덕션 코드 변경(`use-widget.ts`)은 세션 복원 경로의 stale-토큰 SSE 재오픈·종료 세션 storage 부활을 막는 클라이언트 측 방어 강화이며, 새로운 인젝션·인증 우회·시크릿 노출 경로를 만들지 않는다. `reason` 값은 여전히 고정 allow-list 로만 host 에 전달되고, 신규 테스트·문서·review 산출물 파일은 모두 시크릿을 포함하지 않는 더미 값이거나 로컬 경로뿐이다. Critical/Warning 급 보안 결함은 발견되지 않았으며, 유일하게 남는 논점은 이 게이팅이 클라이언트 측 위생 개선이지 서버 측 보안 경계 자체는 아니라는 점(서버가 종료된 execution 에 대한 토큰/스트림 요청을 독립적으로 거부하는지는 이 diff 범위 밖이라 확인 필요) — 이는 차단 사유가 아닌 참고 사항이다.

## 위험도

NONE
