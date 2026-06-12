# 보안(Security) Review 결과

## 발견사항

### [WARNING] 브라켓 접근자([]) 를 통한 private 저장소 직접 접근 — 캡슐화 우회
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` 메서드 (라인 1337)
- 상세: `this.executionsService['executionRepository']` 와 같이 브라켓 접근자로 private 멤버에 접근한다. TypeScript 컴파일러 보호를 우회하는 방식이며, 클래스 내부 구현에 암묵적으로 결합된다. 이것은 이전 `isActiveExecution` 에서도 동일하게 사용된 패턴이고, 리팩토링 전부터 존재하던 코드이지만, 보안 관점에서 서비스 레이어가 다른 서비스의 내부 저장소에 직접 접근하는 것은 권한 경계를 무너뜨린다. `ExecutionsService` 에 전용 public 메서드(예: `getExecutionStatus(id)`)를 노출하는 것이 올바른 접근이다.
- 제안: `ExecutionsService` 에 `getExecutionStatus(executionId: string): Promise<ExecutionStatus | null>` 형태의 public 메서드를 추가하고, `getActiveExecutionStatus` 가 그것을 호출하도록 수정한다.

### [WARNING] `executionStillRunning` 텍스트가 config.languageHints 에서 전달될 때 XSS/Injection 위험 (Telegram MarkdownV2 escape 미보장)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `sendExecutionStillRunningNotice` 메서드 (라인 1362-1364)
- 상세: `config.languageHints?.executionStillRunning` 는 DB에 저장된 사용자 설정값(관리자가 ChatChannelConfigDto 를 통해 저장)이다. 주석에서 "텔레그램 MarkdownV2 는 어댑터가 escape 하지 않으므로 default 문구는 pre-escaped"라고 기술하고 있다. 즉 커스텀 `languageHints` 값이 주어지면 MarkdownV2 escape 없이 그대로 어댑터에 전달된다. Telegram sendMessage 는 parse_mode=MarkdownV2 사용 시 이 값의 특수문자(`.`, `!`, `-`, `(`, `)` 등)를 파싱 오류 또는 의도치 않은 포맷팅으로 처리할 수 있다. 동일 패턴이 `maybeNotifyIgnored`, `/help` 응답, `handleFormStep` 내 languageHints 전반에 존재한다.
- 제안: 어댑터 수준에서 `kind:'text'` 메시지의 text 를 parse_mode 에 따라 escape 하거나, languageHints 저장 시 입력 유효성 검증(허용 문자 제한)을 추가한다. 또는 plaintext mode 를 기본으로 사용하고 MarkdownV2 를 명시적으로 선택하도록 어댑터 계약을 변경한다.

### [INFO] `rotateBotToken` 응답에 `botIdentity`(botId, username) 포함 — 민감 정보 노출 범위 검토
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken` 반환값 (라인 1559-1567)
- 상세: 응답에 `botIdentity: { botId: number; username: string }` 가 추가되었다. 이 자체는 공개 식별자이나, `botId` 는 Telegram bot ID 로서 공개 API(예: Telegram MTProto)에서 타겟 식별에 활용될 수 있다. 현재 이 API는 인증된 관리자만 호출 가능(workspaceId 기반 인가)하므로 직접적 위험은 낮다. `botToken` 자체는 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 에 의해 올바르게 제거되어 있다(라인 1623-1631).
- 제안: 현 구현은 수용 가능. 다만 `botId` 가 외부 공격자에게 노출되면 타겟팅이 가능하므로, API 응답에 대한 접근 제어(인증된 관리자 전용)가 컨트롤러 수준에서 확실히 적용되는지 재확인한다.

### [INFO] `getActiveExecutionStatus` DB 오류 시 `null` (비활성 처리) — fail-open 정책
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` 메서드 (라인 1337-1349)
- 상세: `.catch(() => null)` 로 DB 예외를 삼키고 `null`(비활성) 로 처리한다. DB 장애 시 실행 중인 execution 이 있어도 새 execution 을 시작하는 fail-open 동작이다. 이는 테스트 코드에서도 명시적으로 검증된 의도적 결정이다(hooks.service.spec.ts 라인 334-363). DoS 성 연쇄 execution 생성 가능성이 있으나, 이를 악용하려면 이미 webhook 인증을 통과해야 하므로 위협 범위가 제한된다.
- 제안: 이 정책이 의도적임을 확인. 단, DB 장애 시 과도한 execution 생성을 방지하기 위한 rate-limit(CCH-NF-03, 아직 미구현)이 보완책으로 필요하다.

### [INFO] `form_submission` 에서 필드 allow-list 필터링 적용 확인 — 양호
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — 라인 936-943
- 상세: `pendingFormModal.fields` 에 선언된 이름만 허용하는 allow-list 필터(`allowedNames` Set)가 적용되어 있어 undefined 필드 injection 을 방지한다. 보안 관점에서 올바른 구현이다.
- 제안: 없음.

### [INFO] `open_form_modal` / `form_submission` channelUserKey 불일치 검증 — 양호
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — 라인 854-858, 910-914
- 상세: 그룹 채널에서 다른 사용자가 버튼을 클릭하여 타인의 form 을 가로채는 공격을 방지하는 security guard 가 구현되어 있다. channelUserKey 불일치 시 조용히 무시하는 정책이다.
- 제안: 없음.

### [INFO] 하드코딩된 시크릿 없음 — 양호
- 위치: 전체 변경 파일
- 상세: API 키, 토큰, 비밀번호 등이 코드에 직접 하드코딩된 사례가 없다. 테스트 파일의 `NEW_BOT_TOKEN = '222222222:NewToken'` 은 테스트 전용 fixture 값이며 실제 자격증명이 아니다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심인 CCH-CV-03 (b) 분기(`getActiveExecutionStatus` 도입)와 `rotateBotToken` 응답 확장은 보안 측면에서 대체로 안전하다. `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` allow-list 를 통한 시크릿 응답 제거, form_submission 의 allow-list 필터링, channelUserKey 불일치 가드 등 기존 보안 레이어가 잘 유지되고 있다. 주의가 필요한 사항은 두 가지다. 첫째, `ExecutionsService` 의 private 저장소를 브라켓 접근자로 직접 접근하는 패턴은 캡슐화 위반으로 서비스 간 권한 경계를 약화시킨다. 둘째, `languageHints` 커스텀 텍스트가 Telegram MarkdownV2 escape 없이 어댑터에 전달되어 의도치 않은 포맷팅이나 메시지 전송 오류가 발생할 수 있다. 하드코딩된 시크릿, 인젝션 취약점, 인증 우회, 알려진 취약 의존성은 이번 변경 범위에서 발견되지 않았다.

---

## 위험도

LOW
