# 유지보수성(Maintainability) Review

## 발견사항

### 파일 3: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 정적 리터럴 목록의 단방향 동기화 한계
  - 위치: `LOCALIZED_ERROR_CODES` 배열 (`describe("i18n Principle 3-C …")` 블록)
  - 상세: 신규 chat-channel 에러 코드 8종이 `LOCALIZED_ERROR_CODES`에 리터럴로 추가되었다. P3-C-2 가드는 "목록에 있는 코드가 `ERROR_KO`에 존재하는지"만 검증하므로, `ERROR_KO`에서 코드를 삭제해도 목록이 stale인 채 조용히 통과한다. 반대로 목록에서만 삭제하면 guard가 실패한다. 이는 기존부터 있던 설계 한계이며 이번 변경이 새로 도입한 것은 아님. 인라인 주석도 충분히 제공되어 의도가 명확하다.
  - 제안: 장기적으로 `Object.keys(ERROR_KO)`의 서브셋으로 도출하거나 전체 키 parity 검사로 개선 검토 (기술 부채, non-blocking).

- **[INFO]** `CHAT_CHANNEL_CODES` 상수 선언 위치 — `describe` 블록 외부
  - 위치: `backend-labels.test.ts` 테스트 케이스 (7)/(8)/(9) 상단 `CHAT_CHANNEL_CODES` 선언
  - 상세: `CHAT_CHANNEL_CODES` 배열이 `describe("translateBackendError …")` 블록 안에 있지만 `it()` 블록 밖 최상위에 선언되어 있어 (7)/(8) 두 테스트가 공유한다. 패턴이 자연스럽고 스코프도 적절하다. (9) 케이스의 `WORKSPACE_ID_REQUIRED`는 이 배열 밖에서 인라인으로 처리되는데, 일관성 측면에서 (9) 검증 코드 방식이 (7)/(8)과 구조적으로 동형이므로 문제 없다.
  - 제안: 이상 없음.

- **[INFO]** 테스트 번호 라벨 (`(7)`, `(8)`, `(9)`) — 파일 내 연속성 확인 필요
  - 위치: `it("(7) ko + chat-channel …")` 등
  - 상세: 기존 테스트가 `(5)`, `(6)` 까지 있었고 이번에 `(7)`, `(8)`, `(9)`가 추가되었다. 번호 순서는 맞으나, 파일 다른 위치에 이미 `(7)` 이상의 번호가 있다면 중복이 된다. 현재 diff만으로는 전체 번호 상태를 확인할 수 없으나, 기존 review SUMMARY(18_01_52) 에서 별도 지적이 없었으므로 순차적으로 이어지는 것으로 판단.
  - 제안: 테스트 번호 라벨이 파일 전체에서 유일한지 확인 권장 (INFO).

### 파일 4: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** 신규 코드 블록이 기존 그룹핑 패턴을 충실히 준수
  - 위치: `ERROR_KO` 객체 신규 항목 (chat-channel 에러 코드 블록)
  - 상세: `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4 실패 응답).` 섹션 주석 + 각 항목별 한국어 메시지 + `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`에 별도 컨텍스트 주석까지 달려 있다. 파일 전체에서 코드 그룹마다 인라인 주석 + spec 참조를 다는 패턴과 완전히 일치한다. 일관성 측면에서 양호하다.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 번역의 범용성 — 잠재적 유지보수 부담
  - 위치: `backend-labels.ts` `TRIGGER_NOT_FOUND` 항목
  - 상세: `"해당 웹훅 엔드포인트를 찾을 수 없어요."` — 에러 코드명(`TRIGGER_NOT_FOUND`)은 트리거 전체 개념이나 번역은 "웹훅 엔드포인트"로 구체화. 영문 SoT(`hooks.service.ts`)가 "Webhook endpoint not found"이므로 번역은 충실하다. 다만 코드가 미래에 다른 트리거 유형에도 사용된다면 번역이 오해를 줄 수 있다. 현재 사용 범위(chat-channel 경로)에서는 문제 없으며 기존 RESOLUTION.md에서도 유지 결정이 기록되었다.
  - 제안: 현재 상태 유지 가능. 향후 코드 재사용 범위 확장 시 번역 재검토 또는 주석으로 사용 범위 명시 권장.

- **[INFO]** `BOT_TOKEN_INVALID`와 `INVALID_BOT_TOKEN` 두 코드의 의미 중복 가능성
  - 위치: `backend-labels.ts` 두 항목 병존
  - 상세: `INVALID_BOT_TOKEN`("봇 토큰이 올바르지 않아요. 새 봇 토큰을 입력해 주세요.")과 `BOT_TOKEN_INVALID`("봇 토큰이 유효하지 않아요 (제공자 인증 401/403). 토큰을 확인해 주세요.")가 별도 키로 존재한다. 두 코드가 각각 다른 에러 경로(전자: 형식 검증 실패, 후자: provider 인증 401/403)에서 발생함이 주석으로 명시되어 있어 구분이 명확하다. 다만 신규 유지보수자가 두 코드의 차이를 파악하려면 spec 또는 throw-site를 확인해야 한다.
  - 제안: 현재 주석 수준으로 충분. 향후 두 코드의 발생 경로 차이를 `ERROR_KO` 항목 위 주석에 한 줄로 요약하는 것을 검토 (선택적).

### 파일 1·2: triggers.mdx / triggers.en.mdx

- **[INFO]** KO·EN 문서 동기화 — 이번 변경에서 EN도 함께 갱신됨
  - 위치: `triggers.en.mdx` Callout, `triggers.mdx` Callout
  - 상세: 이전 review(18_01_52) Warning#3으로 지적된 EN 문서 stale 상태가 이번 변경 세트에서 수정되었다. "Some codes may currently appear in English in the UI." → "All codes are shown as localized Korean messages when the interface language is set to Korean." 으로 갱신되어 KO 문서와 내용 일치. 유지보수 관점에서 KO·EN 두 문서를 함께 수정하는 패턴이 이번에 확립되었다.
  - 제안: 이상 없음. 향후 동일 callout 수정 시 두 파일을 함께 수정하는 관례를 유지.

- **[INFO]** `WORKSPACE_ID_REQUIRED`가 callout 목록에 없음 — 의도적 생략 여부 불명확
  - 위치: `triggers.mdx` 및 `triggers.en.mdx` Chat Channel error code callout
  - 상세: `WORKSPACE_ID_REQUIRED`는 공용 `@WorkspaceId()` 데코레이터 코드로, chat-channel 경로에서도 노출될 수 있으나 callout 목록에는 없다. `backend-labels.test.ts`에 추가된 주석("공용 @WorkspaceId() 데코레이터 코드")과 `LOCALIZED_ERROR_CODES` 포함이 문서 목록 미포함의 배경을 설명하지 않으므로 독자가 혼동할 수 있다.
  - 제안: callout에서 의도적으로 제외하는 경우 HTML 주석 또는 관련 문서에 근거를 남기거나, 포함이 맞다면 추가 검토.

### 파일 7: plan/in-progress/spec-sync-chat-channel-gaps.md

- **[INFO]** `worktree: (unstarted)` — 비표준 값의 기계 파싱 부담
  - 위치: `spec-sync-chat-channel-gaps.md` frontmatter `worktree` 필드
  - 상세: `worktree` 필드가 실제 worktree 디렉토리명을 가리키는 용도라면 `(unstarted)` 는 의미적으로 명확하지만 기계 파싱 시 예외 처리가 필요하다. 빈 문자열(`""`) 또는 `null`이 더 관례적이다. 단, 프로젝트 내에서 `(unstarted)` 표기가 규약으로 정의되어 있다면 변경 불필요.
  - 제안: `plan-lifecycle.md`에 미착수 상태 표기 방식을 정의하고 일관되게 사용.

## 요약

이번 변경은 chat-channel 에러 코드 i18n 매핑 추가(backend-labels.ts), parity guard 및 translateBackendError 단위 테스트 확장(backend-labels.test.ts), KO·EN 문서 현행화(triggers.mdx / triggers.en.mdx), 그리고 plan 파일 상태 정정으로 구성된다. TypeScript 코드 변경은 기존 파일의 네이밍·그룹핑·주석 패턴을 충실히 따르고 있어 코드베이스 일관성이 유지된다. `LOCALIZED_ERROR_CODES`의 단방향 동기화 한계는 기존부터 있던 설계 제약이며 이번 변경이 악화시키지 않았다. 발견된 모든 항목은 INFO 등급이며 즉각 수정이 필요한 구조적·가독성 위험은 없다.

## 위험도

NONE

STATUS: SUCCESS
