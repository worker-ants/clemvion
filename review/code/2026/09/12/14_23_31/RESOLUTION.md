# RESOLUTION — 14_23_31 (라운드 2)

**CRITICAL 0 · WARNING 3.** 세 건 모두 **`codebase/**` 를 한 줄도 바꾸지 않는다** — 조치는
`CHANGELOG.md` 와 `plan/**` 에 국한된다. 이 라운드로 **수렴 선언**한다.

> **정지 규칙은 이 결과를 보기 전에 선언했다** — `plan/in-progress/impl-setup-error-code.md`
> §정지 규칙 (라운드 2 실행 전 커밋되지 않은 상태로 기록). 기준은 *"발견 0"* 이 아니라
> ***"`codebase/**` 수정 0 으로 끝나는 라운드"*** 이고, 이 라운드가 그것이다.
> (`main` 이 직접 조치했다 — 3건 중 2건이 main 이 쓴 문장의 사실 오류라 격리 컨텍스트로
> 넘길 이유가 없었고, 나머지 1건은 코드 조치가 없는 기록 항목이다.)

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|---|---|---|---|
| #1 | 기록 (코드 조치 불요) | 없음 | 400→502 breaking change 는 **의도된 설계**이고 공지는 이미 `CHANGELOG.md` Unreleased 의 "⚠️ 배포 시 확인" 콜아웃 + `@ApiBadGatewayResponse` + 유저가이드 4파일에 실려 있다. reviewer 도 *"코드 조치 불요"* 로 적었다 |
| #2 | 문서 (`CHANGELOG.md`) | 수정 | **내 실측 문구가 틀렸다.** `HttpStatus.BAD_GATEWAY` 는 여전히 **0건**인데 세 식별자를 한 문장으로 묶어 *"각 0건 → 각 1건"* 이라 적었다. 재측정(`grep -rn "BAD_GATEWAY" codebase/{backend,frontend}/src` → 0건)해 두 식별자만 "0건→1건" 으로 좁히고, enum 리터럴은 직접 참조되지 않는다는 사실을 괄호로 밝혔다 |
| #3 | plan (`spec-draft-nullable-notation-followups.md`) | 수정 | **항목이 등재되는 순간 이미 반증돼 있었다.** 「CCA frontmatter 가 stale」 항목 문안을 spec 을 고치기 *전에* 써 두고 같은 커밋(`3c47885a3`)에 함께 실었다 → 다음 사람이 끝난 일을 쫓는다. `- [x]` 로 바꾸고 등재·해소를 같은 줄에 적었다 |

## 이 라운드가 확인해 준 것 (라운드 1 조치의 검증)

reviewer 들이 라운드 1 WARNING 7건의 해소를 **독립적으로 재확인**했다:

- `side_effect`·`testing` — `Logger.prototype.warn` spy 가 `try/finally` 로 원복됨
- `testing` — 502 `BadGatewayException` 이 `GlobalExceptionFilter` 를 마스킹 없이 통과하는
  회귀 테스트 존재
- `architecture`·`maintainability` — Discord 401/403 리터럴이 이름 있는 상수로 추출됨
- `user_guide_sync` — Slack/Discord ko/en **4파일 전부** 400/502 반영
- `api_contract` — breaking change 공지 완료
- `scope` — 조치 커밋 전량이 RESOLUTION 과 1:1 대응, 숨은 스코프 이탈 없음

## 이월 (INFO — 전부 비차단, 트래커가 갖고 있다)

- **§1.1.2 401/403 fallback 제거 판정** — `spec-draft-nullable-notation-followups.md` 의 동명
  항목. 이 PR 이 착수 신호를 켰고, **실측 판정은 「아직 제거하지 말 것」**(남은 3경로 표 포함).
- **`CHAT_CHANNEL_SETUP_FAILED` 상수 비대칭** · **`discord.adapter.spec.ts` 헬퍼 미추출** ·
  **telegram 테스트 `it.each` 분리** · **`rotateBotToken` 길이** — 해당 파일을 다음에 손댈 때.
- **중앙 에러 카탈로그 미등재** · **`slack.md §3.1` 5값 확정** · **§7 파일 트리 서술** —
  planner 축, 트래커 등재됨.
- **`logger.warn` 이 모든 실패에서 WARN** (INFO 3) — 운영 알림 노이즈 판단. 사용자 오타도
  WARN 이 되는 것은 맞지만, **이 로그가 provider 원문의 유일한 보관처**라 레벨을 낮추면
  §5.4 가 요구한 진단 경로가 약해진다. 레벨 분리는 운영 판단으로 남긴다.

## TEST

라운드 2 는 `codebase/**` 를 바꾸지 않았으므로 라운드 1 의 4단계 결과가 그대로 유효하다
(`run-test-all: ALL PASS stages=lint unit build e2e`, e2e 305/305). `--impl-done` 은 별도 게이트.
