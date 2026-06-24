## 발견사항

- **[INFO]** `5-admin-console.md §2.1` 표에서 "R-4 단일 PATCH 경로" 는 `trigger-list.md Rationale R-4` 를 참조하는 교차 참조이나, 독자가 같은 파일 내 로컬 앵커로 오독할 여지가 있다
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §2.1` 이름 변경 행 비고 열
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md Rationale R-4`
  - 상세: `5-admin-console.md` 의 R-4 언급은 `trigger-list.md` 의 `### R-4. isActive 편집 경로는 PATCH /api/triggers/:id body 단일 경로` 를 가리키는 교차 참조다. 두 파일이 동일 Rationale ID 공간을 공유하므로 의미 충돌은 없으나, 로컬 앵커(`#r-4`)처럼 보여 링크가 깨질 수 있다.
  - 제안: `(R-4 단일 PATCH 경로)` 를 `([trigger-list R-4](../2-navigation/2-trigger-list.md#r-4-isactive-편집-경로는-patch-apitriggersid-body-단일-경로-toggle-미채택))` 형식의 절대 앵커로 교체하거나, 5-admin-console 내부에 동일 번호를 로컬 Rationale 로 정의하지 않음을 주석으로 명기한다.

- **[INFO]** `[호출 이력]` 버튼이 `viewer`+ 역할로 허용되어야 하는데, 구현(`page.tsx`)에서 해당 버튼이 `RoleGate` 바깥에 노출됨 — 스펙 의도와 일치하나, spec §7 "viewer+" 표현과 `trigger-list.md §2.1` "모든 역할 가시" 사이의 명시적 정합성 진술이 누락됨
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md §7` 권한 표 + `§2.1` UI 배치 설명
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md §2.1` ⋮ 메뉴 "호출 이력 — 모든 역할 가시"
  - 상세: `5-admin-console.md §2.1` 은 "[호출 이력] 버튼(viewer+)" 으로 명시하고, 구현도 `RoleGate` 없이 모든 역할에 노출한다. `trigger-list.md §2.1` 도 호출 이력을 "모든 역할 가시" 로 선언한다. 내용 충돌은 없으나, 5-admin-console 이 "viewer+" 와 "모든 역할"을 동의어로 묵시적으로 사용 중이다. 명확화하면 독자 혼란을 줄일 수 있다.
  - 제안: spec §7 권한 표에서 "인스턴스 목록·상세·스니펫 복사·미리보기·호출이력 조회" 행의 최소 역할 셀을 `viewer+` 에서 `viewer+ (= 모든 인증 사용자)` 로 부연하거나, 주석 한 줄 추가.

- **[INFO]** `TriggerHistoryDialog` 재사용 시 `onOpenFullDetail` prop 미전달 — spec 에 명시 없으나 컴포넌트 JSDoc 이 존재하는 선택 prop
  - target 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` 334–340행 `TriggerHistoryDialog` 사용
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md Rationale R-6` — "modal 안의 '전체 상세 보기' 버튼으로 detail drawer 로 승격 가능"
  - 상세: `trigger-list.md R-6` 은 호출 이력 dialog 에서 "전체 상세 보기" 버튼(`onOpenFullDetail`)으로 detail drawer 로 승격하는 경로를 설계했다. 웹채팅 콘솔에는 trigger list drawer 와 동일한 전환 대상이 없으므로 prop 미전달이 의도적이다. 그러나 spec `5-admin-console.md §2.1` 은 이 선택에 대해 명시적 설명이 없다.
  - 제안: `5-admin-console.md §2.1` 컴포넌트 재사용 항목에 "onOpenFullDetail 미전달 — trigger list 의 drawer 전환이 웹채팅 콘솔에 적용 불가하므로 생략" 한 줄 추가.

- **[INFO]** `lastTriggeredAt` 필드: `TriggerListItem` 타입에 추가된 `lastTriggeredAt?: string` 이 `spec/1-data-model.md §2.8` 의 `last_triggered_at | Timestamp?` DB 컬럼과 정합하고, 백엔드 `TriggerResponseDto` 의 `lastTriggeredAt?: string | null` 과도 일치한다. 단, frontend 타입에서는 `string | undefined` 이고 백엔드 DTO 에서는 `string | null` 로 nullable 표현이 미세하게 다르다.
  - target 위치: `codebase/frontend/src/lib/types/trigger.ts` 52–53행
  - 충돌 대상: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 43행 `lastTriggeredAt?: string | null`
  - 상세: 백엔드는 `null`(DB 미기록) 과 `undefined`(필드 미포함)를 구분하나, 프론트엔드 타입은 `undefined` 만 모델링한다. `use-web-chat.ts` 는 `t.lastTriggeredAt` 을 그대로 할당하므로 `null` 이 들어오면 `lastTriggeredAt: null` 로 저장될 수 있으나, `timeAgo` 와 조건부 렌더링(`inst.lastTriggeredAt ? ... : ...`)이 `null` 을 falsy 로 처리하므로 실질 런타임 문제는 없다. 타입 정확성 관점의 minor drift.
  - 제안: `TriggerListItem.lastTriggeredAt` 를 `string | null | undefined` 또는 `string | undefined` 로 통일하고 `use-web-chat.ts` 에서 `?? undefined` 정규화를 추가한다. spec 에는 현재 언급 없음 — spec/1-data-model.md §2.8 응답 DTO 매핑 노트에 한 줄 보충 권장.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 와 기존 spec 영역(`trigger-list.md`, `data-model.md`, `_product-overview.md`) 사이에는 직접 모순이 없다. 인스턴스 관리 동작(이름 변경·활성 토글·삭제·호출 이력)이 모두 기존 `PATCH·DELETE /api/triggers/:id` 경로를 재사용하고, RBAC 정책이 `trigger-list.md §4·§7` 과 일치하며, `lastTriggeredAt` 필드가 `data-model.md §2.8` 의 `last_triggered_at` DB 컬럼과 정합한다. 발견된 사항은 모두 INFO 수준으로 — 교차 참조 앵커 명확화, `viewer+` 와 "모든 역할" 동의어 진술 보충, `TriggerHistoryDialog.onOpenFullDetail` 미전달 이유 명기, 그리고 `lastTriggeredAt` nullable vs undefinable 타입 표현의 미세 불일치다. 그대로 채택해도 두 영역 중 하나가 작동 불가해지는 CRITICAL·WARNING 수준 충돌은 없다.

## 위험도

LOW
