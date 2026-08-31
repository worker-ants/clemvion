# 보안(Security) 리뷰

## 개요

이번 diff(51개 파일)는 압도적으로 (1) 주석/JSDoc 내 SoT 인용 정정(썩은 줄 번호 제거), (2) spec 문서 절번호 재정렬·문구 정정, (3) plan 트래커 실측 기록, (4) 이전 리뷰 세션 산출물(`review/code/2026/08/31/{18_30_55,18_46_06}/**`) 커밋으로 구성된다. 실질적인 애플리케이션 코드 변경은 다음 세 갈래로 좁혀진다.

1. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — 신규 `_count_diff_files`/`_scope_delta_census` (내부 개발 하니스 전용, 배포 앱 표면 아님)
2. `workflow-assistant.controller.ts` + 신규 `workflow-assistant.controller.swagger.spec.ts` — `@ApiUnauthorizedResponse` 7건 추가 (순수 Swagger 문서 annotation)
3. `chat-channel.dispatcher.ts`/`types.ts`/`*.spec.ts`, `websocket.service.ts`/`websocket-events.types.ts`/`*.spec.ts`, `notifications-channel-authorizer.ts` — 전부 주석/JSDoc 텍스트만 변경(§4.4→§4.5, `line 536`/`line 89` 등 하드코딩 줄 번호 제거). 실행 로직(비교식·추출식·가드 조건)은 diff 게이트로 확인한바 한 글자도 바뀌지 않았다.

## 발견사항

- **[INFO]** `NotificationsChannelAuthorizer` 의 JSDoc 이 "선제 가드(실피해 0)" → "`notification.new` emit 배선 완료로 실제 트래픽에서 작동 중"으로 갱신됨
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts:11-14`
  - 상세: 주석만 갱신됐고 `authorize()` 의 `targetUserId === userId` fail-closed 비교(IDOR 방어, 04 M-6)는 diff 대상 밖 — 실측(`Read`)으로 원본 로직이 그대로임을 확인했다. 문서가 실제 위험도를 더 정확히 반영하게 된 개선이며, 새 취약점은 없다.
  - 제안: 없음(정상).

- **[INFO]** `WorkflowAssistantController` 7개 라우트에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가 + 신규 회귀 테스트(`workflow-assistant.controller.swagger.spec.ts`)
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` (28번째 줄 import, 59/79/97/111/125/141/164번째 줄 데코레이터)
  - 상세: 클래스 레벨 `@ApiBearerAuth`(가드는 별도 미들웨어/guard 가 수행) 뒤에서 순수 OpenAPI 문서 스키마만 보강 — 인가 로직·가드 체인·응답 바디는 변경 없음. `swagger.md §2-4` 규약 준수를 회귀 테스트로 고정한 것은 문서-코드 drift(OWASP API9:2023 Improper Inventory Management류)를 예방하는 긍정적 변경.
  - 제안: 없음(정상).

- **[INFO]** `_scope_delta_census`/`_count_diff_files` (신규, `consistency_orchestrator.py`)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:485-568` (`_count_diff_files`/`_scope_delta_census`)
  - 상세: `root`/`target_path_rel`/`changed_rels`/`diff_text` 를 받아 마크다운 문자열을 조립만 한다 — `subprocess`/`eval`/`os.system` 호출이나 파일 쓰기 없음, f-string 결과는 프롬프트 텍스트로만 쓰이고 셸로 재해석되지 않는다. 입력은 로컬 git 워킹트리에서 유도되는 개발자 신뢰 경로(외부 미인증 사용자 입력 아님)이며 배포되는 서비스 코드가 아니라 개발 하니스 스크립트다. 인젝션 표면 없음.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 스캔 — 전체 diff(51개 파일 조립 프롬프트)에 대해 `api_key|secret|password|token=|BEGIN PRIVATE|Authorization: Bearer` 패턴 grep 결과 실제 시크릿 값 0건. `notification_secret_v2`(spec 상 컬럼명), `installToken`(변수명) 등은 식별자일 뿐 값이 아님.
  - 제안: 없음.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §8.2 HMAC 알고리즘 화이트리스트 문구 정정 (`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 두 값)
  - 위치: `spec/5-system/14-external-interaction-api.md` (diff 게이트 948-950)
  - 상세: 코드 자체(`notification-signature.util.ts`, `notification-config.dto.ts`)는 이번 diff 범위 밖이고 이미 두 알고리즘을 화이트리스트하고 있었다는 것이 plan 기록의 근거 — spec 문구를 실측 구현에 맞춘 것으로 실제 서명 검증 로직 변경 아님. 두 알고리즘 모두 HMAC 계열(약한 해시 단독 사용 아님)이라 암호화 관점 문제 없음.
  - 제안: 없음.

인증/인가 로직, 입력 검증, 암호화 루틴, 에러 메시지 노출, 의존성(package.json 등) 어느 것도 이번 diff 에서 실질적으로 변경되지 않았다. 특히 IDOR 방어(WS 알림 채널 authorizer)와 인증 데코레이터(`@ApiUnauthorizedResponse`) 관련 변경은 둘 다 기존 안전한 동작을 정확히 반영/문서화하는 방향이며 로직 자체를 흔들지 않는다.

## 요약

이번 변경분은 보안 관점에서 실질적인 코드 로직 변경이 사실상 없다 — 주석/JSDoc 텍스트 정정, spec 절번호 재정렬, plan 실측 기록, 이전 리뷰 산출물 커밋이 대부분이고, 유일한 런타임 코드 변경은 이미 인증이 강제되던 `WorkflowAssistantController` 라우트에 `@ApiUnauthorizedResponse` OpenAPI 문서를 추가한 순수 additive 개선(+ 이를 고정하는 신규 회귀 테스트)뿐이다. `NotificationsChannelAuthorizer` 의 IDOR fail-closed 비교 로직은 주석만 갱신됐을 뿐 실측으로 원본 그대로임을 확인했다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출 등 어떤 항목에서도 새로운 취약점을 발견하지 못했다.

## 위험도

NONE
