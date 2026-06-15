# RESOLUTION — authentication God Component 분리 (origin/main 리베이스 후 재검토, config-c1)

> 대상 리뷰: `review/code/2026/06/16/07_41_38/SUMMARY.md` — **RISK MEDIUM / Critical 0 / WARNING 7**.
> 짝 게이트: consistency `--impl-done` `07_41_38` — **BLOCK: NO** (LOW).
> 맥락: origin/main 이 PR #615(C-2: generatedKey 30초 자동클리어 + ipWhitelist 저장검증)로 전진 → 본 브랜치를 **리베이스**. C-2 의 page.tsx 변경(SECRET_AUTOCLEAR_MS + generatedKey/revealedSecret auto-clear useEffect)을 보존하며 God-split 구조에 재조정. 리베이스가 codebase 커밋 타임스탬프를 갱신해 가드 재무장 → 본 재검토(가드 우회 안 함, [[feedback_rebase_migration_renumber_skip_review]]).

## 리베이스 충돌 해소 내역 (검증됨)
- `page.tsx` 충돌(C-2 vs God-split) 해소: C-2 의 두 auto-clear `useEffect` 보존. `generatedKey` 는 이제 `useAuthConfigForm` 훅 소유라, effect 가 안정적 deps 를 갖도록 `const { generatedKey, setGeneratedKey } = form;` 구조분해 후 `[generatedKey, setGeneratedKey]` 의존(매 렌더 타이머 리셋 버그 방지). `STATUS_BADGE_VARIANT`/`TYPE_LABEL_KEYS`/`SECRET_AUTOCLEAR_MS` 세 상수 union.
- **검증**: tsc·eslint clean, frontend unit **4439 pass** — **C-2 의 `generated-key-autoclear.test.tsx` 포함**(자동클리어가 리팩토링 구조에서 정상 작동), build PASS. 리뷰어 누구도 리베이스 해소 코드를 결함으로 지적하지 않음.

## WARNING 7건 disposition (Critical 0 — 전부 pre-existing 또는 통합테스트 커버/후속)

| # | 발견 | 처분 |
| --- | --- | --- |
| W1 | "Add Auth Method" 버튼 Admin 가드 누락 | **DEFER (pre-existing)** — merge-base 이전부터 미가드. 백엔드 `@Roles('admin')` fail-closed. plan `spec-sync-config-gaps.md` RBAC 후속 항목에 Add 포함 등록. 동작(UI) 변경이라 순수 리팩토링 범위 밖 |
| W2·W3 | Regenerate·Delete 버튼 Admin 가드 누락 | **DEFER (pre-existing)** — git 증거상 테이블 액션셀 byte-identical(핸들러명 변경뿐). 백엔드 fail-closed. plan 후속 등록 |
| W4·W5·W6 | 신규 컴포넌트(`AuthConfigCreateForm`/`EditDialog`/`FormFields`) 직접 단위 테스트 부재 | **ACCEPT (통합테스트 커버)** — capability props(typeDisabled·showPassword·showTypeLockedHint)의 동작은 `authentication-form.test.tsx`(edit: type 잠금·password 미렌더·PATCH; create: generatedKey 표시·Done)·`usage-drawer.test.tsx` 통합 경로로 렌더 결과가 가드됨. 직접 컴포넌트 격리 테스트는 가치 대비 후속(추가 시 가드 재무장→추가 사이클, 동작 무변경이라 수렴 우선) |
| W7 | page.tsx 745줄(mutation 6·confirm 모달 4·테이블·드로어 잔류) | **DEFER (후속)** — plan 한정 scope 는 create/edit 폼. mutation→`useAuthConfigMutations` 훅, confirm→공용 `ConfirmDialog` 추출은 별도 maintainability PR |

## INFO disposition (요약)
- **spec frontmatter `code:` 5파일 미등재** (ai-review INFO-2 / impl-done INFO-1): **planner 위임** (developer spec/ read-only). `**` glob 확장 권고.
- **`STATUS_BADGE_VARIANT` 명칭 유사**(impl-done WARNING-1): page-local(module-local, **export 아님**)이라 실제 충돌 없음 + 원본 pre-refactor 와 동일 상태. rename 은 선택(수렴 위해 미적용).
- **테스트 확장자 `.test.tsx`→`.test.ts`**(impl-done INFO-2)·**mock 응답 구조 불일치**(ai-review INFO-4)·**`pickPlaintextSecret` 빈문자열 경계**(INFO-5)·**`UsageRecentCall` DTO prefix**(INFO-3): 경미·pre-existing — 현행 유지(수렴).
- **Toggle 버튼 RBAC**(ai-review INFO-1): pre-existing, spec 상 Activate/Deactivate 의 RBAC 범위는 별건 확인 필요 — RBAC 후속 PR 에서 함께 판단.
- **JSDoc 보강**(openCreate·page 모듈): 경미, 후속.

## 게이트 (최종)
- lint·tsc·eslint clean, frontend unit **4439 pass**(C-2 autoclear 포함), build PASS.
- ai-review 07_41_38: **Critical 0** (RISK MEDIUM — 잔여 전부 pre-existing/통합커버/후속). consistency `--impl-done` 07_41_38: **BLOCK: NO**.
- 본 RESOLUTION + 산출물은 codebase 무변경 → review·impl-done 가드 종결.
