> **복구본**: 원 sub-agent 의 disk write 가 harness 에 의해 유실됨(disk-write gap). 아래는 workflow journal.jsonl 의 반환값에서 그대로 복구한 전문이다(main Claude 재집계).

### 발견사항

탐색한 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전부에서 **CRITICAL/WARNING 수준의 충돌은 발견되지 않았다**. 아래는 확인 과정에서 나온 참고용 INFO 항목이다.

- **[INFO]** `R10` Rationale ID — 파일-scoped 넘버링 재확인
  - target 신규 식별자: `1-widget-app.md`의 신설 `### R10. ...` (§4 i18n 절 근거)
  - 기존 사용처: `spec/7-channel-web-chat/1-widget-app.md`의 기존 Rationale은 `R4`~`R9`([1-widget-app.md:125-229](/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md)). 다른 파일에도 `R10`이 존재 — `0-architecture.md:63,164`의 "EIA §R10"은 `spec/5-system/14-external-interaction-api.md` 자신의 R10을 가리키는 **타 문서 참조**.
  - 상세: 이 영역의 R-스킴은 전역이 아니라 **문서별 로컬 시퀀스**다(`3-auth-session.md`도 R3~R6, `2-sdk.md`도 R2~R6, `5-admin-console.md`는 R1~R7, `4-security.md`는 R1~R6, `0-architecture.md`는 R1~R5 — 서로 다른 파일이 같은 번호를 재사용하는 것이 기존 관례). `1-widget-app.md`에서 다음 번호는 실제로 `R10`이 맞고, 같은 파일 내 기존 사용 없음 — target의 "R4~R9 다음 순번 R10" 주장은 정확하며 충돌 없음.
  - 제안: 조치 불필요. 다만 `1-widget-app.md` 안에서 `R10`을 인용할 때는 굳이 "EIA §R10"처럼 파일 접두를 붙이지 않아도 되지만(같은 파일 내부 참조이므로), 향후 이 문서를 외부에서 인용하는 코드가 생기면 `[1-widget-app §R10]`처럼 파일 qualifier를 명시해 `EIA §R10`과 혼동되지 않게 하면 좋다.

- **[INFO]** 신설 `## 4. i18n` 섹션 — anchor 여유 확인
  - target 신규 식별자: `1-widget-app.md`에 신설되는 `## 4. i18n (chrome 문자열 다국어화)` 절(§4)
  - 기존 사용처: 현재 `1-widget-app.md`는 `## 1`~`## 3`까지만 존재하고 `## 4`는 미사용([1-widget-app.md](/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md) 확인). `spec/`, `plan/` 전체를 grep해도 `1-widget-app.md#4-...` 앵커를 참조하는 dangling 링크는 없음.
  - 상세: target의 "§4 미사용이라 충돌 없음" 주장은 실측과 일치. 충돌 없음.
  - 제안: 조치 불필요.

- **[INFO]** i18n 번역 키 네임스페이스(`composer.*`, `header.*`, `confirm.*`, `group.*`, `launcher.*`, `carousel.*`/`table.*`/`chart.*`, `form.*`, `error.generic`) — 격리 확인
  - target 신규 식별자: §3.5 인벤토리 표의 제안 key 32종
  - 기존 사용처: `codebase/frontend/src/lib/i18n/dict/{ko,en}/*.ts`(메인 앱 dict) — [frontend/src/lib/i18n](/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n)
  - 상세: `codebase/channel-web-chat/src`에는 현재 i18n/dict/locale 모듈이 전혀 없어(grep 결과 0건) 신설 카탈로그가 기존 파일과 물리적으로 겹치지 않는다. 명명도 "dict"가 아닌 "**위젯 로컬 catalog**"로 의도적으로 구분해(§3.1) 메인 앱 `dict/` 시스템과의 개념적 혼동을 피했다. `error.generic` 키가 EIA 계약의 `error.code`/`error.details` JSON 필드 경로 표기(예: `error.code=WEBCHAT_IDLE_TIMEOUT`)와 접두어 `error.`를 공유하지만, 전자는 i18n catalog 키(dot-path), 후자는 API 응답 필드 경로(dot-path)로 표기 스타일만 같을 뿐 실제 식별자 문자열이 겹치지 않아 실질 충돌은 아니다.
  - 제안: 조치 불필요(착수 재료 명시로 최종 확정은 구현 시 EN copy 리뷰에서 결정하도록 이미 스코프됨).

- **[INFO]** "chrome" 용어 재사용 — 기존 의미와 일관
  - target 신규 식별자: "chrome 문자열"(위젯 소유 UI 문자열을 가리키는 신규 분류 용어)
  - 기존 사용처: `spec/2-navigation/_layout.md:105`, `spec/2-navigation/13-user-guide.md:204`의 "전역 chrome"(글로벌 UI 프레임 요소를 가리키는 기존 용어)
  - 상세: 같은 의미(운영자/AI 콘텐츠가 아닌 애플리케이션 자체의 UI 프레임 문자열)로 일관되게 쓰여 충돌이 아니라 오히려 기존 관례와 정합.
  - 제안: 조치 불필요.

새 요구사항 ID(WCA-* 없음, R10만 신설), 새 엔티티/DTO/인터페이스명(신규 타입 미도입 — `BootConfig.locale`은 기존 필드 재활성일 뿐), 새 API endpoint(없음), 새 이벤트/메시지명(`wc:*` 재사용, 신규 없음), 새 ENV var/config key(없음), 새 spec 파일 경로(5개 파일 모두 기존 파일 편집, 신규 파일 없음) 어느 항목에서도 실질적 충돌은 확인되지 않았다.

### 요약
target 문서(`plan/in-progress/spec-draft-webchat-en-i18n.md`)가 실제로 spec에 도입하는 신규 식별자는 `1-widget-app.md`의 `### R10` Rationale ID와 신설 `## 4.` 섹션, 그리고 구현 세부로 위임된 i18n 번역 key 제안 목록뿐이다. `R10`은 해당 파일 내 로컬 시퀀스(R4~R9) 다음 번호로 기존 사용과 겹치지 않고, `## 4.`는 현재 미사용 섹션 번호이며, 번역 key 네임스페이스는 메인 앱 `frontend/src/lib/i18n/dict`와 물리적·개념적으로 완전히 분리된 신설 위젯 로컬 catalog(코드 미존재)에 귀속돼 기존 정의와 충돌하지 않는다. 새 endpoint·이벤트명·env var·spec 파일 경로는 아예 도입되지 않는다(모두 기존 5개 spec 파일에 대한 편집). 결론적으로 신규 식별자 충돌 관점에서 이 draft는 안전하다.

### 위험도
NONE
