# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`git diff origin/main...HEAD --stat`(워킹트리:
`/Volumes/project/private/clemvion/.claude/worktrees/lint-warning-triage`) 로 실측한 결과, 이번 PR 은
`codebase/backend/**` (ESLint warning 처분 — 타입 주석/제네릭 인자/단언만, 런타임 미접촉) 과
`plan/in-progress/backend-lint-gate-broken-on-main.md`, `review/code/**` 만 변경한다.
**`spec/data-flow/` 는 diff 에 전혀 등장하지 않는다** — 본 payload 에 첨부된
`spec/data-flow/0-overview.md`, `1-audit.md` 등은 참고용 bundle-file 이며 이번 target 이 "새로 도입"한
문서가 아니다. 즉 이번 target 은 spec 문서를 만들거나 바꾸지 않으므로, 본 checker 의 점검 관점 1~6
(요구사항 ID·엔티티/DTO·API endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로) 이 다루는
**spec-level 신규 식별자는 이번 diff 에 하나도 없다.**

## 코드 레벨 신규 식별자 확인 (참고, spec 충돌 관점 밖)

diff 가 실제로 새로 도입하는 코드 식별자를 절대경로 grep 으로 확인했다:

- `HttpResponseLike` (interface, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34`) —
  같은 파일 내부에서만 쓰이는 private 구조적 타입. 저장소 전체 grep 결과 이 파일 밖에는 등장하지
  않아 다른 의미로 쓰이는 기존 식별자와 충돌하지 않는다.
- `makeInterceptor` (test helper, `idempotency.interceptor.spec.ts:85`) — 해당 spec 파일 로컬 함수.
- 신규 `describe`/`it` 문자열(`'IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)'` 등) — 테스트
  설명 문자열이며 spec ID·API 이벤트명 성격이 아니다.
- `SetupResult` — `triggers.service.ts` 가 새로 import 하지만, `git grep` 확인 결과
  `codebase/backend/src/modules/chat-channel/types.ts:454` 에 **기존에 이미 정의**돼 있던 타입이다
  (discord/telegram/slack adapter 가 이미 사용 중). 신규 도입이 아니라 기존 타입의 사용처 확대이므로
  충돌 대상이 아니다.

이들은 모두 파일-로컬 또는 이미 존재하던 식별자의 재사용이라 요구사항 ID/엔티티/endpoint/이벤트/ENV/파일
경로 어느 축으로도 기존 spec 정의와 부딪히지 않는다.

### 발견사항

없음.

### 요약

target 문서로 지목된 `spec/data-flow/` 는 이번 diff(`origin/main...HEAD`)에서 실제로 변경되지 않았다 —
이번 PR 은 backend ESLint warning 을 전량 처분한 타입 전용 코드 변경(+ plan/review 기록)이며 새 요구사항
ID, 엔티티/DTO, API endpoint, webhook/queue/SSE 이벤트명, 환경변수·설정키, spec 파일 경로 중 어느 것도
새로 도입하지 않는다. 코드 레벨에서 유일하게 신설된 식별자(`HttpResponseLike` interface, `makeInterceptor`
테스트 헬퍼)는 파일-로컬 스코프라 기존 사용처와 충돌하지 않고, `SetupResult` 는 기존 타입의 신규 import 일
뿐 신규 정의가 아니다. 신규 식별자 충돌 관점에서 이번 target 은 무해하다.

### 위험도
NONE
