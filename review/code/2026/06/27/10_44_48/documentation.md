### 발견사항

- **[WARNING]** CHANGELOG.md 에 이번 버그픽스 항목 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/CHANGELOG.md`
  - 상세: 리포지토리 루트에 `CHANGELOG.md` 가 존재하며, 보안 취약점 수정·submit_form 검증 등 기능/버그픽스가 모두 "Unreleased" 섹션으로 기록되는 패턴을 따른다. 이번 변경(임베드 위젯 auto-boot 누락 — `arguments` 객체 replay 버그)은 고객 사이트에서 위젯 버튼이 아예 노출되지 않는 사용자 가시적 버그이며, #709·#713과 함께 배포돼야 완전 복구된다는 점에서 CHANGELOG 기록 대상이다. 현재 누락.
  - 제안: `## Unreleased — 웹채팅 로더 명령 큐 arguments-replay 버그 수정` 항목을 추가하고, `Array.isArray` 가드가 `arguments` 객체를 버려 auto-boot 가 무증상 누락되던 문제 해소, 회귀 테스트 추가 사실을 1–2줄로 기술한다.

- **[INFO]** `GlobalCall` / `GlobalApi` 익스포트 타입에 JSDoc 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` line 7, 15
  - 상세: `GlobalCall = [method: string, ...args: unknown[]]` 는 TypeScript tuple 로 선언돼 있으나, 런타임에서 큐 항목은 실제로 `arguments` 객체(array-like)일 수 있다는 사실이 타입 정의 자체에 전혀 문서화되어 있지 않다. `GlobalApi` 역시 JSDoc 없이 선언만 존재한다. 이번 변경으로 이 타입 불일치가 핵심 원인이었던 만큼, 해당 타입에 주의 사항을 남기면 향후 동일 버그 재발을 예방할 수 있다.
  - 제안: `GlobalCall` 에 "큐 항목의 런타임 형태는 스텁이 `push(arguments)` 하므로 진짜 Array 가 아닌 array-like일 수 있다. `Array.isArray` 대신 `length` 기반 guard 후 `Array.prototype.slice.call` 로 정규화할 것." 주석 추가. `GlobalApi` 에도 "전역 진입점 함수 시그니처" 한 줄 JSDoc 추가.

- **[INFO]** README 큐 설명이 이번 픽스 동작을 암묵적으로 기술하나 `arguments` 호환성 언급 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/README.md` line 52
  - 상세: "스니펫 큐: 로더가 비동기 로드되는 동안 `ClemvionChat(...)` 호출은 `ClemvionChat.q` 에 버퍼링됐다가 로드 완료 시 순서대로 replay 된다." — 기능 설명은 여전히 정확하며 사용자에게 노출할 필요는 없다. 그러나 스니펫을 직접 작성·유지하는 통합 개발자나 SDK 기여자를 위해 `arguments` 객체 호환성 보장이 설계상 의도적임을 언급하면 문서와 구현 사이의 의도적 선택임을 명확히 할 수 있다.
  - 제안: 필수는 아니나, README 또는 `loader.ts` 모듈 레벨 주석에 "스텁은 `push(arguments)` 패턴이므로 큐 항목은 array-like — 로더는 이를 정규화해 replay함" 한 줄 추가 고려.

- **[INFO]** 테스트 파일 인라인 주석 품질은 우수 — 추가 조치 불필요
  - 위치: `codebase/packages/web-chat-sdk/src/loader.spec.ts` line 200–217
  - 상세: 신규 회귀 테스트는 버그 재현 조건, 구 코드가 왜 이를 잡지 못했는지(rest 파라미터 vs `arguments`), 실패 시 증상(boot 건너뜀→`[]`) 을 인라인 주석으로 상세히 설명한다. 테스트 이름도 PR 번호(#709)를 포함해 맥락 추적이 용이하다.

- **[INFO]** plan/complete 문서 구조는 양호 — 스펙 영향 없음(`spec_impact: []`) 확인됨
  - 위치: `plan/complete/web-chat-loader-queue-replay-arguments.md`
  - 상세: 배경·root cause·수정 내용·검증·관계 섹션이 완비됐으며, spec `2-sdk §1·R5` 를 이미 지정 계약으로 인용하고 스펙 변경이 불필요함을 명시한다. 올바른 분류.

### 요약

이번 변경은 순수 구현 버그 수정(arguments-replay)으로, 스펙·README·API 엔드포인트 문서는 갱신이 불필요하다. 새로 추가된 인라인 주석과 회귀 테스트 주석은 버그의 원인·수정 의도를 충분히 설명하며, plan 문서도 체계적으로 작성됐다. 다만 리포지토리 CHANGELOG.md 에 기록 패턴이 있음에도 이번 사용자 가시적 버그픽스가 누락된 점이 가장 큰 문서화 갭이며, 익스포트된 `GlobalCall` 타입에 array-like 런타임 특성 주석이 없어 동일 원인 재발 가능성이 남는다.

### 위험도

LOW
