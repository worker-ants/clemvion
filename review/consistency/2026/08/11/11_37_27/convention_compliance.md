# 정식 규약 준수 검토 — `spec/7-channel-web-chat` (재판정 라운드)

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`
이번 라운드 지시: (1) 직전 라운드 WARNING(완료 plan 내 "위 3개 항목 미구현" 잔존 서술) 반영 확인,
(2) `3-auth-session.md` `status: implemented` + (완료 plan) `spec_impact` 가 `origin/main` 머지 이후에도
규약에 부합하는지 재확인, (3) CRITICAL 판정은 특히 엄격히 — 비-CRITICAL 은 개별 발견사항 대신 요약에만 기록.

## 발견사항

없음(CRITICAL 기준). 아래 두 항목을 실측으로 재확인했고 둘 다 위반이 없다.

### 확인 1 — 직전 WARNING("그 PR 시점" 미명시) 은 해소됨

`plan/complete/webchat-reload-rest-error-branches.md` §"본 PR 에서 한 것 (2026-08-10)" 을 재확인:

> `3-auth-session.md` frontmatter `status: implemented` → `partial` + `pending_plans:` 에 본 문서 등재.
> 규약이 결정적이라(본문이 미구현을 자인 ⇒ `implemented` 불가) 이 정정 자체는 사용자 결정을 요하지 않는다.
> **그 PR 시점에는 위 3개 항목의 구현을 하지 않았다** — 구현은 `claude/webchat-reload-rest-branches` 가
> 했고(2026-08-11 완료) 그 결과가 이 문서 §미구현 항목의 체크박스다. **이 절은 그 시점의 기록이다.**

직전 라운드가 지적한 "이미 구현된 지금 시점에도 '미구현' 처럼 읽히는 잔존 서술" 문제는, 위와 같이
"그 PR 시점" 한정어 + "이 절은 그 시점의 기록이다" 명시로 해소됐다. 시제 모순 없음.

### 확인 2 — `3-auth-session.md` `status: implemented` + `spec_impact` 재검증 (origin/main 머지 후)

**frontmatter**: `id: web-chat-auth-session`, `status: implemented`, `code:` 6개 경로(session-store.ts,
api-base.ts, eia-client.ts, use-widget.ts, use-session-generations.ts, use-token-refresh.ts), `pending_plans:`
없음 — `spec-impl-evidence.md §3` 의 `implemented` 요건(≥1 `code:` 매치, `pending_plans` 없음)과 정합.

**본문-frontmatter 정합**: §3.1 배너가 종전 "⚠ v1 구현 현황(**부분**)" + "`404`·복구불가 `401`/`410`
… 여전히 미구현(Planned)" 이던 자기모순 서술에서, 현재는 "v1 구현 현황" + "`404`·복구불가 `401`/`410`
REST 분기와 `401 → 낙관적 refresh 1회` 도 구현됐다(2026-08-10)" 로 바뀌었고, 유일하게 남은 soft-fail
경로도 "**미구현이 아니라 의도된 경계다**" 로 명시돼 `implemented` 와 모순되지 않는다. §R4 상단의
"결정은 내려졌으나 구현은 없다(Planned)" 고지도 제거됨.

**코드 실측**: `use-widget.ts` 를 직접 확인 — `err.status === 404`/`err.status === 401`(낙관적
`refresh-token` 1회) 분기, `410`(`EXECUTION_TERMINATED`) 처리가 실제로 존재. 6개 `code:` 경로 파일 전부
워킹트리에 실존.

**build-time 가드 실행 결과** (`codebase/frontend`, `npx vitest run`):
- `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` /
  `spec-pending-plan-existence.test.ts` / `spec-link-integrity.test.ts` / `spec-area-index.test.ts`
  → 6 files, **991 passed**.
- `plan-frontmatter.test.ts` / `spec-plan-completion.test.ts`(Gate C) → 2 files, **963 passed**.

**`spec_impact` 재검증**: `plan/complete/webchat-reload-rest-error-branches.md` frontmatter
`spec_impact: [spec/7-channel-web-chat/3-auth-session.md, spec/0-overview.md]`. 실측
`git diff origin/main...HEAD --stat -- spec/` 결과 이번 브랜치가 건드린 spec 파일은 정확히 이 두 개뿐
(`0-overview.md` 2줄, `3-auth-session.md` 30줄) — 선언과 실제 diff 가 1:1 일치. `spec-plan-completion.test.ts`
(Gate C, `started ≥ 2026-06-04` 완료 plan 은 `spec_impact` 의무)도 통과.

**`spec/0-overview.md` 미러 동기화**: "영역 spec 6문서가 모두 `implemented` 다 — [3-auth-session]…이
마지막까지 `partial` 이었던 재로드 복원의 `404`·복구불가 `401`/`410` REST 분기와 `401` 낙관적 refresh 는
2026-08-10 구현 완료" 로 갱신돼 있고, 실제로 `spec/7-channel-web-chat/` 6개 spec 문서 전부
`status: implemented` 확인.

이 병합·재판정으로 남은 것은 별도 in-progress 문서
(`plan/in-progress/webchat-auth-session-status-reconcile.md`) 인데, 그 문서의 "§frontmatter 재판정" 행은
이미 완료 체크 상태이고, 나머지 행(경합·미검증 인터리빙·주석 정정 등)은 각각 독립 항목으로 명시 유예
사유가 달려 있어 `3-auth-session.md` 의 `status: implemented` 판정과는 무관하다(자잘한 후속 항목이라
CRITICAL 판정 대상 아님 — 아래 요약 참고).

## 요약

직전 라운드 WARNING(완료 plan 안에 "위 3개 항목 미구현" 서술이 시점 한정 없이 남아 있던 문제)은
`plan/complete/webchat-reload-rest-error-branches.md` §"본 PR 에서 한 것" 에서 "**그 PR 시점**에는
… 하지 않았다 … 이 절은 **그 시점의 기록**이다" 로 명시돼 해소됨을 확인했다. `spec/7-channel-web-chat/3-auth-session.md`
의 `status: implemented` 는 `origin/main` 머지 이후에도 (a) frontmatter 스키마·라이프사이클 규약,
(b) 본문-frontmatter 시제 정합, (c) 코드 실존·분기 구현, (d) build-time 가드 6+2 파일(총 1,954 테스트) 전수
통과로 뒷받침되며, 완료 plan 의 `spec_impact` 선언도 실제 diff(`git diff origin/main...HEAD --stat -- spec/`)와
정확히 일치해 Gate C 를 포함한 정식 규약을 충실히 따른다. `spec/0-overview.md` 의 "6문서 모두 implemented"
미러도 동기화돼 있다. 본 diff 는 프런트엔드 위젯(`channel-web-chat`) 전용 변경으로 backend Swagger/DTO 표면이
없어 API 문서 규약(관점 4)은 적용 대상이 아니다. 이번 라운드에서 CRITICAL 로 판정할 위반은 발견하지
못했다. (비-CRITICAL 성격의 사소한 잔여 — `webchat-auth-session-status-reconcile.md` 의 아직 열린 세부
항목들, `4-security.md` 의 기존 "현 시점 비목표" 서술 등 — 은 본 diff 가 만든 새 위반이 아니고 각각 명시
사유가 달린 기존/독립 항목이라 개별 발견사항으로 올리지 않고 본 요약에만 남긴다.)

## 위험도

NONE
