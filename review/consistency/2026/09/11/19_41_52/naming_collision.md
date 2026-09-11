# 신규 식별자 충돌 검토 (--impl-done)

## 대상과 실측 방법

`spec/5-system/` scope 델타는 0개 파일(이 브랜치는 spec 을 바꾸지 않음, `spec_impact: none`).
구현 diff 는 8개 파일 / 1130줄 — `codebase/backend/src/modules/triggers/` 내부의 순수
코드 이동(`TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` →
신규 `ChatChannelBinderService` + 신규 순수 함수 `buildTriggerCallbackUrl`)이다.

프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션이 예산 절단으로 생략되어
있어, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-binder-t2-7e9b70`)에서 직접
`git diff --stat origin/main...HEAD -- codebase/` 및 신규 파일 전문을 읽어 실제 diff 로
대조했다. 아울러 저장소 전체(`spec/`·`codebase/`·`plan/`·`review/`)를 대상으로 신규
식별자 4개를 전수 grep 했다.

## 신규 식별자 목록 (이 target 이 실제로 도입한 것)

- `ChatChannelBinderService` (신규 클래스, `chat-channel-binder.service.ts`)
- `buildTriggerCallbackUrl` (신규 순수 함수, `trigger-callback-url.ts`)
- 신규 파일: `chat-channel-binder.service.ts` · `chat-channel-binder.service.spec.ts` ·
  `trigger-callback-url.ts` · `trigger-callback-url.spec.ts`
- 신규 요구사항 ID·엔티티·DTO·API endpoint·이벤트명·ENV var·config key: **없음**
  (`spec_impact: none` 대로 spec 층 신규 도입은 0건 — 실측 일치)

## 발견사항

- **[INFO]** `buildTriggerCallbackUrl` 의 캡슐화 대상(APP_URL 기본값 + 후행 슬래시 정규화)이
  기존 `getAppBaseUrl()`(`common/utils/app-base-url.ts`, 스스로 "단일 표준 fallback"이라 선언)과
  개념적으로 겹친다 — **이름 충돌은 아니다**(리터럴 동일 이름 0건, `Trigger` 접두로 텍스트
  검색 시 혼동 가능성도 낮음).
  - target 신규 식별자: `trigger-callback-url.ts` 의 `buildTriggerCallbackUrl({ baseUrl, endpointPath })`
  - 기존 사용처: `codebase/backend/src/common/utils/app-base-url.ts:12` `getAppBaseUrl()`
    (호출부: `integrations.service.ts`·`integration-oauth.service.ts` 6곳, `process.env.APP_URL` 직접 읽음)
  - 상세: 이 발견은 이번 `--impl-done` 라운드가 처음 낸 것이 아니라 이 target 의
    `--impl-prep` 단계 naming_collision 리포트(`review/consistency/2026/09/11/17_39_32/naming_collision.md` W4)가
    이미 동일 지점을 WARNING 으로 짚었다. 실측 결과 그 리포트가 권고한 조치("`trigger-callback-url.ts`
    docstring 에 '이 fallback 은 `getAppBaseUrl()` 과 중복, 통합 대상' 한 줄 포인터")가
    **실제로 구현에 반영됐다** — `trigger-callback-url.ts:24-30` 에 "**알려진 중복 — 통합 대상.**
    `common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 이 스스로 '단일 표준 fallback' 이라고
    선언하고 있고 ... 지금 합치지 않는 이유는 읽는 소스가 다르기 때문(`ConfigService` vs
    `process.env` 직접 읽기, 테스트 14블록의 DI 통제권)" 문단이 명문화되어 있다. 두 진입점이
    같은 규칙을 별도 이름으로 아는 상태는 여전히 남아 있으나, "왜 지금 통합하지 않는가"가
    코드에 근거와 함께 기록되어 있어 다음 사람이 조용히 divergence 를 못 알아챌 위험은
    낮아졌다. 이름 자체의 충돌(동일 식별자·다른 의미)은 아니므로 CRITICAL/WARNING 이 아닌
    INFO 로 하향한다 (이전 라운드 WARNING → 이번 라운드 INFO, 근거: 권고 조치 이행 확인).
  - 제안: 조치 불요 — 이미 문서화된 후속 과제(별도 PR, DI 변경 필요)로 이월. 새 지시 없음.

## 위 외 6개 관점 확인 결과 (충돌 없음)

1. **요구사항 ID** — target 코드는 `CCH-AD-02`·`CCH-AD-03`·`R-CC-21`(모두 `spec/5-system/15-chat-channel.md` 기존 SoT ID)을 `@see` JSDoc 으로 **참조만** 한다. 새 ID 부여 없음.
2. **엔티티/타입명** — `ChatChannelBinderService` 전역 grep 결과 `triggers/` 모듈과 그 plan/review 문서 밖에서 다른 의미로 쓰이는 사례 0건. `ChatChannelConfig`·`ChatChannelInput` 등 기존 타입은 import 만 하고 재정의하지 않는다.
3. **API endpoint** — 신규 endpoint 없음 (컨트롤러 diff 없음, `setupChatChannel`/`teardownChatChannel`은 내부 메서드이며 소유 클래스만 이동).
4. **이벤트/메시지명** — webhook/queue/SSE 이벤트 신규 도입 없음. `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` 등 기존 큐 상수는 변경 없이 그대로 import.
5. **환경변수·설정키** — `process.env.APP_URL` 언급은 모두 JSDoc 인용문(코드가 아님)이며 기존 `app.config.ts` 의 `APP_URL` 을 그대로 참조한다. 신규 ENV/설정 키 0건 (diff 전체에서 `process.env.` 신규 참조 없음).
6. **파일 경로** — `chat-channel-binder.service.ts`/`trigger-callback-url.ts`(+ 각 `.spec.ts`)는 `triggers/` 모듈의 기존 명명 컨벤션(Nest provider=`*.service.ts`, 협력자 없는 순수 함수=접미사 없음, 예: 같은 폴더의 `chat-channel-input-rules.ts`)에 정확히 부합한다. 기존 파일과의 경로 겹침 없음(`git status`/`find` 전수 확인, `dist/` 산출물만 대응 위치에 존재 — 정상 빌드 결과).

## 요약

이 target 은 `spec_impact: none` 순수 백엔드 코드 이동이라 spec 레벨 신규 식별자(요구사항 ID·엔티티·endpoint·이벤트·ENV)는 0건이며 실측이 이를 뒷받침한다. 코드 레벨 신규 식별자 4개(`ChatChannelBinderService`, `buildTriggerCallbackUrl`, 두 신규 파일 쌍)를 전수 grep 한 결과 리터럴 이름 충돌은 없고 `triggers/` 기존 명명 컨벤션과도 정합한다. 유일하게 이미 알려진 지점은 `buildTriggerCallbackUrl`이 `getAppBaseUrl()`과 같은 개념(APP_URL fallback)을 별도 이름으로 캡슐화한다는 것인데, 이는 `--impl-prep` 단계에서 이미 WARNING 으로 지적됐고 그 권고(중복·통합 대상임을 docstring 에 명시)가 구현에 실제로 반영된 것을 이번 라운드에서 확인했다 — 이름 충돌이 아니라 개념 중복이므로 INFO 로 하향하며 PR 을 막을 사유가 아니다.

## 위험도

NONE
