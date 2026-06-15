# RESOLUTION — authentication God Component 분리 (config-c1-auth-god-split)

> 대상 리뷰: `review/code/2026/06/16/00_39_27/SUMMARY.md` (fresh, 2차) — Critical 0 / WARNING 10 / INFO 15.
> 1차 리뷰: `review/code/2026/06/16/00_22_46/SUMMARY.md` — Critical 0 / WARNING 4.
> 본 PR 의 절대 제약: **순수 구조 리팩토링 — 동작·UI·API 호출·i18n 불변**(plan `spec-sync-config-gaps.md` "God Component 분리"). 동작을 바꾸는 수정은 본 PR 범위 밖.

## 처분 요약

| 분류 | 처분 |
| --- | --- |
| 1차 testing W1·W2·W3 | **FIXED** (commit 9ad6310a) — 훅 renderHook 테스트·`pickPlaintextSecret` 유닛·generatedKey 표시 경로 |
| 2차 security W1·W2 (regenerate/delete RBAC) | **DEFER** — 기존 상태(git 증거), 백엔드 fail-closed, 수정=동작변경. 후속 plan 추적 |
| 2차 W3·INFO-6 (regenerate 평문 미표시) | **ACCEPT(기존동작)** — 분리 전과 byte-identical 동작 |
| 2차 testing W4·W5, INFO-10·11·12 | **PARTIAL FIX / ACCEPT** — 일부 즉시 반영, 나머지 통합테스트로 커버됨 |
| 2차 architecture W6·W10, maintainability W7·W8·W9 | **DEFER** — 동작보존 추출이 기존 패턴 유지. 유지보수 개선은 후속 |
| SPEC-DRIFT (frontmatter `code:`) | **위임** — planner(`spec-update-c-sync-promotions.md`) |

---

## 상세 disposition

### FIXED (1차 리뷰 대응, commit 9ad6310a)
- **W1 (useAuthConfigForm 훅 직접 테스트 없음)** → `use-auth-config-form.test.tsx` 신설(renderHook). openCreate/openEdit/close 상태전환·필드초기화·collectFormState·validateAndProceed 각 분기 검증.
- **W2 (generatedKey 표시 경로 미검증)** → `authentication-form.test.tsx` 에 평문 키 발급→표시→Done 닫기 시나리오 추가.
- **W3 (pickPlaintextSecret 미검증)** → `auth-config-types.test.ts` 신설(우선순위 체인·null·비-string).

### DEFER — 동작 변경/범위 밖 (수정 시 "behavior identical" 위반)

- **2차 security W1·W2 — Regenerate·Delete 버튼 `isAdmin` 가드 누락 (RBAC)**
  - **기존 상태 (git 증거)**: merge-base `1899c05e` 의 `page.tsx` 에서도 Eye(Reveal)·Pencil(Edit) 만 `{isAdmin && …}` 가드, **Regenerate(RefreshCw)·Delete(Trash2) 는 가드 없음**. 본 PR 의 action-cell diff 는 `handleEditClick → form.openEdit` 핸들러명 변경 **단 1건**이며 regenerate/delete 버튼 렌더링은 byte-identical. → **내가 도입한 회귀 아님**.
  - **실제 위험 LOW**: 백엔드 `auth-configs.controller.ts` 가 `POST :id/regenerate`·`DELETE :id` 모두 `@Roles('admin')` 로 **fail-closed** 강제(비-admin = 403). UI 갭은 방어심층/UX(403 혼란 방지) 일관성 문제이지 권한상승 취약점 아님.
  - **수정 보류 사유**: 가드 추가는 **비-admin UI 변경(버튼 사라짐) = 동작 변경**으로 본 PR 의 "동작·UI 불변" 제약 위반. RBAC 일관성은 spec-aware 별도 PR 이 적절.
  - **추적**: `plan/in-progress/spec-sync-config-gaps.md` 후속 항목으로 등록.

- **2차 W3 / INFO-6 — regenerate 성공 후 평문 키 미표시 가능**
  - regenerate `onSuccess` 가 `setGeneratedKey(secret)` 호출하나 `mode===null` 이라 `AuthConfigCreateForm` 미렌더. **분리 전과 동일**: 원본도 regenerate 시 `showDialog=false` 상태에서 `setGeneratedKey` 만 호출해 표시되지 않았다(리뷰어 INFO-6 도 "기존 버그 이전" 명시). 동작 보존이 본 PR 목표이므로 이 경로의 동작 변경(표시 추가/제거)은 하지 않는다. 표시 기능이 필요하면 별건 plan.

- **2차 architecture W6 — `validateAndProceed` 가 `toast.error` 직접 호출(레이어 혼재)**
  - 원본 `page.tsx` 의 `validateAndProceed` 도 동일하게 `toast.error` 를 직접 호출했다. 훅 추출은 기존 동작을 **그대로 이동**했을 뿐 새 결합을 도입하지 않았다. 검증결과 반환형 전환은 동작·호출부 변경을 수반 → 후속 개선(리뷰어도 "이번 범위 벗어남" 명시).

- **2차 architecture W10 / maintainability W7·W8·W9 — ISP·AUTH_TYPES 중복·다이얼로그 셸 중복·close() 다중 setter**
  - 모두 유지보수성 개선 제안(기능 저해 없음). 본 PR 은 plan 이 한정한 create/edit 폼 추출 범위. `TYPE_LABEL_KEYS` 파생, `DialogShell` 추출, `DEFAULT_FORM` 상수 등은 후속 maintainability plan 으로 분리(추가 추출은 회귀면 확대).

### ACCEPT — 통합 테스트로 커버 / 경미

- **2차 testing W4 (분리 3 컴포넌트 직접 단위 테스트 없음)**: `AuthConfigFormFields`/`CreateForm`/`EditDialog` 의 prop 분기는 `authentication-form.test.tsx`(create/edit PATCH·type 잠금·password 가시성·admin 가드)·`usage-drawer.test.tsx` 통합 테스트로 렌더 결과가 커버된다. 직접 컴포넌트 단위 테스트는 가치 대비 후속.
- **2차 testing W5 (hook hmac collectFormState 경로 미검증)**: `collectFormState` 는 단순 필드 패스스루라 api_key 경로 검증으로 충분. hmac 페이로드 조립은 `auth-config-form.test.ts`(순수 함수)가 이미 커버.
- **INFO-10 (authentication-form afterEach cleanup 중복)·INFO-12 (Copy assertion)**: 기존 파일 패턴 유지(중복 cleanup 은 무해), Copy 동작은 표시 경로 테스트로 충분.
- **INFO-11 (use-auth-config-form.test afterEach locale 미복원)**: 신규 테스트가 `beforeEach` 에서 매번 `locale: "en"` 으로 set 하므로 파일 간 오염 없음(타 파일도 beforeEach set). 경미 — 현행 유지.

### 위임 — planner (developer 는 spec/ read-only)
- **SPEC-DRIFT / 2차 INFO-5 — `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 5파일 미등록**: spec 메타데이터 갱신은 planner 영역. 기존 위임 노트 `plan/in-progress/spec-update-c-sync-promotions.md` 계열에서 처리(코드 revert 불필요).

---

## 게이트
- lint·tsc·eslint clean, frontend unit **4435 pass**(+16), build PASS.
- fresh review 00_39_27: **Critical 0**, 8 reviewer 전원 성공. 잔여 WARNING 은 위와 같이 전부 disposition(기존상태/동작변경-범위밖/후속/위임).
- 최종 커밋은 codebase 무변경(review/** + plan 추적만)으로 review-guard 종결.
