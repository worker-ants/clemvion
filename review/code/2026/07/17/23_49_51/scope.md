# 변경 범위(Scope) 리뷰

## 대상 커밋

`00b3b05a4 fix(frontend): 레이어 가드 스코프를 src/types 로 확장 + spec implemented 승격`
(6 files changed, 133 insertions, 46 deletions) — payload 의 7개 파일 항목과 `git show --stat` 실측이 정확히 일치함을 확인했다 (plan 파일 add+delete 쌍은 git 상 rename 1건으로 잡힘).

## 점검 결과

이 커밋은 `plan/complete/spec-draft-frontend-layering.md` 의 Phase 2(가드 스코프 확장)·Phase 3(spec 승격)를 그대로 실행한 것이며, 선언된 작업 범위(레이어 가드에 `src/types/**` 추가 + spec `implemented` 승격)를 벗어나는 수정은 발견되지 않았다.

### 발견사항

- **[INFO]** 메시지 상수 리팩터(`STATIC_IMPORT_MSG`/`LAYERS_LABEL`/`RESOLUTION_HINT` 신설)
  - 위치: `codebase/frontend/eslint.config.mjs` L16-27 부근
  - 상세: 기존에는 `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 가 `"src/lib/**"` 를 하드코딩한 문자열이었는데, 이번 커밋에서 `LOWER_LAYERS` 배열에서 라벨을 파생하는 구조로 바뀌었다. 요청받은 최소 변경(`files` 배열 확장)보다 더 넓은 리팩터이지만, 이는 스코프 확장 후 "`src/lib/**` 은 ~ 못한다" 라는 문구가 `src/types/**` 위반에도 그대로 뜨면서 거짓이 되는 것을 막기 위한 필연적 파생 변경이다. 커밋 메시지·config 내 주석 모두 이 근거를 명시하고 있어 목적 없는 리팩토링이 아니다.
  - 제안: 없음 (승인 가능한 부수 변경).

- **[INFO]** 신규 "가드 스코프 — 실제 ESLint 경로 매칭" 테스트 스위트 (약 62줄 추가)
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` L263-322 (전체 컨텍스트 기준 L523-581)
  - 상세: `plan/in-progress` 원본 초안은 Phase 2 에 "회귀 케이스: src/types 경로 fixture 차단 확인" 정도만 예정했으나, 실제로는 `ESLint` API 를 직접 resolve 하는 별도 `describe` 블록(경로 매칭 전용, components/app 비대상 경로 음성 테스트 포함)이 새로 생겼다. 규모는 최소 diff 이상이지만, 기존 합성 `Linter#verify` 스위트가 `files:` glob 을 원리적으로 우회해 `src/types` 스코프 확장을 증명하지 못한다는 아키텍처적 이유가 plan·commit 메시지·테스트 파일 내 주석에 모두 documented 되어 있고, mutation 검증(①②③ 6-fail/원복 47/47)까지 근거로 제시된다. 이전 리뷰(WARNING#5)가 지적한 "스코프가 아니라 내용만 검증한다"는 갭을 정면으로 메우는 것이라 목적 외 기능 확장(over-engineering)으로 보기는 어렵다.
  - 제안: 없음 (문서화된 근거가 충분).

- **[INFO]** `plan/complete/spec-draft-frontend-layering.md` 가 단순 `git mv` 이상으로 재작성됨 (rename 대비 57줄 diff)
  - 위치: `plan/complete/spec-draft-frontend-layering.md` (신규) / `plan/in-progress/spec-draft-frontend-layering.md` (삭제)
  - 상세: 이동과 함께 Phase 2·3 체크박스 완료 표시, mutation 검증 결과, 그리고 병렬 세션(`claude/zen-kapitsa-c5e1de`)과의 중복 처분을 기록한 "처분 확정" 문단이 추가됐다. 이는 CLAUDE.md 의 plan 라이프사이클 규약(완료 시 `plan/complete/` 이동 + 실행 결과 기록)이 요구하는 정상적인 사후 기록이며, 코드 변경과 무관한 리팩토링이 아니라 이번 작업 자체의 완료 근거를 남기는 문서화다.
  - 제안: 없음.

- **[INFO]** `spec/conventions/frontend-layering.md` frontmatter 변경 (`status: partial → implemented`, `pending_plans` 제거) + 본문 §4/§4.1 갱신
  - 위치: `spec/conventions/frontend-layering.md` L1-9, L68-83 부근
  - 상세: plan 의 D4 결정("Phase 2 와 동일 커밋에서 `implemented` 승격")을 그대로 이행한 것으로, 코드 변경(스코프 확장)과 spec 상태가 실제로 일치하게 된 시점에 승격이 이뤄져 `spec-impl-evidence.md` 규약과 부합한다. 범위 외 항목이 아니다.
  - 제안: 없음.

- **[INFO]** `rag-types.ts` / `conversation-utils.ts` 주석 축약
  - 위치: `codebase/frontend/src/lib/conversation/rag-types.ts` L1-10, `codebase/frontend/src/components/editor/run-results/conversation-utils.ts` L1-4
  - 상세: 개별 파일에 분산돼 있던 "왜 lib 에 사는가" 설명을 spec SoT(`frontend-layering.md §3`) 링크로 대체한 것으로, 이번 작업이 spec 을 신설/승격시킨 것과 직접 연결된 변경이다. 무관한 주석 손질이 아니다.
  - 제안: 없음.

### 확인된 사항 (문제 없음)

- 7개 파일 모두 "레이어 가드 `src/types` 확장 + spec 승격" 이라는 단일 의도에 직접 연결돼 있다. 무관한 파일·디렉터리 수정은 없다.
- `eslint.config.mjs` 의 `COMPONENTS_PATH_RE`, `literalSpecifier`/`backtickSpecifier`, selector 4종 구조(PR #969 산출물)는 그대로 보존되고 손대지 않았다 — 스코프 확장과 무관한 부분에 리팩터가 번지지 않았다.
- import 변경(테스트 파일의 `path`/`fileURLToPath`/`ESLint`/`beforeAll`)은 전부 신규 테스트 스위트에서 실제로 사용되며, 미사용 임포트나 불필요한 정리는 없다.
- 포맷팅만 바뀐 diff hunk는 없음 — 모든 변경 라인이 실질적 내용 변경을 동반한다.
- 설정 변경(`eslint.config.mjs`)은 이번 작업이 의도한 바로 그 설정(레이어 가드) 자체이며, 무관한 다른 규칙·플러그인 설정에는 손대지 않았다.

## 요약

이번 커밋은 선행 plan(`plan/complete/spec-draft-frontend-layering.md`)의 Phase 2·3 을 문서화된 범위 그대로 실행한 것으로, 메시지 상수 파생·신규 스코프 테스트 스위트·plan 문서 재작성 등 최소 diff보다 다소 넓어 보이는 부분들도 모두 "스코프 확장이 기존 텍스트/테스트를 거짓/무력화시키는 것을 막기 위한 필연적 부수 변경"이라는 근거가 커밋 메시지·plan·코드 주석 3중으로 문서화되어 있다. 무관한 파일 수정, 목적 없는 리팩토링, 요청 외 기능 확장, 포맷팅/주석/임포트의 잡음성 변경은 발견되지 않았다.

## 위험도

NONE
