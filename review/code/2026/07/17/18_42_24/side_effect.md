# 부작용(Side Effect) 리뷰 — commit 3e84d2109 (isConversationOutput JSDoc 정정)

## 발견사항

- **[INFO]** 순수 문서화 변경 — 런타임 표면 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` L112-138 (`isConversationOutput` 상단 JSDoc 블록), `plan/in-progress/is-conversation-output-restructure.md` (E-3b 각주 커밋 해시 인용)
  - 상세: `git show 3e84d2109bac...`로 실제 diff를 재확인한 결과, `output-shape.ts` 변경은 `isConversationOutput` 함수 상단 JSDoc 블록에만 국한된다. 그 아래 함수 시그니처(`export function isConversationOutput(outputData: unknown): boolean`)와 본문(early-return 2개 + OR-체인 4개: `hasLegacyMessages && (...)` / `hasConvConfig` / `looksLikeConversationEnd` / `isCanonicalWaiting`)은 diff 컨텍스트 라인으로만 나타나며 단 한 글자도 바뀌지 않았다. `unwrapNodeOutput`, `CONVERSATION_END_REASONS`, `extractIeSnapshot`, `extractAiMetadata`, `extractTurnDebug`, `extractRagSources`, `extractRagDiagnostics` 등 동일 파일의 다른 export/함수도 이 커밋에서 전혀 건드리지 않았다. `plan/*.md` 변경도 각주 안의 커밋 해시 인용 하나(`f17fc18dd` → `f0ef4a821`)를 정정한 산문 텍스트일 뿐이며, plan 파일은 애플리케이션 코드가 아니라 작업 추적 문서다. 두 파일 모두 전역 상태·환경 변수·파일시스템 I/O·네트워크 호출·이벤트/콜백·공개 시그니처(export 표면)에 영향을 주는 지점이 없다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** JSDoc 텍스트에 의존하는 자동화 없음 확인
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`, `codebase/frontend/src/lib/conversation/__tests__/interaction-type-registry.test.ts`
  - 상세: 이 저장소에는 소스 파일을 텍스트로 읽어 grep 하는 가드가 실제로 존재한다(plan 문서가 언급하는 `interaction-type-exhaustiveness.test.ts`의 `REGISTRY_SITES` 패턴, `readRepoFile` 기반). 따라서 "이번 주석 변경이 그런 텍스트 기반 가드를 우발적으로 건드릴 수 있는가"를 확인할 필요가 있었다. `isConversationOutput`을 참조하는 두 테스트 파일을 grep한 결과 `readFileSync`/`readRepoFile` 호출이나 옛 JSDoc 문구(`"Handles all four shapes"` 등)에 대한 문자열 assertion이 전혀 없어, 이번 주석 변경이 어떤 테스트 결과도 바꾸지 않는다. 저장소 전체에서 TypeDoc/JSDoc 문서 생성 도구가 `package.json`/CI workflow에 배선돼 있지 않음도 확인했으므로(grep 0건), 문서 자동 생성 파이프라인에 대한 부수효과도 없다. `plan/in-progress/is-conversation-output-restructure.md` 파일 전체에서 정정 전 해시(`f17fc18dd`)의 잔여 인용도 없어(grep 0건) 문서 내부 자기모순도 남지 않았다.
  - 제안: 없음.

- **[INFO]** 리뷰 스코프 밖의 후속 커밋(HEAD) 확인
  - 위치: HEAD(`4374ff5ce`, "chore(plan): mark is-conversation-output-restructure complete")
  - 상세: 현재 브랜치 HEAD는 리뷰 대상 커밋(`3e84d2109`)보다 한 커밋 앞서 있다. 이 후속 커밋은 prompt가 명시한 리뷰 대상 2개 파일에 포함되지 않으므로 본 리뷰의 분석 범위에서 제외했다 (plan lifecycle 이동 성격의 별개 변경).
  - 제안: 없음 — 별도 리뷰 라운드의 대상이면 그쪽에서 다룰 사항.

## 요약

두 파일 모두 실행 코드가 아니라 주석/문서 텍스트만 변경한다. `git show`로 실제 diff를 재검증해 `isConversationOutput`의 함수 시그니처·본문·export 표면이 바이트 단위로 동일함을 확인했고, JSDoc 텍스트를 파싱하는 테스트나 문서 생성 파이프라인이 이 저장소에 없음도 확인했다. 전역 상태, 환경 변수, 파일시스템, 네트워크, 이벤트/콜백, 공개 인터페이스 중 어느 것도 이 변경으로 영향받지 않는다. 부작용 관점에서 이 변경은 검토가 필요한 위험을 전혀 만들지 않는다.

## 위험도

NONE
