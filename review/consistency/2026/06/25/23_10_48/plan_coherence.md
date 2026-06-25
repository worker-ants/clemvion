# Plan 정합성 검토 결과

검토 대상: refactor 03 m-3 — `integrations/new/page.tsx` 1444→448줄 behavior-preserving 분할 완료 (커밋 174bd906 + review-fix 77a04a4f)
관련 plan: `plan/in-progress/refactor/03-maintainability.md`, `plan/in-progress/refactor/README.md`

---

## 발견사항

### [WARNING] plan `m-3` 항목이 `[ ] 미착수` 상태로 갱신되지 않음

- target 위치: 커밋 설명의 "plan 03-maintainability.md m-3 완료·README 66완료/22잔여 갱신" 언급
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` § m-3 (line 336–358), `plan/in-progress/refactor/README.md` line 22
- 상세: 03-maintainability.md 의 `m-3` 항목은 현재 `- [ ] 미착수 — integrations/new/page.tsx` 상태다. 구현이 완료됐으므로 `[x]` + 커밋·branch 정보로 갱신돼야 한다. README 집계표(line 22)도 03 완료 수가 5건으로 기록돼 있는데 m-3 완료를 반영하면 6건으로 수정이 필요하고 잔여(미완)는 9→8로 줄어야 한다. 커밋 설명은 "m-3 완료·README 66완료/22잔여 갱신"을 했다고 주장하는데, 현재 파일 내용과 불일치가 있다.
- 제안: plan 03-maintainability.md `m-3` 체크박스를 `[x]`로 갱신하고 커밋·branch·검증 내역을 기록. README 집계표 행도 동기화.

### [INFO] impl-prep 결정 I1(컴포넌트 배치)과 plan 원안 배치 경로 불일치 추적 누락

- target 위치: 검토 범위 설명의 "배치: 컴포넌트 라우트-로컬(impl-prep I1)"
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` § m-3 개선 방안 1 (line 343) — `components/integrations/steps/` 배치 제안
- 상세: plan m-3 개선 방안 1은 `components/integrations/steps/` 배치를 제안했으나, 구현은 `new/_components/` 라우트-로컬 배치(impl-prep I1 결정)를 택했다. 이는 impl-prep 단계에서 plan 권장안과 다른 배치를 선택한 것이며 plan 에는 원안 경로가 그대로 남아 있어 추후 혼선 가능성이 있다. binding 결정이 아닌 권장안이므로 CRITICAL 은 아니나, 완료 기록에 명기해야 한다.
- 제안: m-3 완료 체크박스 갱신 시 "배치: `new/_components/`(라우트-로컬, impl-prep I1 결정 — plan 원안 `steps/`과 상이)" 메모 1줄 추가.

### [INFO] `useDraftRestore` hook 미구현 — plan 개선 방안과 부분 차이

- target 위치: 구현 diff — `use-oauth-popup-return.ts`, `use-unsaved-changes-warning.ts` 신규. `useDraftRestore` 없음
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` § m-3 개선 방안 2 (line 344) — `useOauthPopupReturn`/`useDraftRestore` 양쪽 명시
- 상세: plan 개선 방안 2는 `useDraftRestore`(이탈 복원, §3.6) hook을 명시했으나 구현은 `useUnsavedChangesWarning`(이탈 경고)만 추출했다. 이탈 경고(beforeunload)는 구현됐지만 draft 복원 기능은 미구현이다. behavior-preserving 리팩토링 범위라 의도적 축소로 보이지만 m-3 완료로 표기 시 이 차이가 추적되지 않는다.
- 제안: m-3 완료 기록 시 "`useDraftRestore`(§3.6 복원) 미구현 — 이탈 경고(`useUnsavedChangesWarning`)만 추출, 복원 기능은 현상 유지 또는 후속 백로그" 명기.

---

## 요약

target 구현(page.tsx 1444→448줄 behavior-preserving 분할, `_components/` 4개 + 2개 hook 추출)은 plan `03-maintainability.md` m-3의 spec §3.1/§3.5/§3.6 경계 기반 분리 방향과 근본적으로 일치하며, C-3·M-4 등 결정대기 항목을 우회하거나 선행 plan 조건을 위반하지 않는다. CRITICAL 충돌은 없다. 단, 구현 완료 후 plan 파일의 체크박스·집계표 동기화가 현재 파일 내용 기준으로 누락돼 있고(m-3 항목이 `[ ] 미착수` 상태), 배치 경로 변경(`steps/` → `_components/`)과 `useDraftRestore` 미구현 사실을 완료 기록에 명기해야 추적성이 보완된다.

---

## 위험도

LOW
