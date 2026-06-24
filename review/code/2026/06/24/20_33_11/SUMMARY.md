# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 요구사항이 spec 과 line-level 로 일치하고 Critical 결함은 없음. 유저 가이드 미갱신(WARNING) 및 일부 방어 코드·유지보수성 개선 권고(WARNING 2건)가 존재하나, 릴리스 블로커 수준은 아니다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | USER_GUIDE_SYNC | 웹채팅 관리 기능(이름 변경·삭제·활성화·비활성화·호출 이력·목록 메타) 추가에도 `web-chat.mdx`/`web-chat.en.mdx` 에 § 6. 인스턴스 관리 절이 전혀 없음. `<ImplAnchor kind="ui-entry">` 미등록으로 impl-anchor-existence 가드 실패 위험 | `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`, `web-chat.en.mdx` | KO/EN 양쪽에 §6 인스턴스 관리 절 추가 + `WebChatRenameDialog`, `TriggerDeleteDialog`, `TriggerHistoryDialog` 대응 `<ImplAnchor>` 등록. 비활성 배지·lastTriggeredAt 도 §1 또는 §6 에서 언급 |
| 2 | ARCHITECTURE | `TriggerDeleteDialog` 내부에서 `["triggers"]` 를 직접 무효화하면서 동시에 `onDeleted` 콜백에 추가 무효화를 위임 — 컴포넌트가 캐시 키를 알고 있는 leaky abstraction. 다른 도메인 재사용 시 광역 refetch 유발 가능 | `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` `DialogInner` onSuccess/onError | 장기: 캐시 무효화 책임을 `onDeleted` 콜백에 완전 위임하고 컴포넌트 내부 `invalidateQueries` 제거. 단기: 현재 JSDoc 명시 수준으로 수용 가능 |
| 3 | REQUIREMENT | `useUpdateWebChatMeta` onError 핸들러 부재 — 네트워크 에러로 응답 수신 실패 시 `onSuccess`의 `invalidateQueries` 미실행, 목록이 stale 상태로 잔류 가능 | `codebase/frontend/src/components/web-chat/use-web-chat.ts` `useUpdateWebChatMeta` | `onError` 에서도 `WEB_CHAT_INSTANCES_KEY` invalidate 수행 또는 현재 패턴이 의도적임을 JSDoc 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `WebChatRenameDialog` 이름 최대 길이(spec §2.3.1 "1~120자") 클라이언트 검증 누락 — 빈 이름 가드만 존재, 120자 초과 시 서버 왕복 후 에러 | `web-chat-rename-dialog.tsx` `trimmed.length` 검사 | `trimmed.length > 120` 시 저장 버튼 비활성 + 인라인 힌트 추가 |
| 2 | REQUIREMENT | `useUpdateWebChatMeta` 빈 바디 엣지 케이스 — `name`·`isActive` 모두 `undefined` 전달 시 `{}` PATCH 전송 가능. 현재 호출자는 항상 하나 이상 전달하나 타입 레벨 방어 없음 | `use-web-chat.ts` `useUpdateWebChatMeta` mutationFn | `AtLeastOne<T>` 유틸리티 타입 적용 또는 JSDoc "최소 하나 이상 필수" 명시 |
| 3 | REQUIREMENT | `page.tsx` `setDeleteTarget` 에서 `type: "webhook"` 하드코딩 — `WebChatInstance` 인터페이스에 `type` 필드 없어 타입 안전성 부재. 향후 다른 trigger type 노출 시 오표시 위험 | `page.tsx` line ~277 `type: "webhook"` | `WebChatInstance` 에 `type: "webhook"` 상수 필드 추가 또는 JSDoc 근거 명시 |
| 4 | ARCHITECTURE | `WebChatDetail` 컴포넌트 단일 책임 과부하 — 외형 편집·메타 편집·삭제·이력·온보딩·beforeunload·다이얼로그 3개 상태를 하나의 함수(~190줄)에서 수용. 기능 추가 시 비대해짐 | `page.tsx` `WebChatDetail` 함수 | 다이얼로그 렌더 블록을 `WebChatDetailDialogs` 서브컴포넌트로, 핸들러 로직을 `useWebChatDetailActions` 훅으로 추출 — 다음 기능 추가 시 적용 권장 |
| 5 | ARCHITECTURE | `page.tsx` 에서 `useQueryClient` 직접 참조 — 프레젠테이션 레이어가 캐시 인프라·캐시 키 상수를 직접 알게 되는 결합 | `page.tsx` line ~162 `const queryClient = useQueryClient()` | `useWebChatDeleteCallback` 등 소형 훅으로 `invalidateQueries + onDeleted` 조합 캡슐화 |
| 6 | ARCHITECTURE | `useUpdateWebChatAppearance.enabled: true` 하드코딩 — JSDoc 에 "interaction 비활성 인스턴스 silent mutation 위험" 명시되어 있으나 훅이 다른 컨텍스트 재사용 시 계약 위반 조용히 발생 | `use-web-chat.ts` line ~2238 | `enabled` 파라미터 노출 또는 훅 이름을 용도 한정적으로 변경 |
| 7 | MAINTAINABILITY | 세 mutation 훅(`useUpdateWebChatAppearance`, `useUpdateWebChatMeta`, `useCreateWebChat`)이 동일한 `Promise.all([invalidateQueries(WEB_CHAT_INSTANCES_KEY), invalidateQueries(TRIGGERS_KEY)])` 패턴 반복 | `use-web-chat.ts` 각 `onSuccess` 콜백 | `const invalidateWebChatCaches = (qc) => Promise.all([...])` 모듈 수준 헬퍼 추출 |
| 8 | MAINTAINABILITY | `useMutation<unknown, unknown, ...>` 에러 타입 `unknown` — 호출자가 에러 처리 시 타입 정보 없음, `catch {}` 블록 의존 | `use-web-chat.ts` `useUpdateWebChatMeta` 등 | 단기 현 패턴 유지; 중기 프로젝트 전체 에러 타입 전략 통일 시 개선 |
| 9 | MAINTAINABILITY | `function Inner` — `TriggerDeleteDialog`의 `DialogInner` 패턴 대비 네이밍 불일치 | `web-chat-rename-dialog.tsx` `function Inner` | `function WebChatRenameDialogInner` 로 변경해 일관성 확보 |
| 10 | MAINTAINABILITY | `WebChatRenameDialog` key 패턴에 `open` 포함 이유 주석 없음 | `web-chat-rename-dialog.tsx` key 계산부 | `// open=false→true 전환 시에도 state 초기화를 위해 open 포함` 한 줄 주석 추가 |
| 11 | TESTING | `useUpdateWebChatMeta` 실패 경로 테스트 누락 — `useUpdateWebChatAppearance`에는 reject 케이스가 있으나 대칭 미확보 | `use-web-chat.test.ts` `useUpdateWebChatMeta` describe 블록 | `patchMock.mockRejectedValue(new Error("fail"))` 케이스 추가 |
| 12 | TESTING | `page.tsx` `toggleActive`·`beforeunload` 핸들러·`needsOnboarding` 분기·목록 행 `lastTriggeredAt` 분기 렌더 테스트 전무 — 회귀 안전망 없음 | `page.tsx` `WebChatDetail` 내부 | `web-chat-page.test.tsx` 신규 추가 또는 `toggleActive` 독립 훅 분리 후 단위 테스트 |
| 13 | TESTING | `WebChatRenameDialog` Enter 키 submit 경로 미검증 | `web-chat-rename-dialog.test.tsx` | `fireEvent.keyDown(nameInput(), { key: "Enter" })` 케이스 추가 |
| 14 | DOCUMENTATION | `WebChatDetail`·`WebChatPage` 함수 레벨 JSDoc 없음. 파일 내 `CreateWebChatButton`은 주석 있어 스타일 불일치 | `page.tsx` `WebChatDetail` 상단 | `/** 선택된 웹채팅 인스턴스의 외형 편집·관리 패널 */` 수준 주석 추가 |
| 15 | DOCUMENTATION | `use-web-chat.ts` 모듈 JSDoc 에 `useUpdateWebChatMeta` 추가 미반영 | `use-web-chat.ts` 파일 상단 JSDoc | 모듈 JSDoc 에 부분 PATCH 경로(이름·활성 상태, interaction 미변경) 한 줄 언급 추가 |
| 16 | DOCUMENTATION | `use-web-chat.test.ts` 파일 상단 주석이 `// SUMMARY#6 — useUpdateWebChatAppearance` 로 고정, `useUpdateWebChatMeta` 미반영 | `use-web-chat.test.ts` line 1 | `// SUMMARY#6 — useUpdateWebChatAppearance + useUpdateWebChatMeta mutation 단위 테스트` 로 갱신 |
| 17 | SECURITY | `RoleGate minRole="editor"` UI 레이어 가드만 존재 — 백엔드 PATCH/DELETE 인가 검증 동반 여부 미확인 | `page.tsx` RoleGate 래핑 | 백엔드 `/triggers/:id` PATCH·DELETE 에 editor 이상 역할 인가 검사 여부 별도 확인 권장 |
| 18 | SECURITY | `useUpdateWebChatMeta` PATCH body 클라이언트 측 최대 길이 미검증 — 매우 긴 문자열 서버 전송 가능 | `web-chat-rename-dialog.tsx` Input | `<Input maxLength={100} />` 또는 적절한 상한선 추가 |
| 19 | API_CONTRACT | PATCH 에러 응답 상태코드 미분기 — 422(유효성 위반) 등 구체 에러를 사용자에게 전달 불가. DELETE는 404 분기 처리 대비 불일치 | `use-web-chat.ts` `useUpdateWebChatMeta`, `page.tsx` `toggleActive`/`save` | 향후 서버 422 구체 메시지 도입 시 `isAxiosLikeStatus` 패턴 재사용해 분기 처리 고려 |
| 20 | API_CONTRACT | `limit=100` 하드코딩 — 인스턴스 100개 초과 시 목록 잘림 | `use-web-chat.ts` `MAX_LIST_LIMIT = 100` | 인스턴스 수 증가 예상 시 커서 기반 무한 스크롤 또는 페이지네이션 UI 도입 계획 수립 |

---

## 참고 (INFO) — 발견 없음 / 정상 확인

- **동시성**: `beforeunload` 핸들러 등록·cleanup 정상. `isPending` 기반 중복 제출 방어 올바름. `Promise.all` 병렬 캐시 무효화 데드락 없음.
- **scope**: 커밋 메시지 P0~P2 전체 범위에 정확히 대응. 불필요한 리팩터링·무관 변경 없음.
- **spec fidelity**: 이름 변경·활성 토글·삭제·호출 이력·비활성 배지·lastTriggeredAt·beforeunload·온보딩 배너 모두 spec §2.1·§7과 line-level 일치.
- **i18n parity**: KO/EN `webChat.ts` 키 집합 차이 없음.
- **하위 호환성**: `TriggerDeleteDialog.onDeleted` optional prop — 기존 호출자 breaking change 없음.

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | RoleGate UI 레이어 가드만 존재(서버 인가 미확인), 이름 길이 검증 누락. XSS·시크릿 노출 없음 |
| architecture | LOW | TriggerDeleteDialog 이중 캐시 무효화(WARNING), WebChatDetail 책임 집중(INFO) |
| requirement | LOW | onError 핸들러 부재로 stale 가능(WARNING), type 하드코딩 방어 누락(INFO), 이름 최대 길이 검증 누락(INFO) |
| scope | NONE | 변경 범위 정확히 P0~P2 대응, 불필요 변경 없음 |
| side_effect | NONE | beforeunload cleanup 정상, onDeleted 이중 무효화 의도적 설계, 기존 호출자 breaking change 없음 |
| maintainability | LOW | onSuccess 캐시 무효화 패턴 3중 중복, Inner 네이밍 불일치, 에러 타입 unknown |
| testing | LOW | page.tsx 렌더 테스트 전무(toggleActive·beforeunload·needsOnboarding·lastTriggeredAt), useUpdateWebChatMeta 실패 경로 누락 |
| documentation | NONE | 주요 신규 hook·prop JSDoc 적절. 파일 상단 주석·Props 필드 JSDoc 소규모 불일치 |
| concurrency | NONE | 동시성 결함 없음. React 단일 스레드·React Query 표준 패턴 준수 |
| api_contract | LOW | PATCH 에러 상태코드 미분기, limit=100 확장성 제한, lastTriggeredAt 타입 드리프트 확인 필요 |
| user_guide_sync | WARNING | web-chat.mdx/en.mdx 관리 기능 절 미추가, ImplAnchor 미등록 |

---

## 발견 없는 에이전트

- **concurrency**: 동시성 결함 전혀 없음
- **scope**: 범위 이탈 변경 없음
- **side_effect**: 의도치 않은 부작용 없음
- **documentation**: Critical/Warning 발견 없음 (INFO 소규모 불일치만)

---

## 권장 조치사항

1. **(WARNING — 유저 가이드)** `web-chat.mdx`·`web-chat.en.mdx` 에 §6 인스턴스 관리 절 추가(이름 변경·삭제·활성화·호출 이력) + 대응 `<ImplAnchor kind="ui-entry">` 등록. impl-anchor-existence 가드 실패 방지.
2. **(WARNING — 아키텍처)** `TriggerDeleteDialog` 내부 직접 `invalidateQueries` 제거 — 캐시 무효화 책임을 `onDeleted` 콜백에 완전 위임. 트리거 도메인 전체 리팩터링 시 묶어 처리 가능.
3. **(WARNING — 요구사항)** `useUpdateWebChatMeta` `onError` 에 `WEB_CHAT_INSTANCES_KEY` invalidate 추가 또는 의도 JSDoc 명시.
4. **(INFO — 요구사항)** `WebChatRenameDialog` 에 이름 최대 120자 클라이언트 검증 추가(`trimmed.length > 120` 가드 + 인라인 힌트).
5. **(INFO — 테스트)** `web-chat-page.test.tsx` 신규: `toggleActive` 성공/실패, `beforeunload` 등록/해제, `needsOnboarding` 분기, `lastTriggeredAt` 분기 렌더 테스트 추가.
6. **(INFO — 테스트)** `use-web-chat.test.ts` `useUpdateWebChatMeta` describe 에 reject 경로 케이스 추가.
7. **(INFO — 테스트)** `web-chat-rename-dialog.test.tsx` 에 Enter 키 submit 경로 테스트 추가.
8. **(INFO — 유지보수성)** `invalidateWebChatCaches` 헬퍼 함수로 3개 mutation 훅의 `onSuccess` 캐시 무효화 패턴 단일화.
9. **(INFO — 유지보수성)** `function Inner` → `WebChatRenameDialogInner` 네이밍 통일.
10. **(INFO — 문서화)** `use-web-chat.ts` 모듈 JSDoc 갱신 + `use-web-chat.test.ts` 파일 상단 주석 갱신.

---

## 라우터 결정

- **routing_status**: done (라우터가 선별)
- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`, `user_guide_sync` (11명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 3명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 제외 (router skip) |
| dependency | 라우터 제외 (router skip) |
| database | 라우터 제외 (router skip) |