# 보안(Security) 리뷰 결과

리뷰 대상 커밋: `58f123fb136ae91888cd74281f933f035f85244e`
리뷰 파일:
- `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`
- `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`
- `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- `plan/in-progress/trigger-drawer-cleanup.md`
- `spec/2-navigation/2-trigger-list.md`

---

## 발견사항

### [INFO] 에러 메시지에 원시 에러 객체 노출 — ExternalInteractionCard
- 위치: `trigger-detail-drawer.tsx` — `handleSave`, `handleRotateSecret`, `handleRevokeToken` 함수
- 상세: 세 함수 모두 catch 블록에서 `err instanceof Error ? err.message : String(err)` 를 toast 메시지에 직접 포함한다. 백엔드가 상세한 내부 오류 메시지(예: DB 쿼리 실패 텍스트, 내부 경로, 스택 정보 등)를 HTTP 응답 본문에 포함하는 경우, 해당 내용이 사용자 UI 에 그대로 노출될 수 있다. 이번 변경에서 이 패턴이 신규 추가된 것은 아니지만 변경 범위에 포함된다.
  ```
  toast.error(`${t("...")} : ${err instanceof Error ? err.message : String(err)}`);
  ```
- 제안: 프론트엔드에서는 에러 토스트에 백엔드 오류 메시지 원문을 포함하지 않는 것이 권장된다. 백엔드 응답에 사용자-facing 안전한 에러 코드(예: `errorCode`, `userMessage`)를 별도로 내려주고, 프론트엔드는 해당 필드만 표시하도록 개선을 고려한다.

### [INFO] Webhook URL 생성 시 포트 번호 하드코딩 — getWebhookUrl
- 위치: `trigger-detail-drawer.tsx` — `getWebhookUrl` 함수
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` 로 포트를 3011로 강제 교체한다. 이는 개발 환경 전용 편의 코드로, 프로덕션 환경에서 잘못된 URL을 생성할 여지가 있다. 보안 문제라기보다는 정보 노출의 관점에서, UI 가 잘못된 Webhook URL 을 사용자에게 제시하면 사용자가 의도하지 않은 엔드포인트로 외부 시스템을 설정할 수 있다.
- 제안: 이 로직은 이번 변경으로 신규 도입된 것이 아니며 기존 코드다. 단, 리뷰 범위에 포함되므로 언급한다. 장기적으로는 환경 설정(`NEXT_PUBLIC_WEBHOOK_BASE_URL` 등)에서 base URL 을 주입하는 방식으로 교체하는 것이 안전하다.

### [INFO] 민감 자격증명 필드에 `type="password"` 적용 — 양호
- 위치: `trigger-detail-drawer.tsx` — `WebhookConfigCard` edit form (hmacSecret, bearerToken 입력)
- 상세: HMAC secret 및 Bearer token 입력 필드에 `type="password"`와 `autoComplete="new-password"` 가 이미 적용되어 있다. 이번 변경은 해당 필드에 영향을 미치지 않으며, 올바른 보안 관행이 유지되고 있다.
- 제안: 없음.

### [INFO] 삭제된 history 쿼리 — 공격 표면 감소
- 위치: `trigger-detail-drawer.tsx` — `useQuery<TriggerHistoryEntry[]>` 삭제
- 상세: drawer 에서 `GET /api/triggers/:id/history` 호출이 제거되었다. 이는 불필요한 API round-trip 을 제거하여 공격 표면을 소폭 감소시키는 긍정적 변경이다.
- 제안: 없음.

### [INFO] i18n 딕셔너리 파일에 민감 정보 없음 — 양호
- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`, `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: 추가된 i18n 키와 값은 순수 UI 문자열이며, 시크릿·토큰·API 키 등 민감 정보를 포함하지 않는다.
- 제안: 없음.

### [INFO] `window.confirm` 사용으로 인한 UX 보안 한계 — 기존 패턴
- 위치: `trigger-detail-drawer.tsx` — `handleSaveClick` (endpointPath 변경 경고), `handleRotateSecret`, `handleRevokeToken`
- 상세: `window.confirm()` 을 경고 확인 UI 로 사용한다. 이 자체는 보안 취약점이 아니나, 일부 브라우저 환경에서 confirm 다이얼로그를 자동 승인하거나 차단할 수 있어 사용자 확인 의존 보안 게이트로는 불완전하다. 이번 변경으로 신규 도입된 패턴은 아니다.
- 제안: 민감한 액션(시크릿 교체, 토큰 폐기)에는 커스텀 확인 다이얼로그 컴포넌트 사용을 권장한다. 단, 이번 PR 범위에 해당하지 않으므로 후속 작업으로 분류.

---

## 요약

이번 변경은 trigger detail drawer 에서 Recent Calls 카드를 제거하고 UI 문자열을 i18n 키로 교체하는 리팩토링이다. 신규 도입된 보안 취약점은 없다. 기존부터 존재하던 에러 메시지 노출 패턴(백엔드 오류 원문을 toast 에 포함)이 변경 범위 내에 포함되어 있으나, 이는 이번 PR 의 변경에 의해 도입된 것이 아니며 INFO 수준으로 분류한다. 하드코딩된 시크릿, SQL 인젝션, XSS, 인증 우회, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10 범주의 중요 취약점은 발견되지 않았다.

---

## 위험도

NONE
