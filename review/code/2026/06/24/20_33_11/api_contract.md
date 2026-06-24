# API 계약(API Contract) 리뷰 결과

## 개요

본 변경은 **프론트엔드 전용**(7개 파일: `page.tsx`, 컴포넌트 2개, 훅 1개, 테스트 3개, i18n 1개)이며, 신규 백엔드 엔티티·엔드포인트를 추가하지 않는다. 기존 `/triggers` REST API 를 재사용하는 클라이언트 레이어 변경이다.

분석 대상 API 호출 경로:

| 작업 | HTTP 메서드 | 경로 |
|---|---|---|
| 웹채팅 목록 조회 | GET | `/triggers?type=webhook&interactionEnabled=true&limit=100` |
| 이름 변경 | PATCH | `/triggers/{instanceId}` |
| 활성 토글 | PATCH | `/triggers/{instanceId}` |
| 삭제 | DELETE | `/triggers/{instanceId}` |

---

## 발견사항

### 1. 하위 호환성

- **[INFO]** `TriggerDeleteDialog` 에 `onDeleted?` prop 추가
  - 위치: `/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` Props 인터페이스
  - 상세: optional prop(`onDeleted?: () => void`) 추가로 기존 사용처는 영향 없음. breaking change 없음. 기존 동작(`["triggers"]` 캐시 무효화)은 그대로 유지되며 콜백은 "추가" 책임만 가짐.
  - 제안: 현재 설계 적절. 추가 조치 불필요.

### 2. 버전 관리

- **[INFO]** API 버전 헤더/경로 변경 없음
  - 상세: 기존 `/triggers` API 를 재사용하며 버전 관련 변경 없음. 신규 엔드포인트 미도입.

### 3. 응답 형식

- **[INFO]** `lastTriggeredAt` 필드 신규 소비
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 33, 74
  - 상세: `WebChatInstance.lastTriggeredAt?: string` 을 `TriggerListItem` 응답에서 pass-through. 서버가 해당 필드를 내려주지 않아도 `undefined` 처리로 안전하게 폴백됨(`inst.lastTriggeredAt ? ... : t("webChat.list.neverTriggered")`).
  - 제안: 현재 방어 코드 적절. 단, 서버 `TriggerListItem` 타입 정의에 `lastTriggeredAt` 이 포함되어 있는지 별도 확인 권장(타입 드리프트 가능성).

### 4. 에러 응답

- **[INFO]** PATCH 에러 처리 — 단일 범용 catch
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` `useUpdateWebChatMeta`, `/codebase/frontend/src/app/(main)/web-chat/page.tsx` `toggleActive()` / `save()`
  - 상세: PATCH 실패 시 에러 종류(404/422/5xx)를 구분하지 않고 단일 `toast.error` 로 처리함. DELETE 경로(`TriggerDeleteDialog`)는 404 동시 삭제를 별도로 처리하는 반면, PATCH 경로는 미구분. 실제 UX 에 허용 가능한 수준이지만, 서버가 422(이름 중복 등 유효성 위반) 를 돌려줄 경우 사용자에게 구체 오류를 전달하지 못함.
  - 제안: 현재는 LOW 위험. 향후 서버가 PATCH 422 에 구체적 에러 메시지를 내려준다면, `isAxiosLikeStatus` 패턴을 재사용해 분기 처리 고려.

### 5. 요청 검증

- **[INFO]** `useUpdateWebChatMeta` 빈 바디 전송 가능성
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` `useUpdateWebChatMeta` mutationFn
  - 상세: `name` 과 `isActive` 가 모두 `undefined` 이면 빈 객체 `{}` 를 PATCH 바디로 전송함. 서버가 이를 no-op 으로 처리하면 문제없으나, 유효성 오류로 처리할 경우 불필요한 에러가 발생할 수 있음.
  - 제안: `WebChatRenameDialog` 는 `trimmed.length === 0 || unchanged` 가드로 빈 PATCH 를 차단하고, `toggleActive` 는 항상 `isActive` 를 전달하므로 실제 호출 경로에서는 빈 바디가 전송될 일이 없음. 타입 수준 보호(최소 하나 필수)를 원한다면 `Require<UpdateWebChatMetaInput, 'name' | 'isActive'>` 유니온 타입으로 강화 가능하나 현재는 허용 범위.

- **[INFO]** 이름 최대 길이 클라이언트 미검증
  - 위치: `/codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx` `Input`
  - 상세: `WebChatRenameDialog` 에서 이름 최대 길이를 클라이언트가 검증하지 않음. 서버가 해당 제약을 강제하면 PATCH 실패로 에러 토스트가 표시되나 사용자에게 구체적 안내 없음.
  - 제안: 서버 제약이 존재한다면 `maxLength` 속성 및 UI 피드백 추가 권장. 서버 제약 미확인 시 LOW 수준.

### 6. URL/경로 설계

- **[INFO]** 기존 `/triggers/{id}` PATCH 단일 경로로 이름·활성 상태·외형 모두 처리
  - 상세: 세 가지 뮤테이션(`useUpdateWebChatMeta`, `useUpdateWebChatAppearance`, delete) 이 동일 엔드포인트를 서로 다른 바디 구조로 사용. 현재 서버가 부분 PATCH 를 지원한다는 전제 하에 작동. RESTful 관점에서 경로 설계 위반 없음.

### 7. 페이지네이션

- **[INFO]** 목록 조회 `limit=100` 하드코딩
  - 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` `MAX_LIST_LIMIT = 100`
  - 상세: 웹채팅 인스턴스가 100개를 초과할 경우 목록이 잘림. 현재 단일 페이지 조회이며 페이지네이션 UI 없음. 소규모 운영 콘솔 시나리오에서는 허용 범위이나, 인스턴스 수가 증가하면 문제가 될 수 있음.
  - 제안: 현재는 LOW. 인스턴스 수 증가가 예상되면 커서 기반 무한 스크롤 또는 페이지네이션 UI 도입 계획 수립 권장.

### 8. 인증/인가

- **[INFO]** `editor` 역할 게이트 적용 확인
  - 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `RoleGate minRole="editor"` 로 드롭다운 메뉴(이름 변경·활성 토글·삭제) 래핑
  - 상세: 수정성 작업(이름변경·토글·삭제)은 `editor` 이상 역할에만 UI 노출됨. 호출이력 조회 버튼(`History`)은 역할 게이트 없이 모든 사용자에게 노출되나, 읽기 전용 작업이므로 적절.
  - 제안: 서버측 인가가 동일하게 강제되는지 확인 필요(클라이언트 게이트는 UI 레이어 제어일 뿐).

---

## 요약

본 변경은 프론트엔드 클라이언트 레이어 전용으로, 기존 `/triggers` REST API 를 재사용하며 신규 엔드포인트나 스키마 변경이 없다. `TriggerDeleteDialog.onDeleted` prop 추가는 하위 호환적이며, `useUpdateWebChatMeta` 의 부분 PATCH 설계는 서버 스펙(R-4, `TriggerUpdateBody`)을 올바르게 따른다. 에러 처리는 PATCH 경로에서 상태코드 미분기라는 경미한 허점이 있으나 현재 UX 영향은 제한적이다. `lastTriggeredAt` 필드 소비는 서버 타입 정의와의 동기화 확인이 필요하고, `limit=100` 하드코딩은 인스턴스 증가 시 확장성 과제가 될 수 있다. 전반적으로 API 계약 위반이나 breaking change 없이 안전하게 구현되었다.

---

## 위험도

LOW
