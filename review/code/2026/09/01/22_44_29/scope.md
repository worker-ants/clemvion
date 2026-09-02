# 변경 범위(Scope) 코드 리뷰

## 발견사항

- **[WARNING]** 서로 다른 역할(developer/harness ↔ project-planner/spec)의 작업이 같은 커밋 2개에 계속 함께 묶인다 — 재발 확인
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md:17`(`spec/` 쓰기라 **planner 트랙**이다 — developer 턴에서 처리하지 않고 분리 등재한다), `plan/in-progress/spec-conventions-engine-error-code-surface.md:3`(`worktree: easy-a-harness-hygiene`), `review/code/2026/09/01/22_25_37/RESOLUTION.md:8-19`(W1)
  - 상세: `git show --stat`으로 확인한 두 실제 커밋 모두 `fix(harness)` 접두인데, 각각 `spec/conventions/error-codes.md`를 함께 건드린다 — 1번째 커밋(`b5d2e6972`)은 68파일 중 `EngineErrorCode` 두 surface 병기 결정(전용 plan 1개 + `--spec` 6라운드 consistency-check 산출물 54파일 + spec 본문 편집)을 harness 가드 3건(`_CHECKBOX` 정규식 확장, `stray-tool-tags.test.ts` 신규, `spec-links.test.ts` 보강) + plan-lifecycle 절차 문서와 한 커밋에 담았고, 2번째 커밋(`9c0028371`)도 review-round-1 픽스와 함께 `spec/conventions/error-codes.md`를 재차 수정한다. 정작 그 spec 결정 자체를 추적하는 `spec-conventions-engine-error-code-surface.md`는 스스로 "`spec/` 쓰기라 planner 트랙이다 — developer 턴에서 처리하지 않고 **분리 등재**한다"고 적어 두고도, `worktree:` 는 harness 위생 작업과 동일한 `easy-a-harness-hygiene`로 잡혀 있고 최종적으로 같은 브랜치·같은 두 커밋에 합쳐졌다. 이 문제는 이미 리뷰 1라운드(`RESOLUTION.md` W1)에서 지적됐고 처분은 "분리하지 않는다 — 사용자가 'A 를 모두 처리하고 PR'로 묶어 지시했다 + PR 본문에 두 축의 리뷰 책임자를 명시"였다(코드 구조상 분리 아님, PR 설명 수준 완화). 이번 라운드(diff 81파일)에서도 구조는 그대로다 — 재확인 차원에서 다시 등재한다. PR 본문에 실제로 그 이원화 서술이 들어가는지는 이 diff만으로는 검증되지 않는다.
  - 제안: 새로 취할 조치는 없어 보임(이미 사용자 지시로 채택된 트레이드오프) — 다만 PR 생성 시 RESOLUTION.md W1이 약속한 "harness 축/spec 축 리뷰 책임자 분리" 서술이 실제 PR 본문에 들어갔는지 확인할 것.

- **[WARNING]** 코드 리뷰 fix(resolution-applier, developer 역할) 단계가 `spec/` 본문을 직접 수정 — CLAUDE.md의 좁은 예외 조건 미충족
  - 위치: `spec/conventions/error-codes.md:26`(`대표 surface` → `대표 surface 중 하나. 나머지 하나는 아래 문단 참조`), `review/code/2026/09/01/22_25_37/RESOLUTION.md:21-28`(W2), 근거 규약: `CLAUDE.md:64,70,73`(developer 는 `spec/` read-only, 좁은 예외는 "developer 자신이 그 문서에 써 넣은" 문장의 정정에 한정)
  - 상세: `RESOLUTION.md` W2는 "draft가 §Overview 도입부 단수 표현도 복수로 조정한다고 적었는데 실제 diff는 안 건드렸다"는 자기 모순을 "plan을 고쳐 주장을 낮추는 대신 **코드를 주장에 맞췄다**"고 처리했다 — 즉 code-review 픽스(개발자/resolution-applier 트랙, `codebase/**`·`plan/**`·`review/**`만 쓰기 가능하고 `spec/`는 read-only)가 `spec/conventions/error-codes.md`의 "**대표 surface**"라는 기존 문장(commit `c70893d76`/`41acc03f7` 등 2025년 이전부터 존재, `git log --follow`로 확인)을 직접 편집했다. CLAUDE.md의 "자기-반증형 소정정" 예외는 5조건을 **전부** 요구하는데 그중 1번("대상 문장을 developer 자신이 그 문서에 썼다")이 성립하지 않는다 — 이 문장은 이번 세션에서 developer가 쓴 게 아니라 몇 달 전부터 있던 기존 규약 서술이다. 예외의 게이트 조건("`--spec` 대신 `--impl-done` 을 그 spec 파일이 포함되는 scope 로 반드시 돌린다")도 충족되지 않았다 — `RESOLUTION.md:79-83`의 검증 목록(lint/unit/build/e2e/docs 가드/harness 테스트/뮤테이션)에 `spec/conventions/error-codes.md`를 포함한 `--impl-done`/`--spec` 재실행이 없고, 이 diff 안에도 `21_56_30` 이후의 새 consistency-check 세션 디렉터리가 없다. 내용 자체는 이미 6라운드로 게이트된 결정("두 surface, 자매 const, 목적지는 SoT에 위임")과 일치하는 사소한 문구 보완이라 위험은 낮지만, 절차상으로는 developer 역할이 spec/ 을 예외 없이 직접 고친 사례다.
  - 제안: 이 한 줄 편집을 이 changeset 범위에 포함하는 `--impl-done`(대상에 `spec/conventions/error-codes.md` 포함)을 돌려 사후 그물로 덮거나, 사실을 그대로 두려면 이 편집이 어느 트랙(project-planner 연속 턴 vs developer 예외)이었는지 커밋 메시지나 plan에 명시할 것.

## 확인했으나 문제 없음 (근거 기록)

- 신규 가드(`stray-tool-tags.test.ts`)가 정리한 `</content>`/`</invoke>` 잔재 5개 plan 파일(6~10, 14번)은 그 가드가 감지하는 대상과 정확히 일치 — 새 회귀 가드 + 그 가드가 잡아낼 기존 위반의 동반 정리는 "관련 없는 정리"가 아니라 같은 작업의 두 반쪽이다.
- `plan-lifecycle.md`(파일 1) 추가 절, `plan_guard.py`의 `_CHECKBOX` 정규식 확장(파일 2)과 그 회귀 테스트(파일 3), `spec-links.test.ts` 통합 테스트 보강(파일 4)은 전부 "harness 위생" 축 안에서 서로를 참조하는 좁고 일관된 변경이며 range 밖 파일을 건드리지 않는다.
- `plan/in-progress/harness-review-gate-followups.md`(파일 12)의 두 체크박스 갱신(SoT 미등재 후속 등재, `_CHECKBOX` 판정 완료)은 이 changeset 이 실제로 구현한 항목을 원 트래커에 되짚는 정상적인 plan 동기화다.
- `review/code/2026/09/01/22_25_37/**`(파일 15~26) 와 `review/consistency/2026/09/01/{21_30_10..21_56_30}/**`(파일 27~80)는 이 저장소 관례상 git 추적 대상인 세션 산출물이며, 그 자체가 "무관한 파일 추가"는 아니다 — 다만 그 절대다수(54/81 ≈ 67%)가 harness 축이 아니라 spec 축의 산출물이라는 점은 위 첫 WARNING의 근거로 이미 반영했다.

## 요약

이번 diff(81파일, 2커밋)는 이름·plan 상 "harness 위생"(체크박스 정규식 확장, 도구 태그 잔재 가드 신설, 링크 가드 보강, plan lifecycle 절차 문서화)을 목적으로 하지만, 실제로는 완전히 별도 트랙으로 등재된 spec 문서 결정(`EngineErrorCode` 두 surface 병기, 전용 plan + `--spec` 6라운드 산출물 54파일)이 같은 두 커밋에 함께 실려 있다. 이 사실 자체는 이미 리뷰 1라운드에서 지적되고 사용자 지시로 "분리하지 않는다"는 처분을 받았지만, 코드 구조상 여전히 유효하므로 재확인해 등재했다. 더 중요한 새 발견은, 그 결정을 마무리하는 code-review fix 단계(developer/resolution-applier)가 `spec/conventions/error-codes.md`의 기존 문장을 CLAUDE.md 의 좁은 예외 조건(문장을 developer 자신이 썼을 것 + `--impl-done` 게이트)을 충족하지 못한 채 직접 수정했다는 점이다 — 내용 위험은 낮지만 절차 위반이며, 이 changeset 이 스스로 강조하는 "역할 경계"를 그 changeset 의 후반부가 다시 넘었다.

## 위험도

MEDIUM
