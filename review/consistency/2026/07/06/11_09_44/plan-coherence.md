# Plan 정합성 검토 — spec/2-navigation/1-workflow-list.md (태그 필터 하향 + 폴더 drift 현행화)

대상 diff: `spec/2-navigation/1-workflow-list.md` (worktree `fe-tag-filter-283723`)
대조 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md`

## 발견사항

### [WARNING] plan 의 "결정 필요" 항목이 spec 에서는 해소됐는데 plan 자체는 미갱신
- target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 태그 필터 행 + 신설 `### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)` Rationale
- 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` 라인 17-18 (`**구현 진척 (2026-07-06, FE-2)**: ... 남은 잔여 = 태그 필터 UI(§2.3, spec 멀티선택 vs 서버 단일 `?tag=` 결정 필요)·...`) 및 라인 24 (`- [ ] 태그 필터 UI 부재 (§2.3): 서버 `?tag=` 지원, **frontend 잔여**(태그 멀티 선택 UI). 별도 PR.`)
- 상세: plan 은 "멀티 vs 단일 결정 필요"를 미해결 블로커로 명시해뒀고, 이번 spec 변경이 정확히 그 결정("단일 free-text, 사용자 결정 2026-07-06")을 내렸다. 결정 자체는 plan 이 요청한 방향에 부합하므로 충돌(CRITICAL)은 아니다. 다만 plan 문서(진행 노트 라인 17-18, 체크박스 라인 24)는 이번 커밋에 포함되어 있지 않아 결정 이후에도 여전히 "결정 필요"·"태그 멀티 선택 UI" 라는 stale 문구로 남는다. spec 은 SoT 이고 plan 은 추적 문서이므로, spec 갱신과 plan 갱신이 분리되면 이후 세션에서 plan 을 읽는 사람이 이미 내려진 결정을 다시 "미해결"로 오인할 위험이 있다.
- 제안: plan 의 진행 노트를 "태그 필터 UI(§2.3, 서버 단일 `?tag=` 에 맞춰 free-text 단일로 하향 확정 — spec Rationale §4, 2026-07-06). frontend 구현 잔여." 로 갱신하고, 체크박스 항목 문구도 "태그 멀티 선택 UI" → "태그 단일 free-text 필터 UI" 로 정정할 것. (같은 developer/planner 세션에서 spec 과 plan 을 함께 커밋하는 편이 안전 — 별도 커밋으로 분리 시 누락 위험.)

### [INFO] 체크박스 상태(`[ ]`)와 spec 서술 톤 불일치 — 실제 미구현 확인
- target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 태그 필터 행 — "입력한 태그 1개를 서버 `?tag=` 로 전달 ... 검색과 동일하게 debounce 적용, page 리셋." 처럼 이미 동작하는 필터인 것처럼 폴더·상태·소유 필터와 동일한 서술 톤을 사용
- 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` 라인 24 — `- [ ] 태그 필터 UI 부재 (§2.3): ... **frontend 잔여**`
- 상세: 코드 확인 결과(`codebase/frontend/src/app/(main)/workflows/page.tsx`) 태그 필터 UI(입력창·debounce·`?tag=` 송신 로직)는 아직 없다 — 코드에 남은 `tag` 관련 참조는 테이블 뱃지 표시(`workflow.tags?.map`)뿐이다. §2.3 표에서 태그 행에 있던 "**미구현 (Planned)**" 마킹이 이번 diff 로 제거되어, 다른 필터(이미 구현 완료)와 구분이 사라졌다. spec 하향(멀티→단일) 자체는 정당하나, 문구가 "장래 구현될 사양"이 아니라 "현재 동작"으로 읽혀 spec-code 정합성 관점에서 오해 소지가 있다.
- 제안: 태그 필터 행에도 폴더 필터가 과거 가지고 있던 것과 같은 명시적 상태 마커(예: "**미구현 (Planned)**: 위 사양대로 아직 frontend 구현 전 — plan/in-progress/spec-sync-workflow-list-gaps.md 추적")를 유지해, "사양은 확정(하향)됐으나 구현은 아직" 임을 명확히 할 것. 이는 CRITICAL 은 아님 — 다음 developer 세션이 코드를 보면 미구현임을 바로 알 수 있고, plan 도 여전히 `[ ]` 로 정확히 추적 중이기 때문.

### 확인 결과 — 충돌 없음
- 폴더 필터 관련 spec 변경(§2.3 폴더 행, §3 API 안내문)은 plan 라인 25(`- [x] 폴더 필터 UI 부재 (§2.3): ... (FE-2, fe2-workflow-list-filters-08493f)`) 및 plan 라인 19(`**planner 후속(SPEC-DRIFT)**: 폴더 필터 구현으로 §2.3 폴더 필터 행 및 §3.1 ... 안내문이 낡음. spec 본문 현행화 필요`)와 정확히 일치한다. 이번 diff 가 바로 그 SPEC-DRIFT 후속을 이행한 것으로, plan 이 요청한 내용과 완전히 정합적이다.
- 다른 in-progress plan(`self-hosting-deployment.md`, `marketplace-and-plugin-sdk.md`, `spec-sync-structural-followups.md` 등)의 "태그" 언급은 각각 Docker 이미지 태그, 노드 카테고리 태깅, HTML select 옵션 태그로 워크플로우 목록 태그 필터와 무관 — 태그 멀티선택을 전제로 하는 다른 plan 은 없음을 확인했다.

## 요약
이번 spec 변경은 plan 이 "결정 필요"로 남겨둔 태그 필터 멀티/단일 문제를 사용자 결정으로 해소하고, 폴더 필터 관련 SPEC-DRIFT 후속을 정확히 이행한 것으로 plan 이 요청한 방향과 정합적이다. CRITICAL 한 미해결 결정 우회는 없다. 다만 spec 만 갱신되고 대응하는 `plan/in-progress/spec-sync-workflow-list-gaps.md` 의 진행 노트·체크박스 문구가 함께 갱신되지 않아, plan 을 읽는 후속 세션이 이미 내려진 결정을 다시 미해결로 오인할 수 있는 WARNING 수준의 후속 누락이 있다. 또한 태그 필터 행의 "미구현(Planned)" 마킹 제거로 사양-구현 상태 구분이 흐려진 INFO 수준 개선 여지가 있다.

## 위험도
LOW

(BLOCK 아님 — CRITICAL 없음. plan 갱신은 이번 spec PR 에 함께 포함하거나 후속 커밋으로 빠르게 이어가는 것을 권장.)
