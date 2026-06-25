# 정식 규약 준수 검토 — refactor 03 m-1 (console → Logger)

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: 리팩토링 구현 계획 (`plan/in-progress/refactor/03-maintainability.md §m-1`) 및 변경 예정 파일 4곳 + 면제 5곳 + eslint 설정

---

## 발견사항

### [INFO] telegram-message.renderer.ts — 함수 스코프 new Logger 패턴 적합성

- target 위치: `modules/chat-channel/providers/telegram/telegram-message.renderer.ts:427` — 계획상 "모듈레벨 `new Logger`" 로 교체 예정
- 위반 규약: 직접 위반은 없으나 NestJS 관례(`@Injectable()` 클래스에서 `private readonly logger = new Logger(ClassName.name)`)와 달리 모듈레벨 상수를 사용하는 패턴 — `spec/conventions/swagger.md` 등 별도 Logger 패턴 규약 문서 없음. 기존 클래스 컨텍스트(`AuditLogsService`, 예정 `McpTestConnectionService`)와 패턴이 다름
- 상세: `telegram-message.renderer.ts` 와 `language-hint-defaults.ts` 는 `@Injectable()` 클래스가 아닌 순수 함수 컨텍스트라 `this.logger` 패턴 불가. 계획에서 "모듈레벨 `new Logger`" 로 명시하고 있으나, NestJS `Logger` 인스턴스를 클래스 외부(모듈 스코프)에서 생성하는 것은 NestJS DI 생명주기를 벗어나며 context 이름 부여가 제한적. spec/conventions 에 Logger 인스턴스화 위치를 명시한 규약이 없으므로 CRITICAL/WARNING 은 아님
- 제안: 구현 시 `new Logger('ChatChannel.Telegram')` / `new Logger('ChatChannel.LanguageHint')` 처럼 명시적 context 이름을 사용해 로그 가독성을 유지. 규약화 필요 시 `spec/conventions/` 에 Logger 패턴 문서 신설(별건 planner)

---

### [INFO] plan 상 전환 대상 목록과 worktree 현재 상태 불일치

- target 위치: `plan/in-progress/refactor/03-maintainability.md §m-1:286` — 5곳 열거 중 `modules/audit-logs/audit-logs.service.ts:85` 포함
- 위반 규약: 없음 (정보성 확인)
- 상세: worktree 현재 `audit-logs.service.ts` 에는 이미 `private readonly logger = new Logger(AuditLogsService.name)` 가 존재하고 `console.*` 호출이 없음 (grep 결과). plan §m-1 의 "5곳 미착수" 목록에 `audit-logs.service.ts` 를 포함하는 것이 현재 코드베이스와 불일치. 본 계획의 scope 기술("전환 4곳")은 이미 audit-logs 를 제외하고 있어 계획 scope 자체는 정확하나, plan 문서 §m-1:286 의 원본 목록이 stale 상태
- 제안: 구현 착수 전 `grep -rn 'console\.' codebase/backend/src --include='*.ts'` 로 실제 대상을 재확인. 계획 scope 기술("전환 4곳")이 실제 미전환 곳과 일치하는지 검증 후 착수. plan §m-1:286 의 목록 갱신은 해당 plan 문서 업데이트 시 반영 권장

---

### [INFO] eslint.config.mjs no-console 룰 — spec 명시 예외 범위

- target 위치: 계획 scope "eslint.config.mjs 에 no-console 룰 추가(scripts/·instrumentation.ts·*.spec override)"
- 위반 규약: 없음 (정보성)
- 상세: `spec/conventions/` 에 eslint 룰 명세 문서가 없어 직접 위반은 없음. `main.ts:204/206` 의 bootstrap `console.log` 는 `const logger = new Logger('Bootstrap')` 인스턴스가 이미 존재해 `logger.log(...)` 로 전환 가능하나, 계획이 이를 면제("bootstrap console.log")로 처리하는 것은 타당한 선택. `code.handler.ts` 3곳(pre-bootstrap IIFE) 면제도 DAYJS_SNAPSHOT 로딩 사유로 타당
- 제안: 면제 사유 주석을 inline `eslint-disable-next-line no-console -- <사유>` 형식으로 작성해 나중에 면제 이유를 grep 으로 추적 가능하게 유지 권장 (현 계획에 "사유 주석" 이 명시돼 있어 양호)

---

### [INFO] chat-channel-adapter.md §swallow — 계획 방향 정렬 확인

- target 위치: `spec/conventions/chat-channel-adapter.md:84` — `"swallow (logger.warn)"` 명시
- 위반 규약: 없음 — 본 계획이 이 규약에 정합하는 방향으로 `console.warn` → `this.logger.warn` 전환을 수행하므로 정방향 정렬
- 상세: `language-hint-defaults.ts:75` 의 `console.warn` (deprecated hint 경고) 은 chat-channel-adapter.md §1.1 "swallow (logger.warn)" 의미와 정렬되는 전환. 규약 준수 관점에서 계획 내용이 올바름
- 제안: 해당 없음

---

### [INFO] ai-agent spec §6.2.c.fallback — 별건 planner 위임 명시됨

- target 위치: 계획 scope 끝 "ai-agent spec §6.2.c.fallback 의 console.warn 원문 정정은 planner 위임(별건, 본 PR 미포함)"
- 위반 규약: 없음
- 상세: 본 PR 이 spec 원문 `console.warn` 표현을 정정하지 않는 것은 `developer` 의 `spec/` 읽기 전용 제약(CLAUDE.md)에 부합. planner 위임으로 명시돼 있어 계획 자체는 규약 준수
- 제안: 해당 없음

---

## 요약

정식 규약(`spec/conventions/**`) 직접 위반은 발견되지 않았다. 본 리팩토링 계획은 `3-error-handling.md §6.2` 구조화 JSON 로깅 규약 및 `chat-channel-adapter.md §1.1 swallow(logger.warn)` 명문과 정렬되며, eslint `no-console` 가드 추가는 재발 차단 수단으로 규약과 일치한다. 유일한 실질적 주의 사항은 plan §m-1 원본 목록의 `audit-logs.service.ts` 가 이미 Logger 로 전환된 상태로 보이므로, 착수 전 실제 미전환 대상을 grep 으로 재확인해 계획 scope 와 코드 현실을 동기화하는 것이다. 나머지 발견사항은 모두 INFO 수준의 구현 품질 제안이다.

## 위험도

LOW

STATUS: OK
