# 정식 규약 준수 검토 — `spec/7-channel-web-chat/3-auth-session.md`

검토 모드: spec draft (`--spec`)

## 검토 방법 메모

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 발췌본은 이번에도 대부분
`cafe24-api-catalog/**` (target 과 무관) 로 채워져 있었고, target 이 실제로 의존하는
`swagger.md`·`error-codes.md`·`chat-channel-adapter.md`·`conversation-thread.md`·`execution-context.md`·
`interaction-type-registry.md` 등은 "본문 생략됨 — 컨텍스트 예산 초과" 로 잘려 있었다(기존
`feedback_consistency_spec_mode_budget.md` 계열과 동형). `spec-impl-evidence.md` 는 온전히 번들됐다.
잘린 파일은 워크트리 절대경로로 직접 Read 했다.

**직전 라운드(12_56_30) 의 CRITICAL 주장을 액면가로 받지 않고 독립 재검증했다** — 커밋 `5996c9199`
가 frontmatter 를 `status: implemented` → `status: partial` + `pending_plans:` 로 고쳤다고 주장하는데,
이를 다음 세 방식으로 직접 확인했다:

1. `git show 5996c9199 -- spec/7-channel-web-chat/3-auth-session.md` 로 diff 원문 대조.
2. `pending_plans:` 가 가리키는 `plan/in-progress/webchat-reload-rest-error-branches.md` 실존 +
   frontmatter(`worktree: (unstarted)` / `started: 2026-08-10` / `owner: project-planner`) 확인.
3. **가장 결정적** — 규약을 프로즈로만 읽지 않고 **실제 build 가드 4종을 직접 실행**했다:
   `spec-frontmatter.test.ts` · `spec-code-paths.test.ts` · `spec-status-lifecycle.test.ts` ·
   `spec-pending-plan-existence.test.ts` (총 955 tests) + `plan-frontmatter.test.ts` ·
   `spec-link-integrity.test.ts` (총 162 tests) — **전부 green**.

```
cd codebase/frontend && pnpm vitest run \
  src/lib/docs/__tests__/spec-status-lifecycle.test.ts \
  src/lib/docs/__tests__/spec-pending-plan-existence.test.ts \
  src/lib/docs/__tests__/spec-code-paths.test.ts \
  src/lib/docs/__tests__/spec-frontmatter.test.ts
# Test Files  4 passed (4) / Tests  955 passed (955)

cd codebase/frontend && pnpm vitest run \
  src/lib/docs/__tests__/plan-frontmatter.test.ts \
  src/lib/docs/__tests__/spec-link-integrity.test.ts
# Test Files  2 passed (2) / Tests  162 passed (162)
```

가드 소스(`spec-status-lifecycle.test.ts` (b)/(c), `spec-pending-plan-existence.test.ts`,
`spec-code-paths.test.ts`)를 직접 읽어 로직도 대조했다 — `spec-impl-evidence.md §3`/§4 표 서술과
가드 구현이 정확히 일치함을 확인(프로즈-코드 drift 없음).

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 직전 라운드의 유일한 CRITICAL 은 해소를
독립 확인했다.

- **[해소 확인] frontmatter `status: implemented` → `partial` + `pending_plans:` 정정이
  `spec-impl-evidence.md §3` 을 실제로 만족함**
  - target 위치: frontmatter L2–L11
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §3` (`status` 라이프사이클),
    §4 `spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts`
  - 상세:
    - `status: partial` 은 §3 표의 `partial` 정의("일부 구현됨")와 부합 — 본문 §3.1 배너가 자인하는
      "`200`+terminal 종료 분기는 구현됨" vs "`404`·복구불가 `401`·낙관적 refresh 는 미구현" 이라는
      혼재 상태를 이제 frontmatter 값이 정확히 반영한다.
    - `code:` 5개 경로(`session-store.ts`/`api-base.ts`/`eia-client.ts`/`use-widget.ts`/
      `use-token-refresh.ts`) 전부 실재 파일 확인(`ls`) — `partial` 요건 "≥1 매치" 충족.
    - `pending_plans:` 가 가리키는 `plan/in-progress/webchat-reload-rest-error-branches.md` 는 실재하고,
      본문에서 정확히 §3.1 이 미구현이라 자인한 3개 항목(404 분기·복구불가 401·낙관적 refresh)을
      "결정이 필요한 항목"으로 소유한다 — `spec-impl-evidence.md R-5`("plan 이 책임지지 않는 빈 약속")가
      막으려는 실패 유형이 이제 발생하지 않는다. 양방향 링크(spec → plan `pending_plans:`, plan 본문 →
      spec 파일명 언급)도 성립.
    - plan frontmatter (`worktree: (unstarted)` / `started: 2026-08-10` / `owner: project-planner`)도
      `plan-frontmatter.test.ts` 의 top-level `plan/in-progress/*.md` 의무 필드 요건을 만족(sentinel
      `(unstarted)` 허용 규정과 일치).
    - §3.1 배너 말미에 신설된 문장("이 잔여 때문에 `status` 는 `implemented` 가 아니라 **`partial`**")이
      frontmatter 값과 본문 서술을 명시적으로 교차 참조시켜, 향후 세션이 다시 드리프트시킬 여지를
      줄인다.
  - 결론: 직전 CRITICAL 의 근본 원인(frontmatter 값 ≠ 본문이 자인하는 구현 현황)이 실제로 해소됐고,
    프로즈 검토뿐 아니라 해당 규약을 강제하는 4개 build 가드 + 인접 2개 가드(plan-frontmatter,
    link-integrity) 를 직접 실행해 전량 green 임을 확인했다. 추가 조치 불필요.

- **[INFO] `## Rationale R4` 는 §3.1 이 "미구현"이라 자인한 낙관적 refresh 설계를 서술하지만,
  R4 절 자체에는 "미구현" 표시가 없다**
  - target 위치: `## Rationale` → `### R4. 재로드 401 — 낙관적 refresh 1회 후 종료`
  - 위반 규약: 없음 — Rationale 은 "결정의 배경·근거"를 담는 절(CLAUDE.md 정보 저장 위치 표)이지
    구현 현황 진술 의무가 있는 절이 아니다. 이번 정정으로 새로 생긴 문제도 아니다(정정 전부터
    존재하던 서술이며, 커밋 5996c9199 는 이 절을 건드리지 않았다).
  - 상세: R4 는 "낙관적으로 refresh-token 1회 시도해 만료면 복구하고..." 를 확정된 설계처럼 서술한다.
    §3.1 배너의 미구현 고지와 함께 읽으면 모순이 아니지만(Rationale=왜 이렇게 설계했는가, §3.1=지금
    어디까지 구현됐는가), R4 만 단독으로 읽으면 이미 동작하는 것으로 오독될 여지가 있다.
  - 제안: 필수는 아니나, R4 도입부에 "(§3.1 — 미구현, `pending_plans` 참조)" 같은 1줄 각주를 붙이면
    Overview 의 교차 참조("§R4 등의 결정 근거는 Rationale")와 더불어 독자가 R4 만 보고 오판할 여지를
    완전히 없앨 수 있다.

## 점검 관점별 확인 내역 (위 항목 외 위반 없음)

1. **명명 규약** — `id: web-chat-auth-session` kebab-case, 영역 형제 문서 전부(`web-chat-architecture`/
   `web-chat-widget-app`/…) 동일 `web-chat-*` 접두 패턴(직접 `0-architecture.md`/`1-widget-app.md`
   frontmatter 로 재확인) — basename(`3-auth-session`) 불일치는 영역 전체의 의도된 패턴, 위반 아님.
2. **출력 포맷 규약** — 이번 정정은 frontmatter/§3.1 캡션 문장만 건드렸고 API 응답·이벤트 페이로드
   서술에는 손대지 않았다. 직전 라운드가 확인한 `{ data }` 봉투·`InteractAckDto`·`interaction-token`
   Bearer scheme 정합은 그대로 유효.
3. **문서 구조 규약** — Overview / 본문(§1–§3.1) / Rationale(§R3–§R8) 3섹션 유지.
4. **API 문서 규약** — 위젯(소비자) 관점 spec 이라 swagger 데코레이터/DTO 비대상, 이번 정정도 이 영역을
   건드리지 않음.
5. **금지 항목** — 해당 없음.

## 요약

직전 라운드(12_56_30)가 낸 유일한 CRITICAL — frontmatter `status: implemented` 가 본문 §3.1 이 자인한
미구현 표면과 모순 — 은 커밋 `5996c9199` 의 정정(`status: partial` + `pending_plans:` 신설)으로
실제로 해소됐다. 이번 라운드는 그 주장을 액면가로 받지 않고 diff 원문 대조·plan 파일 실존/frontmatter
확인·**해당 규약을 강제하는 실제 build 가드(6개 테스트 파일, 총 1,117 tests) 직접 실행**의 3중으로
독립 재검증했으며 전부 확인/green 이다. 새로 발견된 CRITICAL/WARNING 은 없다. R4 Rationale 절이
미구현 표시 없이 확정 설계처럼 읽히는 점은 규약 위반이 아닌 가독성 INFO 로만 남긴다.

## 위험도

NONE
