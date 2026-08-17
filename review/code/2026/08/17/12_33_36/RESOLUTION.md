# RESOLUTION — 12_33_36 (라운드 2)

대상 SUMMARY: `review/code/2026/08/17/12_33_36/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **1**, INFO 6)

직전 라운드(`12_06_12`)의 WARNING 6건 처분을 반영한 뒤 돌린 fresh review.
**testing reviewer 가 내 뮤테이션 결과를 독립으로 재현**해 두 vacuity 해소를 확인했다
(`type="button"` → 14 RED · `true &&` → 2 RED · 가드 제거 → 4 RED).

**처분: WARNING 1건 수정 + INFO 1건 수정, 나머지 INFO 4건 트래커 등재.**

---

## WARNING 1 — 내 CHANGELOG fix 가 죽은 포인터를 만들었다 (documentation / requirement) — **수정**

직전 라운드 W4 를 고치면서 *"프런트 마커 가드는 **아래 항목에서** 폼 프리필에 먼저
구현됐다"* 라고 썼는데, **그 "아래 항목" 이 없다.** 게다가 이 파일은 58행에서 *"CHANGELOG 는
최신이 위로 쌓인다"* 고 스스로 밝히므로 이번 PR 을 가리키려면 방향도 "위" 여야 했다.
stale 문장을 고치려다 형태만 다른 불일치를 새로 만든 셈 — 처분이 완결되지 않았다.

리뷰어 권고대로 **이 시리즈 자매 3건(#1177/#1179/#1180)이 모두 자기 절을 가진 선례**를 따랐다:

- 맨 위에 이번 PR 의 `## Unreleased` 절 신설 — 무수정 프로브, 카브아웃이 불가능한 이유
  (`formConfig` 는 SSE·webhook 으로도 나간다), 정확 일치 경계, 미러 명명 규약
- 기존 문장은 *"위 항목이 폼 프리필에 세웠다"* 로 고쳐 실재하는 절을 가리키게 함

- `CHANGELOG.md`

## INFO 2 — 테스트 fixture 가 마커 리터럴을 3중 복제 (3 reviewer 중복 지적) — **수정**

`MASKED_MARKERS` 가 이번에 export 로 승격됐는데 테스트는 여전히 리터럴을 손으로 적고 있었다.
구현이 마커를 늘려도 그 마커는 **조용히 미검증**으로 남는다.

다만 단순히 import 로 바꾸면 **값이 통째로 바뀌어도 초록**이 된다(집합은 늘 자기 자신과
일치). 그래서 둘 다 취했다:

- `const MARKERS = [...MASKED_MARKERS]` — 마커가 늘면 `it.each` 가 자동으로 순회
- **리터럴 대조 테스트 신설** — 세 문자열이 backend SoT 가 실제로 내보내는 값임을 못박음

대상 파일 단독 실행 **26 passed**.

- `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`

---

## 트래커 등재 (코드 미변경)

발견의 성격이 **동작 → 구조 → 문서/테스트 층**으로 내려왔다. 이 저장소의 수렴 신호이므로
여기서 코드 라운드를 더 열지 않고 등재한다 (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`).

| # | 항목 | 등재 사유 |
|---|------|-----------|
| 1 | 마커 미러 계약 테스트 (backend ↔ frontend) | 이 시리즈 **반복** 지적. 프런트 절반은 이번에 기계화(위 INFO 2)했으나 **스택을 가로지르는** 대조는 jest/vitest 분리 탓에 공유 패키지 추출이 선행돼야 값싸다 |
| 4 | `isMaskedMarker` non-string 입력 단위 테스트 | 공개 유틸 승격에 따른 회귀 방어. 현 구현은 `typeof` 가드 한 줄이라 위험 낮음 |
| 5 | `select`/`textarea` 필드 타입 가드 테스트 | 구현이 타입을 분기하지 않아 실동작 영향 없음 |
| 6 | `presentation.mdx`(+`.en`) `defaultValue` 캐비엇 | 매트릭스 요구 타겟(`05-run-and-debug/`)은 충족. 런타임 힌트가 원인을 그 자리에서 설명 |

**INFO 3 (부분-매치 잔여) 은 등재하지 않는다** — 직전 라운드에서 *의도적 경계*로 결정하고
JSDoc·캐너리 테스트로 고정한 트레이드오프이며, 이번 리뷰어도 "현행 유지" 로 판단했다.
`token=` 패턴 확장 시 함께 넓어진다는 점은 그 항목에 이미 적혀 있다.

---

## 곁들인 것 — consistency `12_34_24` (BLOCK: NO)

같은 커밋에 대해 병행한 `--impl-done` 게이트의 WARNING 1 + INFO 2건도 함께 처리했다:

- **WARNING 1**: `14-external-interaction-api.md` frontmatter `code:` 에 §R17 이 새로 SoT·가드로
  지목한 2건 등재 (`sanitize-error-message.ts` · `dynamic-form-ui.tsx`).
  자매를 전수로 세어 확인 — `websocket.service.ts` 는 **WS spec 이 이미 등재**하고 있어 갭이
  아니다(`6-websocket-protocol.md:8`).
- **INFO 7**: §R17 신규 불릿의 `carve-out` → `카브아웃` 표기 통일 (같은 문서 다른 5곳이 한글)
- **INFO 9**: 완료 체크박스 옆에 남아 있던 "이연 사유" blockquote 에 해소 시점 명기.
  이 저장소가 **4번째로** 겪은 재발 패턴이라 문구로 닫았다

## 검증

fix 반영 후 TEST WORKFLOW 4단계 전부 PASS:

| 단계 | 결과 |
|---|---|
| lint | PASS (50s) |
| unit | PASS — backend 427 suites / 8,812 · frontend 6,026(6,025 pass) · 내부 packages 451 |
| build | PASS (140s) |
| e2e | PASS — backend supertest 276 + playwright 51 |

대상 테스트 파일 단독: **26 passed (26)** (리터럴 대조 테스트 1건 추가).
