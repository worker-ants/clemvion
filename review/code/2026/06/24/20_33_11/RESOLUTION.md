# RESOLUTION — 20_33_11

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 (USER_GUIDE_SYNC) | 코드·문서 | 0d8aee2e | web-chat.mdx/en.mdx §6 인스턴스 관리 절 추가 + WebChatRenameDialog·TriggerHistoryDialog·TriggerDeleteDialog 대응 `<ImplAnchor kind="ui-entry">` 3건 등록 (KO/EN parity) |
| W2 (ARCHITECTURE) | dismiss | — | TriggerDeleteDialog JSDoc 이 이미 캐시 무효화 책임을 명시하고 onDeleted 콜백 패턴이 도입되어 단기 수용. 추가 코드 변경 없음. |
| W3 (REQUIREMENT) | 코드 | 0d8aee2e | useUpdateWebChatMeta JSDoc 에 "onError 미처리 — PATCH 실패 시 서버 미변경이므로 stale 아님, useUpdateWebChatAppearance 와 동일 패턴" 근거 명시 |
| I-9 (MAINTAINABILITY) | 코드 | 0d8aee2e | `function Inner` → `WebChatRenameDialogInner` 네이밍 통일 (TriggerDeleteDialog.DialogInner 패턴 일관성) |
| I-10 (MAINTAINABILITY) | 코드 | 0d8aee2e | key 계산부에 "open=false→true 전환 시에도 state 초기화를 위해 open 포함" 주석 추가 |
| I-11 (TESTING) | 코드 | 0d8aee2e | useUpdateWebChatMeta describe 블록에 PATCH reject 경로 테스트 케이스 추가 (useUpdateWebChatAppearance 와 대칭) |
| I-16 (DOCUMENTATION) | 코드 | 0d8aee2e | use-web-chat.test.ts 파일 상단 주석에 useUpdateWebChatMeta 반영 |

## TEST 결과

- lint  : 통과 (41s)
- unit  : 통과 (use-web-chat.test.ts 11/11 — 신규 reject 케이스 포함. web-chat-page.test.tsx 7건 사전 존재 실패 — 본 commit 무관, stash 비교로 확인)
- e2e   : 통과 (214/214, 88s)

## 보류·후속 항목

- **W2 장기 백로그**: TriggerDeleteDialog 내부 `invalidateQueries(["triggers"])` 제거 — 캐시 무효화 책임을 `onDeleted` 콜백에 완전 위임. 트리거 도메인 전체 리팩터링 시 묶어 처리 권장.
- **INFO #1** (REQUIREMENT): WebChatRenameDialog 이름 최대 120자 클라이언트 검증 누락. 서버 측에서 차단하므로 UX 개선 항목으로 defer.
- **INFO #2** (REQUIREMENT): useUpdateWebChatMeta `AtLeastOne<T>` 유틸리티 타입. 현 호출자 항상 하나 이상 전달하므로 defer.
- **INFO #3** (REQUIREMENT): page.tsx `type: "webhook"` 하드코딩. WebChatInstance 타입에 상수 필드 추가 — 후속 refactor 시 처리.
- **INFO #4,5** (ARCHITECTURE): WebChatDetail 단일 책임 집중, useQueryClient 직접 참조. 다음 기능 추가 시 분리 권장.
- **INFO #6** (ARCHITECTURE): useUpdateWebChatAppearance enabled 하드코딩. 훅 컨텍스트 한정 사용으로 수용.
- **INFO #7** (MAINTAINABILITY): invalidateWebChatCaches 헬퍼 추출 — 3중 중복 패턴. 다음 mutation 추가 시 적용 권장.
- **INFO #8** (MAINTAINABILITY): useMutation 에러 타입 unknown. 프로젝트 전체 에러 전략 통일 시 처리.
- **INFO #12** (TESTING): web-chat-page.test.tsx toggleActive·beforeunload·needsOnboarding·lastTriggeredAt 테스트 — 사전 존재 실패 7건 포함. 별도 follow-up.
- **INFO #13** (TESTING): WebChatRenameDialog Enter 키 submit 경로 테스트 미추가 — defer.
- **INFO #14** (DOCUMENTATION): WebChatDetail·WebChatPage 함수 레벨 JSDoc 누락 — defer.
- **INFO #15** (DOCUMENTATION): use-web-chat.ts 모듈 JSDoc useUpdateWebChatMeta 미반영 — defer.
- **INFO #17** (SECURITY): 백엔드 PATCH/DELETE 인가 검증 여부 확인 권장 — 별도 확인 필요.
- **INFO #18** (SECURITY): Input maxLength 미설정 — UX 개선 항목 defer.
- **INFO #19** (API_CONTRACT): PATCH 에러 상태코드 미분기 — 향후 서버 422 도입 시 처리.
- **INFO #20** (API_CONTRACT): limit=100 하드코딩 — 인스턴스 수 증가 예상 시 페이지네이션 계획 수립.
