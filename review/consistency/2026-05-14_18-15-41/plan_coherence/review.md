`spec-update-cafe24-pending-polish.md`가 in-progress에 존재하므로 내용을 spec-draft와 대조합니다.

---

## 발견사항

---

**[WARNING] HTTP 상태 코드 불일치 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`**

- target 위치: `DRAFT 2F` §9.4 에러 코드 보강 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)`
- 관련 plan: `plan/in-progress/spec-update-cafe24-pending-polish.md` §B C4 — 동일 에러 코드를 `(400)` 으로 명시
- 상세: 위임 출처인 spec-update는 400을 요구했으나 드래프트는 409(Conflict)로 수정했다. 드래프트 Rationale에 "swagger 규약·INTEGRATION_IN_USE(409) 선례" 근거가 있으나, spec-update와의 불일치가 명시적으로 언급되지 않았다. consistency-check가 이 변경을 기존 swagger 규약과 비교할 때 409가 맞으나, 두 문서 간 수치가 달라 추적이 단절된다.
- 제안: spec-update §B C4의 `(400)` → `(409)` 로 갱신하고 "spec-draft에서 swagger 선례에 따라 409로 수정" 1줄 주석 추가.

---

**[WARNING] 드래프트 범위가 위임 plan(spec-update) 및 cafe24-pending-polish 실행 순서 Step 0을 초과**

- target 위치: DRAFT 2J/2J-bis/2J-2/2J-ter (4-cafe24.md), DRAFT 3C/3C-bis/3D (data-flow §1.2/§1.4/§2.1), DRAFT 2K (§4.2), DRAFT 2H `spec/conventions/cafe24-api-metadata.md §6`
- 관련 plan 1: `spec-update-cafe24-pending-polish.md` — 대상 파일: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/integration.md §3.2` 만 열거
- 관련 plan 2: `cafe24-pending-polish.md` 실행 순서 Step 0 — "spec/1-data-model.md §2.10, spec/2-navigation/4-integration.md §2.2/§2.4/§3.2/§6/§9.2/§9.4/§10/§14.2, spec/data-flow/integration.md §3.2" 명시
- 상세: 드래프트가 두 상위 plan의 열거 파일 목록에 없는 `spec/4-nodes/4-integration/4-cafe24.md`(§9.4/§9.8/§10 전반), `spec/data-flow/integration.md §1.2/§1.4/§2.1`, `spec/conventions/cafe24-api-metadata.md §6` 를 추가로 수정한다. 확장 자체는 W1–W8 Warning을 해소하기 위한 정당한 확장이지만, 상위 plan들과 수정 대상 목록이 불일치해 향후 적용 단계에서 누락 또는 범위 혼동이 생길 수 있다.
- 제안: `cafe24-pending-polish.md` 실행 순서 Step 0에 추가된 파일 목록(`spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/integration.md §1.2/§1.4/§2.1`, `spec/conventions/cafe24-api-metadata.md §6`)을 병기하고, `spec-update-cafe24-pending-polish.md`에 "확장 범위 (W-시리즈 해소)" 항목을 추가.

---

**[INFO] 영구 폐기 시점 follow-up — cafe24-pending-polish.md 미기재**

- target 위치: DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" — "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가"
- 관련 plan: `cafe24-pending-polish.md` — "비포함" 섹션 및 변경 0–5 어디에도 해당 항목 없음
- 상세: 드래프트가 옛 경로 영구 폐기를 후속 plan 아이템으로 예약했으나, cafe24-pending-polish.md에 이 항목이 실제로 등재되지 않았다. 드래프트 적용 이후 follow-up이 추적 불가 상태가 된다.
- 제안: cafe24-pending-polish.md의 "비포함" 섹션에 "옛 install 경로(`/oauth/install/cafe24`) 영구 폐기 시점 결정 — 운영 데이터·외부 등록 URL 잔존 여부 확인 후 별도 plan" 항목 추가.

---

**[INFO] spec-update-cafe24-pending-polish.md 완료 처리 시점 미명시**

- target 위치: 드래프트 하단 "consistency-check 후 후속 작업" — "본 draft 통과 시 patch 내용을 실제 spec 파일에 적용", "`spec-update-cafe24-pending-polish.md` 와 본 draft 를 처리 완료 상태로 정리"
- 관련 plan: `spec-update-cafe24-pending-polish.md` (worktree 동일: `cafe24-pending-polish-7fdb7e`, 현재 in-progress)
- 상세: 드래프트 자체에 "처리 완료 상태로 정리"가 명시되어 있어 의도는 명확하다. 단, spec-update와 spec-draft 두 파일 모두 `complete/`로 git mv해야 함을 cafe24-pending-polish.md가 명시하지 않아, developer 복귀 시 둘 다 정리해야 함을 놓칠 수 있다.
- 제안: cafe24-pending-polish.md 실행 순서 Step 0 뒤에 "spec-draft와 spec-update 모두 `plan/complete/`로 `git mv`" 1줄 추가.

---

## 요약

spec-draft-cafe24-pending-polish.md는 consistency-check BLOCK 원인인 Critical 이슈 4건(C1–C4)을 모두 해소하고, Warning W1–W8을 각 DRAFT 섹션에서 명시적으로 처리했다. 두 상위 plan(spec-update, cafe24-pending-polish)과의 정합도는 전반적으로 양호하나, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`의 HTTP 상태 코드(400 vs 409) 불일치가 spec-update와 드래프트 간에 존재하며, 드래프트가 상위 plan에 열거되지 않은 파일 4종(`4-cafe24.md`, `data-flow §1.2/§1.4/§2.1`, `cafe24-api-metadata.md §6`)을 추가로 수정하는 범위 초과가 추적 공백을 만든다. 두 Warning 모두 상위 plan 문서 갱신만으로 해소 가능한 수준이다.

## 위험도

**LOW** — Critical 충돌 없음. HTTP 상태 코드 불일치가 가장 구체적인 불일치이며 이는 spec-update 단일 줄 수정으로 해소된다. 범위 초과는 적용 전 plan 목록 동기화로 대응 가능하다.