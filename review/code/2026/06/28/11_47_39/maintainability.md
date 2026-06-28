# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `createWebChatCorsDelegate` describe 블록 내 로컬 `defaultOptions` 픽스처와 신규 테스트의 `buildDefaultCorsOptions` 팩토리 주입 방식이 혼재
  - 위치: `web-chat-cors.spec.ts` lines 197-200, 284-297
  - 상세: 기존 6개 테스트는 `credentials: true`만 담긴 단순 스텁을 사용하고, 신규 '비-웹채팅 경로 → exposedHeaders 전파' 테스트만 실 팩토리를 주입한다. 의도는 명확하나(다른 테스트는 exposedHeaders 에 무관), 미래 유지자는 왜 두 가지 패턴이 공존하는지 처음에는 혼란스러울 수 있다. 로컬 스텁 위에 짧은 주석(`// 이 suite 의 다른 테스트는 exposedHeaders 와 무관해 최소 스텁 사용`)을 추가하면 의도가 자명해진다.
  - 제안: `const defaultOptions` 스텁 선언부에 1줄 주석 추가로 혼재 이유 명시.

- **[INFO]** `buildDefaultCorsOptions` 의 JSDoc 에 SoT spec 경로(`spec/5-system/17-agent-memory §6 AGM-13`)가 기재되어 있으나, 소스 파일 내 동일 정보가 `CorsOptionsLike.exposedHeaders` 필드 JSDoc 에도 중복 존재
  - 위치: `web-chat-cors.ts` lines 416-421, 371-382
  - 상세: 두 곳 모두 `X-Deleted-Count` 배경 설명을 각자 서술한다. 현재는 서로 일관적이지만, 향후 헤더 이름 변경 시 한 곳만 수정해 불일치가 생길 수 있는 미세한 중복이다. 치명적이지는 않으나 단일 출처 원칙에 반한다.
  - 제안: `CorsOptionsLike.exposedHeaders` JSDoc 을 유지하되 `buildDefaultCorsOptions` JSDoc 에서 exposedHeaders 배경 설명 중복 부분을 `// SoT: CorsOptionsLike.exposedHeaders JSDoc 참고` 식으로 참조로 대체.

- **[INFO]** `main.ts` 인라인 주석(`// 비-웹채팅 경로 옵션은 순수 팩토리로 추출(W3) — exposedHeaders(X-Deleted-Count) 회귀가 web-chat-cors.spec 단위 테스트로 실제 보호된다.`)이 코드 변경 배경을 설명하는 '커밋 메시지형' 주석
  - 위치: `main.ts` lines 790-792
  - 상세: 해당 주석은 "왜 팩토리로 바꿨는지" 를 설명하는 이력성 주석이다. 미래 독자에게 유용하지만 "팩토리 이름 자체(`buildDefaultCorsOptions`)가 이미 의도를 전달"하므로 주석 없이도 읽힌다. 반면 `// W3` 태그 같은 내부 추적 참조는 맥락 없이는 불투명하다.
  - 제안: `// (W3)` 같은 내부 티켓 태그는 제거하거나 spec 링크(`spec/5-system/17-agent-memory §6`)로 대체. 나머지 설명은 유지해도 무방.

## 요약

이번 변경은 `buildDefaultCorsOptions` 순수 팩토리 추출을 통해 인라인 부트스트랩 정의의 테스트 불가 문제를 해소하고, 실 팩토리를 직접 검증하는 테스트로 동어반복 테스트를 교체한 유지보수성 개선 리팩터링이다. 코드 구조, 네이밍, 함수 길이, 중첩 깊이 모두 양호하다. 발견된 항목 세 가지는 모두 INFO 수준의 문서/주석 개선 제안으로, 기능·회귀·컨벤션 위반은 없다. 전반적으로 유지보수성이 향상된 변경이다.

## 위험도

NONE
