# Rationale 연속성 검토 — trigger-canary-hardening (impl-done, 2026-09-14 13:31)

## 검토 범위와 방법

target scope(`spec/conventions/`) 델타는 **0개** — 이 브랜치는 `spec/`을 전혀 편집하지 않는
순수 코드 하드닝이다 (`plan/in-progress/trigger-canary-hardening.md`, `spec_impact: none`).
프롬프트 번들은 예산으로 diff 섹션이 통째로 잘려 있어(`## 구현 변경 사항` 자체가 없음), 실제
코드 diff 는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/
trigger-canary-hardening-a71e04`)에서 `git diff origin/main`으로 직접 확인했다.

`codebase/` 변경은 여전히 6개 파일(누적, 라운드 1~5 전체)이다:

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (신규 — AST 리더)
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (신규 — 3중 사본
  정합 가드 + 분기별 대조군)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 주석 정리 — 자리
  수·번호 표기)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts`
  (teardown 註 — `secret-store.md §R4` 명시 인용)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 3건 신규 배선)

동일 세션에서 이미 여섯 차례 rationale_continuity 검토가 돌았다 (`review/consistency/2026/09/14/
{10_44_37,11_27_47,11_52_23,12_17_21,12_37_09,13_04_59}` — impl-prep LOW → impl-done NONE ×5).
직전 회차(`13_04_59`)는 라운드 4 커밋(`026fbb610`)까지 포함해 NONE으로 결론지었다. 본 검토는 그
**이후 추가된 라운드 5 커밋**(`7420cede1`, "수를 맞추는 대신 복제를 없앴다 + 리뷰어의 «한 줄»을
ratchet 이 기각했다")까지 포함한 최종 상태를 델타 위주로 재대조했다.

라운드 5의 `codebase/` 변경은 두 갈래다:

1. `trigger-workflow-ref.spec.ts` 헤더 — "다섯 자리"(2회, 실측 6)와 형제 e2e 헤더의 "여섯
   형태"가 서로 다른 수를 주장하던 것을 **수를 맞추는 대신 삭제**하고 e2e 파일을 자리 수의
   SoT로 지정. 가드 번호도 원문자(①②…)에서 아라비아 숫자로 통일(`grep '가드 [0-9]'` 검색성).
2. `trigger-secret-columns.spec.ts` — 코드 리뷰 INFO#4("`tmp`를 `string | undefined`로")를
   적용했다가 타입체크 ratchet이 사용처 10곳에서 `0→10` 진단을 내자 **철회**하고, 철회 판단과
   대안 기각 사유(`let tmp!: string`은 이 저장소 `nullable-type-lie-cast` 가드가 겨누는 "타입
   거짓말")를 코드 주석에 남겼다.

나머지는 `plan/in-progress/{harness-review-gate-followups,spec-conventions-engine-error-code-
surface}.md` 갱신(역방향 포인터 추가·수치 정정 이력 등재)으로 `plan/**` 범위이며 spec Rationale
대상이 아니다.

직접 대조한 spec: `spec/conventions/secret-store.md`(§R4·§2.1), `spec/1-data-model.md`(응답
경계 secret-strip 원칙, `CREATOR_PROJECTION` 선례), `spec/conventions/review-citations.md`.
`nullable-type-lie-cast` 가드는 `codebase/backend/src/repo-guards/__tests__/
nullable-type-lie-cast-guard.ts`에 실재함을 grep으로 확인했다(지어낸 선례 아님).
`TRIGGER_RESPONSE_STRIP_COLUMNS`가 `triggers.service.ts`에서 `export` 없이 선언돼 있음도
직접 확인했다(diff의 "정본이 export가 아니다" 주장과 일치).

## 발견사항

없음 — CRITICAL·WARNING 수준의 발견 없음.

## 확인된 정합 사항 (참고용)

- **라운드 5의 "수 삭제" 처방은 결정 번복이 아니라 결속 축소다.** 종전 두 문서(캐너리 self-spec
  헤더·형제 e2e 헤더)가 자리 수를 각자 손으로 세어 서로 다른 값을 주장하던 상태 자체가 결함이었고,
  그 해소로 "숫자를 일치시킨다" 대신 "SoT를 e2e 파일로 지정하고 여기서는 세지 않는다"를 택했다.
  이는 이 저장소가 이미 기록한 원칙("복제를 없앤다 — 자리 수의 SoT는 그 e2e 파일이고, 여기서
  다시 세면 한쪽이 반드시 낡는다")을 스스로 지킨 사례이며, 새 설계 원칙의 도입이 아니라 기존
  "SoT 단일화" 원칙의 재적용이다.
- **INFO#4 적용→철회는 "무근거 번복"이 아니다.** 적용 시도, 실측(`0→10` 타입체크 진단),
  대안 두 가지(사용처 10곳 수정 vs `let tmp!: string`) 검토, 후자가 `nullable-type-lie-cast`
  가드가 겨누는 형태임을 근거로 철회 — 전 과정이 코드 주석에 그대로 남아 있다. 등급 기준
  3("결정의 무근거 번복")에 해당하려면 근거 없이 뒤집어야 하는데, 여기는 근거(ratchet 실측 +
  기존 가드와의 충돌)를 명시적으로 실었다.
- **`secret-store.md §R4`와의 관계는 이전 라운드 판정에서 변경 없음.** `R4`가 요구하는 대상은
  프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)이고, 라운드 5는 이 파일들을
  건드리지 않았다 — teardown 註 재작성은 라운드 4 이전에 이미 완료·검토됐다.
- **`CREATOR_PROJECTION` 선례 인용은 라운드 5에서도 그대로 유지.** "런타임 공유 대신 정적 가드"
  설계는 라운드 5가 건드리지 않은 `trigger-workflow-ref.ts`(round 이전 코드)의 기존 JSDoc이
  이미 근거를 명시하고 있고, 라운드 5의 두 변경 모두 이 파싱 설계·정본/사본 구분 자체를
  바꾸지 않는다.
- **plan/** 트래커 추가분(역방향 포인터·"등재 5/미등재 9" vs "파일 쌍 7/8" 구분)은 수치의
  주어가 다름을 명시하며 checker의 "교체" 제안을 근거와 함께 기각했다** — 처방을 실측으로
  기각하는 것 자체는 Rationale 연속성 위반이 아니라 부정확한 수치 대체를 막는 정상적 처신이다.
  이 파일들은 `spec/`이 아니라 `plan/`이라 본 검토 관점(스펙 Rationale 연속성)의 직접 대상도
  아니다.

## 요약

라운드 5 커밋(`7420cede1`)까지 포함한 최종 diff(`trigger-canary-hardening`)는 `spec/
conventions/`를 전혀 편집하지 않는 순수 코드 하드닝이며, 이번 라운드의 두 변경(자리 수 서술
삭제·타입체크 ratchet에 따른 리뷰 제안 철회) 모두 근거를 코드/커밋에 명시적으로 남긴 채
기존 `## Rationale`/합의 원칙(SoT 단일화, `nullable-type-lie-cast` 금지 형태, `secret-store.md
§R4`, `CREATOR_PROJECTION` 선례)과 대조했을 때 기각된 대안의 재도입, 합의 원칙 위반, 무근거
결정 번복, invariant 우회 어느 것도 발견되지 않았다. 앞선 여섯 라운드의 결론(LOW→NONE×5)과
일치하며, 이번 재검토도 독립적으로 같은 결론에 도달했다.

## 위험도

NONE
