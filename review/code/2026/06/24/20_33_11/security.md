# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `endpointPath` (webhook URL 경로) 가 `TriggerDeleteTarget.webhookUrl` 로 노출됨
  - 위치: `page.tsx` line ~265 (`webhookUrl: instance.endpointPath`)
  - 상세: `endpointPath` 는 공개 webhook URL 이므로 그 자체가 시크릿은 아니다. 그러나 삭제 확인 다이얼로그 본문(`DialogDescription`)에 URL 이 그대로 렌더링된다(`trigger-delete-dialog.tsx`). 이 값이 서버-사이드 토큰이나 서명 키를 포함하지 않는 한 노출 위험은 낮다.
  - 제안: `endpointPath` 가 공개 엔드포인트 경로임을 스펙에 명확히 유지하고, 향후 해당 경로에 서명 토큰을 추가하지 않도록 주의한다.

- **[INFO]** `useUpdateWebChatMeta` PATCH body 에 대한 클라이언트 측 길이·형식 검증 부재
  - 위치: `use-web-chat.ts` `useUpdateWebChatMeta` 의 `mutationFn`; `web-chat-rename-dialog.tsx` `submit()`
  - 상세: 이름 변경 시 `trimmed.length === 0` 여부만 확인하고 최대 길이 제한이 없다. 이론적으로 매우 긴 문자열을 서버로 전송 가능하다. 실질적인 방어는 서버 측 DTO 유효성 검사에 위임하고 있다. 이는 흔한 패턴이고 서버가 검증한다면 실제 위험은 낮지만, 클라이언트 UX 측면에서도 maxLength 제한을 두는 것이 권장된다.
  - 제안: `<Input maxLength={100} />` 또는 적절한 상한선을 `web-chat-rename-dialog.tsx` 의 Input 에 추가한다.

- **[INFO]** `isAxiosLikeStatus` 에러 상태 코드 분기 — 에러 정보 노출 최소화 확인됨
  - 위치: `trigger-delete-dialog.tsx` `isAxiosLikeStatus` 함수 및 `onError` 핸들러
  - 상세: 에러 처리 시 상태 코드(404, 5xx)에 따라 분기하며, toast 메시지로는 i18n 키(`triggers.deleteFailed`, `triggers.notFoundOnDelete`) 만 노출한다. 원시 에러 객체나 서버 응답 바디는 사용자에게 노출되지 않는다. 올바른 패턴이다.
  - 제안: 없음.

- **[INFO]** `beforeunload` 핸들러 등록 — 보안 관련 없음, 정상 패턴
  - 위치: `page.tsx` `useEffect` (isDirty 감지)
  - 상세: `e.returnValue = ""` 를 빈 문자열로 설정하는 표준 beforeunload 패턴이다. 이벤트 리스너 cleanup 도 올바르게 수행된다. 보안 위험 없음.
  - 제안: 없음.

- **[INFO]** `RoleGate minRole="editor"` 로 클라이언트 권한 제어 — 서버 측 인가 의존 필요
  - 위치: `page.tsx` `RoleGate` 래핑 (드롭다운 메뉴 전체 및 저장 버튼)
  - 상세: `RoleGate` 는 UI 가드이며, 실제 삭제/수정/활성화 API 호출은 서버 측 인가에 의해 최종 보호되어야 한다. 현재 코드에서 서버가 인가 검증을 수행하는지는 이 파일 범위에서 확인 불가이나, 프론트엔드 단독 가드는 OWASP A01(Broken Access Control) 위험이 있다. 다만 `RoleGate` 가 렌더링 가드로만 동작하는 일반적인 패턴이고, 실제 변조는 서버 API 호출 레이어에서 막혀야 한다.
  - 제안: 백엔드 PATCH/DELETE `/triggers/:id` 엔드포인트에 editor 이상 역할 요구 인가 검사가 있는지 별도 검토 권장.

- **[INFO]** `crypto.randomUUID()` 사용 — 안전한 UUID 생성
  - 위치: `use-web-chat.ts` `useCreateWebChat` `mutationFn` 내 `endpointPath: crypto.randomUUID()`
  - 상세: 브라우저 Web Crypto API 를 통한 UUID v4 생성으로, 충분한 엔트로피를 보장한다. 예측 불가한 webhook 경로 생성에 적합하다.
  - 제안: 없음.

## 요약

이번 변경은 순수 프론트엔드 콘솔 관리 기능(삭제·이름변경·활성토글·이력 조회) 통합이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, XSS 취약점은 관찰되지 않는다. 사용자 입력(`inst.name`, `inst.workflowName`, `instance.endpointPath`)은 React 의 자동 이스케이프를 통해 렌더링되므로 XSS 위험이 없다. 에러 처리는 원시 에러를 사용자에게 노출하지 않는 올바른 패턴이다. 클라이언트 권한 제어(`RoleGate`)는 UI 레이어 가드이므로 서버 측 인가 검증이 동반되어야 한다는 점이 유일한 주의 사항이며, 이는 이 PR 범위 외 기존 백엔드 보안 정책에 해당한다. 전반적으로 보안 위험도는 낮다.

## 위험도

LOW
