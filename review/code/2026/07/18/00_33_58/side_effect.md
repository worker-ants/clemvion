# 부작용(Side Effect) 리뷰

## 대상 요약

이번 payload 는 (1) 실제 코드 변경 1건 — `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 의 테스트 전용 diff(직전 리뷰 WARNING #1·#2 fix + INFO #11·#12 반영), (2) 나머지 20개 파일은 전부 이전 코드리뷰(`review/code/2026/07/17/23_49_51/**`)·컨시스턴시체크(`review/consistency/2026/07/18/00_22_41/**`) 세션이 산출한 신규 리포트(md/json) 파일이다. 후자는 저장소 관례(`review/code/**`, `review/consistency/**`)가 요구하는 산출물 저장 위치이며 실행 코드가 아니므로 부작용 관점에서 실질적 점검 대상은 (1)뿐이다.

## 발견사항

- **[INFO]** `GUARD_BLOCK_KEY` 도입 — 블록 탐색 키를 하드코딩 리터럴에서 `CONFIG_LOWER_LAYERS[0]` 파생으로 변경
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:26,37`
  - 상세: 모듈 스코프 `const` 로, export 되지 않고 이 테스트 파일 내부에서만 쓰인다. 전역 오염이나 다른 테스트 파일과의 공유 상태 변경 없음. `eslint.config.mjs` 의 `LOWER_LAYERS` 배열 순서가 바뀌면(`["src/types/**", "src/lib/**"]`) 탐색 키가 조용히 달라지는 결합이 생기지만, 이는 기존에도 있던 config↔test 결합(named export `LOWER_LAYERS`)의 연장이며 새로운 부작용 범주는 아니다.
  - 제안: 조치 불필요.

- **[INFO]** fail-open 에러 메시지 텍스트를 `JSON.stringify(CONFIG_LOWER_LAYERS)` 파생으로 변경
  - 위치: `eslint-layering-guard.test.ts:69`
  - 상세: 순수 문자열 조합이며 실행 흐름·리턴 타입·호출자에는 영향 없음. 에러가 발동하는 조건(`Object.keys(mergedRules).length === 0`)도 변경되지 않았다 — 텍스트만 현재 config 형태를 정확히 반영하도록 갱신됨.
  - 제안: 조치 불필요.

- **[INFO]** 신규 `it` 케이스(메시지 `.message` 내용 assertion) 추가 — 기존 `layeringErrors()` 헬퍼 재사용, 신규 부작용 경로 없음
  - 위치: `eslint-layering-guard.test.ts:119-135`
  - 상세: 순수 함수 호출(`layeringErrors(code)` → in-memory `Linter#verify`) 3회 반복일 뿐, 파일시스템/네트워크/환경변수 접근이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 근접 오탐(near-miss) 경계 케이스 2건(`src/types-legacy/**`, `src/libs/**`) + `src/lib/types/` 차단 확인 케이스 1건 추가
  - 위치: `eslint-layering-guard.test.ts:270-272, 278-283`
  - 상세: 기존 `errorsAt()` 헬퍼(실제 `ESLint({ cwd: FRONTEND_ROOT })` 인스턴스의 `lintText`)를 그대로 재사용해 케이스 수만 늘렸다. 이 헬퍼가 디스크에서 config/plugin 을 read-only 로 재로딩하는 부작용은 직전 리뷰(`review/code/2026/07/17/23_49_51/side_effect.md`)에서 이미 INFO 로 확인·문서화된 것과 동일 종류이며, 캐시 옵션 미사용으로 파일 쓰기 부작용은 없다. 케이스 수 증가가 부작용의 "성격"을 바꾸지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 산출물 20개 파일이 신규 생성됨 (`review/code/2026/07/17/23_49_51/**`, `review/consistency/2026/07/18/00_22_41/**`)
  - 위치: 파일 2~21
  - 상세: 전부 이전 세션이 프로토콜대로 생성한 리포트(md)·상태(json) 파일이며, 저장 위치가 CLAUDE.md 의 "정보 저장 위치" 표(`review/code/<...>`, `review/consistency/<...>`)와 정확히 일치한다. 코드 실행 경로에 영향 없는 순수 문서 추가다. 다만 `_retry_state.json`·`meta.json` 내부에 이 worktree 의 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/frontend-layering-types-scope-351061/...`)가 다수 박혀 있어, 이 worktree 가 나중에 정리(삭제)되면 커밋된 문서 안의 경로가 댕글링된다 — 이는 하네스 전반의 기존 관례(세션별 상태 파일에 절대경로 기록)이며 이번 diff 가 새로 도입한 패턴이 아니다.
  - 제안: 조치 불필요(기존 하네스 패턴). 참고용 기록.

CRITICAL/WARNING 급 부작용 없음. 전역 변수 오염, 의도치 않은 상태 변경, 함수/메서드 시그니처 파괴, 공개 인터페이스 breaking change, 환경변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경 — 8개 점검 관점 모두 해당 사항 없음.

## 요약

이번 diff 의 유일한 실제 코드 변경은 `eslint-layering-guard.test.ts` 에 대한 테스트 전용 fix/보강(직전 리뷰 WARNING #1·#2 해소 + INFO #11·#12 반영)으로, 순수 함수 호출과 in-memory/read-only ESLint API 사용만 있을 뿐 전역 상태·파일시스템 쓰기·네트워크·환경변수·시그니처에 영향이 없다. 나머지 20개 파일은 이전 코드리뷰·컨시스턴시체크 세션의 산출물(md/json)로, 관례된 저장 위치에 새 파일을 추가하는 것 외의 부작용이 없다. 신규 도입된 `GUARD_BLOCK_KEY` 상수는 module-scope 로 격리돼 있어 전역 오염이 아니며, config↔test 결합 확대(named export 의존)는 이미 이전 세션에서 의도된 설계로 판정된 사항의 연장선이다.

## 위험도
NONE
