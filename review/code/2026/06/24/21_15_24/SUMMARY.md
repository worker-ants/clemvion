# Code Review 통합 보고서

> 세션: 2026-06-24 21:15:24
> 브랜치: claude/webchat-console-95fe1e

## 전체 위험도

**LOW** — 보안 reviewer 만 LOW 를 반환했고 나머지 8개 reviewer 는 모두 NONE. Critical 발견사항 없음. 주요 사항은 `primaryColor` 같은 appearance 필드가 설치 스크립트에 삽입될 경우의 XSS 잠재 위험이며, 이는 백엔드 저장/렌더 레이어에 의존하는 범위 외 이슈다. 이번 변경 자체(JSDoc 보강·내부 함수 리네이밍·테스트 추가·사용자 가이드 §6 신규 추가)는 기능 로직 무변경으로 구조적 위험 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

해당 없음.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` spec §2.1 — `useUpdateWebChatMeta` onError 미처리 정책 미기재. 코드에 "PATCH 실패 시 서버 미변경 → stale 아님 → onError invalidate 불필요" 근거가 추가됐으나 spec 표에 반영 안 됨. | `spec/7-channel-web-chat/5-admin-console.md` §2.1 | spec §2.1 표 이름변경/활성토글 행 비고에 "PATCH 실패 시 onError invalidate 불필요 — 서버 미변경으로 stale 발생 없음(onSuccess 만 invalidate)" 추가 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` spec §2.1 — `useUpdateWebChatMeta` 이름·활성 동시 PATCH 미언급. 코드와 테스트(L267–283)는 `{ name, isActive }` 동시 전달을 지원·검증하나 spec 표는 단일 필드 경로만 예시. | `spec/7-channel-web-chat/5-admin-console.md` §2.1 | spec §2.1 이름 변경 행 비고에 "name·isActive 동시 전달도 허용(부분 바디 — 지정 필드만 반영)" 추가 |
| 3 | Security | `useUpdateWebChatAppearance` — `primaryColor` 등 appearance 필드에 런타임 새니타이징 없음. 설치 스크립트 생성 시 HTML 이스케이프 없이 삽입되면 XSS 가능. 이번 diff 범위 밖 백엔드 레이어에 의존. | `use-web-chat.ts` L548–555 | 백엔드에서 색상 값 형식(`#RRGGBB`) 정규식 검증 권장. 설치 스크립트 생성 시 JSON 직렬화 또는 HTML 이스케이프 여부 확인. |
| 4 | Security | `useUpdateWebChatMeta` — `name` 필드 훅 레벨 trim·빈 문자열 방어 없음. 다이얼로그에서 검증하나 훅 단독 재사용 시 빈 문자열 전달 가능. | `use-web-chat.ts` L588–591 | 훅 내부에서 name 존재 시 trim 후 빈 문자열이면 에러 throw 또는 바디 제외 고려. 서버 측 검증 필수. |
| 5 | Architecture | `useUpdateWebChatMeta` — `name`·`isActive` 모두 `undefined` 이면 빈 `{}` 바디로 PATCH 전송. 의미 없는 네트워크 요청 발생 가능. | `use-web-chat.ts` L587–592 | `if (!name && isActive === undefined) return Promise.reject(...)` 또는 TS 레벨에서 최소 1 필드 필수 제약 적용. |
| 6 | Maintainability | `onSuccess invalidateQueries` 블록이 `useUpdateWebChatAppearance`(L558–562), `useUpdateWebChatMeta`(L594–598), `useCreateWebChat`(L517–520) 3곳에 동일 패턴 반복. | `use-web-chat.ts` | `invalidateWebChatCaches(queryClient)` 헬퍼 추출 권장 (현재 규모는 강제 아님). |
| 7 | Testing | `wrapper` 팩토리가 `mutations.retry` 를 명시하지 않음. TanStack Query v5 기본값 0이므로 현재 무해하나 향후 mutation retry 옵션 추가 시 reject 테스트 flaky 위험. | `use-web-chat.test.ts` L106–109 | `mutations: { retry: false }` 를 명시적으로 추가해 의도 명확화. |
| 8 | Testing | `key=${instanceId}:${open}` state 초기화 동작(open=false→true 전환 후 input 리셋)에 대한 직접 테스트 없음. JSDoc·주석으로만 기술됨. | `web-chat-rename-dialog.tsx` | 통합/E2E 레벨 테스트 추가 고려 (단위 테스트보다 통합 수준이 적합). |
| 9 | Testing | 파일 헤더 두 번째 줄이 appearance PATCH body 만 설명. useUpdateWebChatMeta 추가 후 meta(name·isActive) 언급 누락. | `use-web-chat.test.ts` L2 | `// PATCH body 구성(enabled/tokenStrategy/appearance, name/isActive) + query invalidation 검증` 으로 확장 (필수 아님). |
| 10 | Architecture | 캐시 무효화 책임이 훅 내부 `onSuccess` 에 하드코딩. 의식적 결정(커밋 메시지에 "장기 백로그" 인식)이나, 향후 캐시 전략 다양화 시 유연성 제한. | `use-web-chat.ts` `onSuccess` 블록 | 향후 `onSuccess?: () => void` 콜백 주입 패턴 고려 (현재 단일 콘솔 경로에서는 현행이 적절). |
| 11 | Architecture | 이중 필터링(서버 `interactionEnabled=true` + 클라이언트 `.filter(t => t.type==="webhook" && ...)`) 의도적 패턴. 향후 서버 필터 변경 시 클라이언트 필터 silent drift 가능. | `use-web-chat.ts` L437–471 | 이중 필터 동기화를 단위 테스트에서 검증하는 스냅숏 테스트 장기 고려. |
| 12 | Maintainability | `WebChatRenameDialogInner` 리네이밍으로 `TriggerDeleteDialog.DialogInner` 패턴과 Prefix/Suffix 스타일 미묘한 차이 존재. | `web-chat-rename-dialog.tsx` | 장기적으로 내부 컴포넌트 네이밍 컨벤션 통일(`XXXInner` vs `XXX.Inner`) 고려. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | appearance primaryColor XSS 잠재위험(백엔드 의존), name 빈 문자열 방어 미비 — 모두 INFO |
| architecture | NONE | 빈 바디 PATCH 방어 미비, 캐시 무효화 하드코딩, 이중 필터 패턴 — 모두 INFO |
| requirement | NONE | SPEC-DRIFT 2건(onError 정책 미기재, 동시 PATCH 미언급) — 모두 INFO |
| scope | NONE | 모든 변경이 커밋 메시지 선언 항목에 정확히 대응, 범위 초과 없음 |
| side_effect | N/A | 출력 파일 미생성 (재시도 필요) |
| maintainability | NONE | onSuccess invalidate 패턴 3중복, 내부 컴포넌트 명명 미묘한 불일치 — 모두 INFO |
| testing | NONE | reject 경로 테스트 추가 적절, key remount 직접 테스트 누락 — 모두 INFO |
| documentation | NONE | JSDoc·테스트명·파일헤더 일관 기술, ko/en MDX §6 완전 동기화 |
| user_guide_sync | NONE | 매트릭스 3 trigger 매칭, 동반 갱신 누락 0건 (ImplAnchor·dict ko/en parity·KO/EN sibling 모두 PASS) |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 완전 적합 — 범위 초과 또는 선언 외 변경 없음.
- **documentation**: 문서화 모범 수준 — JSDoc·테스트명·파일헤더·ko/en MDX 일관성 모두 충족.
- **user_guide_sync**: 매트릭스 전 trigger 통과 — 누락 0건.

---

## 권장 조치사항

1. **(SPEC-DRIFT #1)** spec `7-channel-web-chat/5-admin-console.md` §2.1 표에 `useUpdateWebChatMeta` onError 미처리 정책 명기 — "PATCH 실패 시 onError invalidate 불필요(서버 미변경으로 stale 없음, onSuccess 만 invalidate)".
2. **(SPEC-DRIFT #2)** 동 §2.1 표에 이름·활성 동시 PATCH 허용 명기 — "name·isActive 동시 전달 허용(부분 바디)".
3. **(INFO #3)** 백엔드 설치 스크립트 생성 레이어에서 `primaryColor` 등 appearance 값의 HTML 이스케이프/JSON 직렬화 여부 확인, 미적용 시 정규식 검증(`#RRGGBB`) 추가.
4. **(INFO #5)** `useUpdateWebChatMeta` 에 빈 바디 조기 반환 방어 또는 TS 레벨 최소 1 필드 필수 제약 추가 (낮은 우선순위).
5. **(INFO #7)** 테스트 `wrapper` 에 `mutations: { retry: false }` 명시적 추가.
6. **(INFO #6)** `invalidateWebChatCaches` 헬퍼 추출 — 3곳 중복 제거 (낮은 우선순위, 향후 키 구조 변경 시 우선순위 상승).
7. **(INFO #4)** `useUpdateWebChatMeta` 훅 레벨에서 `name` trim 후 빈 문자열 방어 추가 고려 (낮은 우선순위, 서버 검증이 1차 방어선).

---

## 재시도 필요

- **side_effect** (1건): 출력 파일 `/review/code/2026/06/24/21_15_24/side_effect.md` 미생성. 디렉토리 목록에서 확인 불가. 재시도 필요.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함.

- **실행** (9명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync
- **강제 포함(router_safety)** (6명): maintainability, requirement, scope, security, side_effect, testing
- **제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 제외 (이유 미기재) |
| dependency | 라우터 제외 (이유 미기재) |
| database | 라우터 제외 (이유 미기재) |
| concurrency | 라우터 제외 (이유 미기재) |
| api_contract | 라우터 제외 (이유 미기재) |