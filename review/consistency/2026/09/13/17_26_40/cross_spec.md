# Cross-Spec 일관성 검토 — guide-identifier-existence (`--impl-done`, scope=`spec/conventions/`, 라운드 8)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- 프롬프트 번들은 예산 초과로 `spec/conventions/` 다수 파일(`error-codes.md`·`migrations.md`·`node-output.md`·`review-citations.md`·`secret-store.md`·`spec-impl-evidence.md`·`swagger.md`·`user-guide-evidence.md`)과 실제 `<git diff origin/main...HEAD -- code_areas>` 본문이 절단돼 있었다. 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)를 절대경로 `git`/`Read`로 직접 조회해 보완했다.
- `spec/conventions/**` 델타: `git diff origin/main...HEAD --stat -- spec/` 실측 **0개 파일**. 정상 — 이 브랜치는 spec 을 고치지 않는다(코드 전용 배치).
- 브랜치 누적 diff(`origin/main...HEAD --stat`): `CHANGELOG.md`·`PROJECT.md` 서술 갱신, `codebase/frontend/src/lib/docs/__tests__/`의 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제 + `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설 + `guide-sanitized-message-parity.test.ts` 각주, `plan/in-progress/guide-identifier-existence.md`(작업 트래커), `plan/in-progress/spec-draft-nullable-notation-followups.md`(무관 항목의 PR 번호 치환) — 전부 frontend build-time 테스트 harness + plan 문서다.
- **이번 라운드에서 새로 얹힌 유일한 코드 커밋은 `1a2e78519`**(직전 리뷰 `review/consistency/2026/09/13/16_56_35` 이후, `git log` 실측). 변경 범위는 `guide-identifier-scan.ts`(+105/−22)·`guide-identifier-existence.test.ts`(+88)·`plan/in-progress/guide-identifier-existence.md` 세 파일뿐이다(`git show --stat -1 1a2e78519` 실측, 나머지는 이전 라운드 리뷰 산출물 커밋 포함). 내용은 직전 라운드(`16_56_29`)의 CRITICAL(`BACKTICK` 축이 "혼합 스팬" 토큰을 미탐지)·WARNING 4건에 대한 순수 정밀도 수정이다 — `BACKTICK` 정규식을 스팬 분리(`BACKTICK_SPAN`) + 스팬 내부 재탐지(`BACKTICK_INNER`) 2단으로 교체, `FIELD_TABLE_NAME` 의 키 순서 의존 완화, 허용목록 vacuity 하한 추가, plan 자기참조 총계 표기 제거.

## 관점별 점검

1. **데이터 모델 충돌** — 대상 없음. 신규/변경 코드는 `IdentifierCitation`/`axis` 타입과 순수 함수(`scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`)뿐이며 `spec/**` 도메인 엔티티 정의와 무관.
2. **API 계약 충돌** — 대상 없음. endpoint·HTTP method·request/response shape 변경 없음.
3. **요구사항 ID 충돌** — 대상 없음. 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 대상 없음.
5. **권한·RBAC 모델 충돌** — 대상 없음. `GUIDE_EXTERNAL_VOCABULARY` 허용목록은 이번 라운드에서 항목이 늘거나 이름이 바뀌지 않았고(diff 는 하한 단언 추가뿐), 도메인이 다른 기존 allowlist(`cafe24-restricted-scopes.md`·`egress-masking.md`·`node-output.md`의 allowlist류)와 이름·검증 대상 충돌이 없음을 재확인(`grep -rn "GUIDE_EXTERNAL_VOCABULARY" codebase/ spec/` — 정의·사용처 외 0건).
6. **계층 책임 충돌** — 대상 없음. 변경된 두 파일은 여전히 `codebase/frontend/src/lib/docs/__tests__/` 안(`frontend-layering.md`의 `LOWER_LAYERS` 범위)이고, 이번 diff 는 정규식·헬퍼 로직만 건드려 `@/components/**` import 를 추가하지 않았다(`fs.readFileSync` 로 backend/packages 소스·`.env.example`·compose YAML을 텍스트로 읽는 기존 패턴 그대로).

## 발견사항

- **[정보 — 신규 아님, 위험도 불변]** 가드가 자칭하는 SoT(`user-guide-evidence.md §2`)에 여전히 미등재
  - target 위치: `guide-identifier-scan.ts` 최상단 주석, `guide-identifier-existence.test.ts` JSDoc, `PROJECT.md`/`CHANGELOG.md` 가드 서술 — 모두 동일 주장 유지, 이번 라운드 diff 도 이 인용 문구 자체는 건드리지 않았다.
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (**3건**)" 표, 실측 재확인: 표는 여전히 3건이고 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts` 어느 것도 등재돼 있지 않다 — `spec/` 전체 grep `guide-identifier` 0건) · §2.1 관계표 · frontmatter `code:` 목록.
  - 상세: gap 의 크기·성격이 직전 라운드(`16_56_35`, 위험도 NONE 판정) 이후 새로 벌어지거나 좁혀지지 않았다. `plan/in-progress/guide-identifier-existence.md §D`(`--impl-prep` 3-checker 수렴, `12_33_41`)에 표·frontmatter·Rationale 갱신을 한 턴으로 묶으라는 지시와 함께 `project-planner` 항목으로 이미 정식 등재돼 있다. `spec/**` 쓰기는 `developer` 권한 밖이고, 자기-반증형 소정정 예외(제품 정의·요구사항·evidence 카탈로그는 명시적 제외 대상)에도 해당하지 않는다.
  - 제안: 추가 조치 불요 — 이미 올바른 채널(`project-planner` 트래커)로 이관돼 있다. 다음 planner 턴에서 `user-guide-evidence.md` §2/§2.1/frontmatter `code:`를 한 번에 갱신하면 닫힌다.

- **[확인 후 기각]** `cafe24-api-metadata.md §4` Principle 7/0 오인용 — 이번 diff 와 무관한 선재 결함이며 별도 planner 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이미 등재돼 있어 본 검토에서 중복 flag 하지 않는다.

## 요약

이번 라운드(유일 코드 커밋 `1a2e78519`)는 직전 `/ai-review` CRITICAL(`BACKTICK` 축의 혼합-스팬 미탐지)과 WARNING 4건에 대한 정규식·회귀-테스트 정밀도 수정이며, `spec/conventions/**` 델타는 이번에도 0이다. 변경은 기존 `IdentifierCitation`/`axis` 타입과 순수 스캔 함수의 내부 로직에 국한돼 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새 표면을 열지 않았고, 신규 허용목록 항목이나 이름 충돌도 없다. 라운드 1부터 일관되게 확인돼 온 유일한 항목("가드가 자칭하는 SoT `user-guide-evidence.md §2`에 아직 미등재")은 이번 라운드로 크기·성격이 달라지지 않았으며 이미 `project-planner` 트래커에 정식 등재돼 있어 재차단 사유가 아니다. Cross-Spec 관점에서 이번 라운드가 새로 발생시킨 CRITICAL/WARNING 은 없다.

## 위험도
NONE
