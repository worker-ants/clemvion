# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 문서 스니펫과 코드 생성 스니펫 간 포맷 불일치
- 위치: `snippet.ts` buildWebChatSnippet 반환값 vs MDX 4개 파일 예시
- 상세: `snippet.ts`가 생성하는 스니펫은 `j.async=1;j.src=...;d.head.appendChild(j);`를 한 줄로 이어 쓰는 반면, MDX 예시 코드는 `j.async=1;` / `j.src=...;` / `d.head.appendChild(j);`를 각각 별도 줄로 분리한다. 사용자가 콘솔에서 복사한 실제 스니펫과 문서 예시의 형식이 다르므로, 미래에 스니펫 형식을 변경할 때 두 곳 모두 수정해야 한다는 것을 알기 어렵다.
- 제안: `snippet.ts` 생성 로직을 단일 진실 소스(SoT)로 삼고, MDX 예시를 실제 출력과 동일한 포맷으로 맞추거나, 혹은 `snippet.ts`의 배열 조인 방식을 MDX 예시와 동일한 줄 구분으로 통일한다.

### [INFO] `buildWebChatSnippet` 내부 배열 조인 — 생성 포맷의 가독성
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` (함수 반환부)
- 상세: `return [...]join("\n")`에서 첫 줄 `<script>(function(d,s){`와 그 다음 줄 `  window.ClemvionChat=...`이 배열 항목으로 분리돼 있으나, 마지막 JS 구문 줄(`  var j=...;j.async=1;j.src=...;d.head.appendChild(j);`)은 세 문장이 한 줄로 연결돼 있다. 줄 분리 기준이 일관되지 않아 스니펫 형식 수정 시 어느 배열 항목을 고쳐야 하는지 직관적이지 않다.
- 제안: 배열 항목 분리 기준을 "논리적 문장 단위" 또는 "들여쓰기 단위" 중 하나로 통일한다. 예를 들어 `var j`, `j.async`, `j.src`, `d.head.appendChild`를 각각 별도 항목으로 분리하거나, 반대로 현재 MDX 예시처럼 기능 블록 단위로 묶는다.

### [INFO] 테스트의 `stubIdx` 검색 대상이 큐 스텁 전체 표현식의 중간 토큰
- 위치: `codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts` (1104번 줄)
- 상세: `snippet.indexOf("window.ClemvionChat.q")`는 `window.ClemvionChat.q=window.ClemvionChat.q||[]`의 내부 `.q=` 부분에도 매칭된다. 스텁의 시작 위치보다 스텁 내부 `.q` 참조가 먼저 나올 수 있어, 이 테스트는 스텁 설치 위치가 아닌 `.q` 토큰의 첫 출현 위치를 검사하게 된다. 현재 구현에서는 두 검색 문자열이 같은 라인에 존재하므로 오진 없이 통과하지만, 스텁 형식이 바뀔 경우 테스트 의도와 실제 검사 지점이 달라질 수 있다.
- 제안: `snippet.indexOf("window.ClemvionChat=window.ClemvionChat||function()")` (스텁 선언의 시작)을 stubIdx로 사용해 의도를 명확히 한다.

### [INFO] 큐 스텁 리터럴이 여러 파일에 복사 형태로 존재
- 위치: `snippet.ts` 코드 생성부, `spec/7-channel-web-chat/2-sdk.md`, `web-chat.mdx`, `web-chat.en.mdx`, `web-chat-sdk.mdx`, `web-chat-sdk.en.mdx`
- 상세: 동일한 큐 스텁 한 줄(`window.ClemvionChat=window.ClemvionChat||function(){...}`)이 6곳에 문자 그대로 복사돼 있다. 이번 PR이 바로 이 drift를 수정한 것이지만, 스텁 형식이 미래에 변경되면 다시 6곳을 각각 수동으로 수정해야 한다.
- 제안: 스텁 한 줄 자체는 외부 사이트에 그대로 노출되는 스니펫의 일부이므로 완전한 추상화는 어렵다. 최소한 `snippet.ts`에 명명된 상수(`QUEUE_STUB_JS`)를 추출해 테스트에서도 그 상수를 직접 참조함으로써 소스 변경 시 테스트가 자동으로 연동되게 한다. MDX 예시와의 동기화 절차는 코드 주석 또는 기여 가이드 수준에서 명문화하는 것을 검토한다.

## 요약

이번 변경은 실제 버그(ReferenceError)를 정확히 진단하고 코드·spec·문서를 일괄 수정한 점에서 범위 선정과 커밋 메시지 품질이 우수하다. `buildWebChatSnippet`의 JSDoc 보강과 테스트 추가도 유지보수성을 높이는 방향이다. 다만, 동일 스텁 리터럴이 6개 파일에 복사 형태로 존재하는 구조는 향후 drift 재발 위험을 완전히 제거하지 못하며, `snippet.ts` 생성 포맷과 MDX 예시 포맷의 불일치, 테스트에서 검색 토큰이 스텁 시작점보다 내부 토큰을 가리키는 세부 사항은 가독성·유지보수성 관점에서 개선 여지가 있다. 전반적으로 즉시 차단이 필요한 항목은 없다.

## 위험도

LOW
