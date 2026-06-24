# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 테스트 파일 수정(production 코드 무변경)이며 핵심 수정 방향은 타당하다. Critical 발견 없음. 저장 성공/실패 테스트의 조건부 단언 패턴(false-positive 위험)과 로드 게이트 이후 동기 쿼리 race 가능성이 WARNING 수준으로 식별되었다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 신뢰성 | 저장 성공·실패 테스트에서 `if (!saveBtn.hasAttribute("disabled"))` 조건부 단언 — dirty 유발이 실패해도 단언이 silently skip되어 false-positive 위험 | `web-chat-page.test.tsx` 라인 267–273, 292–298 ("저장 성공 시 toast.success", "저장 실패 시 toast.error") | `expect(saveBtn).not.toBeDisabled()` 단언을 조건 바깥에서 먼저 실행해 dirty 상태 진입을 명시 검증한 뒤 클릭·단언으로 진행. 또는 dirty 유발에 `data-testid`·role 기반 신뢰성 있는 selector 사용 |
| 2 | 테스트 신뢰성 | `findAllByText("Support bot")` 로드 게이트 resolve 시점에 WebChatDetail 하위 컴포넌트(Save 버튼 등)가 아직 마운트 중일 수 있어 이후 동기 `getByRole` 호출의 race 가능성 잠재 | `web-chat-page.test.tsx` 라인 161, 170, 180, 237, 248, 282 — `findAllByText` 직후 동기 쿼리 사용 각 지점 | Save 버튼 자체를 `await screen.findByRole("button", { name: /^Save$/i })` 로 대기하거나, 상세 패널 렌더 완료를 나타내는 더 구체적인 요소로 로드 게이트 교체 |
| 3 | 유지보수성 | 들여쓰기 불일치 — `describe("저장 버튼 흐름")` 블록 내 주석·`await` 라인이 2-space로 삽입되어 주변 `it` 본문의 4-space(또는 6-space)와 혼재. 가독성 저하 | `web-chat-page.test.tsx` diff 라인 100–102, 111–113, 122–124 | 해당 3곳의 들여쓰기를 주변 `it` 블록 본문 기준으로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 동일한 3줄 주석+`await screen.findAllByText("Support bot")` 패턴이 6곳에 복사되어 있어 향후 레이아웃 변경 시 6곳을 동시에 수정해야 함 | 라인 291–293, 300–302, 309–311, 367–369, 377–380, 411–414 | `async function waitForInstanceLoaded(name = "Support bot") { await screen.findAllByText(name); }` 헬퍼 추출로 변경 지점 단일화 |
| 2 | 테스트 표현성 | `findAllByText` 로드 게이트 하나에서 `.length > 0` 단언이 중복 — `findAllByText`는 매칭 없으면 자체 에러 throw | 라인 146 (`expect((await screen.findAllByText("Support bot")).length).toBeGreaterThan(0)`) | `await screen.findAllByText("Support bot");` 만으로 충분. 나머지 5곳과 패턴 통일 |
| 3 | 테스트 표현성 | `toBeGreaterThan(0)` 조건은 단일 렌더로도 통과 — #692 목록+헤더 2개 동시 렌더 구조가 테스트에 명시되지 않음 | 라인 146 | `toHaveLength(2)` 또는 `toBeGreaterThanOrEqual(2)` 로 변경하면 #692 구조를 명시적으로 표현. 단, brittle 트레이드오프 고려 후 팀 컨벤션 따를 것 |
| 4 | 테스트 의도 | 저장 성공/실패 테스트에서 `if (disabled)` 조건부 패턴은 이번 커밋 범위 밖 기존 코드. false-positive 위험은 WARNING 1번과 동일 근거로 이미 포착됨 | 라인 400–405, 425–430 | WARNING 1번 제안과 동일하게 처리 |
| 5 | 보안 | 픽스처 데이터는 더미값(`id: "t-1"`, `workflowId: "wf-1"`) 사용, 하드코딩 시크릿 없음 | `WEBHOOK_INSTANCE` / `WEBHOOK_INSTANCE_2` / `NON_INTERACTION_WEBHOOK` 상수 | 현행 유지 |
| 6 | 보안 | 신규 의존성 추가 없음. API 호출 전부 mock 처리로 실제 네트워크 노출 없음 | `vi.mock("@/lib/api/client", ...)` 블록 | 현행 유지 |
| 7 | 요구사항 적합성 | `findAllByText` 교체는 "페이지 로드 대기" 원래 의도를 정확히 보존. spec §1 이중 렌더 구조와 일치 | diff 전체 (`findByText` → `findAllByText` 6곳) | 현행 유지 |
| 8 | 변경 범위 | 단일 테스트 파일에만 국한, 불필요한 리팩토링·임포트 변경·기능 확장 없음 | `codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx` | 현행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 관점 신규 위험 없음. 픽스처 더미값, API 전체 mock 처리 |
| requirement | NONE | spec 5-admin-console.md 이중 렌더 구조와 일치. 요구사항 충족 |
| scope | NONE | 단일 테스트 파일 수정에 집중, 범위 이탈 없음. 들여쓰기 불일치만 포맷 이슈 |
| side_effect | (재시도 필요) | output_file 미존재 — 실행 fatal |
| maintainability | LOW | 들여쓰기 불일치(WARNING), 대기 패턴 6곳 중복(WARNING), 단언 방식 불일치(INFO) |
| testing | LOW | 조건부 단언 false-positive 위험(WARNING), 동기 쿼리 race 가능성(WARNING) |

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 발견사항 보고).

## 권장 조치사항

1. **[WARNING 1 — 테스트 신뢰성]** `if (!saveBtn.hasAttribute("disabled"))` 조건부 단언 제거 — `expect(saveBtn).not.toBeDisabled()` 를 먼저 단언해 dirty 유발 실패 시에도 테스트가 명확히 실패하도록 재작성. 해당 라인 267–273, 292–298.
2. **[WARNING 2 — race 가능성]** `findAllByText` 로드 게이트 이후 동기 쿼리를 `await screen.findByRole(...)` 등의 비동기 쿼리로 교체하거나, 상세 패널 렌더 완료를 더 정확히 대기하는 로드 게이트로 교체.
3. **[WARNING 3 — 들여쓰기]** `describe("저장 버튼 흐름")` 블록 내 3곳의 들여쓰기를 주변 코드와 일치시키도록 수정.
4. **[INFO — 중복 패턴]** 6곳에 반복된 `findAllByText` 대기 패턴을 `waitForInstanceLoaded` 헬퍼로 추출하면 향후 구조 변경 시 수정 지점을 단일화 가능 (선택적 개선).
5. **[INFO — 단언 중복]** 라인 146의 `.length > 0` 단언 제거 또는 `toHaveLength(2)` 로 교체해 나머지 패턴과 일치시킴 (선택적 개선).
6. **[재시도 필요]** `side_effect` 리뷰어가 fatal 종료하여 결과 없음. 부작용 측면 재검토 권장.

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

**실행 (6명, 전원 router_safety 강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`

**제외 (8명)**:

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 순수 테스트 파일 수정, 성능 관련 코드 변경 없음 |
| architecture | 아키텍처 변경 없음 |
| documentation | 문서 변경 없음 |
| dependency | 신규 의존성 추가 없음 |
| database | DB 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| api_contract | API 계약 변경 없음 |
| user_guide_sync | 사용자 가이드 연관 변경 없음 |

**강제 포함 (router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 목록과 동일)