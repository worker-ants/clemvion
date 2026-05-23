# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 버그 수정(버튼 무반응 회귀)이 올바르게 구현됐으며 보안·범위·부작용 관점에서 위험 없음. 유지보수성과 테스트 커버리지에 개선 여지가 일부 존재함.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 / 유지보수성 | 코드 주석이 실제 동작과 불일치 — "form 분기에서 `capped.payload`를 직접 읽는다"고 서술하나, 실제로는 `normalisedPayload`(=`backfillButtonUuids` 반환값)가 `formConfig`에 대입됨. 동작은 동일하나 미래 리뷰어가 오해할 수 있음 | `render-tool-provider.ts` line 590–592 | 주석을 "backfillButtonUuids is a no-op for form (early-return in the helper), so normalisedPayload === capped.payload for form" 으로 수정 |
| 2 | 유지보수성 | `isSelected` 판별 로직이 `CarouselContent`와 `PresentationContent` 두 곳에 각각 복사돼 있어 향후 변경 시 이중 수정 필요 | `presentation-renderers.tsx` CarouselContent line 249 / PresentationContent line ~512 | 파일 상단에 `isButtonSelected(selectedId, btnId)` 헬퍼를 추출해 두 컴포넌트에서 호출 |
| 3 | 테스트 | `PresentationContent` 전역 buttons 경로에 동일한 `isSelected` 가드가 추가됐으나, 해당 경로의 `undefined id` 클릭 테스트가 없어 회귀 위험 잠재 | `presentation-renderers.test.tsx` — PresentationContent describe 블록 | `buttonConfig.buttons`에 `id` 없는 버튼 + `selectedButtonId` 미전달 시 `onPortButtonClick` 호출됨을 검증하는 케이스 추가 |
| 4 | 테스트 | `table`, `chart`, `template` 세 타입을 단일 `it()` 블록에서 검증해 실패 시 원인 특정이 어려움 | `render-tool-provider.spec.ts` lines 105–136 | `it.each` 또는 개별 `it()` 블록으로 분리 |
| 5 | 문서 | `spec-drift-parallel-count.md` 및 `spec-drift-ws-button-config.md`의 frontmatter `worktree`가 `(TBD)` / `(TBD — ...)` 로 미완성 — plan 라이프사이클 규약 위반 | `plan/in-progress/spec-drift-parallel-count.md` L2, `plan/in-progress/spec-drift-ws-button-config.md` L2 | 처리 worktree 결정 시 frontmatter 업데이트. 현 worktree 무관임을 명확히 하려면 `plan/complete/archive/`로 이동 또는 별도 plan으로 분리 후 worktree 할당 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | plan 문서 §C에 helper 함수명이 `normalizeButtonIds`로 기재됐으나 실제 구현·spec 모두 `backfillButtonUuids`로 확정됨 | `plan/in-progress/render-presentation-button-click-fix.md` §C | plan 완료 처리(complete/ 이동) 전에 `backfillButtonUuids`로 정정 |
| 2 | 요구사항 | TDD 체크리스트 항목 "truncate된 아이템 안의 버튼은 처리 안 함"을 직접 검증하는 테스트 부재 (기능 동작은 올바르나 체크리스트 미완결) | `render-tool-provider.spec.ts` — backfillButtonUuids describe | 선택적 개선 — truncation 발생 payload에서 잘려나간 items의 버튼에 UUID가 없음을 assert하는 케이스 추가 |
| 3 | 유지보수성 | `(b as Record<string, unknown>)` 타입 캐스팅 패턴이 `fillButtons` 내부·carousel items 순회에서 3–4회 중복 | `render-tool-provider.ts` backfillButtonUuids 내부 | `const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';` 헬퍼 추출 후 사용 |
| 4 | 유지보수성 | `fillButtons` 반환 타입이 `unknown`으로 호출부에서 타입 정보 손실 | `render-tool-provider.ts` | 반환 타입을 `unknown[]` 또는 `Record<string, unknown>[]`로 명시 |
| 5 | 유지보수성 | `buttons`, `items`, `itemButtons` 세 갈래의 가드 패턴이 구조적으로 유사하나 표현이 미묘하게 달라 향후 새 타입 추가 시 확장 번거로움 | `render-tool-provider.ts` | `hasArray` 로컬 헬퍼로 가드 통일 |
| 6 | 유지보수성 | `backfillButtonUuids`가 `export`되어 공개 API이지만 `@internal` JSDoc 태그 없음 | `render-tool-provider.ts` | `@internal` JSDoc 태그 추가 고려 |
| 7 | 테스트 | `form` 경로에서 `normalisedPayload`가 `formConfig`에 전달되는 통합 경로(early-return passthrough) 명시 테스트 없음 | `render-tool-provider.spec.ts` | 낮은 우선순위 — form 경로의 passthrough 동작을 서술하는 단위 테스트 1건 추가 권고 |
| 8 | 테스트 | `CarouselContent`의 `isSelected` 가드 테스트가 `type: "port"` 버튼만 사용 — `type: "link"` 버튼의 클릭 단락 회귀 검증 없음 | `presentation-renderers.test.tsx` | `type: "link"` 버튼 케이스를 선택적으로 추가 |
| 9 | 문서 | `backfillButtonUuids` JSDoc에 `@param`/`@returns` 태그 없어 IDE hover에서 파라미터 의미 생략 | `render-tool-provider.ts` | `@param type`, `@param payload`, `@returns` 태그 추가 |
| 10 | 문서 | `CarouselContentProps.selectedButtonId` 및 `PresentationContentProps.selectedButtonId`에 JSDoc 없음 — undefined가 정상 케이스임을 인터페이스 수준에서 미명시 | `presentation-renderers.tsx` | undefined 정상 케이스를 명시한 prop JSDoc 추가 |
| 11 | 문서 | plan 파일 함수명 잔재 — `normalizeButtonIds` 표기 (INFO #1과 동일, 문서화 관점에서도 동일 지적) | `plan/in-progress/render-presentation-button-click-fix.md` | complete/ 이동 전 `backfillButtonUuids`로 정정 |
| 12 | 보안 | `randomUUID()` 출처 — `node:crypto` 내장 CSPRNG 사용으로 UUID 충돌/예측 리스크 없음. Zod 검증 후 처리, 스프레드 복사로 원본 오염 없음 | `render-tool-provider.ts` import 라인 | 조치 불필요 |
| 13 | 범위 | `review/consistency/` 산출물 파일 다수 포함 — developer 워크플로 의무 단계 아티팩트로 범위 이탈 아님 | `review/consistency/2026/05/23/10_28_45/`, `10_42_12/` | 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | UUID 생성에 CSPRNG 사용, Zod 검증 후 처리, 스프레드 복사로 원본 오염 없음. 보안 위험 없음 |
| requirement | LOW | form 분기 주석-코드 불일치(WARNING 1건). spec §10.5와 구현이 line-level 일치 |
| scope | NONE | 24개 파일 전체가 plan의 명시 범위(A/C/S 3축) + 일관성 검토 의무 아티팩트로 완전 설명됨 |
| side_effect | NONE | 불변 스프레드 패턴, 외부 I/O 없음, 전역 상태 변경 없음 |
| maintainability | LOW | isSelected 로직 이중 복사(WARNING), plan 문서 함수명 잔재 |
| testing | LOW | PresentationContent 경로의 undefined id 클릭 테스트 누락(WARNING) |
| documentation | LOW | spec-drift plan 2건의 worktree frontmatter 미완성(WARNING) |

---

## 라우터 결정

`routing_status=done` (router 선별):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 모두 router_safety 강제)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | null 체크 가드 1줄 — I/O·반복·대용량 처리 변경 없음 |
| architecture | 모듈 경계 변경 없음 |
| dependency | node:crypto 는 Node.js 내장 모듈 — package.json 변경 없음 |
| database | schema 마이그레이션·ORM 변경 없음 |
| concurrency | async/Promise/락 코드 변경 없음 |
| api_contract | HTTP route/GraphQL schema 변경 없음 |
| user_guide_sync | 새 노드/schema 변경/enum 값 추가 아님 |
