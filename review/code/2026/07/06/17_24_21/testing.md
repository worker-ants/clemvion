### 발견사항

- **[INFO]** `dispatchEmails` 준비 단계(`userRepository.find`) 실패 테스트는 있으나, `userRepository.find` 부분 결과(일부 필드 누락 등) 케이스는 다루지 않음
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` `dispatchEmails` / `notifications.service.spec.ts`
  - 상세: `userRepo.find` 가 throw 하는 케이스(테스트 존재, "userRepo.find 가 throw 해도…")는 커버되지만, TypeORM `select: {id, email}` 프로젝션이 실제로 `email` 컬럼을 누락시켜 반환하는 경우(select 오류·컬럼명 불일치 등 설정 실수)는 mock 기반 unit 으로는 원천적으로 검증 불가능한 영역. e2e/통합 테스트가 없다면 이 프로젝션 자체의 정확성(실제 컬럼 alias)은 미검증 상태로 남는다.
  - 제안: PR3에서 실제 발사 소스가 붙을 때 최소 1개의 e2e(email channel end-to-end, 이미 WARNING으로 defer 결정됨)로 `select` 프로젝션의 실동작을 검증할 것. 현재 라운드에서는 defer 결정이 합리적(RESOLUTION 17_00_31 참고).

- **[INFO]** `dispatchEmails`/`sendOneEmail` 의 로그 레벨(warn) 자체를 검증하는 테스트가 없음
  - 위치: `notifications.service.spec.ts` 이메일 발송 실패 테스트들
  - 상세: 실패 시 `email_sent_at` 미갱신·`notify()`/`createMany()` 가 reject 하지 않는 것은 잘 검증되지만, `this.logger.warn(...)` 호출 자체(메시지 포맷)를 spy 로 확인하는 테스트는 없다. 운영 모니터링(spec §3 "실패는 warn 로그로 남아 운영자가 추적")이 핵심 계약인데 로그 발생 여부는 암묵적으로만 신뢰됨.
  - 제안: 최소 1개 테스트에서 `logger.warn` spy 로 실패 로그가 실제로 호출되는지 확인 권장(저비용, 회귀 방지용). 차단 사유는 아님.

- **[INFO]** `MailService.sendNotificationEmail` XSS 테스트가 `message` 의 `<img src=x onerror=1>` 만 검증하고, `type` 필드는 이스케이프 대상이 아님을 암묵 가정
  - 위치: `mail.service.spec.ts` "title/message 를 HTML escape" 테스트
  - 상세: `buildNotificationHtml`/`buildNotificationText` 는 `type` 을 렌더링에 사용하지 않으므로(제목/본문에만 노출) 문제는 없으나, 향후 `type` 을 뱃지·아이콘 매핑 등으로 노출시키는 변경이 들어오면 이스케이프 누락 회귀 가능성이 있다. 현재는 실질적 위험 없음(코드가 type을 렌더링하지 않음) — 관찰 사항.
  - 제안: 조치 불필요, 향후 `type` 렌더링 추가 시 escape 테스트 동반 상기.

- **[INFO]** `dispatchEmails` 의 `Promise.allSettled` 결과(rejected reason)를 개별적으로 로깅/집계하지 않고 `sendOneEmail` 내부에서 개별 catch 하므로, allSettled 자체의 rejected 분기는 사실상 도달 불가 코드
  - 위치: `notifications.service.ts` `dispatchEmails`
  - 상세: `sendOneEmail` 이 내부에서 모든 예외를 catch 하여 절대 reject 하지 않으므로 `Promise.allSettled` 를 쓸 이유가 실질적으로 없다(모든 promise 가 항상 fulfilled). 테스트는 이 사실을 정확히 반영해 개별 실패/성공을 `repo.update` 호출 여부로 검증하고 있어 테스트 자체는 정확하지만, 프로덕션 코드의 `allSettled` 선택이 코드 가독성상 오해를 유발할 수 있다(마치 reject 가능성이 있는 것처럼 보임).
  - 제안: 코드 관점 이슈이므로 이번 라운드 차단 사유 아님 — `Promise.all(rows.map(...))` 로 단순화 가능하다는 점만 참고(테스트 영향 없음, 스타일 이슈).

- **[INFO]** `notifications.module.ts` 변경(신규 `TypeOrmModule.forFeature([User])`, `MailModule` import)에 대한 전용 모듈 단위 테스트는 없음(기존 컨벤션상 없는 것이 일반적)
  - 위치: `notifications.module.ts`
  - 상세: DI 배선 정확성은 `notifications.service.spec.ts` 생성자 시그니처(4-인자: repo, userRepo, moduleRef, mail) 변경 반영 + app-boot e2e(236 passed, RESOLUTION 기록)가 간접 검증. 순환 참조 회피 주석은 코드 리뷰로 충분히 검토됨.
  - 제안: 별도 조치 불필요 — 기존 프로젝트 관행과 일치.

### 요약
본 PR은 이미 4라운드의 `/ai-review` 사이클을 거치며 테스트 커버리지가 매우 촘촘하게 보강된 상태다. `MailService.sendNotificationEmail`(XSS escape, CRLF 헤더 인젝션 방어, console transport, 발송 실패 throw)과 `NotificationsService.dispatchEmails`/`sendOneEmail`(channel 필터링 3분기, In() 배치 조회, 동일 userId 다중 알림, 부분 실패 격리, email 없음/빈 문자열 가드, notify 단건 both/default 분기, email_sent_at UPDATE 실패 시 warn-only) 모두 성공·실패·경계 경로가 개별 테스트로 명시적으로 커버되어 있다. Mock 구성(MailerService/ConfigService/Repository/ModuleRef)은 실제 인터페이스 형태를 적절히 반영하고 있고, 각 테스트가 독립적인 `beforeEach` 셋업으로 격리되어 있어 순서 의존성도 없다. 테스트명이 한국어로 의도(무엇을·왜)를 명확히 서술해 가독성도 좋다. 기존 회귀 테스트(sendVerificationEmail/sendPasswordResetEmail/sendEmailChangeVerification 등)는 변경 없이 유효하며, notify()/createMany() 기존 dismiss 관련 테스트도 생성자 인자 확장에 맞춰 정확히 갱신되었다. 남은 갭은 실 DB/실 발사 소스가 필요한 e2e 채널(=email) 종단 검증뿐이며, 이는 PR3(발사 소스 wiring) 이후로 defer하는 것이 합리적이라고 이미 팀이 판단해 기록해 두었다(WARNING 1, 17_00_31 라운드). 신규 발견 CRITICAL/WARNING 없음.

### 위험도
NONE
