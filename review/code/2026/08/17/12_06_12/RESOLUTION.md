# RESOLUTION — 12_06_12

대상 SUMMARY: `review/code/2026/08/17/12_06_12/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **6**, INFO 5)

**처분: 6건 전부 조치.** 코드/테스트 수정 5건 + 설계 경계 문서화 1건. INFO 5건은 비차단으로 종결(사유는 §INFO).

---

## WARNING

### 1. `fireEvent.submit` 이 버튼 배선을 검증하지 못한다 (testing) — **수정**

리뷰어의 뮤턴트를 그대로 재현해 확인했다. `type="submit"` → `type="button"` 으로 바꾸면
이 테스트만 GREEN 을 유지했다 — 폼 `onSubmit` 을 직접 때리므로 버튼이 폼에 연결돼 있는지를
묻지 않았다.

`fireEvent.click(button)` 으로 통일하고, 같은 파일의 다른 13건이 이미 click 을 쓰는 선례를
주석으로 남겼다.

**재검증(뮤테이션)**: `type="button"` 뮤턴트 → **14 failed / 11 passed**. 이 테스트가 이제
RED 집합에 포함된다(수정 전에는 이 뮤턴트에서 홀로 GREEN).

- `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`

### 2. 힌트에 음의 단언이 없다 (testing) — **수정**

역시 리뷰어 뮤턴트로 확인: 노출 조건을 `true &&` 로 바꿔 **항상 노출**시켜도 23건 전원 GREEN.
"뜬다"만 물었지 "안 떠야 할 때 안 뜨는가"를 묻지 않았다.

두 갈래로 고쳤다:

- 기존 테스트를 마스킹 필드 + 평범한 필드를 **함께** 렌더하도록 바꾸고
  `getAllByText(...)` 가 정확히 1건임을 단언 — 필드 수만큼 새는 경우도 잡힌다
- 마스킹이 하나도 없을 때 힌트가 아예 없다는 별도 테스트 추가(`not.toBeInTheDocument()`)

**재검증(뮤테이션)**: `true &&` 뮤턴트 → **2 failed / 23 passed**. 두 테스트가 정확히 이
뮤턴트를 잡는다.

- 같은 테스트 파일

### 3. 정확 일치만 잡고 부분-매치 마스킹은 통과한다 (security / requirement) — **경계로 문서화, 코드 유지**

사실 확인은 맞다. `postgres://user:pw@db` 는 backend 에서 `postgres://***@db` 가 되고, 이 값은
마커를 **포함**할 뿐 마커와 **같지** 않아 그대로 프리필된다.

그럼에도 **넓히지 않는다**. 포함으로 바꾸면 `a***b` 같은 정상 기본값까지 비워져 가드가 정상
워크플로를 망가뜨린다 — 이 PR 이 막으려는 것이 바로 "조용히 잘못된 값이 제출되는" 일인데,
과잉 차단은 같은 부류의 피해를 반대 방향으로 만든다. 부분-매치 잔여는 자격증명이 **이미
가려진** 값이라 노출 위험이 아니라 편집 유도 실패이고, 사용자가 필드를 보고 고칠 수 있다.

리뷰어의 권고(문서화)를 그대로 받아 두 곳에 고정했다:

- `isMaskedMarker` JSDoc 에 "정확 일치만 잡는다(의도)" + 넓히지 않는 이유(오탐 비용 > 미탐 비용)
- **캐너리 테스트**로 경계를 못박음 — `postgres://***@db.internal/prod` 는 계속 프리필된다.
  나중에 누가 포함-매치로 넓히면 이 테스트가 RED 로 알린다

### 4. CHANGELOG Unreleased 가 stale (documentation) — **수정**

직전 항목에 내가 "프런트 마커 가드는 트래커에 등재했다"고 써 뒀는데, 이번 커밋이 그걸
구현하면서 그 문장이 거짓이 됐다. 해당 문장을 이번 구현을 가리키도록 고치고, 아직 닫히지
않은 범위(Re-run·히스토리 로드)를 명시했다.

- `CHANGELOG.md`

### 5. `text-muted-foreground` 가 CSS 를 만들지 않는다 (maintainability) — **수정**

실측으로 확인했다: `globals.css` 에 `@theme` 매핑이 없어 이 유틸리티는 규칙을 생성하지 않는다.
저장소 관용구는 `text-[hsl(var(--muted-foreground))]` 이며 사용 빈도도 698 대 10 으로 압도적이다.
안내 문구가 기본 전경색으로 렌더될 뻔했다.

- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`

### 6. 미러 이름이 backend SoT 와 다르다 (maintainability) — **수정**

미러 동기화를 grep 으로 하는 이상 이름이 다르면 다음 사람이 못 찾는다.

- `MASK_MARKERS` → `MASKED_MARKERS` (export 로 승격)
- `isMaskedValue` → `isMaskedMarker`
- 두 곳이 왜 손으로 복제돼 있고 이름을 맞춰야 하는지를 JSDoc 에 남김

---

## INFO (비차단 종결)

| # | 처분 |
|---|------|
| 7 | 마커 상수 backend/frontend 수동 복제 — **트래커 유지**. 이번 PR 에서 이름을 맞춰(W6) grep 동기화는 성립. 계약 테스트는 공유 패키지 추출과 같이 판단할 항목이라 별건 |
| 8~10 | 문서 시제·표현 — W4 갱신에 흡수 |
| 11 | §R17 "프리필 왕복" 불릿이 Rationale 전용 — 기존 consistency WARNING #3 과 동일 사안. 그 항목 해소 시 함께 반영(리뷰어도 "조치 불요" 판정) |

---

## 검증

TEST WORKFLOW 4단계 전부 PASS (fix 적용 후 재실행):

| 단계 | 결과 |
|---|---|
| lint | PASS (53s) |
| unit | PASS — backend 427 suites / 8,812, frontend 6,025(6,024 pass), 내부 packages 451 + 23 files |
| build | PASS (117s) |
| e2e | PASS — backend supertest 276 + playwright 51 |

대상 테스트 파일 단독: **25 passed (25)**.
