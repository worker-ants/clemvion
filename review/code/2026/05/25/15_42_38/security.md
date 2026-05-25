# 보안(Security) 리뷰 결과

리뷰 대상: `telegram-carousel-button-click` 브랜치 변경 (2026-05-25)
리뷰 범위: 총 6개 파일 (실행 엔진 서비스 구현 + 테스트 + 일관성 검토 산출물)

---

## 발견사항

### [INFO] buttonId 길이 제한 — 적절히 처리됨
- 위치: `execution-engine.service.ts` diff, `button_click` 분기 추가 코드
- 상세: `buttonIdStr = typeof buttonIdRaw === 'string' ? buttonIdRaw.slice(0, 64) : ''` 구문으로 외부에서 유입된 buttonId 값을 64자로 절삭한 후 로그에 기록한다. 이 처리는 로그 인젝션(log injection) 및 과도하게 긴 문자열이 로그 시스템을 압박하는 케이스를 방어한다. 64자 cap 자체는 실용적으로 충분하다.
- 제안: 없음. 현재 구현은 적절하다.

### [INFO] action 타입 캐스트 — `as { buttonId?: unknown }` 안전성
- 위치: `execution-engine.service.ts` diff, `const buttonIdRaw = (action as { buttonId?: unknown }).buttonId`
- 상세: `action` 객체를 `{ buttonId?: unknown }` 으로 단언(type assertion)한 뒤 `buttonId` 를 꺼낸다. 이 시점에 `action` 은 이미 `action.type === 'button_click'` 분기를 통과했으므로, 외부에서 임의 객체가 직접 도달할 수 없다. `buttonId` 값 자체도 즉시 `typeof ... === 'string'` 검사 후 사용하므로 타입 혼동(type confusion) 위험이 없다.
- 제안: 없음.

### [INFO] warn 로그의 executionId 포함 — 민감 정보 노출 여부 검토
- 위치: `execution-engine.service.ts` diff, `this.logger.warn(...)` 구문
- 상세: 경고 로그에 `execution=${executionId}` 와 `buttonId=${buttonIdStr}` 가 포함된다. `executionId` 는 내부 식별자로, 이 값이 외부 채널(예: API 응답, 프론트엔드 UI, Telegram 메시지)로 노출되지 않는 한 로그 파일 내 기재는 운영상 허용 범위이다. 현재 코드는 로그만 남기며 응답 페이로드나 외부 채널로 전달하지 않는다. `buttonId` 역시 64자로 절삭되어 포함된다.
- 제안: 프로덕션 환경에서 로그 집계 시스템(예: ELK, Datadog)의 접근 제어가 적절히 설정되어 있는지 확인 권장. 코드 변경 자체는 문제없다.

### [INFO] MAX_UNKNOWN_SKIPS cap 우회 가능성 — 의도된 설계이나 확인 필요
- 위치: `execution-engine.service.ts` diff 전체 맥락, `button_click` 를 `unknownSkipCount` 카운팅에서 제외하는 로직
- 상세: 이 PR 은 `button_click` 을 "알려진(enum-complete)" 이벤트로 분류하여 `MAX_UNKNOWN_SKIPS` (20회) 카운터 증가에서 제외한다. 이는 stale Telegram inline_keyboard 클릭이 무한 반복되어도 대화를 FAILED 처리하지 않겠다는 설계다. 보안 관점에서 검토할 점은 다음과 같다: (1) 공격자가 `button_click` 메시지를 빠른 속도로 무한히 전송하면 `waitForAiConversation` 루프가 영구적으로 점유될 수 있다. (2) 이 루프는 각 iteration 마다 `await` 를 포함하므로 Node.js 이벤트 루프를 블로킹하지는 않지만, 해당 execution context 는 해제되지 않는다. (3) 외부에서 유입되는 `button_click` 에 대한 rate limiting 이 API 게이트웨이 또는 Telegram webhook 처리 계층에 존재한다면 이 위험은 완화된다.
- 제안: Telegram callback 수신 엔드포인트에서 동일 `executionId` + `chat` 조합에 대해 rate limiting 또는 debounce 가 적용되어 있는지 확인 권장. `waitForAiConversation` 루프 자체에 절대 실행 시간 상한(예: 기존 `MAX_UNKNOWN_SKIPS` 대신 총 경과 시간 기반 타임아웃)을 설계 수준에서 도입하는 것도 고려할 수 있다. 단, 이는 spec §3·§6.1 "무제한 대기" 정책과 상충하므로 spec 변경이 선행되어야 한다.

### [INFO] 테스트 파일에서 `unknown as` 형태의 내부 필드 직접 접근
- 위치: `execution-engine.service.spec.ts` 신규 테스트 코드, `pendings`, `logger` 등 내부 필드에 대한 `(service as unknown as { ... })` 캐스트
- 상세: 테스트 코드에서 `private` / 내부 상태에 직접 접근하기 위해 `as unknown as` 이중 단언 패턴을 사용한다. 이 패턴은 테스트에서 일반적으로 허용되며 프로덕션 보안에 영향을 미치지 않는다. 테스트 환경에서만 사용되는 코드이고, 프로덕션 빌드에는 포함되지 않는다.
- 제안: 없음.

### [INFO] 일관성 검토 산출물(`_retry_state.json`)의 절대 경로 노출
- 위치: `review/consistency/2026/05/25/15_27_39/_retry_state.json`
- 상세: JSON 파일에 `/Volumes/project/private/clemvion/...` 형태의 로컬 절대 경로가 포함되어 있다. 이 파일은 리포지터리에 커밋되어 있어, 해당 파일을 통해 개발자의 로컬 파일 시스템 경로 구조가 외부에 노출될 수 있다. 직접적인 서버 보안 취약점은 아니나, 소셜 엔지니어링 또는 타겟 정보 수집(OSINT) 관점에서 불필요한 정보 노출이다.
- 제안: 리포지터리 커밋 전 `_retry_state.json` 내부의 절대 경로를 상대 경로 또는 플레이스홀더로 치환하는 후처리 단계를 도입하거나, 해당 파일 패턴을 `.gitignore` 에 추가하는 방안을 검토 권장.

---

## 요약

이번 PR 의 핵심 변경인 `waitForAiConversation` 루프 내 `button_click` 분기 추가는 보안 관점에서 전반적으로 안전하게 구현되었다. `buttonId` 값을 64자로 절삭한 뒤 로그에 기록하는 방어 코드가 존재하고, 민감 정보가 외부로 노출되는 경로는 없다. 주요 보안 점검 항목(SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화) 어느 것도 해당 사항이 없다. 다만 `button_click` 을 `MAX_UNKNOWN_SKIPS` 카운터에서 완전히 제외함으로써 해당 이벤트 타입을 무한 전송하는 DoS 벡터가 이론적으로 존재한다는 점은 상위 계층(API 게이트웨이, Telegram webhook 처리)의 rate limiting 으로 방어되어야 함을 확인할 필요가 있다. 또한 `_retry_state.json` 파일에 로컬 절대 경로가 포함된 채 커밋되는 패턴은 정보 노출 측면에서 개선이 권장된다.

---

## 위험도

LOW

STATUS: SUCCESS
