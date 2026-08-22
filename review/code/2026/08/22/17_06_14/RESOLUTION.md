# RESOLUTION — `17_06_14` (Critical 0 · WARNING 6 · RISK MEDIUM)

## W5 (testing/maintainability) — 반영 · **실측으로 확정**

**지적**: 제목은 `throws INVALID_TRIGGER_PARAMETERS ...` 로 갱신됐는데 본문은
`rejects.toBeInstanceOf(BadRequestException)` 만 본다 — 코드 값이 되돌아가도 GREEN.

**지적이 정확했다.** 그냥 고치지 않고 **대조군을 세워 실측**했다 (커밋 후 `cp` 백업 원복,
`git checkout` 미사용):

| 조건 | 결과 |
| --- | --- |
| 무수정 | GREEN (1 passed) |
| 발행부를 `INVALID_INPUT` 으로 되돌림 + **fix 후** | **RED (1 failed)** |
| 발행부를 `INVALID_INPUT` 으로 되돌림 + **fix 전 본문** | **GREEN** ← 지적대로 vacuous 했다 |

원복 후 두 파일이 원본과 바이트 동일함을 단언으로 확인했다.

`toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })` 를 추가했다. 자매 셋
(`workflows.controller.spec.ts` ×2 · `workflows.service.spec.ts`)은 이미 값을 단언하고 있어
**이 테스트만 뒤처져 있었다** — 그래서 이번 rename 이 세 곳 중 한 곳에서만 기계에 안 걸렸다.

## W3 (documentation) — 반영

`CHANGELOG.md` 에 `## Unreleased` 절 신설. 바뀌는 값 · 영향 엔드포인트 · **`details[]` 항목
코드는 불변**(필드별 사유로 분기하는 클라이언트는 무영향) · 규약 예외 근거 · §5 선례와의
리스크 등급 차이 · 유저 가이드 선존 오류 정정까지 적었다.

## W2 (scope) — 반영 (사실 확인 후 "정정하지 않음" 으로)

**지적**: 재판정 절이 브랜치명(`eia-error-code-unify-a87cea`)과 다른 세션명
(`backend-redact-depth-boundary`)을 자칭한다 — 오탈자인지 확인 요망.

**오탈자가 아니다.** 그 재판정은 실제로 `backend-redact-depth-boundary` 세션이 착수 전
점검으로 수행했고, 그 PR(#1192)의 리뷰가 *"본래 목표와 무관한 grooming"* 으로 지적해
**커밋째(`git format-patch` → `git am`) 이 PR 로 옮겼다.** 수행 주체를 사후에 고쳐 적으면
어느 실측이 어느 세션 것인지 추적선이 끊긴다. 대신 **왜 세션명이 다른지**를 그 절에
명시했다.

## W1 (scope) — 반영 안 함 · 사유

**지적**: 같은 트래커 절의 이월 spec 편집 3건이 이 rename PR 에 번들링됐다.

**사용자가 같은 턴에 처리하기로 명시 결정했다** (2026-08-22). 세 항목은 전부
`resolveTriggerParametersRejectingMasked` / §R17 / trigger-parameter reason 계열 —
**이 PR 이 건드리는 바로 그 문서·그 절**이라, 분리하면 같은 문단을 두 PR 이 연달아 고치게
된다(그 충돌을 피하려고 #1192 에서 트래커 커밋을 이미 한 번 분리해 왔다).

리뷰어의 대안 조치("PR 설명에 번들링 사실 명시")를 이행한다 — PR 본문에 적었다.

## W4 (documentation/maintainability) — 반영 (PR 생성 직후)

`error-codes.md §5` 신규 행의 `#TBD_PR` 을 실제 PR 번호로 치환한다. **PR 번호는 생성 전에는
존재하지 않으므로** placeholder 로 커밋한 뒤 `gh pr create` 직후 같은 브랜치에 치환 커밋을
올린다. push 전 잔존 0 을 `grep TBD_PR spec` 로 확인한다.

## W6 (api-contract/side-effect) — 반영 안 함 · 사유

**지적**: dual-emit 없는 breaking rename.

`error.code` 는 **단일 값**이라 alias 를 실을 자리가 구조적으로 없다. `details[]` 항목 코드는
이미 양쪽이 동일하므로 이행 경로로서도 이득이 없다(plan §Rationale 의 기각 대안). 잔여
위험은 `error-codes.md §5` 신규 행에 **본 표 최고 리스크 등급**으로 등재했고 사용자 결정으로
인수했다. 리뷰어도 *"CHANGELOG 명시 외 추가 조치 불요"* 로 판정했고 그 CHANGELOG 는 W3 에서
반영했다.

## INFO (조치 안 함 — 사유)

| # | 항목 | 사유 |
| --- | --- | --- |
| 1 | `_retry_state.json` 이 호출 전 스냅샷 | 하네스 부산물. application 무관 — 리뷰어도 그렇게 판정 |
| 2 | 에러 코드 리터럴 3파일 중복 | **이번 drift 의 구조적 원인**이라 값지지만 저장소 전역 관례이고 이 PR 이 만든 것이 아니다. 후속 plan 후보로 남긴다 |
| 3 | §5 비고 셀이 장문 | 표 스캔성 vs 근거 보존의 교환. 이 행은 **선례보다 위험한 최초 사례**라 근거를 줄이면 다음 사람이 과잉 일반화한다 |
| 4 | e2e 에 re-run 검증 실패 코드 단언 없음 | 선존 갭. unit 3곳이 세 경로를 각각 덮는다 |
| 5 | 프런트 미분기 실측 확인 | 긍정 관찰 |
