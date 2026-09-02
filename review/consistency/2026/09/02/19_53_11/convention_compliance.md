# 정식 규약 준수 검토 — `spec/5-system/` (--impl-done, diff-base `origin/main`)

## 검토 방법 메모

프롬프트 번들이 예산 초과로 `<git diff>` 및 `spec/5-system/` 의 상당수 파일 본문을 생략했다
(대부분 `⚠️ 본문 생략됨` 마커). 지시에 따라 워킹트리를 절대경로/`git -C`로 직접 열어 실제 diff 와
관련 spec 절을 확인했다.

- 실제 코드 diff(`git diff origin/main...HEAD --stat`): `codebase/backend/src/modules/websocket/{websocket-events.types.ts,websocket.gateway.ts}` ·
  `codebase/frontend/src/lib/websocket/ws-client.ts` · `CHANGELOG.md` · user-guide MDX 2개 · `review/**` 산출물 다수.
- 근거 spec: `spec/5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·§6.1·§9.2 + Rationale
  `R-ws-socket-lifetime-binds-token` (developer plan `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
  이 명시적으로 인용).
- `spec/5-system/` 자체는 이 diff 에서 **변경되지 않았다**(scope 델타 0 파일) — 정상. 검토 대상은
  "코드 변경이 target 문서의 정식 규약을 준수하는가" 다.
- 이 diff 는 이미 `/ai-review` 5라운드를 거쳤고(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43,19_12_36,19_41_19}`),
  최종 라운드 CRITICAL 0 · WARNING 0. 본 검토는 그 결과를 전제하지 않고 `spec/conventions/**` 관점에서
  독립적으로 재확인했다.

## 발견사항

- **[INFO] `auth.token_expired` 서버발신 emit — spec 배지가 구현을 못 따라감 (정상적으로 미조치됨)**
  - target 위치: `spec/5-system/6-websocket-protocol.md:52`(§1.2) · `:876`(§4.6 표) · `:1100`·`:1133`(Rationale)의
    `_(계획·미구현)_` / "backend emit 은 구현 대기" 서술
  - 위반 규약: 직접적인 `spec/conventions/**` 위반은 아님 — `spec-impl-evidence.md` 가 규정하는
    "spec 약속 vs 구현" 정합성(§Overview)의 정신에 해당
  - 상세: 이번 diff(`websocket.gateway.ts` `armExpiryTimers` + `handleConnection` 결선,
    `websocket-events.types.ts` 의 `AuthEventType.AUTH_TOKEN_EXPIRED`)로 서버발신 emit 이
    **완전히 구현**됐다. 그러나 spec 본문은 여전히 "미구현(Planned)" 배지를 달고 있어 코드와
    문서가 어긋난다.
  - 제안: 조치 불요(이번 PR 기준). CLAUDE.md §자기-반증형 소정정 예외의 5개 조건 중 조건 1
    ("developer 자신이 그 문장을 썼다")·조건 2("제품 정의·요구사항·API 계약은 해당 없음")에
    해당하지 않으므로 developer 가 직접 고칠 권한이 없다 — plan(`ws-token-expired-socket-lifetime-impl.md:94-96`)이
    이미 "머지 후 planner 턴" 으로 정확히 등재했고, 5R 코드 리뷰도 동일하게 SPEC-DRIFT #1 로
    기록했다(중복 확인, 새 발견 아님). planner 턴에서 §1.2·§4.6·Rationale 배지 flip +
    `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` 체크박스 동시 정리 필요.

- **[WARNING] (기존·비신규) `2-api-convention.md §6` HTTP 상태 코드 표에 `410 Gone`·`202 Accepted` 미등재**
  - target 위치: `spec/5-system/2-api-convention.md` §6 (198~213행 표)
  - 위반 규약: 문서 구조 규약(SoT 표의 완결성) — §6 표가 "기본값 SoT" 역할을 표방하나 같은 문서
    본문(§11.3 `:349` `410 Gone`, §11.3 `:360` `202 Accepted`)이 이미 쓰는 코드가 표에 없음
  - 상세: 실측 확인 완료 — `sed -n '196,225p' 2-api-convention.md` 결과 200/201/204/400/401/403/404/409/413/422/429/500/503 만 등재, 410·202 누락.
    이 diff 가 만든 문제는 아니다(코드가 이 파일을 건드리지 않음) — `--impl-prep` 단계에서
    convention_compliance 가 이미 발견(W1)했고 developer plan(`:65-68`)이 "요구사항/계약 표라
    자기-반증형 소정정 예외 대상 아님 → planner 턴 필요" 로 정확히 위임·등재해 둔 상태다.
  - 제안: 이번 PR 을 막을 사유 아님(diff 밖). planner 턴에서 §6 표에 410/202 행 추가 권장.

- **[WARNING] (기존·비신규) `PASSWORD_INVALID`(재인증) vs `INVALID_PASSWORD`(비밀번호 변경) — 이름이 의미를 구분하지 못함**
  - target 위치: `spec/5-system/3-error-handling.md:50,66-67,70` · `spec/5-system/1-auth.md:337,339,521,750,756`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" — "이름만으로 분기 의미가
    드러난다" 원칙. 두 코드 모두 UPPER_SNAKE_CASE 로 §1 표기 규칙 자체는 준수하지만, 단어 순서만
    다를 뿐 인코딩된 의미가 동일("비밀번호가 유효하지 않음")해 이름만으로 두 컨텍스트(재인증 vs
    비밀번호 변경 확인)를 구분할 수 없다.
  - 상세: 실측 확인 — `error-codes.md §3`(historical-artifact 예외 레지스트리)은 "케이스 표기
    위반" 유형의 코드만 등재하는 절이라 이 두 코드처럼 표기는 옳고 의미만 근접 충돌하는
    케이스의 정식 자리가 아니다(원 `--impl-prep` W2 지적의 "§3 에 미등재"는 등재 위치가
    §3 이 맞는지부터 재검토할 여지가 있음). 다만 spec 본문(3-error-handling.md:70, 1-auth.md:339,521)이
    "근접 명명 주의" 로 세 곳 이상에서 명시적으로 상호 참조·구분 서술을 이미 달아 실질 위험은
    상당히 완화돼 있다. 이 diff 는 이 코드들을 건드리지 않았다 — `--impl-prep` 단계 발견(W2)을
    developer plan(`:69-72`)이 "rename 은 breaking, 의도적 분리 근거를 §3(또는 별도 절)에
    등재하는 쪽이 답 — planner 턴" 으로 정확히 위임해 둔 상태다.
  - 제안: 이번 PR 을 막을 사유 아님(diff 밖). planner 턴에서 (a) 두 코드의 분리 근거를
    `error-codes.md` 에 정식 등재하거나 (b) §3 편입이 부적절하면 별도 절 신설을 검토.

## 준수 확인 (신규 코드 diff 대상, 위반 없음)

- **WS 이벤트 enum 명명**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` —
  `6-websocket-protocol.md` Rationale "WS 이벤트 enum 명명 — `<도메인>EventType`"(2026-08-30)을
  정확히 따름. 기존 `ExecutionEventType`/`NodeEventType`/`InAppNotificationEventType` 과 동일
  패턴(도메인 접두 `SCREAMING_SNAKE` 키 = `domain.action` 값).
- **payload 형식**: `AuthTokenExpiredPayload { message: string; expiresAt: string }` —
  §4.6 표가 정의한 `{ message, expiresAt }` 그대로. 시스템 이벤트(§4.5·§4.6)는 execution/node
  이벤트(§2.2)와 달리 `seq`/`executionId` 평면 병합 대상이 아니므로 이 payload 가 그 필드들을
  갖지 않는 것도 정합.
- **근접 식별자 3종 구분**: JSDoc 이 `auth.token_expired`(WS) / `token_expired`(Integration
  `status_reason` DB 슬러그) / `TOKEN_EXPIRED`(REST 에러 코드)를 명시적으로 구분하고 `--impl-prep`
  naming_collision INFO#7 을 인용 — 해당 세션(`review/consistency/2026/09/02/17_13_02/naming_collision.md`
  항목 7)과 대조해 인용이 정확함을 확인.
- **frontend 레이어링**: `ws-client.ts`(`src/lib/websocket/`)는 `frontend-layering.md` §1 이
  규정하는 `lib → components` 금지 방향을 위반하지 않음(신규 코드가 `@/components/**` import
  없음).
- **user-guide i18n 쌍**: `password-and-sessions.mdx`/`password-and-sessions.en.mdx` 를 같은
  커밋에서 동시 갱신 — `i18n-userguide.md` 의 ko/en parity 취지 준수. 기존 문체(해요체/영문 캐주얼
  톤)와 일관.
- **spec frontmatter `code:`**: `6-websocket-protocol.md` frontmatter 가 이미
  `codebase/backend/src/modules/websocket/websocket.gateway.ts` ·
  `codebase/backend/src/modules/websocket/websocket-events.types.ts` ·
  `codebase/frontend/src/lib/websocket/ws-client.ts` 를 `code:` 목록에 보유 — 신규 glob 추가
  불필요, `spec-impl-evidence.md` §4 가드(`spec-code-paths.test.ts`) 통과 유지.
- **spec 변경 회피(자기-반증형 소정정 미해당)**: developer 가 §4.6/§1.2 배지·
  `spec-sync-websocket-protocol-gaps.md` 체크박스를 이번 PR 에서 건드리지 않은 것 자체가
  CLAUDE.md §자기-반증형 소정정 예외 규칙 준수(요구사항/계약 텍스트는 developer 권한 밖).

## 요약

이번 diff(WS 소켓 수명을 토큰 수명에 종속시키는 `auth.token_expired` 구현)가 신규로 도입한
식별자·payload 형식·문서 갱신 범위는 `spec/conventions/**`(WS 이벤트 enum 명명, i18n 가이드
페어링, frontend 레이어링)를 모두 준수하며 CRITICAL/WARNING 급 신규 위반이 없다. 발견된
WARNING 2건(§6 상태 코드 표 410/202 누락, `PASSWORD_INVALID`/`INVALID_PASSWORD` 의미 근접)은
이 diff 가 만든 문제가 아니라 `--impl-prep` 단계에서 이미 발견돼 developer plan 에 "planner 턴
필요" 로 정확히 등재된 기존 갭이며, 이번 PR 을 막을 사유는 아니다. `auth.token_expired` 의
"_(계획·미구현)_" spec 배지가 이번 구현으로 stale 해진 점(INFO)도 developer 권한 밖 텍스트라
직접 고치지 않고 플래너 턴으로 올바르게 위임돼 있다(5R 코드 리뷰의 SPEC-DRIFT #1 과 동일 항목,
중복 확인).

## 위험도

LOW
