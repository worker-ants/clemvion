# 요구사항(Requirement) 리뷰

## 발견사항

### [WARNING] `PUBLIC_WEBHOOK_QUOTA_REDIS` 주입 토큰이 모듈에 미등록
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` L38-40, `hooks.module.ts`
- 상세: `PublicWebhookQuotaService` 생성자는 `@Inject('PUBLIC_WEBHOOK_QUOTA_REDIS')` 토큰으로 Redis 인스턴스를 주입받도록 선언되어 있으나, `HooksModule` providers 배열에 해당 토큰(`{ provide: 'PUBLIC_WEBHOOK_QUOTA_REDIS', useValue/useFactory: ... }`)을 제공하는 provider 가 없다. `@Optional()` 데코레이터가 붙어 있어 런타임 DI 오류는 발생하지 않으나, 운영 환경에서 Redis 를 해당 토큰으로 주입하려면 별도 provider 등록이 필요하다. 테스트는 생성자 직접 주입으로 우회하므로 토큰 기반 경로가 실제로 동작함을 보장하는 장치가 없다.
- 제안: `HooksModule` 에 `{ provide: 'PUBLIC_WEBHOOK_QUOTA_REDIS', useValue: null }` (기본 비활성) 또는 실제 Redis provider 를 등록하거나, `@Inject` 토큰 방식을 제거하고 `ConfigService` 기반 경로만 남긴다.

---

### [WARNING] spec §4 v1 기본 "동시 ≤3 캡" 미구현
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` L17 주석, `plan/in-progress/channel-web-chat-followups.md §1`
- 상세: spec `4-security.md §4` 는 "익명 세션+IP 조합 동시 ≤3"을 opt-in 이 아닌 "v1 기본 적용" 항목으로 명시한다. `PublicWebhookQuotaService` 주석은 이를 "followup, 본 서비스 밖"으로 표시하고 plan 에도 열려 있는 체크박스로 남아 있다. spec 의 v1 기본 의도와 코드 범위 간 갭이다.
- 제안: spec §4 에서 해당 항목을 "conversationEnded 신호 연동 선행 필요로 v1.1 이연" 으로 명시해 spec fidelity 갭을 해소하거나, project-planner 가 spec 을 갱신하도록 위임.

---

### [WARNING] `measureBodyBytes` 직렬화 실패 시 0 반환 — 크기 제한 우회 가능 경로
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L113-125
- 상세: `rawBody` 가 없고 `JSON.stringify(body)` 가 예외를 던질 때 0 을 반환해 크기 제한을 통과시킨다. 주석은 "별도 검증은 service 책임"이라 하나 `HooksService` 는 body 크기를 검사하지 않는다. `rawBody: true` 가 `main.ts` 에 설정돼 있어 실제 NestJS 파이프라인에서는 `rawBody` 가 거의 항상 존재하므로 실질 위험은 낮다.
- 제안: 직렬화 불가 시 `return 0` 보다는 `return this.maxBodyBytes + 1` 로 보수적 차단 처리하거나, HooksService 가 크기 검증을 담당한다면 주석에 그 경로를 명시한다.

---

### [INFO] spec `2-sdk §1` 메서드 목록에 `off()` 미반영 (코드가 spec 앞서 있음)
- 위치: `spec/7-channel-web-chat/2-sdk.md §1`, `codebase/packages/web-chat-sdk/src/types.ts`, `loader.ts`
- 상세: 코드(`types.ts ClemvionChatMethod`, `loader.ts case 'off'`, `index.ts off` 노출)는 `off()` 를 완전히 구현했으나, spec `2-sdk.md §1` 메서드 목록은 `on(event, cb)` 만 표기하고 `off` 가 없다. spec fidelity 역방향 갭이다.
- 제안: project-planner 가 `spec/7-channel-web-chat/2-sdk.md §1` 메서드 목록에 `off(event, cb?)` 추가 및 Rationale 에 unsubscribe 패턴 근거를 명문화한다.

---

### [INFO] spec §4 "메시지 4KB 제한" 미구현 범위 미명시
- 위치: `spec/7-channel-web-chat/4-security.md §4`, `public-webhook-throttle.guard.ts`
- 상세: spec §4 v1 기본에 "메시지/페이로드 크기 제한(예: 메시지 4KB, body 32KB)"이 있다. 현 구현은 body 32KB 만 처리하고 개별 메시지 4KB 제한은 없다. 이 제한이 EIA 레이어(interact endpoint) 책임인지 webhook 게이트 책임인지 spec 에서 불명확하다.
- 제안: spec 에서 "메시지 4KB" 제한의 적용 레이어(EIA interact vs webhook gate)를 명시하도록 project-planner 위임.

---

### [INFO] `wc:resize` `state` 필드 spec-코드 일치 확인 완료
- 위치: `codebase/packages/web-chat-sdk/src/types.ts L73-78`, `spec/7-channel-web-chat/2-sdk.md §3`
- 상세: spec §3 표의 `state: 'collapsed'|'expanded'` 와 `WcResizePayload.state?: "collapsed" | "expanded"` 가 일치한다. `applyResize` 에서 `payload.state` 가 truthy 일 때만 `dataset.wcState` 에 기록하므로 spec 에 정의되지 않은 빈 문자열 엣지케이스는 기록 없이 무시된다.

---

## 요약

이번 변경의 핵심 세 그룹 — 백엔드 공개 webhook 남용 방어(분당/시간당 rate-limit, body 크기), SDK `on()` Unsubscribe 반환·`off()` 추가·`wc:resize` 처리, npm scope 확정·loader 충돌 방지 — 은 모두 의도한 기능을 구현하고 있으며 spec `4-security.md §4` 의 주요 v1 기본 항목(body 32KB, IP rate-limit, fail-open 정책, 공개/인증 webhook 구분)과 spec `2-sdk §3`(wc:resize)를 충실히 따른다. 정상 흐름 외 에러 시나리오(Redis 오류 fail-open, trigger 조회 실패 fail-open, IP 식별 불가 통과)는 모두 처리되어 있다. 주요 미비점은 `PUBLIC_WEBHOOK_QUOTA_REDIS` DI 토큰의 모듈 미등록(WARNING), spec §4 v1 기본으로 명시된 "동시 ≤3 캡" 잔류(WARNING), `measureBodyBytes` 직렬화 실패 시 0 반환으로 인한 잠재적 우회(WARNING)이며, spec `2-sdk §1` 이 `off()` 를 아직 메서드 목록에 추가하지 않은 점(INFO, project-planner 후속)도 남아 있다.

## 위험도

MEDIUM
