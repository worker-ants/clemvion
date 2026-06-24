# 요구사항(Requirement) 리뷰 — feat(web-chat): 운영 콘솔 관리 기능 통합

리뷰 대상 커밋: `6e53f57d`  
대상 파일 10개 (page.tsx, trigger-delete-dialog.tsx, use-web-chat.ts, web-chat-rename-dialog.tsx, 테스트 3개, i18n 2개, trigger.ts)

---

## 발견사항

### [INFO] useUpdateWebChatMeta — 빈 바디 엣지 케이스 미방어

- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` mutationFn (line 194-198)
- 상세: `name`과 `isActive` 모두 `undefined`인 채로 호출하면 빈 객체 `{}` 를 `PATCH /triggers/:id`로 전송한다. 현재 호출자(toggleActive, WebChatRenameDialog.submit) 는 항상 하나 이상의 필드를 전달하므로 실제 버그는 아니지만, TypeScript 타입(`name?: string; isActive?: boolean`) 상 두 필드 모두 생략 가능하므로 향후 재사용 시 의도치 않은 no-op PATCH가 발생할 수 있다.
- 제안: 타입 레벨에서 `name | isActive` 중 최소 하나를 요구하도록 `AtLeastOne<T>` 유틸리티 타입을 적용하거나, JSDoc에 "최소 하나 이상의 필드 필수" 주석을 추가한다.

---

### [INFO] WebChatRenameDialog — 이름 최대 길이 클라이언트 검증 누락

- 위치: `/codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx` Inner 컴포넌트 `trimmed.length` 검사 (line 10)
- 상세: 서버 spec (`spec/2-navigation/2-trigger-list.md §2.3.1`) 에 "name: 1~120자" 제약이 명시되어 있다. 빈 이름 가드(`trimmed.length === 0`)는 있지만 최대 120자 초과 방어가 없다. 서버가 400으로 거부하므로 기능은 동작하나, 사용자 경험상 서버 왕복 전에 인라인 에러로 안내하는 편이 좋다.
- 제안: `trimmed.length > 120` 이면 저장 버튼 비활성 + 인라인 힌트 표시를 추가한다.

---

### [WARNING] page.tsx — deleteTarget에서 type을 "webhook"으로 하드코딩: spec §2.1과 일치하나 방어 없음

- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` line 277 `type: "webhook"`
- 상세: 웹채팅 인스턴스는 항상 `type=webhook`이므로 하드코딩 자체는 spec과 일치한다(`spec/7-channel-web-chat/5-admin-console.md §2`). 그러나 `WebChatInstance` 타입에 `type` 필드가 없어 코드에서 `instance.type` 으로 참조할 수 없고, 향후 다른 trigger type 인스턴스가 이 화면에 노출될 경우 삭제 다이얼로그 본문이 webhook 메시지로 잘못 표시된다.
- 제안: `WebChatInstance` 인터페이스에 `type: "webhook"` 을 상수 필드로 추가해 타입 안전성을 높이거나, 현재 하드코딩의 근거를 JSDoc에 명시한다.

---

### [WARNING] useUpdateWebChatMeta — onError 핸들러 부재로 실패 시 캐시 상태 불일치 가능

- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` useUpdateWebChatMeta (line 191-206)
- 상세: `toggleActive()` 에서 에러를 catch해 toast를 띄우지만, 낙관적 UI 업데이트는 없으므로 캐시 불일치는 없다. 다만 네트워크 에러 등 특수 케이스(서버는 성공했지만 응답 수신 실패)에서 `onSuccess`의 `invalidateQueries`가 호출되지 않아 목록이 stale 상태로 남을 수 있다. `useUpdateWebChatAppearance`도 동일 패턴이라 일관성은 있으나, 이탈 없이 화면에 남는 사용자는 새로고침 전까지 실제 상태를 모를 수 있다.
- 제안: `onError`에서도 `WEB_CHAT_INSTANCES_KEY` invalidate를 수행해 일관된 화면 상태를 보장한다. 또는 현재 패턴이 의도적임을 JSDoc에 명시한다.

---

### [INFO] 삭제 onDeleted — ["triggers"] 캐시 이중 무효화

- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` TriggerDeleteDialog onDeleted 콜백 (line 314) + TriggerDeleteDialog 내부 onSuccess/onError(404) 핸들러
- 상세: `TriggerDeleteDialog`는 내부에서 `["triggers"]`를 무효화하고, 콘솔의 `onDeleted` 콜백은 `WEB_CHAT_INSTANCES_KEY`(`["web-chat-instances"]`)를 추가로 무효화한다. 이는 spec §2.1 코드 주석과 일치하며 의도적이다. 단 `["web-chat-instances"]` 무효화를 내부 콜백에서 처리하면 트리거 화면에서도 동일 유틸리티가 재사용될 때 예상치 않은 invalidation이 발생하지 않도록 설계가 캡슐화되어 있다. 구조 자체는 spec §2.1 "추가 책임만" 원칙과 일치한다.
- 제안: 현재 구조 유지. 주석이 의도를 충분히 설명하고 있다.

---

### [INFO] spec fidelity — lastTriggeredAt TriggerListItem 필드 추가

- 위치: `/codebase/frontend/src/lib/types/trigger.ts` TriggerListItem 인터페이스
- 상세: `spec/5-system/12-webhook.md §2.1` 에 `lastTriggeredAt` 이 응답 필드로 명시되어 있고, `spec/7-channel-web-chat/5-admin-console.md §2.1` 이 이를 목록 행 메타로 사용함을 명시한다. 코드가 spec과 일치한다.

---

### [INFO] spec fidelity — WebChatRenameDialog: spec §2.1 "이름 변경" 행과 일치

- 상세: spec §2.1 매트릭스 "이름 변경 | `PATCH /api/triggers/:id { name }` | `editor`+ | 부분 바디 — interaction·isActive 미포함이라 silent mutation 없음". 코드는 `useUpdateWebChatMeta { name }` 단일 필드만 전송하고, RoleGate `minRole="editor"` 로 감싸진 DropdownMenu 내 항목으로 노출된다. spec과 line-level 일치.

---

### [INFO] spec fidelity — 활성 토글: spec §2.1 "활성/비활성 토글" 행과 일치

- 상세: spec §2.1 "활성/비활성 토글 | `PATCH /api/triggers/:id { isActive }` | `editor`+". 코드는 `useUpdateWebChatMeta { isActive: next }`, RoleGate `minRole="editor"` 메뉴 내 항목. 일치.

---

### [INFO] spec fidelity — 삭제: spec §2.1 "삭제" 행과 일치

- 상세: spec §2.1 "삭제 | `DELETE /api/triggers/:id` | `editor`+ | 이름 입력 확인 다이얼로그". TriggerDeleteDialog 재사용 + RoleGate `editor`+ 메뉴 내 항목. spec §4.4 동시 삭제 404 시 `toast.message` + `onClose` 처리도 코드에 구현되어 있다. 일치.

---

### [INFO] spec fidelity — 호출 이력: spec §2.1 "호출 이력" + §7 권한 테이블과 일치

- 상세: spec §7 "인스턴스 목록·상세·스니펫 복사·미리보기·호출이력 조회 | `viewer`+". 코드에서 History 버튼은 RoleGate 없이 노출 (= viewer 포함 모든 인증 사용자 접근 가능). 일치.

---

### [INFO] spec fidelity — 비활성 배지 + lastTriggeredAt 목록 행: spec §2.1 "목록 행 메타" 명세와 일치

- 상세: spec §2.1 "비활성 배지 + 마지막 호출 시각(`lastTriggeredAt` → `timeAgo`)". 코드: `!inst.isActive && <Badge>`, `timeAgo(inst.lastTriggeredAt)`. 일치.

---

### [INFO] spec fidelity — beforeunload 경고: spec §2.1 "미저장 보호(UX)"과 일치

- 상세: spec §2.1 "외형 미저장(`isDirty`) 상태에서 페이지 이탈/새로고침 시 `beforeunload` 경고로 손실을 한 번 잡는다". 코드: `useEffect`로 `isDirty` 시 `beforeunload` 이벤트 리스너 등록 + 컴포넌트 언마운트 시 정리. 일치.

---

### [INFO] spec fidelity — 온보딩 배너: spec §2.1 "온보딩" 요구사항과 일치

- 상세: spec §2.1 "외형이 서버에 한 번도 저장되지 않은(갓 생성된) 인스턴스는 상세 상단에 다음 단계 안내를 노출하고, 저장되면 `appearance` 가 채워지며 자연히 사라진다(파생 상태, 별도 플래그 없음)". 코드: `const needsOnboarding = !instance.appearance`. 일치.

---

### [INFO] spec fidelity — i18n KO/EN 키 패리티: spec §8 "KO/EN 동반 갱신 의무" 충족

- 상세: ko/en 양쪽 `webChat.ts`에 `list.inactive`, `list.lastTriggered`, `list.neverTriggered`, `manage.*`, `onboarding.*` 키가 동일 구조로 추가되었다. 일치.

---

### [INFO] 테스트 커버리지 — onDeleted 콜백 분기: 3 케이스(성공·404·5xx) 모두 커버

- 위치: `/codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx`
- 상세: 성공 시 호출, 404 동시삭제에도 호출, 5xx 실패 시 미호출 — 세 분기 모두 테스트된다. spec §4.4 동시삭제 처리와 일치.

---

## 요약

이번 변경은 웹채팅 콘솔에서 생애주기 전체(삭제·이름수정·활성토글·호출이력·목록 메타·이탈경고·온보딩)를 완결하는 기능을 통합한다. spec `7-channel-web-chat/5-admin-console.md §2.1·§7`의 요구사항(P0·P1·P2 항목 전체)이 코드로 충실하게 구현되어 있다. 권한 분기(viewer+/editor+), 캐시 무효화 책임 분리, 컴포넌트 재사용 패턴, i18n KO/EN 패리티, 테스트 커버리지 모두 spec 기술과 line-level로 일치한다. CRITICAL 발견사항은 없다. 주요 개선 권고는 두 가지다: (1) `useUpdateWebChatMeta` 빈 바디 엣지 케이스를 타입 레벨에서 방어하고, (2) `WebChatRenameDialog`에 서버 규약(`name 1~120자`)과 일치하는 클라이언트 측 최대 길이 검증을 추가하는 것이다.

---

## 위험도

LOW
