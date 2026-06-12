# 유지보수성(Maintainability) Review

## 발견사항

### 파일 3: backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 배열이 정적 리터럴 목록으로 하드코딩되어 `ERROR_KO` 와 수동 동기화만 유지된다.
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열 (`describe("i18n Principle 3-C …")` 블록)
  - 상세: 코드를 추가할 때 `LOCALIZED_ERROR_CODES` 도 함께 갱신해야 하지만, stale entry(삭제 누락) 는 가드가 탐지하지 못한다. P3-C-2 는 "배열에 있는 코드가 `ERROR_KO` 에 존재하는지"만 검증하므로, `ERROR_KO` 에서 코드를 제거해도 배열이 그대로이면 통과한다. 이는 기존 패턴의 의도된 한계이며 이번 변경이 도입한 문제는 아님.
  - 제안: 장기적으로 `Object.keys(ERROR_KO)` 기반 파생 또는 전체 키 parity 검사로 개선 검토.

- **[INFO]** 신규 추가된 `CHAT_CHANNEL_CODES` 상수가 `describe("translateBackendError …")` 블록 상단에 선언되어 두 개의 it 테스트((7)(8))에서 공유된다. 중복 리터럴 없이 상수로 추출한 패턴은 기존 코드베이스 스타일과 일관된다.

### 파일 4: backend-labels.ts

- **[INFO]** `TRIGGER_NOT_FOUND` 한국어 메시지 "해당 웹훅 엔드포인트를 찾을 수 없어요." 는 에러 코드명이 트리거 개념 전체를 가리키는 반면 번역이 "웹훅 엔드포인트"로 구체화되어 있어, 미래에 동일 코드가 비-웹훅 경로에서 재사용될 경우 번역이 문맥과 어긋날 수 있다.
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `TRIGGER_NOT_FOUND` 엔트리
  - 상세: 현재 사용 범위(chat-channel 어댑터 + hooks 경로)에서는 기능상 문제없다. 주석에 사용 범위가 명시되지 않아 차후 유지보수자가 재사용 여부를 파악하기 어렵다.
  - 제안: "해당 트리거를 찾을 수 없어요." 처럼 더 중립적 표현으로 변경하거나, 코드 옆에 `// chat-channel + hooks 경로 공용` 한 줄 주석으로 사용 범위를 명시.

- **[INFO]** 신규 5종 엔트리가 기존 그룹(CODE_ERROR, CODE_MEMORY_LIMIT 바로 아래)에 섹션 주석과 함께 삽입되어 파일 내 그룹-주석 패턴을 일관되게 따른다. 네이밍·들여쓰기·줄 정렬 모두 기존 스타일과 일치한다.

### 파일 7: spec-sync-chat-channel-gaps.md

- **[INFO]** `worktree: (unstarted)` 값은 의미상 명확하지만 비표준 sentinel 이다. worktree 필드가 실제 디렉토리명을 가리키는 규약이라면 `(unstarted)` 는 기계 파싱 시 예외 처리가 필요하다.
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter `worktree` 필드
  - 상세: plan-lifecycle 규약에서 `(unstarted)` 를 sentinel 로 정의하고 있어 규약 준수이나, 새 코드가 이 값을 파싱할 경우 별도 분기가 필요하다.
  - 제안: plan-lifecycle 스키마 문서에 허용 sentinel 값 목록을 명시적으로 기록하여 파서 구현 가이드 제공.

### 파일 1, 2 (MDX / 계획 문서)

- **[INFO]** `triggers.en.mdx` 와 `triggers.mdx` 의 callout 문구를 동시에 갱신하여 KO/EN 문서 간 parity 가 복원되었다. 향후 유사한 KO/EN 쌍 파일 변경 시 동반 갱신 여부를 체크리스트로 강제하는 패턴이 있다면 stale EN 재발 방지에 도움이 된다.

## 요약

이번 변경은 chat-channel 에러 코드 5종의 i18n 매핑 추가(`backend-labels.ts`), parity 가드 및 직접 단위 테스트 보강(`backend-labels.test.ts`), KO/EN 문서 현행화(`triggers.mdx` / `triggers.en.mdx`), plan 파일 frontmatter 정정으로 구성된다. TypeScript 코드는 기존 네이밍·그룹핑·주석 패턴을 충실히 따르고 있어 일관성이 높다. 유일하게 주의가 필요한 항목은 `TRIGGER_NOT_FOUND` 번역이 "웹훅 엔드포인트"로 지나치게 구체화되어 재사용 시 오해 가능성이 있다는 점이나, 현재 사용 범위에서는 기능 결함이 없다. `LOCALIZED_ERROR_CODES` 배열의 수동 동기화 한계는 기존 패턴의 의도된 제약으로 이번 변경이 악화시킨 것이 아니다. 전체적으로 구조적·가독성 위험은 없으며 발견사항은 모두 INFO 수준이다.

## 위험도

NONE

STATUS: SUCCESS
