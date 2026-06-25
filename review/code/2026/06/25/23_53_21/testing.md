# Testing Review — fix(web-chat): command-queue 스텁 추가

## 발견사항

### [INFO] 큐 스텁 존재 검증 테스트 추가 — 적절
- 위치: `codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts` L70–81
- 상세: `snippet.test.ts` 에 두 개의 신규 테스트가 추가됐다. (a) 큐 스텁 문자열(`window.ClemvionChat=...||function()`, `.push(arguments)`) 포함 여부, (b) 스텁 인덱스 < boot 인덱스 순서 보장. 핵심 버그(ReferenceError) 재발 방지를 위한 regression anchor 로서 충분하다.
- 제안: 없음(적절).

### [INFO] `describe` 블록 내 공유 `snippet` 픽스처 재사용 — 격리 적합
- 위치: `snippet.test.ts` L45–50 (`const snippet = buildWebChatSnippet(...)` 상단 선언)
- 상세: `describe("buildWebChatSnippet")` 블록 상단에서 스니펫을 한 번 생성해 모든 `it` 블록이 공유한다. `buildWebChatSnippet` 은 순수 함수(사이드이펙트 없음)이므로 공유 픽스처는 안전하다. XSS 테스트 2개는 별도 로컬 인스턴스를 사용해 격리가 올바르다.
- 제안: 없음.

### [WARNING] 큐 스텁 순서 테스트가 `indexOf` 첫 번째 매치에 의존 — 취약 가능성
- 위치: `snippet.test.ts` L76–81
- 상세: `snippet.indexOf("window.ClemvionChat.q")` 는 해당 문자열이 최초로 등장하는 위치를 반환한다. 현재 구현에서는 스텁이 한 곳(첫 번째 `<script>` 블록)에만 존재하므로 문제 없다. 그러나 향후 스니펫 구조 변경으로 두 블록 모두에 `ClemvionChat.q` 참조가 생기면 순서 검증이 오탐될 수 있다.
- 제안: 두 `<script>` 블록을 구조적으로 분리해 검증하는 방식이 더 견고하다.
  ```ts
  const [loaderBlock, bootBlock] = snippet.split("</script>");
  expect(loaderBlock).toContain("window.ClemvionChat.q");
  expect(bootBlock).toContain("ClemvionChat('boot'");
  ```
  현재 방식도 합격 기준은 충족하지만, 구조 변경 시 false-negative 위험이 잠재한다.

### [INFO] `loaderUrl` XSS 이스케이프 경로 테스트 누락
- 위치: `snippet.test.ts` — 신규 테스트 2개 및 기존 XSS 테스트
- 상세: 기존 XSS 테스트는 boot 설정 값(headerTitle, 라인 구분자)에 대한 이스케이프를 검증하나, `loaderUrl` 자체에 `</script>` 가 주입됐을 때 `escapeForScript` 가 올바르게 작동하는지는 테스트가 없다. `buildWebChatSnippet` 내부에서 `loaderSrc = escapeForScript(loaderUrl)` 로 처리하지만 이 경로는 커버되지 않는다.
- 제안: `loaderUrl` 은 서버 생성 값이고 사용자 입력이 아니므로 현재 위험도는 낮다. 방어적 커버리지 차원에서 별도 케이스 추가를 권장하나 이번 PR 범위 밖으로 처리 가능하다.

### [INFO] `loader.spec.ts` — 큐 스텁 replay 연동 테스트 이미 완비, 변경 없음 적절
- 위치: `codebase/packages/web-chat-sdk/src/loader.spec.ts` L109–175
- 상세: `installGlobal` 의 큐 replay 로직(`loader.ts` L97–107)은 이미 `loader.spec.ts` 에서 충분히 커버됐다. 이번 PR 은 로더를 수정하지 않으므로 loader 측 테스트 추가 불필요. 스텁 시뮬레이션(`stub.q = []`) → replay 순서 → 새 호출 동작까지 검증이 완비돼 있다.
- 제안: 없음.

### [INFO] MDX 문서 파일 4개의 스니펫 예시 동기화가 자동 테스트로 보호되지 않음
- 위치: 파일 1–4 (web-chat.mdx, web-chat.en.mdx, web-chat-sdk.mdx, web-chat-sdk.en.mdx)
- 상세: 문서 파일의 코드 예시 스니펫이 실제 `buildWebChatSnippet` 출력과 동기화됐는지 자동 검증하는 테스트가 없다. 이번 PR 은 수동 동기화로 6곳을 일치시켰으나, 향후 스니펫 구조 변경 시 문서 예시가 다시 drift 할 잠재 위험이 있다.
- 제안: canonical fixture 를 추출해 `buildWebChatSnippet` 출력과 비교하는 snapshot 테스트를 장기적으로 고려할 수 있다. 현 단계에서는 낮은 우선순위이며 WARNING 수준은 아니다.

## 요약

이번 변경의 핵심 수정(`snippet.ts` command-queue 스텁 삽입)에 대한 테스트(`snippet.test.ts`)는 신규 2개 케이스로 적절히 추가됐다 — 스텁 문자열 존재 검증과 순서(스텁 < boot) 검증. 테스트는 독립 실행 가능하고 의도가 명확하며, 기존 XSS 및 구조 검증 테스트와 잘 통합된다. 로더 측(`loader.spec.ts`)은 이미 완비된 큐 replay 테스트를 보유하며 이번 PR 이 로더를 수정하지 않으므로 변경 불필요. 개선 포인트로는 (a) `indexOf` 기반 순서 검증을 구조적 블록 분리(`split("</script>")`) 방식으로 강화하는 것이 향후 스니펫 포맷 변경에 더 견고하며, (b) 문서 파일 4개의 스니펫 예시 동기화는 자동 테스트로 보호되지 않아 재drift 잠재 위험이 남아 있다. 단, 이 두 가지는 현 구현의 안전성을 위협하는 수준이 아니다.

## 위험도

LOW
