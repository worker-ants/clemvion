# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat/3-auth-session.md`

## 조사 방법 메모

번들 프롬프트가 컨텍스트 예산 초과로 대부분의 spec 파일(111개) · plan 파일(59개) · conventions 파일(270개)
본문을 절단했다. "없다"를 근거로 삼지 말라는 지시에 따라, target 문서가 참조·인용하는 식별자 중 판정에
필요한 것들은 `Read`/`grep` 로 직접 원문을 열어 대조했다: `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/12-webhook.md`, `spec/7-channel-web-chat/{1-widget-app,2-sdk,4-security,5-admin-console}.md`,
`spec/data-flow/{0-overview,14-chat-channel}.md`, `spec/2-navigation/9-user-profile.md`(grep), 관련 코드
(`codebase/channel-web-chat/src/lib/{session-store,api-base}.ts`).

또한 실제 "target"의 신규 도입분을 좁히기 위해 최근 커밋(`24d7a0760`, 2026-08-10)의 diff 를 확인했다 — 이
커밋이 `3-auth-session.md`에 대한 마지막 실변경이며, 변경분은 §R7 산문 2문단 정정(호출부 짝 가드 → openStream
내부 단일 게이트로 아키텍처 서술 정정)뿐이다. 새 식별자(타입명·엔드포인트·이벤트명·ENV·파일 경로)는
diff 에 전혀 등장하지 않는다.

## 검증한 식별자 (target 문서 전체 인용분, 기존 정의와 대조)

다음은 target 문서가 "새로 도입"하는 것처럼 보일 수 있으나, 실제로는 기존 spec 의 SoT 를 그대로 인용·재진술한
것으로 확인된 항목들이다 (충돌 없음, 각 원문 위치 실측):

| target 인용 | 기존 SoT 위치 | 일치 여부 |
|---|---|---|
| `GET /api/hooks/:path/embed-config` | `spec/5-system/12-webhook.md:437`, `spec/7-channel-web-chat/4-security.md:102` | 일치 |
| `POST /api/hooks/:path`(트리거) | `spec/5-system/12-webhook.md` §webhook 엔드포인트 | 일치 |
| `POST .../:id/interact` + `submit_message`/`click_button`/`submit_form` | `spec/5-system/14-external-interaction-api.md:72(EIA-IN-02),288-290` | 일치 |
| `POST .../:id/refresh-token` | `14-external-interaction-api.md:93(EIA-AU-05),505-508` | 일치 |
| `GET /api/external/executions/:id` (200/404/401 상태값) | `14-external-interaction-api.md:341(EXECUTION_NOT_FOUND),449-480` | 일치 |
| `EIA-IN-12`(410 Gone) | `14-external-interaction-api.md:82` | 일치 |
| `EIA-AU-04`(종료 시 즉시 invalidate) | `14-external-interaction-api.md:92` | 일치 |
| `EIA-RL-07`(idle-wait 회수 backstop) | `14-external-interaction-api.md:145,1262` | 일치 |
| `R-replay-unavailable` | `14-external-interaction-api.md:1252`(Rationale 앵커) | 일치 |
| `WH-SC-01`(공개 webhook 인증 없음) | `12-webhook.md:65` | 일치 |
| `iext_*`/`itk_*` 토큰 prefix, `interaction:{token,expiresAt,endpoints}` | `12-webhook.md:82(WH-RS-04),159-195`, EIA §4.1 | 일치 |

모두 target 이 스스로 새로 명명한 것이 아니라 기존 SoT 를 정확히 재인용한 것이므로 충돌 대상이 아니다.

## 발견사항

### INFO — `### R3`부터 시작하는 Rationale 번호 (R1/R2 부재)
- target 신규 식별자: 해당 없음 (번호 자체는 기존부터 존재, 이번 diff 로 신설된 것도 아님)
- 기존 사용처: `spec/7-channel-web-chat/3-auth-session.md` 자체 — `### R3`(L88)부터 `### R8`(L174)까지만 있고
  `R1`/`R2`는 문서 내에 없다.
- 상세: 신규 식별자 "충돌"은 아니지만, 문서 하나 안에서 번호 계열이 R3부터 시작하는 것은 독자가 R1/R2 가
  다른 곳(예: 삭제되었거나 타 문서로 이동)에 있다고 오인할 여지를 준다. 다만 이는 이번 target 변경분이
  만든 문제가 아니라 기존 상태이며, 실제 R-넘버 충돌(다른 문서의 R3 와 의미 충돌)은 확인되지 않았다 —
  Rationale 번호는 문서 로컬 스코프라 다른 spec 파일의 R3 와 이름공간이 겹치지 않는다.
- 제안: 조치 불요(기존 상태 유지로 충분). 굳이 정리하려면 번호를 R1부터 재부여하거나, R1/R2 가 과거
  어떤 사유로 결번됐는지 한 줄 각주를 남기는 정도.

### INFO — §R8 "동명 함수" 경고는 이미 해소된 과거 CRITICAL 의 재확인이며, 이번 target 변경분과 무관
- 확인 배경: §R8 하단의 "⚠ 동명 함수 주의 — 데모 설정에는 후행 `/api`까지 제거하는 정반대 계약의 동명
  정규화 함수가 있다"는 경고를 실제 코드와 대조했다.
- 코드 확인 결과: `codebase/channel-web-chat/src/lib/session-store.ts:80-83`의 주석이 정확히 이 경고를
  구현 근거로 인용하며 `(consistency-check 22_35_51 naming_collision CRITICAL)`이라는 과거 세션 참조를
  남기고 있다 — 즉 이 "동명 함수" 충돌은 **과거 naming_collision 검토에서 이미 CRITICAL 로 발견되어
  해소된 사안**이다(공용 `stripTrailingSlash`를 직접 쓰고 데모 전용 `normalizeApiBase`와 통합하지 않는
  방식으로 처리). target 문서의 §R8 서술은 그 해소 결정을 정확히 반영하고 있어 신규 충돌이 아니다.
- 제안: 조치 불요. 정보용 기록으로만 남긴다 — 향후 두 함수를 실수로 통합하려는 시도가 있으면 이 경고와
  코드 주석이 1차 방어선이다.

### 그 외 관점 — 발견 없음
- **요구사항 ID 충돌**: target 은 자체적으로 새 요구사항 ID(`WH-*`/`EIA-*`/`ND-*` 류)를 신설하지 않는다.
  본문이 인용하는 기존 ID(`EIA-IN-12`, `EIA-AU-04`, `EIA-RL-07`, `WH-SC-01`, `R-replay-unavailable`)는
  전부 원 SoT 와 문자 그대로 일치한다.
- **엔티티/타입명 충돌**: target 은 인터페이스/DTO 를 새로 정의하지 않는다(타입 블록은 `2-sdk.md`
  §5 `ChatInstance`/`BootConfig`/`WidgetEvent`/`Unsubscribe`에만 있고, 이들은 target 밖의 파일이며
  이번 검토 대상도 아니다). target 내 언급된 `PersistedSession`류 개념(§3.1 sessionStorage 페이로드
  `{executionId, token, expiresAt, endpoints, apiBase}`)은 산문 서술뿐이라 형식 충돌 표면이 없고,
  실제 타입 `PersistedSession`(코드)과 필드 구성이 일치함을 확인했다.
- **API endpoint 충돌**: 6개 endpoint 모두 EIA/webhook spec 의 기존 정의와 method+path+status 까지
  정확히 일치. target 이 새 endpoint 를 추가 정의하지 않는다.
- **이벤트/메시지명 충돌**: SSE 이벤트(`execution.waiting_for_input`/`execution.ai_message` 등)·
  `wc:*` postMessage 이벤트는 모두 EIA/2-sdk.md 기존 정의를 참조만 한다. 신규 이벤트명 없음.
- **환경변수·설정키 충돌**: target 문서에 신규 ENV var·config key 정의 없음(`WEBCHAT_IDLE_REAP_GRACE_MS`
  등은 EIA-RL-07 소속이며 target 이 재정의하지 않고 참조도 하지 않는다).
- **파일 경로 충돌**: target 은 기존 spec 파일(`3-auth-session.md`, id: `web-chat-auth-session`)의
  개정이며 새 spec 파일을 만들지 않는다. frontmatter `code:` 5개 경로 모두 기존 컨벤션(`codebase/channel-web-chat/src/{lib,widget}/*.ts`)과 정합하고 다른 spec 문서의 `code:` 목록과 겹치는 파일 없음(단, 최근 리팩터로
  `use-session-generations.ts`가 §3(재전송) 로직의 정본이 됐는데 `code:` 목록엔 아직 없다는 지적은
  `plan/in-progress/spec-update-webchat-evidence-pointers.md`에 이미 별도 항목으로 등록돼 있다 —
  이는 파일 "충돌"이 아니라 evidence pointer drift 로, naming-collision 스코프 밖이라 본 리포트에서는
  중복 지적하지 않는다).

## 요약

이번 검토의 실질 target 변경분(2026-08-10 커밋)은 §R7 두 문단의 산문 정정(아키텍처 서술을 "호출부 짝
가드"에서 "openStream 내부 단일 게이트"로 맞춤)뿐이며, 새 요구사항 ID·타입명·엔드포인트·이벤트명·ENV
var·spec 파일 경로 중 어느 것도 도입하지 않는다. 문서 전체를 기존 EIA/webhook/SDK spec 및 실제 코드와
대조한 결과, 인용된 모든 식별자(엔드포인트 6종, 요구사항 ID 5종, 토큰 prefix, R8 의 "동명 함수" 경고
포함)가 원본과 정확히 일치했고, 유일하게 걸리는 R8 의 "동명 함수" 이슈는 이미 과거 naming_collision
CRITICAL 로 발견·해소된 사안을 target 이 올바르게 반영한 것이었다. 신규 충돌 없음.

## 위험도

NONE
