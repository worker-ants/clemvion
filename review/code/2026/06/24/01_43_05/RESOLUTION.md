# RESOLUTION — C-2 순환 의존성 해소 (chat-channel ↔ triggers forwardRef 제거)

대상 커밋: `c5ed584f` (구현)
ai-review SUMMARY: 본 디렉터리 `SUMMARY.md` — **위험도 LOW, Critical 0, Warning 3, INFO 11**

## 처분 요약

| # | 등급 | 처분 | 근거 |
|---|------|------|------|
| W-1 | Warning (Security 외 다수) | **Defer (별건 보안 fix)** | pre-existing. 아래 §W-1 |
| W-2 | Warning | **Defer (별건)** | pre-existing. 아래 §W-2 |
| W-3 | Warning (Maintainability) | **Defer (백로그)** | 리뷰가 "이번 PR 즉시 수정 불요" 명시. 아래 §W-3 |
| INFO 1–11 | Info | **Defer** | 전부 pre-existing 또는 nice-to-have. 아래 §INFO |

**코드 변경 없음 → 재리뷰 불요. 수렴.**

본 PR 의 단일 책임은 `chat-channel ↔ triggers` 의 `forwardRef` 양방향 순환을 제거하는 **behavior-preserving** 리팩터링이다. 이전된 핸들러(`rotateBotToken`)와 워커(`ChatChannelTokenRotatorService`)는 **원본 `ChatChannelController` / `chat-channel/` 에서 데코레이터·로직 verbatim 이동**했다. 따라서 아래 지적은 모두 이전 전부터 존재하던 사안이며, 이 PR 에서 손대면 "동작 보존" 경계를 깨고 보안/검증 동작을 변경하게 된다 (M-8 2단계에서 pre-existing warning 을 별건 처리한 것과 동일 규율).

---

## §W-1 — `rotateBotToken` `@Roles('editor')` 누락 → Defer (별건 보안 fix 권장)

- **사실**: 형제 mutation 엔드포인트(`rotateNotificationSecret`, `revokePerTriggerToken`)는 `@Roles('editor')` 적용. `rotateBotToken` 만 누락 → viewer 도 bot token 회전 호출 가능 (권한 정책 불일치, 실제 보안 갭).
- **pre-existing 확인**: 원본 `ChatChannelController.rotateBotToken` 도 `@Roles` 없었음. 본 PR 은 데코레이터까지 verbatim 이동했으므로 갭을 **신규 도입하지 않음**.
- **defer 사유**:
  1. `@Roles('editor')` 추가는 **authz 동작 변경** (viewer 가 기존엔 호출 가능, 추가 후 403) — behavior-preserving 순환-break PR 의 범위를 벗어남.
  2. 올바른 fix 는 spec 의 해당 엔드포인트 **권한 요구(editor) 명문화 + `@ApiForbiddenResponse` 문서화 + viewer-forbidden e2e** 동반이 필요. spec 변경은 `developer` 권한 밖(planner 영역).
  3. 따라서 **별도 보안-fix PR (planner 가 권한 요구를 spec 에 확정 → developer 가 가드+테스트 추가)** 로 처리하는 것이 옳다.
- **조치**: 사용자/planner 에게 "pre-existing 보안 갭 — bot token 회전이 viewer 에게 열려 있음" 을 보고서에 명시 escalate. 본 PR 에서는 미수정.

## §W-2 — `rotateBotToken` `ParseUUIDPipe` 미적용 + param 명 불일치 → Defer

- **사실**: `@Param('id') triggerId: string` — `ParseUUIDPipe` 없음(형제는 전부 적용), 변수명도 `triggerId`(타 메서드 `id`).
- **pre-existing 확인**: 원본 `ChatChannelController` 와 동일. verbatim 이동.
- **defer 사유**: `ParseUUIDPipe` 추가는 **검증 동작 변경**(비-UUID 가 기존엔 서비스 레이어 도달, 추가 후 400) — behavior-preserving 경계 밖. W-1 별건 fix 와 묶어 처리 권장.

## §W-3 — rotator 구조 중복 → Defer (백로그)

- **사실**: `ChatChannelTokenRotatorService` 가 `NotificationSecretRotatorService` 와 구조적으로 거의 동일(WorkerHost·hourly cron·process→handleHourly 위임·catch swallow).
- **pre-existing 확인**: 두 서비스 모두 이전부터 존재. 본 PR 은 위치만 co-locate(둘 다 `triggers/` 로) 했을 뿐 중복을 신규 도입하지 않음.
- **defer 사유**: 리뷰가 명시적으로 "이번 PR 즉시 수정 불요. 백로그 등록 권장". `abstract HourlyRotatorWorkerHost` 공통화는 별도 유지보수 리팩터링.

## §INFO (1–11) — 전부 Defer

- Swagger 데코레이터(#1, #3)·클래스 JSDoc(#5, #6)·file-tree 주석(#7)·빈 문자열 테스트(#8): 전부 pre-existing 또는 nice-to-have이며, codebase 변경 시 재리뷰 사이클을 유발한다. 본 PR 범위(순환-break) 밖이므로 defer.
- 빈 문자열(`''`) 케이스(#8): 현재 validation(`!body?.newBotToken`)이 falsy 인 `''` 를 이미 거부하므로 **동작은 이미 보장됨**. 명시 테스트는 nice-to-have, defer.
- catch 로깅(#2)·JSONB 적재(#9): verbatim / 신규 아님. 즉시 수정 불요로 리뷰가 명시.

---

## 검증 상태 (구현 시점, GREEN)

- lint: PASS
- build (docker): PASS
- unit: PASS (frontend 182 + backend 관련 spec; `triggers.controller.spec.ts` 신규 4 케이스 포함)
- **e2e: PASS (214) — docker 부팅/DI 초기화 검증.** `forwardRef` 제거 후에도 Nest 컨테이너 정상 부팅 → 순환 해소가 런타임 DI 를 깨지 않음을 실증. concurrency reviewer 도 "forwardRef 제거로 DI 초기화 결정성↑(positive)" 평가.
