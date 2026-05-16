# 변경 범위(Scope) 리뷰

## 발견사항

### 핵심 의도 확인

plan/in-progress/cafe24-mall-dup-followup.md 에 명시된 이번 PR 의 공식 범위:
- **W20**: `buildFakeCafe24Integration` 테스트 factory 추출
- **W21**: `@ApiOperation.description` 에 라우트 순서 주의 추가
- **W23**: `IntegrationsService.create` 트랜잭션 경계 주석 명시
- **INFO 6**: precheck debounce 에 `AbortController` 도입

---

### 파일 1 (integration-oauth.service.cafe24.spec.ts) — W20

- **[INFO]** `buildFakeCafe24Integration` factory 함수에 `installToken`, `installTokenIssuedAt`, `statusReason`, `lastError` 필드가 추가되어 있으나, 기존 테스트 케이스 중 이 필드들을 실제로 override 하거나 assert 하는 케이스는 없음.
  - 위치: 파일 1, 라인 +55 ~ +58 (`installToken`, `installTokenIssuedAt`, `statusReason`, `lastError` 파라미터)
  - 상세: W20 의 취지는 기존 인라인 mock 의 반복 선언 통일이다. `installToken` 류는 현재 어떤 테스트에서도 사용되지 않아 factory 확장이 소폭 과도한 면이 있으나, 이 파라미터들은 Integration entity 의 실제 필드로 추후 테스트 작성 시 필요할 가능성이 높아 허용 가능한 수준의 미래 대비다.
  - 제안: 허용 가능. 단, 향후 `lastError` 타입이 `unknown` 인 점은 테스트 안정성을 위해 `Record<string, unknown> | null` 정도로 좁혀도 무방하다.

- **[INFO]** factory 내부에서 `workspaceId` 필드가 제거되었다. 기존 인라인 mock 일부에 `workspaceId: 'ws-1'` 가 있었으나 factory 에서는 누락.
  - 위치: 파일 1, diff `@@ -311` 영역
  - 상세: `workspaceId` 는 Integration entity 의 실제 필드이므로 의도적 제거인지 확인 필요. 단, 이 spec 파일의 테스트들은 `workspaceId` 를 assert 하지 않으므로 기능적 문제는 없다.
  - 제안: 의도적 누락이라면 factory 주석에 명시; 미래 테스트를 위해 추가해두는 것도 무해.

---

### 파일 2 (integration-oauth.service.ts) — W21 인접 변경

- **[WARNING]** 변경 내용이 `Cafe24PrecheckStatus` 타입 선언의 줄바꿈 포맷팅뿐이다 (`type` 선언을 한 줄 → 두 줄 합산).
  - 위치: 파일 2, `@@ -321`
  - 상세: 이 파일에서 W21 · W23 · INFO 6 중 어느 것도 서비스 코드 자체를 수정하지 않는다. 유일한 변경이 포맷팅 조정이어서 실질 변경 없는 줄바꿈 혼입에 해당한다. 다만 변경폭이 1 line 이고 코드 의미에 영향이 없어 위험도는 낮다.
  - 제안: 해당 포맷 변경이 자동 포매터(Prettier) 에 의한 것이라면 커밋 시 정상 포함 가능. 그렇지 않다면 이 변경은 제거해 범위를 최소화할 것.

---

### 파일 3 (integrations.controller.ts) — W21

- **[INFO]** W21 의도에 정확히 부합: `@ApiOperation.description` 에 라우트 순서 주의사항을 추가. 변경 범위 내.
  - 위치: 파일 3, `@@ -219` 영역
  - 상세: 기존 단순 설명 문자열에 라우트 선언 순서 회귀 안전망 문구 추가. 따옴표 종류가 홑따옴표→쌍따옴표로 변경된 것은 긴 문자열에 내부 작은따옴표 포함으로 인한 필수 변경이다. 허용.

---

### 파일 4 (integrations.service.ts) — W23

- **[INFO]** W23 의도에 정확히 부합: `try` 블록 앞에 트랜잭션 미적용 근거 주석 삽입. 코드 동작 변경 없음.
  - 위치: 파일 4, `@@ -371` 영역
  - 상세: 트랜잭션 경계 검토 결과를 코드 내 주석으로 남긴 것은 plan 명시 의도와 일치.

---

### 파일 5 ~ 18: 메타데이터 파일 대규모 삭제 + spec 카탈로그 롤백

- **[CRITICAL]** 파일 5 (`application.ts`), 6 (`collection.ts`), 7 (`community.ts`), 9 (`design.ts`), 10 (`mileage.ts`), 11 (`notification.ts`), 12 (`personal.ts`), 13 (`planned.ts`), 14 (`privacy.ts`), 16 (`promotion.ts`), 18 (`translation.ts`) 에서 **"Phase 8" 에서 추가된 총 51개 이상의 operation 정의가 삭제**되었으며, spec 카탈로그(파일 23 ~ 33) 에서 해당 항목들의 status 가 `supported` → `planned` 로 롤백되었다.
  - 위치: 파일 5~18 diff 전체, 파일 23~33 diff 전체
  - 상세: plan 에 명시된 4개 항목(W20/W21/W23/INFO 6) 중 어느 것도 Phase 8 메타데이터 롤백을 포함하지 않는다. 이것은 전혀 다른 작업 — 이전 커밋(Phase 8a~8j 완성 커밋들)에서 추가된 50+ operation 구현을 되돌리는 대규모 범위 이탈이다. `spec/conventions/cafe24-api-catalog/_overview.md` 의 통계도 `264 → 213 supported` 로 51건 감소 처리되었고, Phase 8a~8j 의 changelog 항목 10줄이 삭제되었다.
  - 제안: 이 변경이 의도적 revert 라면 별도 PR 에서 명시적으로 진행해야 하며, plan 에도 해당 작업을 문서화해야 한다. 현재 follow-up PR 에 포함될 범위가 아니다. 해당 변경을 이 PR 에서 제외할 것을 강력히 권고.

---

### 파일 8 (`customer.ts`), 15 (`product.ts`), 17 (`supply.ts`)

- **[WARNING]** 이 파일들의 변경은 홑따옴표 ↔ 쌍따옴표 교체, 긴 문자열의 줄바꿈 포맷 정규화, `requiredFields` 배열 줄바꿈 정규화이다.
  - 위치: 파일 8 (`customer.ts`) 2곳, 파일 15 (`product.ts`) 3곳, 파일 17 (`supply.ts`) 6곳
  - 상세: 이들은 순수 포맷팅 변경으로 의미 변경 없음. 자동 포매터 적용 결과로 보이나, 해당 파일들은 plan 에 언급된 어떤 항목(W20/W21/W23/INFO 6)과도 관련이 없다. 포맷팅 변경이 실질 변경과 혼재되면 diff 추적이 어려워진다.
  - 제안: 포맷팅 변경은 별도 PR 로 분리하거나, 팀 합의된 포매터 자동 적용 결과로 공식화할 것. 단, 기능 영향이 없으므로 CRITICAL 이 아닌 WARNING 수준.

---

### 파일 19 (cafe24-precheck.test.tsx) — INFO 6

- **[INFO]** INFO 6 의도에 정확히 부합: `AbortController.signal` 전달 검증 테스트와 abort 동작 검증 신규 테스트 추가. 변경 범위 내.
  - 위치: 파일 19 전체 diff

---

### 파일 20 (page.tsx), 21 (integrations.ts) — INFO 6

- **[INFO]** INFO 6 의도에 정확히 부합: `AbortController` 도입 및 `cafe24Precheck` API 함수의 `signal` 파라미터 추가. 변경 범위 내.
  - 위치: 파일 20, 21 전체 diff

---

### 파일 22 (plan/in-progress/cafe24-mall-dup-followup.md)

- **[INFO]** plan 문서 신규 생성. frontmatter 포함, 작업 범위 명시, 진행 상태 체크리스트 구성 — 프로젝트 규약에 부합.
  - 위치: 파일 22 전체

---

## 요약

이번 PR 의 명시된 범위(W20 테스트 factory / W21 Swagger 주석 / W23 트랜잭션 주석 / INFO 6 AbortController)에 해당하는 변경은 모두 적절히 구현되어 있다. 그러나 범위를 크게 벗어난 변경이 두 가지 포함되어 있다: 첫째, `backend/src/nodes/integration/cafe24/metadata/` 하위 11개 파일에서 Phase 8a~8j 에서 추가된 51개 이상의 operation 정의가 삭제되었으며 spec 카탈로그의 status 도 `supported → planned` 로 대규모 롤백되었다 — 이는 plan 에 전혀 언급되지 않은 이전 커밋 revert 로, 이 PR 에 포함되어서는 안 된다. 둘째, `customer.ts` / `product.ts` / `supply.ts` 등 plan 범위 외 파일에 포맷팅 전용 변경이 혼입되어 있다. CRITICAL 1건과 WARNING 2건을 처리하지 않으면 이전 Phase 8 작업이 의도치 않게 소실될 위험이 있다.

## 위험도

**HIGH**

> Phase 8 operation 정의 51건 삭제 및 spec 카탈로그 롤백은 이전 구현 작업의 실질적 소실을 의미하며, plan 에 문서화되지 않은 범위 이탈이다. 이 변경이 의도적이지 않다면 서비스에 영향을 주는 기능 회귀다.
