# 신규 식별자 충돌 검토

검토 모드: `--impl-done` (scope=`spec/data-flow/`, diff-base=`origin/main`)

대상 파일 (변경된 spec 2건):
- `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/5-system/3-error-handling.md`

---

## 발견사항

### INFO — `TOKEN_INVALID` 설명 확장, `BOT_TOKEN_INVALID` 와 명칭 유사성

- target 신규 식별자: `TOKEN_INVALID` (에러 코드) — `spec/5-system/3-error-handling.md` 에서 기존 설명 "변조/형식 오류" 에 "refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" 케이스를 추가.
- 기존 사용처:
  - `spec/5-system/3-error-handling.md` — 기존에 `TOKEN_INVALID`가 "변조/형식 오류" 목적으로 이미 정의돼 있었고, target 이 이 설명을 확장함.
  - `spec/5-system/15-chat-channel.md:344` — `BOT_TOKEN_INVALID` (400) 가 별도 에러 코드로 존재. chat-channel bot token setup 실패 전용이고 HTTP status code 도 400(목적어 도메인 오류)으로 `TOKEN_INVALID`(401 auth failure)와 구분된다.
  - `spec/data-flow/15-external-interaction.md:270`, `spec/5-system/14-external-interaction-api.md:315` — external-interaction guard 가 같은 `TOKEN_INVALID` 를 사용하나, 이는 auth 도메인 에러 코드를 재사용한 것으로 의미가 일관된다(토큰 무효화).
- 상세: target 은 새 에러 코드를 *도입*한 것이 아니라 기존 `TOKEN_INVALID` 에 새 발생 경로(동시 회전 경합 → affected=0)를 추가했다. `BOT_TOKEN_INVALID` 는 명칭이 유사하지만 별개 코드로 이미 명확히 구분되어 있다. 실질적 충돌 없음.
- 제안: 현재 상태로 충돌 없음. `spec/5-system/3-error-handling.md` 에 `BOT_TOKEN_INVALID` 가 정식 등재되지 않아 비교 가독성이 낮을 수 있으나, 이는 이번 변경 범위 밖의 별도 개선 사항이다.

---

### INFO — 계획 참조 식별자 `C-1` 의 비공유 로컬 네임스페이스

- target 신규 식별자: `refactor/05-database.md` 내의 항목 번호 `C-1` — `spec/data-flow/2-auth.md` §1.4 Rationale 에서 `(refactor/05-database.md C-1)` 형태로 인용.
- 기존 사용처:
  - `plan/complete/spec-draft-auth-config-webhook-wiring.md` — 다른 맥락에서 `C-1`을 지역 번호로 사용 (§2.4 "기존 ID 보존 + 신규 ID 추가 (C-1 해소)").
  - `plan/complete/eia-strip-llmcalls.md` — `/ai-review Critical C-1` 레이블로 사용.
  - `plan/complete/backend-msg-i18n-impl.md` — `P3-C-1` 형태로 중첩 번호 사용.
- 상세: `C-1` 은 각 plan 문서 내에서만 의미 있는 지역 번호이며, target 은 `refactor/05-database.md` 경로를 명시해 모호성을 차단하고 있다. 기계적 파싱보다 가독성을 위한 인용 패턴이므로 실질적 충돌 없음.
- 제안: 현재 패턴(`파일경로 항목번호`)이 고유성을 보장하므로 변경 불필요.

---

## 요약

`spec/data-flow/2-auth.md` 와 `spec/5-system/3-error-handling.md` 의 변경은 기존 `TOKEN_INVALID` 에러 코드의 설명을 확장하고 Mermaid 다이어그램에 트랜잭션 박스를 추가한 것이 전부다. 새로운 에러 코드, 엔티티명, API 엔드포인트, 이벤트명, 환경변수, 설정키, 파일 경로 중 어느 것도 신규 도입되지 않았다. `TOKEN_INVALID` 와 명칭이 유사한 `BOT_TOKEN_INVALID` 는 이미 기존 spec 에서 HTTP 상태코드·도메인이 다른 별개 코드로 명확히 구분되어 있으며, 이번 변경이 그 경계를 침범하지 않는다. 계획 참조 번호 `C-1` 은 파일 경로를 한정자로 사용하므로 모호성이 없다.

## 위험도

NONE
