# Code Review 통합 보고서

리뷰 대상: `refactor(triggers): M-8 1단계 — lib/api/triggers.ts API 레이어 추출`
커밋: `0413433128321273c32d2ea1d12906ce201e4b2d`
생성일: 2026-06-23

---

## 전체 위험도

**LOW** — 순수 behavior-preserving 리팩터. 신규 취약점·Breaking Change·기능 결함 없음. 주요 갭은 신설 `triggersApi` 모듈의 유닛 테스트 부재 및 타입 안전성 약화(WARNING 7건)이며, 이는 M-8 2단계에서 해소 예정.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `lib/api/triggers.ts` 유닛 테스트 부재 — 프로젝트 관례(`lib/api/__tests__/model-configs.test.ts`)와 비교해 `triggersApi` 모듈 자체 검증 없음 | `codebase/frontend/src/lib/api/triggers.ts` (신설 전체) | `lib/api/__tests__/triggers.test.ts` 신설. URL/HTTP verb/파라미터·응답 정규화(특히 `getById` workflow 평탄화, `rotateNotificationSecret`/`revokeInteractionToken` 이중 언래핑) 검증 |
| 2 | Testing | `getById` workflow 평탄화 엣지 케이스 미커버 — `workflowId` 최상위 / `workflow.id` 중첩 / 둘 다 없음 / 둘 다 있음 4-way 분기가 컴포넌트 레벨 mock에 의해 우회됨 | `codebase/frontend/src/lib/api/triggers.ts` — `getById` 함수 | `triggers.test.ts`에서 4가지 shape 케이스 각각 검증 |
| 3 | Testing | `rotateNotificationSecret`/`revokeInteractionToken` 이중 envelope 언래핑 테스트 부재 — `res.data.data.secret`/`res.data.data.token` 패턴이 기존 drawer 테스트에서 완전히 우회됨 | `codebase/frontend/src/lib/api/triggers.ts` L297–L313 | `triggers.test.ts`에서 `{ data: { data: { secret: "s" } } }` mock 응답으로 언래핑 검증 |
| 4 | Architecture | 컴포넌트(`page.tsx`)에 뷰모델 매핑 로직·hex-regex 클라이언트 검증이 잔류 — `triggersApi.list()`가 `TriggerListItem[]`을 반환하나 컴포넌트 내 `queryFn`에서 `Trigger` 뷰모델로 수동 매핑(~15줄) | `codebase/frontend/src/app/(main)/triggers/page.tsx` — `queryFn` 내 `raw.map(...)` 변환 블록, `handleCreate` 내 hex-regex 검증 | M-8 2단계에서 `useTrigger` hook 추출 시 매핑 함수를 `lib/api/triggers.ts` 또는 `lib/mappers/triggers.ts`로 이관 |
| 5 | Architecture | `TriggerListItem`(API raw shape)과 `Trigger`(페이지 뷰모델) 타입 이중 존재 — 필드 중복으로 drift 발생 용이 | `lib/api/triggers.ts`의 `TriggerListItem`, `page.tsx`의 `interface Trigger` | M-8 2단계 hook 추출 시 매핑 함수 공식 분리 및 타입 SoT 단일화 |
| 6 | Architecture | `CreateTriggerBody.chatChannel` 및 `TriggerUpdateBody.chatChannel`/`notification`/`interaction`이 `Record<string, unknown>` 오버-와이드 타입 — 컴파일 타임 필드 오남용 차단 불가 | `lib/api/triggers.ts` — `CreateTriggerBody`, `TriggerUpdateBody` 인터페이스 | `ChatChannelCreateInput` 전용 타입 신설 후 `chatChannel` 필드 타입 교체. 최소한 `provider`, `botToken`을 required로 명시. M-8 2단계에서 처리 권장 |
| 7 | Maintainability | `TriggersPage` 컴포넌트가 폼 상태 8개·쿼리 3개·뮤테이션 2개·복잡한 JSX 렌더를 단일 함수에서 처리 (god-component 구조 잔류) | `codebase/frontend/src/app/(main)/triggers/page.tsx` 전체 (~302~900+ 라인) | M-8 2단계에서 `useCreateTriggerForm` hook + Create Dialog 컴포넌트 추출 최우선 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `lib/api/triggers.ts` 신설 — spec §3 API 표에 "frontend는 typed 카탈로그 함수를 통해 호출한다" 패턴 미반영. 코드 오류가 아니라 spec 갱신 누락 | `spec/2-navigation/2-trigger-list.md §3` | 코드 유지 + spec 갱신: `§3` 하단에 `lib/api/triggers.ts` typed 카탈로그 경유 note 추가 (project-planner 트랙) |
| 2 | Security | `endpointPath`에 `crypto.randomUUID()` 클라이언트 생성값 사용 — 서버 UUID 강제 미적용(known-deferred W1) | `triggers/page.tsx` — `createMutation.mutationFn` 내 `endpointPath` | plan `trigger-review-deferred-fixes.md` W1 트랙에서 처리. 서버 측 강제 생성 적용 |
| 3 | Security | `botToken`·`inboundSigningPlaintext` 평문 전송 — 기존 동작 보존, HTTPS 전제 보호됨 | `triggers/page.tsx` — `createMutation.mutationFn` | 추후 서버 측 request body 로깅 마스킹 검토 |
| 4 | Security | `TriggerUpdateBody.chatChannel`이 `Record<string, unknown>` — 금지 키 클라이언트 필터링 없음 (기존과 동일) | `lib/api/triggers.ts` — `TriggerUpdateBody` 인터페이스 | `Omit<ChatChannelConfigView, 'hasBotToken' \| 'botIdentity'>` 형태로 좁히거나 금지 키를 `never`로 명시 |
| 5 | Security | `rotateNotificationSecret` 결과를 React state에 평문 저장 후 렌더링 — UX 의도이나 노출 시간 무제한 | `trigger-detail-drawer.tsx` — `handleRotateSecret()` → `setRotateResult(secret)` | 60초 timeout 초기화 또는 복사 완료 시 state 클리어 |
| 6 | Security | `getById`의 `as` 타입 단언 — 서버 응답 런타임 검증 없음 (기존과 동일) | `lib/api/triggers.ts` — `getById()` | 중장기적으로 Zod 스키마 검증 도입 고려 |
| 7 | Requirement | `triggersApi.create` 반환 타입이 `void` — 생성된 리소스 ID 버림 | `lib/api/triggers.ts` `create` 함수 | 향후 drawer 자동 오픈 UX 추가 시 `Promise<{ id: string }>` 확장 |
| 8 | Requirement | spec `2-trigger-list.md` frontmatter `code` 목록에 `lib/api/triggers.ts` 미등재 | `spec/2-navigation/2-trigger-list.md` frontmatter | spec frontmatter에 해당 파일 추가 (project-planner 트랙) |
| 9 | Requirement | `TriggerUpdateBody`에 `config` 최상위 키 미포함 — spec §3 PATCH note의 `config` 하위 호환 경로와 경미한 불일치 (의도적) | `lib/api/triggers.ts` — `TriggerUpdateBody` | 변경 불필요. spec의 `config` 키 항목이 혼란 유발 시 project-planner가 주석 정리 가능 |
| 10 | Scope | `apiClient` import가 `triggers/page.tsx`에 잔류 (`/workflows` 전용) — 후속 개발자 혼동 가능 | `triggers/page.tsx` 상단 import | `// /workflows 호출 전용 — m-2 workflows 트랙에서 제거 예정` 주석 추가 (선택) |
| 11 | Maintainability | `TriggerListParams.type`/`status`가 `string`으로 열려있음 — 실제 허용값은 enum 수준으로 제한됨 | `lib/api/triggers.ts` — `TriggerListParams` | `type?: "webhook" \| "schedule" \| "manual"`, `status?: "active" \| "inactive"` 리터럴 유니온으로 좁히기 |
| 12 | Maintainability | `apiClient` 잔류에 주석 없어 m-2 트랙 이전 의도 불명확 | `triggers/page.tsx` — `apiClient.get("/workflows")` | `// m-2 workflows 트랙: lib/api/workflows.ts 이전 전 임시` 주석 추가 |
| 13 | Architecture | `getById`의 `body?.data ?? body` 이중 shape 편차 흡수 — backend 응답 일관성 이슈를 클라이언트가 장기 흡수 중 | `lib/api/triggers.ts` — `getById` | backend `GET /triggers/:id` 응답 shape를 spec에서 단일 형식으로 확정 후 이중 분기 제거 |
| 14 | Architecture | `triggersApi`가 plain object singleton으로 export — Jest/Vitest 테스트 격리 시 모듈 수준 교체에 의존 | `lib/api/triggers.ts` | 팀 결정 사항. 현재 관례(`executions.ts`) 준수로 변경 필요 없음 |
| 15 | Architecture | `/workflows` 호출이 `apiClient` 직접 방식으로 잔류 — 동일 파일 내 두 패턴 혼재 | `triggers/page.tsx` | m-2 workflows 트랙 착수 시 해소 예정 |
| 16 | Documentation | `TriggerListParams` 인터페이스에 JSDoc 없음 | `lib/api/triggers.ts` 라인 88–93 | `/** GET /triggers 쿼리 파라미터. type: 'webhook'\|'schedule'\|'manual' — Spec §3 */` 추가 |
| 17 | Documentation | `triggersApi.create` 반환 `void` 의도 미문서화 | `lib/api/triggers.ts` — `create` 함수 | "응답 바디를 버린다 — 호출부는 queryKey 무효화로 재조회" 주석 추가 |
| 18 | Documentation | `chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt` 필드에 JSDoc 없음 | `lib/api/triggers.ts` 라인 63–65 | 각 필드에 Spec 섹션 참조 한 줄 주석 추가 |
| 19 | Documentation | `TriggerListItem.workflowId`와 `workflow` 필드 이중 표현 주석 부재 | `lib/api/triggers.ts` 라인 76–77 | `/** backend shape 편차 흡수 — workflow.id 와 중복 공존 */` 주석 추가 |
| 20 | Testing | 기존 drawer/page 테스트가 `apiClient` 직접 모킹 방식 유지 — `triggersApi` 내부 로직 검증 안 됨 (회귀 없음) | `trigger-detail-drawer.test.tsx`, `triggers-page.test.tsx` | 현행 테스트 유지. `triggers.test.ts` 신설로 보완 |
| 21 | User Guide Sync | 매트릭스 19개 trigger 전수 점검 — 매칭 trigger 0건. 신규 UI 문자열·백엔드 변경·i18n dict 변경 없음 | — | 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. 기존 동작 보존된 INFO 5건 (endpointPath UUID, 민감정보 평문, 타입 약화 등) |
| architecture | LOW | WARNING 3건 (뷰모델 매핑 컴포넌트 잔류, 타입 이중화, chatChannel 오버-와이드 타입). INFO 4건 |
| requirement | LOW | SPEC-DRIFT 1건 (spec §3 typed 카탈로그 패턴 미반영). INFO 6건 (기능 결함 없음) |
| scope | NONE | 선언된 M-8 1단계 범위 완전 부합. 불필요한 변경 없음 |
| side_effect | NONE | 순수 리팩터. stateless 래퍼, 공개 시그니처 무변화, 전역 상태 변경 없음 |
| maintainability | LOW | WARNING 1건 (god-component 잔류). INFO 3건 (타입 약화·주석 부재·직접 호출 잔류 설명) |
| testing | LOW | WARNING 3건 (`triggersApi` 유닛 테스트 부재·workflow 평탄화·이중 envelope 언래핑 미커버) |
| documentation | NONE | 전반적 양호. INFO 4건 (JSDoc 누락 필드, void 반환 의도 미문서화) |
| api_contract | NONE | Breaking change 없음. INFO 3건 (이중 shape 허용, 느슨한 타입 선언) |
| user_guide_sync | NONE | 매칭 trigger 0건. 동반 갱신 불필요 |

---

## 발견 없는 에이전트

- **user_guide_sync**: 매트릭스 19개 trigger 전수 점검 결과 해당 없음

---

## 권장 조치사항

1. **[즉시 — Testing]** `lib/api/__tests__/triggers.test.ts` 신설: `model-configs.test.ts` 패턴 답습하여 (a) `getById` workflow 평탄화 4-way 케이스, (b) `rotateNotificationSecret`/`revokeInteractionToken` 이중 envelope 언래핑, (c) `list`/`update`/`create` URL·파라미터·에러 전파 검증
2. **[M-8 2단계 착수 전 — Architecture/Maintainability]** `CreateTriggerBody.chatChannel` 및 `TriggerUpdateBody.chatChannel`을 `Record<string, unknown>`에서 `ChatChannelCreateInput` 구체 타입으로 교체
3. **[M-8 2단계 — Architecture/Maintainability]** `useTrigger` hook + Create Dialog 컴포넌트 추출 시, `TriggerListItem → Trigger` 매핑 함수를 `lib/api/triggers.ts` 또는 `lib/mappers/triggers.ts`로 이관하고 `Trigger` 뷰모델 타입 중복 제거
4. **[project-planner 트랙 — SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md §3`에 "frontend 구현은 `lib/api/triggers.ts` typed 카탈로그 경유" note 추가 및 frontmatter `code` 목록에 `lib/api/triggers.ts` 등재
5. **[선택적 개선]** `TriggerListParams.type`/`status`를 리터럴 유니온으로 좁히고, `apiClient` 잔류 부분에 m-2 트랙 주석 추가
6. **[선택적 개선 — Documentation]** `TriggerListParams`, `chatChannelLastError`/`chatChannelSetupAt`/`chatChannelRotatedAt` 필드, `TriggerListItem.workflowId` 이중 표현에 JSDoc 추가

---

## 라우터 결정

라우터 사용 (`routing_status=done`):

- **실행** (10명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **제외** (4명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | M-8 1단계는 순수 API 레이어 추출 리팩터 — 성능 임계 경로 변경 없음 |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | 백엔드·DB 스키마 변경 없음, 프론트엔드 전용 리팩터 |
  | concurrency | 비동기 패턴 변경 없음, React Query 기존 패턴 유지 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)