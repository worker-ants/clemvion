# API 계약(API Contract) 리뷰

리뷰 대상: `refactor(triggers): M-8 1단계 review fix — triggersApi 유닛 테스트 + 타입/문서 강화`
커밋: `ac804f2a4510631b552dcbd96fa6d7a2dc2a91c8`
생성일: 2026-06-23

---

## 발견사항

**[INFO]** `TriggerListParams.type` / `status` 타입을 `string`에서 리터럴 유니온으로 narrowing
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` 인터페이스
- 상세: `type?: "webhook" | "schedule" | "manual"`, `status?: "active" | "inactive"` 로 좁혔다. 이는 클라이언트 측 타입 안전성 향상이며, 백엔드 API 계약(허용 enum 값)을 코드에 명시했다. typecheck PASS 확인됨.
- 제안: 현재 조치 적절. 단, 향후 백엔드가 새 타입/상태 값을 추가할 경우 프론트엔드 타입도 동기 갱신 필요 — spec §3 과의 단일 진실 관리에 유의.

**[INFO]** `create` 함수의 `Promise<void>` 반환 타입이 문서화됨
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `create` 함수 JSDoc
- 상세: "응답 바디를 버린다 — 호출부가 queryKey 무효화로 재조회한다"는 의도가 JSDoc으로 명시됨. POST 생성 엔드포인트 응답에서 생성된 리소스 ID를 클라이언트가 현재 활용하지 않는 설계 의도를 명확히 함.
- 제안: 현재 상태로 허용. 추후 생성 직후 drawer 오픈 등 UX가 추가되면 `Promise<{ id: string }>` 반환 타입 확장이 필요하며, 해당 시점에 calling convention 변경이 수반됨.

**[INFO]** `getById` 이중 envelope 흡수(`body?.data ?? body`) 패턴 — API 응답 형식 불일치 클라이언트 흡수
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `getById` 함수, `lib/api/__tests__/triggers.test.ts`
- 상세: 유닛 테스트가 `{ data: { ... } }` (enveloped) 와 `{ ... }` (bare) 두 응답 shape 모두 검증한다. 이는 백엔드 `GET /triggers/:id` 응답 형식이 명세 상 확정되지 않았거나 실제로 두 형식이 혼재함을 의미한다. 테스트 추가로 계약 흡수 동작이 문서화된 점은 긍정적이나, 장기 지속 시 스펙 드리프트 위험.
- 제안: 변경 자체는 적절. 백엔드 응답 shape를 spec에서 단일 형식으로 확정 후 이중 분기 제거를 백로그로 유지 (RESOLUTION.md INFO #13 에 이미 기록됨).

**[INFO]** `rotateNotificationSecret` / `revokeInteractionToken` — `res.data.data` 이중 envelope 패턴 명세화
- 위치: `codebase/frontend/src/lib/api/triggers.ts` L297–L313, `lib/api/__tests__/triggers.test.ts`
- 상세: 이중 언래핑(`res.data.data`) 동작이 유닛 테스트로 명시적으로 검증됨. API 계약 관점에서 POST 액션 엔드포인트(`/notification/rotate-secret`, `/interaction/revoke-token`)가 `{ data: { secret, rotatedAt } }` / `{ data: { token } }` 형식을 반환하는 계약이 코드로 정착됨.
- 제안: 현재 조치 적절. 백엔드 응답 envelope 구조(`{ data: ... }`)가 다른 일반 엔드포인트와 일관성 있는지 spec 레벨에서 확인 권장.

**[INFO]** `rotateBotToken` 전용 엔드포인트 `POST /triggers/:id/chat-channel/rotate-bot-token` — URL 경로 패턴
- 위치: `codebase/frontend/src/lib/api/triggers.ts`, `lib/api/__tests__/triggers.test.ts`
- 상세: 액션성 엔드포인트가 `/resource/:id/sub-resource/verb-noun` 형태로 명명됨. kebab-case 동사 패턴이 다른 rotate/revoke 엔드포인트(`/notification/rotate-secret`, `/interaction/revoke-token`)와 일관됨.
- 제안: 현재 패턴 일관적. 신규 액션 엔드포인트 추가 시 동일 패턴 유지 권장.

**[INFO]** `page.tsx` 내 `/workflows` 직접 `apiClient` 호출 잔류
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` L226–L228
- 상세: workflows 도메인 API 호출이 triggers 페이지 파일에 직접 잔류 중이며 m-2 workflows 트랙 이전 예정이라는 주석이 추가됨. API 계약 관점에서 `GET /workflows` 호출 자체에 문제는 없으나, 별도 API 모듈 없이 raw `apiClient` 를 사용한다.
- 제안: 현재 주석 추가로 의도 명확화됨. m-2 workflows 트랙에서 `lib/api/workflows.ts` 로 이전 시 `useQuery` 타입 파라미터(`Workflow[]`) 포함 계약 재검토.

---

## 요약

이번 변경은 API 계약(프론트엔드 클라이언트 레이어) 관점에서 전반적으로 안전하다. `TriggerListParams` 타입 narrowing은 백엔드 API의 허용 enum 값을 클라이언트 타입으로 명시화한 것으로 하위 호환성을 해치지 않는다. `create`의 `void` 반환, `getById` 이중 envelope 흡수, `rotateNotificationSecret` / `revokeInteractionToken` 이중 언래핑 패턴이 모두 유닛 테스트로 문서화·검증되어 계약이 명확해졌다. 액션 엔드포인트 URL 패턴은 일관적이다. 주요 잠재 위험은 `GET /triggers/:id` 응답 형식의 이중 shape(envelope / bare)가 백엔드 계약 불확정 상태를 클라이언트가 계속 흡수하는 구조이나, 이는 pre-existing 이슈이고 테스트로 동작이 고정되었다. Breaking change 없음.

---

## 위험도

NONE
