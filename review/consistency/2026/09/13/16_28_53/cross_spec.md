# Cross-Spec 일관성 검토 — guide-identifier-existence (`--impl-done`, scope=`spec/conventions/`, 라운드 6)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/**` 델타: **0개 파일** (`git diff origin/main...HEAD --stat -- spec/` 실측 0). 이 브랜치는 spec 을 고치지 않는다 — 정상.
- 프롬프트 번들은 예산 초과로 관련 문서(`user-guide-evidence.md`·`error-codes.md`·`spec-impl-evidence.md`·실제 diff 본문)가 대부분 절단돼 있었다. 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)를 절대경로로 직접 조회해 보완했다.
- 실제 diff(`git diff origin/main...HEAD --stat -- codebase/`): 5개 파일 — `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제(각 189·184줄), `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설(367·244줄), `guide-sanitized-message-parity.test.ts` 각주 수정(4줄). 전부 frontend build-time 테스트 harness(`codebase/frontend/src/lib/docs/__tests__/`)에 머문다.
- 이번 라운드(라운드 6)에서 새로 얹힌 것은 직전 리뷰(`review/consistency/2026/09/13/16_04_45`) 이후의 커밋 `1984d72d3` 하나뿐이다. `git show 1984d72d3`로 직접 확인한 내용은 `guide-identifier-scan.ts`의 `CODE_FIELD` 정규식 왼쪽 경계를 `(?<![A-Za-z])`→`(?<!\w)`로 교정하고, 5개 정규식 전수 감사 표를 파일 상단 주석에 추가하고, `collectSourceTokens`에 경계 대조군 테스트를 보탠 것이다 — **순수 정규식/테스트 정밀도 수정**이며 spec 인용 문구·SoT 지목·엔티티/엔드포인트 정의는 이전 라운드에서 이미 검증된 것과 동일하게 유지된다.

## 관점별 점검

1. **데이터 모델 충돌** — 대상 없음. 신규/변경 코드는 `CitationAxis`/`IdentifierCitation` 타입과 순수 함수(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)뿐이며 `spec/**`이 정의하는 도메인 엔티티와 무관하다.
2. **API 계약 충돌** — 대상 없음. endpoint·request/response shape 변경 없음.
3. **요구사항 ID 충돌** — 대상 없음. 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 대상 없음.
5. **권한·RBAC 모델 충돌** — 대상 없음.
6. **계층 책임 충돌** — 대상 없음(신규 코드는 `src/lib/docs/__tests__/`에 머물며 `frontend-layering.md`가 명시적으로 제외하는 테스트 디렉터리다. `fs.readFileSync`로 backend/packages 소스·`.env.example`·compose YAML을 텍스트로 읽을 뿐 `import`하지 않으며, 같은 패턴이 선례(`impl-anchor-existence.test.ts` 등)에 이미 존재해 이번 diff가 새로 여는 위반이 아니다 — 라운드 3·5차 리뷰에서 이미 확인된 결론과 동일).

## 발견사항

- **[INFO]** 가드가 자칭하는 SoT(`user-guide-evidence.md §2`)에 아직 미등재 — 신규(이 아님), 이미 추적 중
  - target 위치: `guide-identifier-scan.ts` 최상단 주석("SoT: spec/conventions/user-guide-evidence.md (가드 가족)"), `guide-identifier-existence.test.ts` JSDoc, `PROJECT.md` 가드 카탈로그 표.
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드" 표, 여전히 3건만 등재) · §2.1 관계표 · frontmatter `code:` 목록 — 세 곳 모두 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts`가 없음(실측: 세 식별자 모두 grep 0건, 라운드 1~5와 동일한 결과).
  - 상세: 라운드 5의 유일한 코드 변경(정규식 경계 교정 + 감사 표 추가)은 이 SoT 인용 문구 자체를 건드리지 않았으므로 gap 의 크기·성격이 직전 라운드(`16_04_45`)와 동일하다 — 이번 라운드가 새로 벌리거나 좁힌 것이 없다. 이미 `plan/in-progress/guide-identifier-existence.md §D`(`--impl-prep` 3-checker 수렴, `review/consistency/2026/09/13/12_33_41`)와 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 이하에 `project-planner` 항목으로 정식 등재돼 있다(§2.1 표 3건→5건 승격 + `code:` frontmatter 3파일 추가 + "허용목록 없음→4강제" 원칙 번복의 Rationale 반영을 한 턴으로 묶으라는 지시까지 포함). `spec/**` 쓰기는 `developer` 권한 밖이라 이 PR 스스로 고칠 수 없고, 자기-반증형 소정정 예외(제품 정의/코드 evidence 목록은 명시적으로 제외 대상)에도 해당하지 않는다.
  - 제안: 추가 조치 불요 — 이미 올바른 채널로 이관돼 있다. 다음 `project-planner` 턴에서 `user-guide-evidence.md` §2/§2.1/frontmatter `code:`를 한 번에 갱신하면 닫힌다.

- **[없음]** `cafe24-api-metadata.md §4` Principle 7/0 오인용 — 이번 diff와 무관한 선재 결함으로 이미 별도 planner 항목(`spec-draft-nullable-notation-followups.md`)에 등재돼 있어 중복 언급하지 않는다.

## 요약

라운드 6의 유일한 신규 변경(커밋 `1984d72d3`)은 `guide-identifier-scan.ts`의 정규식 경계 교정과 감사 표·대조군 테스트 추가로, spec 인용·SoT 지목·엔티티/엔드포인트/요구사항 ID/상태 전이/RBAC 정의를 전혀 건드리지 않는다. `spec/conventions/**` 델타는 이번에도 0이며, Cross-Spec 관점에서 새로 발생한 CRITICAL/WARNING은 없다. 라운드 1부터 반복 확인돼 온 유일한 항목("가드가 자칭하는 SoT `user-guide-evidence.md §2`에 아직 미등재")은 이번 라운드의 코드 변경으로 크기가 달라지지 않았고, 이미 `project-planner` 트래커에 상세 처리 지침과 함께 정식 등재돼 있어 재차단 사유가 아니다.

## 위험도
NONE
