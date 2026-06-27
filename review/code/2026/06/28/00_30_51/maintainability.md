# 유지보수성(Maintainability) 리뷰

리뷰 대상: Channel Web Chat sessionStorage 전환 + start() 에러 메시지 일반화 (webchat-session-storage)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] session-store.ts — `getStorage` 파라미터명 `storage?` 가 지역 변수 `s` 와 역할 분리가 모호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-storage-ac439a/codebase/channel-web-chat/src/lib/session-store.ts` — `getStorage` 함수, `saveSession`/`loadSession`/`clearSession`
- 상세: `getStorage(storage?: Storage)` 내부에서 `storage` 가 주입되면 그대로 반환하고 아니면 `sessionStorage` 를 fallback 으로 쓴다. 외부 공개 함수(`saveSession`, `loadSession`, `clearSession`)에서 매개변수 이름도 동일하게 `storage?`로 쓰여, "주입된 storage" 인지 "기본 storage" 인지를 파악하기 위해 `getStorage` 내부를 반드시 읽어야 한다. `injectedStorage` 또는 `storageOverride` 같은 이름이 의도를 더 명확히 전달한다.
- 제안: 공개 API 매개변수 및 `getStorage` 인자 이름을 `storageOverride?: Storage` 로 변경한다. 기능 변경 없이 가독성만 개선된다.

### [INFO] session-store.ts — `KEY_PREFIX` 에 해당하는 키 문자열이 테스트 파일에 리터럴로 중복
- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` line 377 `const KEY_PREFIX = "clemvion-web-chat:session:"` 및 `codebase/channel-web-chat/src/lib/session-store.test.ts` lines 303, 313, 321
- 상세: `session-store.ts` 는 `KEY_PREFIX` 상수로 키 프리픽스를 관리하지만, 테스트 파일에서는 `"clemvion-web-chat:session:trig-1"` 이라는 리터럴 문자열로 세 곳에서 직접 사용한다. `KEY_PREFIX` 가 바뀌면 테스트 파일도 수동으로 모두 수정해야 한다. 이 상수는 `export` 되지 않아 테스트에서 import 가 불가능하다는 제약이 있지만, 테스트 파일 내에서라도 별도 상수(`SESSION_KEY_PREFIX`)로 추출해 세 곳이 동일 소스를 가리키도록 하는 것이 더 유지보수적이다.
- 제안: `KEY_PREFIX` 를 `export const` 로 내보내거나, 테스트 파일 상단에 `const SESSION_KEY_PREFIX = "clemvion-web-chat:session:"` 를 선언하고 세 리터럴을 모두 이 상수로 교체한다.

### [INFO] use-widget-eager-start.test.ts — `NINETY_MIN_MS` 상수 선언 주석 태그(I9)가 외부 추적 맥락 없이 등장
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` line 597
- 상세: `// I9: 토큰 만료 90분(ms) 상수 추출.` 주석의 `I9` 는 plan 파일의 내부 추적 태그로, 코드 파일에 남겨지면 파일 자체만 보는 독자에게는 의미불명의 기호가 된다. 마찬가지로 `// I8:` 태그도 line 595 에 존재한다. 이런 태그는 커밋 메시지나 plan 파일에 두는 것이 적합하다.
- 제안: `I8`, `I9` 태그를 코드 주석에서 제거하거나, 태그 대신 의미를 직접 서술하는 주석으로 교체한다(`// 추가 POST 없음 단언을 위한 대기 시간`, `// 토큰 유효기간 90분(ms) — 테스트 픽스처용`).

### [INFO] use-widget-eager-start.test.ts — C1 테스트 케이스 내 인라인 fetchMock 중복 정의
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` C1 테스트 (lines 776-833)
- 상세: `installFetch` 와 `installControllableSse` 헬퍼 함수가 있음에도 불구하고 C1 테스트 케이스(`"C1: open 직후(booting) submitMessage ..."`) 내부에서 `fetchMock` 과 `EventSource` 를 직접 정의하는 인라인 코드 블록(약 25줄)이 중복된다. 이 패턴은 C1 폐기 테스트에서는 `installControllableSse()` 를 올바르게 사용하고 있어 일관성이 없다.
- 제안: C1 테스트의 인라인 fetch/EventSource 설정을 `installControllableSse()` 또는 별도 헬퍼로 추출해 코드 중복을 제거한다.

### [INFO] use-widget-eager-start.test.ts — W8 테스트의 callCount 변수는 fetchMock 외부 클로저 방식
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` W8 테스트 (lines 884-927)
- 상세: W8 테스트는 `callCount` 변수를 `fetchMock` 클로저 바깥에 선언하고 클로저 내에서 증가시킨다. 기능적으로는 문제없지만, 나머지 테스트들이 `webhookPosts(fetchMock).length` 로 POST 횟수를 확인하는 패턴과 달라 일관성이 깨진다. W8 만 직접 `callCount` 를 추적하는 이유(첫 번째 POST 500 → 두 번째 성공의 분기 제어 때문)가 있지만, 주석이 이를 명시하지 않아 독자가 왜 패턴이 다른지 파악하기 어렵다.
- 제안: W8 내 `fetchMock` 클로저 시작 부분에 왜 `callCount` 방식을 쓰는지 한 줄 주석을 추가한다(`// 첫 번째 호출과 두 번째 호출의 응답을 달리 해야 하므로 callCount 로 분기`).

### [INFO] use-widget.ts — `GENERIC_ERROR_MESSAGE` 상수 선언 위치가 함수 외부 모듈 레벨이나 JSDoc 블록이 다소 길어 가독성 흐름을 끊음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-storage-ac439a/codebase/channel-web-chat/src/widget/use-widget.ts` lines 989-1002
- 상세: `GENERIC_ERROR_MESSAGE` 상수의 JSDoc 주석이 3줄(70+ 자 × 3)로 상수 자체(2줄)보다 길다. 주석의 내용(W1·§5 근거, 보안 목적, 기존 동작 유지)은 모두 중요하지만, 이 맥락은 상수 바로 아래 `errMessage` 함수와 결합해야 완전히 이해된다. 독자가 상수와 함수를 분리된 개체로 읽게 되어 맥락 추적 부담이 있다.
- 제안: 상수 JSDoc 을 한 줄 요약으로 압축하고 상세 근거(W1·§5 인용)는 `errMessage` 함수 내 인라인 주석이나 함수 JSDoc 으로 이동한다. 또는 상수와 함수를 같은 JSDoc 블록(`/** ... */`)으로 통합한다.

### [INFO] system-status.e2e-spec.ts — drift 수정 주석이 PR 맥락을 참조해 파일 자체의 자기설명력 저하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-storage-ac439a/codebase/backend/test/system-status.e2e-spec.ts` lines 86-88
- 상세: 추가된 주석 `// 본 PR(web-chat sessionStorage)과 무관한 pre-existing e2e drift 수정 — 공유 e2e suite green 복구용.` 은 PR 경계 맥락을 파일 내에 하드코딩했다. 파일은 영속적으로 유지되지만 PR 은 머지 후 맥락이 사라진다. 시간이 지나 이 주석을 읽는 독자는 "web-chat sessionStorage" 가 무엇인지, "본 PR" 이 어느 PR 인지 파악할 수 없다.
- 제안: PR 맥락 언급을 제거하고 "WORKSPACE_INVITATIONS_PRUNER_QUEUE 가 등록됐으나 기대 목록에서 누락돼 있었음 — 복구" 처럼 파일 단독으로 의미가 통하는 주석으로 교체한다.

---

## 요약

이번 변경의 핵심 코드(`session-store.ts`, `use-widget.ts errMessage`)는 범위가 작고 의도가 명확하며 단일 책임을 유지한다. `localStorage → sessionStorage` 전환은 함수 1곳의 한 줄 수정으로 깔끔하게 처리됐고, `errMessage` 리팩터링도 상수 추출 + console 위임 패턴으로 가독성이 향상됐다. 다만 테스트 파일에서 `KEY_PREFIX` 리터럴 중복, C1 테스트의 인라인 mock 정의가 헬퍼 패턴과 불일치하는 점, 그리고 `I8`/`I9` 같은 plan 내부 추적 태그가 코드 주석에 잔존하는 점이 장기 유지보수 측면에서 소거할 만한 노이즈다. 시스템 상태 e2e 파일의 PR 맥락 주석도 시간이 지나면 독자에게 불필요한 혼란을 줄 수 있다. 전체적으로 심각한 유지보수성 문제는 없으며 모두 낮은 우선순위의 개선 사항이다.

---

## 위험도

LOW
