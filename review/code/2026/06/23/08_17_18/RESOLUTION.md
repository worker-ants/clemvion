# Code Review 후속 처리 (RESOLUTION) — M-8 1단계

리뷰 대상: `refactor(triggers): M-8 1단계 — lib/api/triggers.ts API 레이어 추출` (commit `04134331`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, Warning 7, INFO 21.

본 PR 은 **behavior-preserving 리팩터**(API 레이어 추출). fix 원칙: 동작 무변 + 검증/타입/문서 강화 항목만 즉시 적용, god-component 구조·뷰모델 매핑·타입 SoT 단일화 등 **컴포넌트 분리를 수반하는 항목은 M-8 2단계로 defer**(리뷰가 직접 그렇게 권고).

---

## 즉시 수정 (이번 후속 커밋)

| 출처 | 항목 | 조치 |
|------|------|------|
| **W-1 / W-2 / W-3** (Testing) | `lib/api/triggers.ts` 유닛 테스트 부재 / `getById` workflow 평탄화 4-way 미커버 / rotate·revoke 이중 envelope 언래핑 미커버 | `lib/api/__tests__/triggers.test.ts` 신설(12 tests, `model-configs.test.ts` 관례). `list`(params·정규화·bare-array fallback), `getById`(workflowId 최상위/`workflow` 중첩/둘다/둘다없음 4-way + 무-envelope), `update`/`create`(단일 PATCH·POST URL·body), `rotateNotificationSecret`/`revokeInteractionToken`(`res.data.data` 이중 언래핑), `rotateBotToken`(전용 엔드포인트·body) 검증 |
| **INFO #11** (Maintainability) | `TriggerListParams.type`/`status` 가 `string` 으로 열림 | 허용 enum 리터럴 유니온(`"webhook"\|"schedule"\|"manual"`, `"active"\|"inactive"`)으로 narrowing. 호출부 할당(`activeTab`/`statusFilter`) 타입 호환 확인(typecheck PASS) |
| **INFO #16 / #17 / #19** (Documentation) | `TriggerListParams`·`create`(void 의도)·`TriggerListItem.workflow` JSDoc 부재 | 각 JSDoc 추가 |
| **INFO #10 / #12 / #15** (Scope/Maintainability) | `triggers/page.tsx` 의 `/workflows` apiClient 직접 잔류 의도 불명확 | "`/workflows` 는 workflows 도메인 → m-2 workflows 트랙 이전 예정" 주석 추가 |

재검증: lint(touched clean) · typecheck PASS · vitest **6 suites / 66 tests PASS**(+triggers.test.ts 12).

---

## Deferred — M-8 2단계 (리뷰가 직접 권고)

| 출처 | 항목 | 근거 |
|------|------|------|
| **W-4** (Architecture) | `page.tsx` 의 뷰모델 매핑(`raw.map`)·hex-regex 클라이언트 검증 잔류 | 리뷰: "M-8 2단계에서 `useTrigger` hook 추출 시 매핑 함수를 `lib/api`/`lib/mappers` 로 이관". 본 단계는 API 레이어만 — 매핑은 컴포넌트 분리(2단계) 영역 |
| **W-5** (Architecture) | `TriggerListItem`(raw) ↔ `Trigger`(뷰모델) 타입 이중 존재 | 리뷰: "M-8 2단계 hook 추출 시 매핑 함수 공식 분리·타입 SoT 단일화". 현재는 raw/뷰모델 분리가 의도적(API shape vs 표시 shape) |
| **W-6** (Architecture) | `chatChannel`/`notification`/`interaction` 가 `Record<string, unknown>` 오버-와이드 | **behavior-preserving 유지** — 바디는 backend 로 그대로 전달, 금지 키(`botTokenRef`·`inboundSigningPlaintext`)는 backend 가 400 으로 차단(서버 enforce). 전용 입력 타입 신설은 호출부 생성 로직 변경을 수반 → 2단계 권장(리뷰 동일 판단) |
| **W-7** (Maintainability) | `TriggersPage` god-component(폼 상태 8·쿼리 3·뮤테이션 2) 잔류 | **pre-existing** — 본 PR 이 만든 구조 아님(API 호출만 이전). 리뷰: "M-8 2단계에서 `useCreateTriggerForm` hook + Create Dialog 추출 최우선" |

---

## Deferred — planner-only / pre-existing / 의도적

- **INFO #1 (SPEC-DRIFT) + #8** — spec `§3` 에 "typed 카탈로그 경유" note + frontmatter `code:` 에 `lib/api/triggers.ts` 등재 → **planner-only**(developer `spec/` read-only). 행위 계약 무변, frontend api 계층은 코드베이스 관례(spec 규약 아님, plan B 판정).
- **INFO #2 (Security)** — `endpointPath` 클라이언트 `crypto.randomUUID()` → **known-deferred** `trigger-review-deferred-fixes.md` W1(서버 UUID 강제). 본 PR 이 verbatim 보존(impl-prep I-8 동일 인지).
- **INFO #3 (Security)** — `botToken`/`inboundSigningPlaintext` 평문 전송 → **pre-existing**, HTTPS 전제 보호. 서버 로그 마스킹은 backend 관심사.
- **INFO #5 (Security)** — rotate secret state 노출 → **이미 `SecretRevealBox` 가 60s auto-dismiss 처리**(verbatim 보존, 본 PR 무변경).
- **INFO #4 / #6 (Security)** — chatChannel 금지 키 클라이언트 필터 / Zod 런타임 검증 → backend enforce 로 충분(금지 키 400). Zod 도입은 별도 이니셔티브.
- **INFO #7 (Requirement)** — `create` 반환 `void` → **의도적**(현 호출부는 생성 id 미사용, queryKey 무효화로 재조회). JSDoc 문서화 완료.
- **INFO #9 (Requirement)** — `TriggerUpdateBody` 에 `config` 최상위 키 미포함 → **의도적**(R-4 단일 경로의 명시 키 사용). spec §3 `config` 항목 혼란은 planner 주석 정리 대상.
- **INFO #13 / #14 (Architecture)** — `getById` 이중 shape 흡수 / `triggersApi` plain-object singleton → backend 응답 shape SoT 확정은 planner; singleton 은 `executions.ts` 관례 준수(변경 불요).
- **INFO #18 (Documentation)** — `chatChannelLastError`/`SetupAt`/`RotatedAt` JSDoc → drawer 에서 verbatim 이동된 필드. 저우선 nit, 2단계 정리 시 동반 가능.
- **INFO #20 (Testing)** — 기존 drawer/page 테스트 apiClient 모킹 유지 → 회귀 없음(public surface 보존), 신규 `triggers.test.ts` 로 보완 완료.
- **INFO #21 (User Guide)** — 매칭 trigger 0건, 조치 불요.

---

## 결론

Critical 0. Warning 7 중 Testing 3건(W-1/2/3) 즉시 fix, Architecture/Maintainability 4건(W-4/5/6/7)은 리뷰 권고대로 M-8 2단계 defer(behavior-preserving 보존). INFO 는 즉시개선(타입 narrowing·JSDoc·주석)/planner-only/pre-existing/의도적으로 분류·근거 기록.
재검증 green. fresh `/ai-review --commit HEAD` 로 수렴 확인 예정.
