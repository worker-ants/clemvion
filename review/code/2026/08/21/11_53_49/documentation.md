# 문서화(Documentation) 리뷰 — masked-marker-contract-7d2e14 (라운드 2, 11_53_49)

## 발견사항

- **[WARNING] plan 체크리스트가 실제 상태와 어긋난다 — "spec R17 정정 (planner 턴 필요)"가 이미 이 changeset 안에서 developer 에 의해 처리됐는데도 미체크(`[ ]`)로 남아 있다**
  - 위치: `plan/in-progress/masked-marker-shared-package.md:127` (`- [ ] **spec R17 정정 (planner 턴 필요)** — ...`)
  - 상세: 이 항목은 "`spec/5-system/14-external-interaction-api.md` 의 R17 SoT 서술 정정은 `developer` 가 `spec/` read-only 라 planner 턴으로 분리 집행"이라고 명시하며 미체크 상태다. 그런데 실제로는 같은 changeset 의 리뷰-수정 커밋(`bf0618a7d "fix(guard): 없애려던 경로 게이팅을 가드 배치로 재도입했다 + spec R17 정정 — 라운드1 처분"`, `git show --stat` 확인)에서 `spec/5-system/14-external-interaction-api.md` 의 R17 문장과 frontmatter `code:` 목록이 **이미 갱신됐다**(직접 `Read` 로 확인: `:1624-1631` 이 "SoT 는 공유 패키지 `@workflow/masked-markers`" 로, frontmatter `:16` 에 `codebase/packages/masked-markers/src/index.ts` 가 추가됨). 이 결정은 `review/code/2026/08/21/11_27_29/RESOLUTION.md` "WARNING 3" 절에 근거와 함께("별도 `--spec` 라운드 대신 push 게이트가 요구하는 `--impl-done` 으로 검증한다... 선택을 숨기지 않고 여기 적는다") 명시적으로 남아 있어 **은폐된 위반은 아니다.** 문제는 그 결정이 실행된 뒤에도 `plan/in-progress/masked-marker-shared-package.md` 자체(이 작업의 SoT 문서, `git show --stat bf0618a7d` 로 확인 결과 이 파일은 그 수정 커밋에 포함되지 않음)가 갱신되지 않아, 이 문서만 읽는 다음 사람은 "R17 정정이 아직 planner 턴을 기다리고 있다"고 오판하게 된다는 점이다. 이 프로젝트의 반복 학습 항목("plan 체크박스 = 실제 상태") 이 지적하는 정확히 그 실패 형태다.
  - 제안: `plan/in-progress/masked-marker-shared-package.md:127` 를 `[x]` 로 바꾸고, "developer 는 `spec/` read-only 라 planner 턴으로 분리 집행" 문구를 "(2026-08-21 정정) `RESOLUTION.md` WARNING 3 판단에 따라 편집 2줄·`--impl-done` 검증으로 같은 턴에 처리 — 별도 planner 턴 생략" 식으로 실제 실행 경로에 맞게 고친다.

## 요약

이번 라운드(11_53_49)는 이전 라운드(11_27_29)의 CRITICAL 0·WARNING 3 전부를 커밋 `bf0618a7d` 로 수정했고, 그 수정 자체의 문서화 품질은 높다 — backend 미러 소멸 가드 신설(`masked-marker-mirror-guard.ts`/`.spec.ts`)에 "왜 frontend 와 둘인가"를 근거·실측과 함께 상세히 남겼고, 패키지 spec 리터럴 pinning 보강(`index.spec.ts`)도 목적을 명확히 설명하며, spec R17 SoT 서술 정정(`14-external-interaction-api.md:1624-1631`)도 정확하고 인접 항목과 혼동 없이 텍스트 앵커로 반영됐다(frontmatter `code:` 목록도 정확한 위치에 추가). 유일한 실질 발견은 그 R17 정정이 실행됐음에도 이 작업의 SoT 인 `plan/in-progress/masked-marker-shared-package.md` 자체의 체크리스트가 갱신되지 않아 "아직 planner 턴을 기다린다"는 낡은 상태를 계속 서술한다는 점이다(WARNING) — RESOLUTION.md 에 결정 근거는 남아 있어 완전히 유실된 정보는 아니지만, plan 문서만 보는 독자에게는 오탐 신호가 된다. 그 외 새 파일들의 JSDoc·README·CI 주석("N개를 전부 등록" 5→6 갱신 등)은 전부 정확하며 stale 주석·누락된 예제·미문서화 설정 항목은 발견되지 않았다.

## 위험도
LOW
