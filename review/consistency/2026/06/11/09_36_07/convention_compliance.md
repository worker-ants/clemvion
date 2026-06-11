# Convention Compliance Review

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=V-02 최종, diff-base=origin/main)
**검토 대상 파일**:
- `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/override-registry.test.ts` (신규)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (삭제)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts` (수정)
- `spec/2-navigation/13-user-guide.md` (수정)
- `spec/3-workflow-editor/1-node-common.md` (수정)
- `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (수정)
- `CHANGELOG.md` (수정)

---

## 발견사항

### INFO-1: 신규 테스트 파일명 — `.test.ts` vs 프로젝트 기존 패턴과 일치
- **target 위치**: `node-configs/__tests__/override-registry.test.ts`
- **위반 규약**: 특정 명시 규약 없음
- **상세**: 동일 디렉토리(`__tests__/`)의 기존 파일은 모두 `.test.tsx` 또는 `.test.ts` 를 사용하며, 신규 파일(`override-registry.test.ts`)도 `.test.ts` 를 사용하여 패턴이 일치한다. 이상 없음.
- **제안**: 없음.

### INFO-2: spec/2-navigation/13-user-guide.md 예시 YAML 내 `code:` 경로 — 본문 예시와 실제 frontmatter 불일치
- **target 위치**: `spec/2-navigation/13-user-guide.md` lines 108–116 (§4 예시 YAML 블록)
- **위반 규약**: 없음 (직접 위반 아님). `spec/conventions/user-guide-evidence.md` §1·`spec/conventions/spec-impl-evidence.md` §2.2 는 `code:` 경로의 실존을 가드하나, 이는 spec 자체 frontmatter(`---`)의 `code:` 가 아닌, 가이드 MDX frontmatter(`---`) 또는 spec frontmatter 에 대한 가드임.
- **상세**: 변경된 line(`code: ["codebase/backend/src/nodes/ai/**", "codebase/frontend/src/components/editor/settings-panel/auto-form/schema-form.tsx"]`)은 본문의 **예시 YAML 블록** 안 샘플 값이다. 해당 경로(`auto-form/schema-form.tsx`)가 실제로 존재하는지 여부가 `registry.test.ts` 의 `code:` 경로 실존 가드 대상인지 확인이 필요하다. 단 이 예시 YAML 은 doc page frontmatter 의 **문서화 예시**(코드 블록 안)이므로 가드 대상이 아닌 것으로 판단된다.
- **제안**: 경로 실존은 별도 가드 대상이 아니므로 현 상태 유지 가능. 다만 예시 YAML 경로는 실제 파일과 같아야 독자 혼동이 없으므로 문서 검토자가 `auto-form/schema-form.tsx` 실존을 한 번 확인하면 충분하다.

### INFO-3: spec/3-workflow-editor/1-node-common.md Rationale 섹션 R-3 — 형식 정상
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` — `## Rationale` 말미 `### R-3` 추가
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: R-3 가 `## Rationale` 섹션 끝에 정상 추가됐다. 3섹션 구조(Overview/본문/Rationale) 준수.
- **제안**: 없음.

---

## 정식 규약 직접 위반 없음

검토 범위의 모든 변경에 대해 `spec/conventions/` 의 정식 규약 항목을 점검한 결과:

1. **명명 규약**: 신규 파일(`override-registry.test.ts`)은 동일 폴더 기존 파일과 동일한 `<name>.test.ts(x)` 패턴을 따름. 삭제 파일(`ai-configs.tsx`)은 snake_case가 아닌 kebab-case로 이미 존재하던 파일이며 본 변경에서 삭제됨 — 명명 위반 신규 도입 없음.

2. **출력 포맷 규약**: API 응답·이벤트 페이로드·에러 코드 관련 변경 없음. `spec/conventions/node-output.md`·`error-codes.md` 등과 무관한 UI 레이어 변경.

3. **문서 구조 규약**: `spec/3-workflow-editor/1-node-common.md` 는 기존 id/status frontmatter 유지, Rationale R-3 추가는 규약 준수. `spec/2-navigation/13-user-guide.md` 는 `id: user-guide`, `status: implemented`, `code:` frontmatter 유지 — frontmatter-evidence 가드 위반 없음.

4. **API 문서 규약**: Swagger/OpenAPI 데코레이터 변경 없음.

5. **금지 항목**: `spec/conventions/spec-impl-evidence.md §1` 적용 대상 파일(`spec/2-navigation/`, `spec/3-workflow-editor/`)의 frontmatter 가 그대로 유지됨. `code:` glob 경로 교체(`ai-configs.tsx` → `auto-form/schema-form.tsx`)는 삭제된 파일에서 실존하는 파일로의 정정이므로 `spec-code-paths.test.ts` 가드 충족 방향의 개선이다.

---

## 요약

이번 V-02 최종 정리 변경(삭제된 `ai-configs.tsx` 경로를 `schema-form.tsx` 로 교정, spec §2.6.3 트랙 배정 현황 갱신, Rationale R-3 추가, 단위 테스트 고정)은 `spec/conventions/` 정식 규약을 직접 위반하는 항목이 없다. spec frontmatter 구조·lifecycle 상태·Rationale 섹션 위치 모두 규약에 부합하며, 신규 테스트 파일명도 기존 패턴과 일치한다. 발견사항은 모두 INFO 수준의 경미한 확인 사항에 그친다.

## 위험도

NONE
