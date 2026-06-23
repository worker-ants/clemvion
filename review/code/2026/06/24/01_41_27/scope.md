# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `spec/` 파일 2건이 `test(web-chat)` 커밋에 동봉됨
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` L37-38, `spec/7-channel-web-chat/4-security.md` L87-98
  - 상세: 커밋 타입은 `test(web-chat)` 이지만, spec 파일 두 곳에 embed-config 갭 보강이 함께 포함됐다. 그러나 커밋 메시지 본문이 이를 명시적으로 설명하고 있고(`spec embed-config 갭 보강(impl-prep W-2)`), `plan/in-progress/web-chat-console.md` 의 `## 미해결/이월` 항목이 해당 갭 해소를 `[x]` 로 추적하고 있다. 본 spec 변경은 기존 미해결 갭을 문서화하는 것이며(신규 동작 추가 없음, 기존 구현 `use-widget.ts`·`embed-config.service` 를 spec 에 소급 기재), 작업과 논리적으로 연결된 범위다.
  - 제안: 허용 범위로 판단하나, spec 변경과 test 추가를 분리 커밋하면 이력 추적이 더 명확해진다. 필수는 아님.

- **[INFO]** `plan/in-progress/web-chat-console.md` 에 `## 추가 e2e (frontend)` 섹션 신설
  - 위치: plan 파일 diff L327-329
  - 상세: 원래 `## 미해결/이월` 섹션 아래에 새 최상위 섹션이 추가됐다. plan 파일 갱신은 개발자가 구현 완료 후 추적 상태를 반영하는 정상 행위(CLAUDE.md: `plan/**` 쓰기 권한 `developer` 허용)이며, e2e 추가 사실을 기록하는 범위 내 변경이다.
  - 제안: 없음.

- **[INFO]** `mockConsole` 에 POST(`/api/triggers`) mock 핸들러 포함
  - 위치: `console.spec.ts` L116-124
  - 상세: 현재 두 테스트 케이스는 모두 POST 경로를 직접 호출하지 않는다(두 번째 테스트는 다이얼로그를 열고 워크플로우 셀렉터 존재만 확인하며 실제 submit 은 하지 않음). POST mock 이 포함된 건 추후 submit 테스트 대비이거나 dialog open 시 백엔드 preflight 가 있을 경우를 대비한 방어적 설정이다. over-engineering 이라기보다 mock stub 수준이며 테스트 격리에 문제를 주지 않는다.
  - 제안: 없음. 단, 향후 submit 케이스를 별도 테스트로 추가할 때 이 mock 이 이미 있음을 확인하면 된다.

## 요약

변경은 두 가지 목적(콘솔 e2e 추가 + embed-config spec 갭 보강)을 단일 커밋에 담았으나, 두 목적 모두 `plan/in-progress/web-chat-console.md` 의 미해결 항목(impl-prep W-2, 추가 e2e)으로 명시된 사전 계획된 작업이다. spec 변경은 신규 기능 추가가 아니라 기존 구현의 소급 문서화이며, 코드·plan·spec 변경이 상호 일관되게 연결돼 있다. 의도 밖의 수정, 불필요한 리팩토링, 무관한 파일 변경, 포맷팅 노이즈, 임포트 변경, 설정 파일 변경은 없다.

## 위험도

NONE
