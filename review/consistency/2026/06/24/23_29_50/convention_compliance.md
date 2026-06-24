# 정식 규약 준수 검토 — 06-concurrency M-2 (ShutdownStateService early-return 제거)

검토 범위: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` · `shutdown-state.service.spec.ts` · `plan/in-progress/refactor/06-concurrency.md` (diff vs origin/main)

---

## 발견사항

### 발견사항 없음 (모두 통과)

본 변경은 `spec/conventions/` 의 어떤 규약도 위반하지 않는다. 아래는 각 점검 관점별 확인 결과다.

---

**[INFO] 명명 규약 — 파일·식별자**
- target 위치: `shutdown-state.service.ts`, `shutdown-state.service.spec.ts`
- 위반 규약: 해당 없음
- 상세: 파일명은 NestJS 관례의 `kebab-case.service.ts` / `kebab-case.service.spec.ts` 형식. `ShutdownStateService`, `registerInFlight`, `unregisterInFlight`, `inFlightNodeExecutions` 등 식별자는 camelCase/PascalCase TypeScript 관례 준수. `spec/conventions/` 내 별도 식별자·파일명 명명 규약 없음.
- 제안: 없음.

**[INFO] 출력 포맷 규약 — 에러 코드**
- target 위치: `shutdown-state.service.ts` JSDoc + 마킹 로직(기존 유지), `shutdown-state.service.spec.ts` 주석
- 위반 규약: `spec/conventions/error-codes.md §1`
- 상세: `SERVER_INTERRUPTED` 에러 코드는 본 변경으로 신설된 것이 아니라 기존 코드에서 유지된 값이다. `UPPER_SNAKE_CASE` 형식으로 `error-codes.md §1` 의 표기 규약에 부합한다. 이번 diff 에서 에러 코드를 새로 정의하거나 변경하지 않았으므로 규약 위반 요소 없음.
- 제안: 없음.

**[INFO] 문서 구조 규약 — plan 파일 갱신**
- target 위치: `plan/in-progress/refactor/06-concurrency.md`, M-2 항목
- 위반 규약: 해당 없음
- 상세: M-2 항목이 `- [ ] 미착수` → `- [x] 구현 완료 (Option A, ...)` 로 갱신됐다. 커밋 해시·review 경로·spec 변경 불요 판정·Option B 미채택 근거 모두 인라인 기술 — 기존 `plan/in-progress/refactor/06-concurrency.md` 의 다른 완료 항목(C-1, M-1, M-5, M-7)과 동일 서술 패턴. CLAUDE.md 의 plan 위치 규약(`plan/in-progress/<name>.md`)과 일치하며 frontmatter 의 `worktree` 필드는 README.md 클러스터 구조에 위임 — 별도 plan 파일로 분리되지 않고 클러스터 내 항목으로 관리되는 기존 패턴과 일관.
- 제안: 없음.

**[INFO] API 문서 규약 — Swagger/OpenAPI**
- target 위치: `shutdown-state.service.ts` 전체
- 위반 규약: `spec/conventions/swagger.md`
- 상세: 본 파일은 NestJS 서비스(`@Injectable`) 이며 Controller/DTO 가 아니다. `swagger.md` 규약의 적용 대상은 Controller 데코레이터·DTO 클래스이므로 본 변경에 적용할 규약이 없다.
- 제안: 없음.

**[INFO] 금지 항목 점검**
- target 위치: `shutdown-state.service.ts` JSDoc, `spec/conventions/` 전체
- 위반 규약: 해당 없음
- 상세: 검토한 conventions(`audit-actions.md`, `error-codes.md`, `swagger.md`, `spec-impl-evidence.md`)에서 명시적으로 금지하는 패턴(인라인 에러 코드 문자열 직접 발행이 아닌 상수 참조 등)은 본 변경에서 새로 도입되지 않았다. `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무는 `spec/**/*.md` 대상이며 `codebase/**` 구현 파일에는 적용되지 않는다.
- 제안: 없음.

---

## 요약

본 변경(M-2 ShutdownStateService `registerInFlight` early-return 제거 + 테스트 교체·추가)은 `spec/conventions/` 의 어떤 정식 규약과도 충돌하지 않는다. 변경된 코드(서비스 구현 + 단위 테스트)는 API·에러 코드·Swagger·문서 구조·명명 규약 관점에서 모두 기존 패턴과 일관하며, plan 갱신도 클러스터 내 항목 관리 관례를 따르고 있다. 규약 위반에 해당하는 사항이 발견되지 않았다.

## 위험도

NONE
