# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`
Target scope: `spec/2-navigation/6-config.md`
diff-base: `1899c05e`
검토 일시: 2026-06-16

---

## 발견사항

### [INFO] `spec/2-navigation/6-config.md` frontmatter `code:` 가 신규 분리 파일들을 미포함

- target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 섹션
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로" 를 열거해야 하며, `status: partial` / `implemented` 시 ≥1 glob 매치 의무
- 상세: 현재 frontmatter `code:` 에는 `codebase/frontend/src/app/(main)/authentication/page.tsx` 가 단건으로 등재되어 있다. 이번 diff 는 God Component 분리로 page.tsx 의 폼 상태·검증·다이얼로그 로직을 다음 신규 파일들로 이전했다: `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`, `use-auth-config-form.ts`. spec-code-paths.test.ts 가드는 glob 이 ≥1 파일에 매치하면 통과하므로 page.tsx 가 존재하는 한 즉시 빌드 실패는 없다. 그러나 백엔드 측 `codebase/backend/src/modules/auth-configs/**` 처럼 디렉토리 glob 을 사용하면 신규 분리 파일을 자동 포섭할 수 있다.
- 제안: `spec/2-navigation/6-config.md` frontmatter 의 `codebase/frontend/src/app/(main)/authentication/page.tsx` 항목을 `codebase/frontend/src/app/(main)/authentication/**` 으로 교체한다. 가드 실패를 유발하는 Critical 위반이 아니므로 INFO 로 분류한다.

---

### [INFO] `spec/2-navigation/6-config.md` `status: partial` — pending_plans 완료 여부 재점검

- target 위치: `spec/2-navigation/6-config.md` frontmatter `status` / `pending_plans` 필드
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙 — `partial` 의 `pending_plans` 가 모두 `plan/complete/` 로 이동했으면 `implemented` 승격 의무
- 상세: 현재 `status: partial`, `pending_plans: [plan/in-progress/spec-sync-config-gaps.md]`. 이번 diff 는 Authentication 화면의 God Component 분리를 구현했다. spec-sync-config-gaps.md plan 이 이번 구현으로 완료됐다면 plan 을 complete/ 로 이동하고 status 를 `implemented` 로 승격해야 한다. 본 diff 만으로는 plan 완료 여부를 확정할 수 없어 INFO 로 기록한다.
- 제안: plan/in-progress/spec-sync-config-gaps.md 의 완료 여부를 확인한다. 완료됐다면 plan 을 plan/complete/ 로 이동하고 spec/2-navigation/6-config.md 의 status 를 `implemented` 로, pending_plans: 를 제거한다. spec-status-lifecycle.test.ts 가드가 pending_plans 완료 후 미승격을 검출하므로 빌드 실패 전에 선제 조치한다.

---

### [INFO] `auth-config-types.ts` 에 정의된 공유 인터페이스 — 규약 위반 없음 (기록)

- target 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`
- 위반 규약: 해당 없음
- 상세: `AuthConfig`, `UsageRecentCall`, `UsagePeriodCounts`, `AuthConfigUsage` 인터페이스를 page.tsx 인라인에서 분리 파일로 이전했다. 파일명은 역할을 적절히 반영하며, spec/conventions/ 에는 프론트엔드 파일 명명 별도 규약이 없다. `pickPlaintextSecret` 헬퍼를 분리해 단위 테스트를 추가한 것은 TDD 방법론(CLAUDE.md 개발 방법론)과 일치한다.

---

### [INFO] `UseAuthConfigForm` 인터페이스 명 — TypeScript 관용 패턴, 규약 위반 없음

- target 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` — `export interface UseAuthConfigForm`
- 위반 규약: 해당 없음
- 상세: spec/conventions/ 에 TypeScript 인터페이스 명명 규약 문서가 없으며, `Use` 접두사로 훅 반환 타입 인터페이스를 표시하는 것은 React 커뮤니티 관용 패턴이다.

---

## 요약

이번 diff 는 `spec/2-navigation/6-config.md` 가 정의하는 Authentication 화면(Part A)의 God Component(`page.tsx`)를 5개 전용 파일로 분리한 순수 리팩터링이다. `spec/conventions/` 의 정식 규약(swagger.md, error-codes.md, audit-actions.md, spec-impl-evidence.md, secret-store.md, node-output.md) 관점에서 직접 위반하는 CRITICAL 또는 WARNING 사항은 없다. 발견된 사항은 모두 INFO 수준이며, 실용적 후속 조치로는 spec frontmatter `code:` 항목을 디렉토리 glob 으로 확장하는 것과 pending_plans 완료 시 `status` 승격 여부를 검토하는 것이다. spec-code-paths.test.ts 빌드 가드는 기존 page.tsx 가 현존하므로 즉시 fail 되지 않는다.

## 위험도

LOW
