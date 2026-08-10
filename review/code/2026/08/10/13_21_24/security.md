# 보안(Security) Review

## 검토 범위 메모

이번 payload 는 28개 파일로 구성되어 있으나 실질적인 애플리케이션 코드 변경은 2개뿐이다:

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream()` 을 자가-게이팅(self-gating)
  구조로 바꿔 SSE 스트림 소유권 가드를 함수 내부 단일 지점으로 이동(반환 타입 `void` → 명명 union
  `StreamClaim`).
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 회귀 테스트 주석만 갱신
  (아키텍처 서술 정정, 단언 로직 변경 없음).

나머지는 `plan/in-progress/**` 신규 문서 2건, `review/code/**`·`review/consistency/**` 산출물(과거
리뷰·컨시스턴시 라운드 기록), `spec/7-channel-web-chat/3-auth-session.md` 의 frontmatter/캡션 정정이다.
이들은 실행되는 코드가 아니므로 인젝션·인증우회·시크릿 노출 표면 자체가 없고, 문서 내용도 직접
`Read` 로 대조해 시크릿·토큰 리터럴이 포함되지 않았음을 확인했다.

## 발견사항

리뷰 대상 diff 범위 내에서 **CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.**

- **[INFO]** SSE 스트림 소유권 가드가 호출부 복제(`start()`·`applyConfig` 각자 손으로 작성)에서
  `openStream()` 내부 단일 지점 강제로 이동 — 보안 관점에서 긍정적
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:386-411`(`openStream` 정의),
    `:622-623`(`start()` 호출부), `:973-974`(`applyConfig` 복원 호출부)
  - 상세: 종전엔 `start()`·`applyConfig` 두 호출부가 각자 `sessionEstablished()` 를 확인한 뒤에만
    `openStream()`을 불렀다(이전 라운드 리뷰 `review/code/2026/08/10/12_39_25/security.md` 가 이미
    지적한 이중 EventSource/세션 교체 레이스). 이번 diff 는 그 재확인을 `openStream` 진입 시점
    (`if (streamRef.current !== null) return "already_owned";` → `closeStream()` 호출 **전**에 조기
    반환)으로 옮겨 "SSE 는 하나만 소유한다" 불변식을 구조적으로 강제한다. 실제 소스를 직접 열어
    확인한 결과 `!client`(no_client) → `streamRef.current !== null`(already_owned) → `closeStream()`
    순서가 동기 코드로 유지되어(중간에 `await` 없음) 검사와 소유권 이전 사이의 새로운 TOCTOU 창을
    만들지 않는다. 두 호출부 모두 새 계약을 **부정 비교**(`claim !== "opened" && claim !== "no_client"`)로
    받아 fail-closed 방향을 유지한다(JSDoc `:619-621` 이 그 이유를 명시).
  - 제안: 조치 불필요(개선). 향후 세 번째 seed→openStream 호출부가 추가돼도 이 가드가 자동 적용되므로
    "가드를 한쪽에만 적용" 하는 결함 클래스의 재발 표면이 줄었다.

- **[INFO]** `client` 미확립 시 `openStream` 이 `"no_client"`(중단 아님)를 반환해 호출부가
  `scheduleRefresh()` 로 계속 진행하는 엣지 케이스가 문서화된 채 보존됨 — 기능·보안 모두 동작 보존
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:389`
  - 상세: `if (!client) return "no_client";` — 이 경로는 두 호출부 모두 진입 전에 `clientRef.current`
    확립을 이미 전제(`start()` 는 `if (!cfg || !client) return;`, `applyConfig` 는 `establishConfig`
    가 동기적으로 먼저 세팅)하므로 실무상 도달 불가능한 방어적 코드이며, `clientRef.current` 를 외부
    입력으로 null 로 되돌릴 수 있는 경로는 없다. 이전 라운드 보안 리뷰가 이미 확인한 사항과 동일하며
    이번 diff 로 그 성격이 바뀌지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `spec/7-channel-web-chat/3-auth-session.md` 정정은 `401`/`404` REST 오류 분기 미구현을
  frontmatter(`status: partial` + `pending_plans:`)로 정직하게 반영 — 보안 관점의 새 위험 아님
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:3`(`status: partial`), `:13-14`(`pending_plans:`)
  - 상세: `plan/in-progress/webchat-reload-rest-error-branches.md` 가 추적하는 잔여(재로드 시 `404`
    execution-not-found 분기, 복구불가 `401` 후 미종료, `401→낙관적 refresh` 미구현)는 이번 diff 로
    새로 생긴 코드 변경이 아니라 **기존부터 있던 구현 갭**이며, `use-widget.ts` 의 `seedWaitingFromStatus`
    `catch` 는 여전히 상태 코드 구분 없이 soft-fail 후 SSE 로 진행한다(코드 변경 없음, 문서만 갱신).
    보안적으로 이 갭은 "만료 vs blacklist 된 세션을 구분 못해 계속 streaming 상태로 머문다" 는 가용성
    성격의 잔여이지, 인증 우회나 권한 상승으로 이어지는 경로는 아니다 — `refresh-token` 미시도는
    세션이 결국 클라이언트 쪽에서 멈추는 fail-safe 방향이다.
  - 제안: 이번 diff 의 문서 정정 자체는 조치 불필요. `plan/in-progress/webchat-reload-rest-error-branches.md`
    가 이미 이 갭의 구현을 추적 중이므로 별도 보안 액션 불필요(구현 시점에 재검토 권장).

## 점검 관점별 요약

1. **인젝션**: 해당 없음 — SQL/커맨드/경로 조작 입력 처리 코드 변경 없음.
2. **하드코딩된 시크릿**: 없음 — 코드·plan·review 문서 전수 확인, 토큰/키/자격증명 리터럴 없음.
3. **인증/인가**: 이번 diff 는 SSE 스트림 소유권(세션 라이프사이클) 가드를 구조적으로 강화했고,
   토큰 검증·origin allowlist 등 인증/인가 로직 자체는 건드리지 않았다. 오히려 "겹친 두 세션 확립
   시도가 서로의 SSE 스트림을 조용히 교체" 하는 레이스를 봉쇄해 세션 무결성을 강화하는 방향이다.
4. **입력 검증**: 변경 범위 밖(`safeApiBaseFromQuery`, `isEmbedAllowed` 등은 diff 대상 아님).
5. **OWASP Top 10**: 굳이 연결하면 A04(Insecure Design) 관점에서 "동일 리소스에 대한 동시 요청 경쟁"
   결함 클래스를 줄이는 방향의 변경.
6. **암호화**: 해당 없음.
7. **에러 처리**: `openStream` 자체는 에러를 던지지 않으며 반환값(`StreamClaim`)만 바뀌었다.
   `console.warn` 에러 로깅에 토큰/세션 페이로드가 포함되지 않음을 확인(diff 범위 내 `onError` 콜백은
   에러 객체만 로깅).
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 diff 의 실질 보안 표면은 `use-widget.ts` 의 `openStream` 리팩터 하나뿐이며, 이는 이전 라운드
(`review/code/2026/08/10/12_39_25/security.md`)에서 이미 NONE 으로 판정된 변경을 반환 타입만
`boolean → StreamClaim` 명명 union 으로 정교화한 것으로, 소유권 검사 순서·타이밍·fail-closed 방향은
그대로 유지된다 — 신규 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화를 도입하지 않았다.
나머지 26개 파일은 plan/spec/review 문서로 실행되는 코드가 아니며, `spec/7-channel-web-chat/3-auth-session.md`
의 frontmatter 정정은 기존에 존재하던 REST 오류 처리 갭(가용성 성격, 인증 우회 아님)을 정직하게
문서화한 것이다. 발견된 사항은 모두 INFO 등급이며 조치가 필요한 항목은 없다.

## 위험도

NONE
