# Cross-Spec 일관성 검토 결과

대상: `spec/7-channel-web-chat/` (6개 문서 전체)
검토 기준: diff-base=origin/main, scope=spec/7-channel-web-chat/

---

## 발견사항

### [INFO] 0-overview.md 의 webchat 상태 기술이 부분 구현(🚧)으로 분류되어 있으나 spec 영역은 모두 `implemented`

- target 위치: `spec/7-channel-web-chat/` 6개 문서 frontmatter `status: implemented`
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-backlog-closeout-c2d1d4/spec/0-overview.md` §6.2 — "임베드형 웹채팅 위젯 + SDK" 항목이 `🚧(백엔드만 존재/부분 구현)` 섹션에 있으며, "라이브 미리보기는 위젯 co-deploy 후 증분 2" 로 기술되어 있다
- 상세: 7-channel-web-chat 영역 spec 6문서는 모두 `status: implemented`로 종결 처리됐다. 그러나 `spec/0-overview.md` §6.2 에는 여전히 "운영 콘솔 라이브 미리보기는 위젯 co-deploy 후 증분 2" 라는 🚧 설명이 남아있다. 5-admin-console.md §5 의 "증분 단계 주의" 노트와 NAV-WC-06(`🚧 권장, 증분 2`) 의 미완 표기는 spec 내부에서 일관되게 유지되고 있으나, `0-overview.md` 의 분류 위치(🚧 섹션)는 영역 종결 상태와 다소 혼선이 생길 수 있다.
- 제안: `spec/0-overview.md` 의 해당 항목을 §6.1(구현 완료 ✅)로 이동하되, "라이브 미리보기는 위젯 co-deploy 후 증분 2" 기술을 §6.1 내 주석으로 유지하거나 NAV-WC-06 상태와 함께 관리. 단, 이는 spec 영역 자체의 내부 정합성은 유지하고 있으므로 낮은 우선순위 동기화 항목이다.

---

### [INFO] `spec/7-channel-web-chat/5-admin-console.md` §4 의 `appearance` flat 저장 스키마와 EIA spec §4 의 `interaction.appearance` 예시 스키마 간 필드 구성 일부 표기 차이

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §4 — "저장 포맷(flat) ↔ BootConfig(nested) 변환: 콘솔 폼·서버는 flat shape(`welcomeText`·`suggestions` textarea 단일 string)로 저장"
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-backlog-closeout-c2d1d4/spec/5-system/14-external-interaction-api.md` §4 의 `interaction.appearance` 예시 블록 (`"welcomeText": "..."`, `"suggestions": "..."`, `"locale"`, `"primaryColor"`, `"position"`, `"headerTitle"`, `"disclaimer"`)
- 상세: EIA spec §4 의 `appearance` 예시는 `welcomeText`/`suggestions` 를 flat string 으로 표기하고 있으며, `5-admin-console.md` §4 도 동일하게 flat 저장을 선언한다. 두 spec 의 표기는 기본 일치하나, EIA spec 예시에는 `launcher.suggestions` 에 해당하는 별도 필드가 없다. `5-admin-console.md` §4 는 "추천질문은 `welcome.suggestions`·`launcher.suggestions` 양쪽에 동일 주입(콘솔은 공용 단일 필드로 관리)"라고 설명하므로, `suggestions` 하나로 두 목적지를 채운다. 이는 모순이 아니라 단일 `suggestions` 필드가 양쪽으로 팬아웃되는 구현 결정이며, EIA spec 예시가 저장 포맷 한 필드만 보여주는 약식 표현임을 명시적으로 언급하지 않는다. 혼선 가능성이 있다.
- 제안: EIA §4 `appearance` 예시 블록에 "저장 포맷(flat) — `draftToBootInput` 이 BootConfig 로 변환. `suggestions` = `welcome.suggestions` + `launcher.suggestions` 공용" 주석 추가를 고려. 선택 사항(INFO 등급).

---

### [INFO] `spec/7-channel-web-chat/2-sdk.md` §1 의 전역 함수 메서드 목록과 §5 `ChatInstance` 타입 계약 간 `resetSession` 포함 여부 표기 차이

- target 위치: `spec/7-channel-web-chat/2-sdk.md` §1 (스니펫 로더 메서드 열거) — "메서드: `boot`/`shutdown`/`show`/`hide`/`open`/`close`/`sendMessage`/`updateProfile`/`on(event, cb)`/`off(event, cb?)`" — `resetSession` 없음
- 충돌 대상: 동일 문서 §3 의 `wc:command` 테이블 — `resetSession` 포함. §1 Overview 문장 "메서드: boot/`open`/`close`/`show`/`hide`/`updateProfile`/`resetSession`/`shutdown`" 에는 `resetSession` 포함
- 상세: §1 의 메서드 목록(전역 함수 `ClemvionChat(method, payload)` 설명)은 두 곳에서 상충된다. 첫 번째 인용(§1 메서드 열거 텍스트)에는 `resetSession`이 없으나, §1 Overview 문장("boot/open/close/show/hide/updateProfile/resetSession/shutdown")에는 있다. §5 `ChatInstance` 타입에는 `resetSession`이 없고 §3 `wc:command` 테이블에 있다. 이는 동일 doc 내부의 불일치로, `resetSession`이 공개 `ChatInstance` 인터페이스 메서드인지 아니면 postMessage 레벨 명령에만 존재하는지 모호해진다. 현재 §3·§5 SoT 정의 기준 `ChatInstance`는 `resetSession()` 메서드를 명시하지 않으나, host 가 `resetSession` 을 위젯에 postMessage 로 보낼 수 있다는 것은 §3·§2 에서 명확히 선언되어 있다. 외부 문서·사용자 가이드에서 혼선 발생 가능성.
- 제안: §1 첫 번째 메서드 열거에 `resetSession` 추가, 또는 §5 `ChatInstance` 타입에 `resetSession(): void` 추가 및 산문 정렬. 동일 파일 내부 표기만의 정리 이슈(INFO).

---

### [INFO] `spec/0-overview.md` §6.2 의 webchat 서술이 "외부 사이트에 삽입하는 iframe 격리형 웹채팅 위젯 SPA … 샘플이 구현됐다"라고 서술하지만 `_product-overview.md` 의 비목표 "샘플 프로젝트"와의 완료 범위 정합 필요

- target 위치: `spec/7-channel-web-chat/_product-overview.md` §4 표 — "C. 샘플 | SDK 패키지의 `examples/`"
- 충돌 대상: `spec/0-overview.md` §6.2 — "외부 사이트에 삽입하는 iframe 격리형 웹채팅 위젯 SPA … + 샘플이 구현됐다"
- 상세: `0-overview.md` 는 샘플(구성요소 C)이 구현됐다고 기술하고 있으나, 이는 `_product-overview.md` 및 `2-sdk.md` 가 명시한 v1 목표 범위 항목이다. spec 문서 자체에는 충돌이 없으나(구성요소 C 는 목표에 포함됨), 실제 구현 여부·범위가 6개 spec 이 all `implemented` 로 종결된 상태와 일치하는지 별도 확인이 필요하다. 본 cross-spec 검토에서는 spec 기술 간 모순은 없음.
- 제안: 별도 spec-coverage 점검으로 샘플 구현 여부 확인. 현재 spec 충돌 없음(INFO).

---

## 요약

`spec/7-channel-web-chat/` 6개 문서는 참조하는 외부 spec 영역(EIA, Webhook, 데이터 모델, Navigation, Conversation Thread, Interaction Type Registry)과의 핵심 계약에서 직접 모순이 발견되지 않는다. 주요 교차점인 EIA 표면 매핑(endpoint·HTTP method·SSE 이벤트명·interactionType 3값), 데이터 모델(`interactionAllowedOrigins`, Trigger `config.interaction.appearance`), RBAC(viewer/editor 분리), Trigger PATCH API, `wc:*` postMessage 프로토콜, 토큰 전략(`per_execution`), 410 Gone 에러 처리, `execution.message` SSE 이벤트 처리 등 모두 target spec과 관련 spec이 일치하거나 명시적 상호 참조로 정합을 유지하고 있다. 발견된 항목은 모두 동일 파일 내 산문 표기 비일관성 또는 `spec/0-overview.md` 의 상태 분류 동기화 권장 사항(INFO)이며, 운영 차단 수준의 충돌은 없다.

## 위험도

LOW
