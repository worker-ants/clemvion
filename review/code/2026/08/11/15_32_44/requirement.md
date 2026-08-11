# 요구사항(Requirement) Review — 2026/08/11 15_32_44

## 컨텍스트

직전 라운드(`15_16_20`)에서 본 reviewer 는 NONE(INFO 1건: plan "회귀 5건" vs 실제 6건 불일치)이었다.
이번 fix(`d8abc7003`)는 그 INFO 를 정정하는 동시에 testing/scope CRITICAL 2건을 처분하며 통합
테스트 2건(`use-widget-eager-start.test.ts`)을 새로 추가했다. 이번 라운드는 그 정정 수치·spec_impact·
plan 상태·spec §R0 vs 구현의 line-level 일치를 재검증한다.

## 검증 방법

- `use-widget.test.ts`/`use-widget-eager-start.test.ts` 실제 파일을 `grep -n 'it('` 로 직접 세어
  diff/plan 이 주장하는 개수와 대조.
- `git show --stat`/`git show -s --format=%B` 로 두 커밋(`3f1169ab5`, `d8abc7003`)의 실제 변경 파일·
  메시지 수치를 확인.
- `use-widget.ts` 실제 소스(`Read`)로 `applyConfig` early return 위치·형태를 spec §R0 인용문과 대조.
- `grep -rn safeApiBaseFromQuery` 로 deprecated 별칭 잔존 여부 확인(0건 — 완전 삭제 확인).
- (참고) `pnpm test` 시도 — 이 워크트리에 `node_modules` 미설치(`vitest: command not found`)라
  실행 검증은 불가했고, 정적 카운트 대조로 대체했다.

## 발견사항

- **[INFO]** plan `## 완료` 섹션의 검증 수치("448 passed")가 라운드 2(통합 테스트 2건 추가) 이후
  갱신되지 않아 최종 상태와 어긋난다.
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:76` ("검증: channel-web-chat
    **448 passed**, 타입 오류 0, lint 0.")
  - 상세: 이 줄은 라운드 1 커밋(`3f1169ab5`, 신규 6건 단위 테스트)까지의 상태를 기록한 것이다.
    라운드 2 커밋(`d8abc7003`)이 통합 테스트 2건을 추가하며 커밋 메시지에 "channel-web-chat
    **450 passed**(신규 8)" 라고 정확히 남겼는데, plan 본문의 이 한 줄은 그 갱신을 따라가지 못해
    "448"로 멈춰 있다. 같은 파일의 `## 체크리스트` 항목(41행)은 "단위 6건 + 호출부 통합 2건"으로
    올바르게 정정돼 있어, 이 448 은 plan 내부에서도 다른 절과 불일치한다 — 이번 라운드가 정확히
    잡으려던 "정정된 수치가 실제와 맞는가" 유형의 잔여 사례다. 기능/spec 영향은 없다(순수 서술 stale).
  - 제안: "448 passed" → "450 passed(신규 8)"로 갱신하거나, 이 문장이 "라운드 1 시점의 기록"임을
    명시하는 문구를 추가한다(이 계열 plan 이 이미 겪은 "숫자를 문장에 박으면 조용히 거짓이 된다"
    패턴과 동형).

## 정정된 수치 검증 (CRITICAL 없음)

- `use-widget.test.ts` 의 `mergeBootConfig` describe 블록: 실 파일에서 `it(` 6건 확인
  (73/79/87/93/100/109행) — plan "단위 6건" 과 일치.
- `use-widget-eager-start.test.ts` 의 `wc:boot 의 apiBase 스킴 검증(호출부 배선)` describe 블록:
  실 파일에서 `it(` 2건 확인(4217/4232행) — plan "호출부 통합 2건" 과 일치.
- 합계 8건은 커밋 `d8abc7003` 메시지의 "channel-web-chat **450 passed**(신규 8)" 와 일치.
- 뮤테이션 수치("종전 병합 동작 복원 → 4건 RED")는 커밋 `3f1169ab5` 메시지("종전 동작 복원 →
  **4건 RED**")와 일치. "호출부만 옛 코드로 되돌리기 → 1건 RED"는 신규 통합 2건 중 1건만
  실제로 그 축(비-http(s) 거절)을 겨냥하고 나머지 1건(정상 http(s))은 옛 코드에서도 그대로
  통과하므로 수치가 논리적으로 맞다(직접 재현은 안 했으나 테스트 내용상 모순 없음).
- `safeApiBaseFromQuery` 별칭은 저장소 전체에서 grep 0건 — "호출부 7곳 치환" 주장과 상충하지
  않는다(완전 삭제 확인).

## spec_impact 검증

- 두 커밋(`3f1169ab5`, `d8abc7003`) 의 `git show --stat` 상 `spec/` 하위에서 변경된 파일은
  `spec/7-channel-web-chat/4-security.md` 뿐이다. plan frontmatter `spec_impact:
  [spec/7-channel-web-chat/4-security.md]` 와 정확히 일치 — 갱신 누락 없음.
- `applyConfig` 조용한 early return 갭은 `spec/` 이 아니라 `plan/in-progress/
  webchat-auth-session-status-reconcile.md` 에 등재됐다(§`applyConfig` 의 조용한 early return,
  2026-08-11) — spec 문서를 건드리지 않았으므로 spec_impact 목록에 추가할 필요가 없고, 실제로도
  추가되지 않았다. 일관적이다.

## plan 체크박스 · §역할 경계 검증

- `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 체크리스트 3항목 모두 `[x]`이고,
  각 항목 서술(스킴 판정 확정·구현+회귀 8건·근거를 §R0+JSDoc 에 고정)이 실제 diff·spec 변경과
  부합한다.
- `## 역할 경계 — 이 PR 은 planner 턴을 포함한다` 절이 인용하는 CLAUDE.md 문구("구현 중 spec 변경
  필요 시 `developer` 는 멈추고 `project-planner` 위임")는 이 워크트리의 실제
  `CLAUDE.md:70`과 축자 일치한다(`grep` 확인) — 인용 왜곡 없음.
- frontmatter `owner: developer + planner`, `status: complete`, `worktree: webchat-apibase-scheme`
  는 실제 세션 워크트리 이름과 일치하고, `plan/in-progress/webchat-boot-apibase-scheme-validation.md`
  가 같은 커밋에서 삭제(→ `plan/complete/`로 이동)돼 라이프사이클 상태와 실제 파일 위치가 어긋나지
  않는다.

## spec §R0 vs 구현 line-level 검증

- `4-security.md` §R0 인용문: "`applyConfig` 의 `if (!cfg.apiBase || !cfg.triggerEndpointPath)
  return;` 은 `warn` 도 `dispatch` 도 없이 조용히 빠진다(바로 아래 자매 분기인 origin allowlist
  실패가 `BLOCKED` 를 dispatch 하는 것과 비대칭)."
- 실제 `use-widget.ts` 확인 결과 정확히 일치:
  - `1221행`: `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` (warn/dispatch 없음)
  - `1230~1231행`: `if (!allowed) { dispatch({ type: "BLOCKED", reason: "origin_not_allowed" }); return; }`
  — "바로 아래"·"BLOCKED dispatch" 서술이 실제 코드 순서·형태와 정확히 일치한다.
- `safeApiBase` 시그니처(`raw: string | null | undefined, source: "configFromQuery" | "wc:boot"`)와
  `mergeBootConfig` 구현(`merged.apiBase = safeApiBase(boot.apiBase, "wc:boot") ?? fromQuery.apiBase`)
  도 §R0/§1 표 서술("두 입력 경로 모두", "거절 시 그 필드만 버림", "부재는 조용히 쿼리 폴백")과
  line-level 로 일치한다.

## 요약

정정된 테스트 수치(단위 6건 + 통합 2건 = 8건)는 실제 파일·커밋 메시지와 모두 일치하며, spec_impact
는 실제 변경된 spec 파일과 정확히 대응한다. plan 체크박스·§역할 경계 절의 CLAUDE.md 인용도 실제와
맞고, spec §R0 의 `applyConfig` 조용한 early return 서술은 코드와 line-level 로 정확히 일치한다.
유일한 잔여는 plan `## 완료` 섹션의 "448 passed" 문구가 라운드 2 이후 갱신되지 않아 같은 파일의
체크리스트(8건)와 내부적으로 어긋나는 documentation-only INFO 1건이며, 새로운 CRITICAL 은 없다.

## 위험도

NONE

STATUS: OK
