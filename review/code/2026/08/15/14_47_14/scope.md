# 변경 범위(Scope) 리뷰 — eia-db-wire-invariant (① finalizeCancelledExecution / ② retry-turn RETURNING / ③ REST durationMs + `13_58_27` RESOLUTION 반영분)

## 조사 방법

`git log --oneline -8` 로 이 브랜치의 커밋 계열(8c2bddbcd~5bd198354)을 확인하고,
`git diff --stat origin/main...HEAD` 로 39개 파일·1991(+)/19(-) 전량이 프롬프트에 실린 목록과
정확히 일치함을 대조했다. 기준선은 `plan/in-progress/eia-db-wire-invariant.md` 의 ①②③ 항목 +
"범위 밖(등재됨)" 절, 그리고 `review/code/2026/08/15/13_58_27/RESOLUTION.md` 가 명시한
"8건 조치, 2건 등재" 목록이다.

## 발견사항

- **[INFO]** `toPersistedDate` 신규 export 헬퍼 — plan 원 항목(①②③)에는 없던 추가지만 리뷰 라운드에서 명시적으로 opt-in 된 것
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 함수, `toFiniteNumber` 바로 아래)
  - 상세: 항목②(`retry-turn.service.ts` `.returning()` 되읽기) 구현 중 `finished_at` 파싱을 인라인으로 작성했는데, 직전 라운드(`13_58_27` maintainability WARNING #2)가 "같은 파일의 `toFiniteNumber` 헬퍼 패턴을 인라인으로 재발명했다"고 지적했다. 그 응답으로 자매 헬퍼를 신설했고 `plan/in-progress/eia-db-wire-invariant.md` "범위 밖" 절도 "W6(`toPersistedDate`)만 '파싱은 한 곳에' 원칙이라 함께 처리했다"고 명시적으로 이유를 밝혀 뒀다. 항목② 구현에 직접 필요한 로직을 추출 위치만 옮긴 것이라 기능 확장이 아니다.
  - 제안: 조치 불요 — 리뷰 피드백에 대한 정당한 응답이며 plan 에 근거가 기록돼 있다.

- **[INFO]** `review/code/2026/08/15/13_58_27/**`(15개)·`review/consistency/2026/08/15/13_43_10/**`(8개) 산출물이 이번 diff 에 포함됨
  - 위치: 해당 두 디렉토리 전체(파일 15~37)
  - 상세: CLAUDE.md 워크플로상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep`, 구현 완료 후 `/ai-review` + Critical/Warning fix(`RESOLUTION.md`)가 상시 승인된 강제 단계다. 이 23개 파일은 그 의무 게이트의 정규 산출물이며, 코드와 무관한 임의 문서가 아니라 이 PR 착수·완료를 증빙하는 자료다. `review/` 는 gitignore 대상이 아니라는 이 저장소의 기존 관행과도 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.spec.ts` 의 `setParameter`/`returning` mock 체인 확장이 새 테스트 1곳에 그치지 않고 파일 전역 기본 mock·다른 describe 블록까지 퍼져 있음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:76-87`(전역 기본 mock), `:1254`, `:1386`(형제 블록)
  - 상세: 프로덕션 코드(`retry-turn.service.ts`)가 같은 query-builder 체인에 `.returning()` 호출을 추가했기 때문에, 그 메서드가 없는 기존 mock 은 TypeError → try/catch 안에서 조용히 vacuous 해진다(주석이 `#1171` 선례를 명시 인용). 리팩토링이 아니라 프로덕션 변경의 직접적 파급이다.
  - 제안: 조치 불요.

- **[INFO]** RESOLUTION 이 명시한 "8건 조치" 각각이 diff 상 정확히 1:1 대응함(전수 대조)
  - 위치: W3→`execution-engine.service.ts:4903-4929`, W1/W2→`retry-turn.service.spec.ts:1309-1373`, W9→`interaction.service.spec.ts:95-98`+`eia-db-wire-invariant.md:101-105`, W8→`spec/5-system/14-external-interaction-api.md:816-824`(취소선 복원), #4→`spec/5-system/14-external-interaction-api.md:77`, #6→`terminal-duration.ts`(신규 함수)+`retry-turn.service.ts:664-673`, #10→`triggers.mdx`/`.en.mdx`, INFO3→`interaction.service.spec.ts:548-555`(`durationMs: 0`)
  - 상세: RESOLUTION.md 가 주장한 조치 목록과 실제 코드 변경이 어긋나는 곳이 없다. "등재"라고 주장한 2건(중첩 평탄화·QB mock 팩토리)도 실제로 코드 변경 없이 plan "범위 밖" 절에만 남아 있어 주장과 실행이 일치한다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음 (스코프 정합)

- 핵심 코드 3파일(`execution-engine.service.ts`/`retry-turn.service.ts`/`interaction.service.ts`)의 모든 hunk 가 plan 의 ①②③ 중 정확히 하나에 대응한다. drive-by 정리·무관한 리팩토링·포맷팅 전용 diff 는 발견되지 않았다.
- `spec/5-system/14-external-interaction-api.md`·`spec/conventions/node-cancellation.md` 편집은 각각 ③(REST 필드표+응답예시)·②(§6.5 해소, 이번엔 트래커 링크까지 정확히 취소선 보존 — W8 반영 확인)·①(§2.4 매트릭스+Rationale 정정)에 정확히 대응하며 원문 삭제 없이 취소선+정정노트 관행을 따른다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 갱신은 "자매 트래커 동시 갱신" 요구사항에 정확히 대응(체크박스 `[ ]`→`[x]` 전환 + "처방 정정" 노트).
- CHANGELOG.md 신규 항목은 이번 diff 전체(①②③ + 수신자 영향)를 정확히 요약하며 무관한 항목을 추가하지 않았다.
- 사용하지 않는 임포트, 의도치 않은 설정 파일 변경, 포맷팅과 실질 변경이 뒤섞인 hunk는 39개 파일 전체에서 발견되지 않았다.

## 요약

39개 파일·1991(+)/19(-) 전량이 plan `eia-db-wire-invariant.md` 의 ①②③ 세 항목, 직전 `/ai-review`(`13_58_27`) RESOLUTION 이 명시한 8건의 fix, 그리고 이 저장소가 강제하는 착수/완료 게이트 산출물(consistency-check impl-prep, ai-review 전체 산출, RESOLUTION)로 정확히 설명된다. `toPersistedDate` 헬퍼 추출처럼 plan 원 항목에 없던 요소도 직전 라운드 리뷰 피드백에 대한 명시적 opt-in 응답이며 plan 에 근거가 기록돼 있다. 요청 외 기능 확장, 무관한 파일 수정, 불필요한 리팩토링, 포맷팅·주석·임포트의 의미 없는 뒤섞임은 발견되지 않았다.

## 위험도

NONE
