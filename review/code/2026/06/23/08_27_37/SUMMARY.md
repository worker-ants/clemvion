# Code Review 통합 보고서

리뷰 대상 커밋: `ac804f2a4510631b552dcbd96fa6d7a2dc2a91c8`
작업: `refactor(triggers): M-8 1단계 review fix — triggersApi 유닛 테스트 + 타입/문서 강화`
생성일: 2026-06-23

---

## 전체 위험도

**LOW** — 신규 보안·기능 결함 없음. 아키텍처 WARNING 3건은 모두 M-8 2단계로 명시 defer된 pre-existing 항목. 즉각 차단 항목 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 컴포넌트(`page.tsx`) `queryFn` 내 `Trigger` 뷰모델 매핑 15줄 잔류 — SRP 미완성 (M-8 2단계 defer 합의됨) | `codebase/frontend/src/app/(main)/triggers/page.tsx` L205–219 | M-8 2단계 hook 추출 시 `lib/mappers/triggers.ts` 로 이관 |
| 2 | Architecture | `TriggerListItem`(raw) ↔ `Trigger`(뷰모델) 타입 이중 선언 — 필드 추가 시 drift 위험 (M-8 2단계 defer 합의됨) | `triggers.ts` `TriggerListItem` / `page.tsx` `interface Trigger` | M-8 2단계 mapper 분리 시 통합 |
| 3 | Architecture | `CreateTriggerBody.chatChannel` / `TriggerUpdateBody.chatChannel/notification/interaction` — `Record<string, unknown>` 오버-와이드 타입 (M-8 2단계 defer 합의됨, RESOLUTION.md W-6) | `codebase/frontend/src/lib/api/triggers.ts` L105, L121–123 | M-8 2단계에서 `ChatChannelCreateInput` 등 구체 입력 타입 신설 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `2-trigger-list.md §3` API 표에 frontend typed 카탈로그(`lib/api/triggers.ts`) 패턴 미반영 — 코드 오류 아님, spec 갱신 누락 | `spec/2-navigation/2-trigger-list.md §3` | project-planner 트랙: §3 하단에 `lib/api/triggers.ts` note 추가 + frontmatter `code:` 등재 |
| 2 | Testing | `triggersApi.list` — `totalItems` 필드 및 정상 envelope 케이스의 `page` 필드 단언 누락 | `triggers.test.ts` L34–51 | `expect(result.totalItems).toBe(...)`, `expect(result.page).toBe(2)` 추가 |
| 3 | Testing | 에러 전파(network error) 테스트 부재 — `model-configs.test.ts` 관례 미충족 | `triggers.test.ts` 전체 | 대표 함수 1개(`list`)에 `mockRejectedValue` 케이스 추가 |
| 4 | Testing | `rotateNotificationSecret`/`revokeInteractionToken` — `res.data` null 또는 `data` 키 없는 예외 경로 미커버 | `triggers.test.ts` L131–156 | M-8 2단계 Zod 도입 시 함께 커버 권고 |
| 5 | Testing | `beforeEach` 최상위 단일 선언 — `model-configs.test.ts` 의 describe 내부 선언 패턴과 불일치 (스타일) | `triggers.test.ts` L29 | 필수 아님. 관례 통일 시 각 describe 내부로 이동 |
| 6 | Documentation | `TriggerDetail.chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` 필드 JSDoc 부재 | `triggers.ts` L63–65 | 각 필드에 Spec Chat Channel §4.1 참조 한 줄 JSDoc 추가 (2단계 정리 시 동반 가능) |
| 7 | Documentation | `TriggerListParams.page`/`limit` 필드 설명 없음 — spec 직접 참조 필요 | `triggers.ts` L89–95 | `/** 1-based 페이지 번호. */` 수준 추가 — 저우선 nit |
| 8 | Maintainability | `TriggerUpdateBody` 세 필드(`notification`/`interaction`/`chatChannel`) `Record<string, unknown>` 반복 — `TriggerDetail.config` 하위 구체 인터페이스와 이중화 (M-8 2단계 defer) | `triggers.ts` L116–124 | defer 메모 JSDoc 추가 권고: `/** @see TriggerDetail.config.notification — M-8 2단계 구체 타입 교체 예정 */` |
| 9 | Maintainability | `getById` 내 `as` 이중 캐스팅 패턴 — 런타임 안전성 없는 타입 강제 단언 (의도는 JSDoc 명시됨) | `triggers.ts` L138–141 | 현 수준 허용. Zod 도입 시 자연 해소 |
| 10 | Maintainability | 테스트 `describe` 이름에 `(R-4)` 내부 추적 코드 포함 — 시간 경과 시 의미 소실 가능 | `triggers.test.ts` L209 | 프로젝트 관례 확인 후 단순화 여부 결정 |
| 11 | Maintainability | `rotateBotToken` 테스트에 `// void — no return value to assert` 주석 미기재 — 의도 불명확 | `triggers.test.ts` L154–161 | 선택적 주석 추가 |
| 12 | API Contract | `GET /triggers/:id` 이중 envelope/bare shape — 백엔드 계약 불확정 상태 클라이언트 흡수 (pre-existing) | `triggers.ts` `getById`, 테스트 전체 | 백엔드 응답 shape spec 단일 확정 후 이중 분기 제거 백로그 |
| 13 | API Contract | `POST /triggers` 생성 후 ID 즉시 활용 불가 (`void` 반환) — 향후 UX 확장 시 시그니처 변경 필요 | `triggers.ts` `create` | 생성 직후 drawer 오픈 등 UX 추가 시 `Promise<{ id: string }>` 확장 |
| 14 | Security | 테스트 fixture `"123456:ABCDEF"` — Telegram Bot Token 형식과 유사 (명백한 플레이스홀더, 실제 자격증명 아님) | `triggers.test.ts` L260 | 선택적: `"TEST_BOT_TOKEN"` 같이 포맷 유사성 낮은 값으로 교체 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 테스트 fixture 플레이스홀더, 타입 narrowing 긍정적 변경 |
| architecture | LOW | WARNING 3건 — 뷰모델 매핑 잔류, 타입 이중 선언, 오버-와이드 chatChannel 타입 (모두 M-8 2단계 defer) |
| requirement | NONE | W-1/W-2/W-3 완전 이행 확인. SPEC-DRIFT 1건(spec 갱신 누락) |
| scope | NONE | 변경 범위 엄격 준수. 요청 외 수정 없음 |
| side_effect | NONE | 런타임 동작 변경 없음. 공개 API 시그니처 완전 유지 |
| maintainability | NONE | INFO 4건 — 오버-와이드 타입 반복, 이중 캐스팅, 추적 코드 포함 테스트명, void 주석 누락 |
| testing | LOW | INFO 6건 — `totalItems` 단언 누락, 에러 전파 케이스 부재, 이중 envelope 예외 경로 미커버 등 |
| documentation | NONE | INFO 3건 — `chatChannel*` 필드 JSDoc 부재, `page`/`limit` 설명 누락, 파일 수준 주석 부재 |
| api_contract | NONE | INFO 5건 — 전반적으로 안전. 이중 envelope 흡수 pre-existing, breaking change 없음 |

---

## 발견 없는 에이전트

없음 (모든 에이전트 발견사항 있음, 단 전부 INFO 또는 deferred WARNING).

---

## 권장 조치사항

1. **[SPEC-DRIFT 처리 — project-planner]** `spec/2-navigation/2-trigger-list.md §3` 하단에 `lib/api/triggers.ts` typed 카탈로그 note 추가 및 frontmatter `code:` 등재. 코드 revert 없이 spec 갱신만 필요.
2. **[Testing 보완 — 소규모]** `triggers.test.ts` 에 `list` 의 `totalItems` 단언 + 에러 전파(`mockRejectedValue`) 케이스 추가 — `model-configs.test.ts` 관례 맞춤.
3. **[Documentation nit]** `TriggerDetail.chatChannelLastError`/`chatChannelSetupAt`/`chatChannelRotatedAt` 필드에 Spec Chat Channel §4.1 참조 JSDoc 한 줄 추가 (M-8 2단계 정리 시 동반 가능).
4. **[M-8 2단계 트랙]** WARNING 3건(뷰모델 매핑 잔류, 타입 이중화, 오버-와이드 chatChannel 타입) + Zod 도입 시 이중 envelope 예외 경로 커버 — 이미 RESOLUTION.md 에 defer 합의됨, 별도 action 불필요.

---

## 라우터 결정

routing_status=done (router 가 선별):

- **실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 선별 제외 |
| dependency | router 선별 제외 |
| database | router 선별 제외 |
| concurrency | router 선별 제외 |
| user_guide_sync | router 선별 제외 |