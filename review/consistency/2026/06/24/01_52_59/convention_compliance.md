# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: `--impl-done` (구현 완료 후), diff-base=`origin/main`
**검토 일시**: 2026-06-24

---

## 발견사항

### **[WARNING]** frontmatter `code:` 에 이동된 `chat-channel-token-rotator.service.ts` 경로 누락

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `code:` (lines 4–17)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로" 를 열거해야 하며, `spec-code-paths.test.ts` 가 `status ∈ {partial, implemented}` 시 ≥1 glob 매치를 강제한다
- **상세**: 이번 diff 로 `ChatChannelTokenRotatorService` 가 `codebase/backend/src/modules/chat-channel/chat-channel-token-rotator.service.ts` 에서 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 로 이동했다. 기존에 이 파일은 `code:` 의 `codebase/backend/src/modules/chat-channel/**` glob 에 포함됐으나, 이동 후에는 triggers/ 하위가 됐다. 현재 frontmatter 의 triggers/ 항목은 명시적 파일 3개(`dto/chat-channel-config.dto.ts`, `triggers.service.ts`, `triggers.controller.ts`)만 열거하며 `chat-channel-token-rotator.service.ts` 와 `chat-channel-token-rotator.service.spec.ts` 를 포함하지 않는다. `spec-code-paths.test.ts` 는 `code:` glob 에 ≥1 파일이 매치되는지만 검증하므로 현재 가드는 **통과**하지만, 해당 spec 이 약속한 CCH-SE-04-C 서비스의 구현 경로가 frontmatter 증거에서 누락되어 spec-impl-evidence §2.1 의 "본 spec 이 약속한 surface 의 구현 경로" 취지와 거리가 생긴다
- **제안**: frontmatter `code:` 에 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 한 줄 추가. 또는 `codebase/backend/src/modules/triggers/**` glob 으로 확대 (단, 이 경우 triggers/ 전체가 chat-channel spec 의 code 증거로 등재되는 부작용 주의 — 명시적 파일 나열 유지를 권장)

---

### **[WARNING]** §7 구현 파일 구조 목록에서 `ChatChannelTokenRotatorService` 이동 미반영

- **target 위치**: `spec/5-system/15-chat-channel.md` §7 (lines 449–480) — `triggers/` 하위 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` (code 경로의 단일 진실 원칙), CLAUDE.md "정보 저장 위치 (단일 진실 원칙)"
- **상세**: §7 의 `triggers/` 블록에는 `triggers.service.ts` 와 `dto/create-trigger.dto.ts` 만 나열돼 있고, 이번 diff 로 이동된 `chat-channel-token-rotator.service.ts` (CCH-SE-04-C 서비스) 및 `triggers.controller.ts` (rotate-bot-token 엔드포인트 이전처)가 누락됐다. `triggers.controller.ts` 는 frontmatter `code:` 에는 등재돼 있으나 §7 파일 구조 목록에는 없다. 이 구현 파일 구조는 spec 의 "단일 진실" 역할을 하며, 리뷰어·기여자가 구현 위치를 파악하는 navigation 기준이다
- **제안**: §7 `triggers/` 블록을 다음과 같이 갱신:
  ```
  triggers/
    triggers.controller.ts                 # C-2: rotateBotToken 엔드포인트 이전 (chat-channel↔triggers 순환 해소)
    triggers.service.ts                    # 기존 — setupChannel / teardownChannel / rotateBotToken 호출 추가
    chat-channel-token-rotator.service.ts  # C-2: chat-channel 에서 이전 — 24h grace 정리 스케줄러 (CCH-SE-04-C)
    dto/create-trigger.dto.ts              # 기존 — chatChannel 필드 추가
  ```

---

### **[INFO]** `@ApiOperation` description 에 응답 Swagger 래퍼 데코레이터 미사용

- **target 위치**: 구현 diff — `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 핸들러 (lines 266–289)
- **위반 규약**: `spec/conventions/swagger.md §2-4, §5-1, §5-3` — `@ApiOkWrappedResponse(Dto)` 등 공용 래퍼 헬퍼 사용 + 응답 DTO 클래스 `dto/responses/` 위치
- **상세**: 이전된 `rotateBotToken` 핸들러에는 `@ApiOperation` 만 있고 `@ApiOkWrappedResponse` / `@ApiBadRequestResponse({ type: ErrorResponseDto })` / `@ApiNotFoundResponse` 등 swagger 응답 데코레이터가 없다. `swagger.md §5-4` 의 "새 엔드포인트 체크리스트"(응답 DTO, 래퍼, `@ApiParam({ format: 'uuid' })` 등) 기준에 미달한다. 단, 이 항목은 spec 문서(`15-chat-channel.md`) 자체의 위반이 아니라 구현 코드의 swagger.md 미준수이며, spec 에는 §5.4 에서 응답 형식이 충분히 명시되어 있다
- **제안**: `triggers.controller.ts` 의 `rotateBotToken` 에 `@ApiParam({ name: 'id', format: 'uuid' })`, `@ApiOkWrappedResponse(RotateBotTokenResponseDto)`, `@ApiBadRequestResponse`, `@ApiNotFoundResponse` 추가. 응답 DTO `RotateBotTokenResponseDto` 를 `triggers/dto/responses/rotate-bot-token-response.dto.ts` 에 신설. (spec 변경 불필요 — 구현 fix 사안)

---

## 요약

`spec/5-system/15-chat-channel.md` 는 전반적으로 정식 규약(`Overview / 본문 / Rationale` 3섹션, `id`/`status`/`code:`/`pending_plans:` frontmatter, 에러 코드 `UPPER_SNAKE_CASE`, API 응답 봉투 형식, `rotate-bot-token` 동사 등)을 올바르게 준수하고 있다. 다만 이번 C-2 리팩터(`ChatChannelTokenRotatorService` + `rotateBotToken` 엔드포인트를 `chat-channel` → `triggers` 모듈로 이전)의 결과가 spec 문서에 완전히 반영되지 않았다 — frontmatter `code:` 경로와 §7 구현 파일 구조 목록 모두 이동된 `chat-channel-token-rotator.service.ts` 를 누락하고 있으며, `triggers.controller.ts` 도 §7 목록에서 빠져 있다. spec-impl-evidence 가드는 `code:` glob 에 ≥1 매치 여부만 검증해 빌드 실패는 발생하지 않지만, spec 이 약속한 surface 의 구현 경로 증거로서의 완전성이 떨어진다. 구현 코드의 Swagger 데코레이터 완성도(INFO) 는 `swagger.md` 규약 준수 문제이나 spec 문서 자체의 위반은 아니다.

---

## 위험도

LOW
