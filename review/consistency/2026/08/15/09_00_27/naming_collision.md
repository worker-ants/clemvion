# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- 검토 모드: `--impl-prep`, scope=`spec/5-system/`
- `origin/main` 대비 이 워크트리(HEAD)의 실제 diff는 **1개 커밋, 1줄**뿐이다
  (`cdaa4291d fix(spec): 인접 두 줄이 자기모순 — Re-run 경로에 금지된 /v1/ 세그먼트`):
  ```
  -Re-run API (`POST /api/v1/executions/:id/re-run`, ...)
  +Re-run API (`POST /api/executions/:id/re-run`, ...)
  ```
  (`spec/5-system/14-external-interaction-api.md` §12 호환성)
- 번들에는 `spec/5-system/` 전체 + 다수 `plan/in-progress/*`가 컨텍스트로 포함돼 있으나,
  이 라운드가 실제로 도입하는 **신규 식별자는 0개**다 — 위 1줄은 기존에 오기재돼 있던
  경로(`/api/v1/executions/:id/re-run`, 존재한 적 없는 phantom 식별자)를 이미 §2.2
  API 규약("버전은 URL 경로에 미포함")과 [13-replay-rerun.md §8.1](../../spec/5-system/13-replay-rerun.md)
  이 정의한 기존 정본 경로(`POST /api/executions/:executionId/re-run`)로 **정정**한 것이다.
  즉 이 변경은 새 식별자를 만드는 게 아니라 **충돌(자기모순)을 제거**하는 방향이다.

## 발견사항

(신규 식별자 충돌 없음 — 아래는 위 1줄 변경 및 그 주변 맥락에 대한 확인 기록이다.)

- **[INFO]** Re-run 경로 표기 정정이 기존 정본과 정확히 일치함을 확인
  - target 신규 식별자: 없음 — `POST /api/executions/:id/re-run` (정정된 표기)
  - 기존 사용처: `spec/5-system/13-replay-rerun.md:38` `Re-run 의 API 계약 (POST /api/executions/:executionId/re-run)`,
    동 파일 §8.1 헤딩(`### 8.1 POST /api/executions/:executionId/re-run`, L200)
  - 상세: 수정 전 `14-external-interaction-api.md` §12는 `/api/v1/executions/:id/re-run`
    (`/v1/` 세그먼트 포함)을 적어 (a) 13-replay-rerun.md의 정본 경로와 문자열이 달랐고
    (b) `2-api-convention.md §1`("버전은 URL 경로에 포함하지 않음")도 위반하는 **자기모순
    식별자**였다. 수정 후에는 두 문서가 동일 문자열(`/api/executions/:executionId/re-run`)을
    가리켜 SoT가 하나로 수렴한다.
  - 제안: 없음(이미 해결됨). 참고로 같은 파일 L666의 `/v1/` 언급은 "이런 세그먼트를 쓰지
    말라"는 금지 규칙 설명 문구일 뿐 실제 경로 식별자가 아님을 확인했다(잔존 phantom
    경로 없음, `grep -n "/v1/\|api\.clemvion\.ai"` 결과 해당 1건만 존재).

## 광역 확인 (scope=spec/5-system/ 전체, 회귀 스캔)

이번 diff는 1줄이지만, `--impl-prep` scope가 `spec/5-system/` 전체이므로 EIA
(`14-external-interaction-api.md`)가 정의하는 주요 신규 식별자 계열이 다른 spec 문서와
충돌하지 않는지 광역 grep으로 재확인했다(전부 기존 라운드에서 이미 정합화된 상태 재확인,
신규 충돌 없음):

- **요구사항 ID**: `EIA-NX-*` / `EIA-IN-*` / `EIA-AU-*` / `EIA-RL-*` / `EIA-NF-*` — 전 prefix가
  `spec/5-system/14-external-interaction-api.md` 한 파일에서만 정의됨(타 파일은 전부 cross-ref
  링크 인용). 재정의 충돌 없음.
- **엔드포인트**: `/api/external/executions/:id/*` — 6-websocket-protocol.md,
  7-channel-web-chat/*, data-flow/15-external-interaction.md 등에서 모두 동일 의미로만
  참조. `/api/executions/*`(워크스페이스 JWT)와 라우팅 prefix·인증 family가 분리돼
  있음(§R11)도 확인.
- **엔티티/필드**: `notification_health`(Trigger)와 `chat_channel_health`(Trigger)는 이름은
  다르지만 **enum 값 집합이 완전히 동일**하다 — 이는 `1-data-model.md:241` ·
  `15-chat-channel.md:289`가 "향후 공용 DB 타입 통합 검토" 대상으로 이미 명시적으로 기록한
  **의도된 근접 중복**이며, 신규로 발생한 문제가 아니다(WARNING 격상 불필요).
  `notificationHealth`(EIA) vs `chatChannelHealth`(Chat Channel) UI 배지도 동일하게 "동일
  영역·동일 형식으로 나란히 배치"라고 명시돼 있어 혼동 리스크가 문서로 흡수돼 있다.
  일치.
- **DTO/타입명**: `InteractAckDto`, `WebChatAppearanceDto`, `RefreshTokenResponseDto`,
  `ExecutionStatusDto` 등은 전부 EIA 자신이 SoT이고 타 문서(7-channel-web-chat/5-admin-console.md,
  conventions/swagger.md)는 동일 의미로만 인용. `swagger.md`의 `ExecutionStatusDto` 예시
  코드는 실제로 EIA §5.3의 `context` 판별 불가 union을 그대로 예시화한 것으로 확인 —
  별개 정의가 아님.
  `InteractionGuard`도 `14-external-interaction-api.md` / `3-error-handling.md` /
  `data-flow/15-external-interaction.md` 세 곳에서 동일 컴포넌트를 가리킴.
- **환경변수**: `ALLOW_HTTP_HOOKS`, `INTERACTION_JWT_SECRET`, `IEXT_REFRESH_WINDOW_SEC`,
  `WEBCHAT_IDLE_REAP_GRACE_MS` — 전부 EIA 단독 정의, 타 문서는 동일 이름·동일 의미로만
  인용(`3-error-handling.md`, `1-auth.md`, `data-flow/15-external-interaction.md`). 재정의
  충돌 없음.
- **토큰 검증 에러 코드**: `TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH`는
  EIA(`iext_*`/`itk_*` interaction 토큰) 전용이며, 워크스페이스 JWT 계층의 `TOKEN_INVALID`/
  `TOKEN_EXPIRED`(3-error-handling.md §1.2)와 문자열은 겹치되(`TOKEN_INVALID`/`TOKEN_EXPIRED`
  2개), §5.1 코드 네임스페이스 주석이 "진입점(`/api/external/*`)·토큰 family로 레이어가
  구분된다"고 명시적으로 다뤄 이미 WARNING 격상 근거가 아님을 문서 자신이 밝히고 있다.
  (근접 재사용이지만 target이 새로 만든 게 아니라 기존 spec 서술 그대로.)
- **파일 경로**: `spec/5-system/14-external-interaction-api.md`는 R9가 근거를 남긴 기존
  파일이며, 이번 라운드는 파일을 신설·개명하지 않는다.

## 요약

이번 검토 대상(target)의 `origin/main` 대비 실제 diff는 `14-external-interaction-api.md`
§12의 Re-run API 경로 표기 1줄 정정뿐이며, 이는 신규 식별자를 도입하는 것이 아니라
`/api/v1/executions/:id/re-run`(존재한 적 없는 phantom, API 규약 위반, 13-replay-rerun.md와
불일치)을 기존 정본 `POST /api/executions/:id/re-run`으로 정정해 **식별자 충돌을 제거**하는
변경이다. `--impl-prep` scope인 `spec/5-system/` 전체에 대해서도 EIA가 정의하는 요구사항
ID·엔드포인트·엔티티 필드·DTO/타입명·환경변수·에러코드 네임스페이스를 광역 재확인했으며,
전부 기존 라운드에서 이미 cross-ref로 정합화돼 있고 신규 충돌은 발견되지 않았다.
근접 중복으로 보일 수 있는 `notification_health`/`chat_channel_health`,
`TOKEN_INVALID`/`TOKEN_EXPIRED`의 레이어 간 재사용은 모두 spec 본문이 이미 의도와 구분
기준을 명시적으로 기록해 두어 별도 조치가 필요 없다.

## 위험도

NONE
