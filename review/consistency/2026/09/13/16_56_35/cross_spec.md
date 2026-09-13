# Cross-Spec 일관성 검토 — guide-identifier-existence (`--impl-done`, scope=`spec/conventions/`, 라운드 7)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- 프롬프트 번들은 예산 초과로 `spec/conventions/` 대부분(관련 문서 `user-guide-evidence.md`·`error-codes.md`·`spec-impl-evidence.md` 포함)과 실제 diff 본문이 절단돼 있었다. 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)를 절대경로 `git`/`Read`로 직접 조회해 보완했다.
- `spec/conventions/**` 델타: **0개 파일** (`git diff origin/main...HEAD --stat -- spec/` 실측 0). 정상 — 이 브랜치는 spec 을 고치지 않는다.
- `origin/main..HEAD` 코드 영역 diff(누적): `CHANGELOG.md`·`PROJECT.md`(각 서술 갱신) + `codebase/frontend/src/lib/docs/__tests__/`의 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제, `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설, `guide-sanitized-message-parity.test.ts` 각주 4줄 — 전부 frontend build-time 테스트 harness.
- 이번 라운드(직전 리뷰 `review/consistency/2026/09/13/16_28_53` 이후)에서 새로 얹힌 유일한 커밋은 `82a23bf0a`(`git show --stat` 직접 확인). 내용은 (1) 스캐너 주석의 미확정 PR 번호 참조 제거, (2) `/ai-review`(`16_28_47`) INFO 3건 처분(하이픈 키 대조군 고정·compose 리스트 스타일 한계 대조군·`FIELD_TABLE_NAME` 손-사본→정본 실행 전환) — **전부 테스트/주석 정밀도 작업**이며 spec 인용 문구·SoT 지목·엔티티/엔드포인트/요구사항 정의는 이전 라운드에서 검증된 것과 동일하게 유지된다.

## 관점별 점검

1. **데이터 모델 충돌** — 대상 없음. 신규/변경 코드는 `CitationAxis`/`IdentifierCitation` 타입과 순수 함수뿐이며 `spec/**` 도메인 엔티티와 무관.
2. **API 계약 충돌** — 대상 없음. endpoint·request/response shape 변경 없음.
3. **요구사항 ID 충돌** — 대상 없음. 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 대상 없음.
5. **권한·RBAC 모델 충돌** — 대상 없음. 신규 허용목록(`GUIDE_EXTERNAL_VOCABULARY`)은 도메인이 다른 기존 allowlist(`cafe24-restricted-scopes.md`·`egress-masking.md`·`node-output.md`)와 이름·검증 대상이 겹치지 않음(직전 라운드 `12_33_41`에서 이미 확인, 이번 커밋으로 변경 없음).
6. **계층 책임 충돌** — 대상 없음. `frontend-layering.md`(CI 강제 범위 `LOWER_LAYERS = ["src/lib/**", "src/types/**"]`)상 이 파일들은 `src/lib/**` 안에 있어 규약 적용 대상이지만, `@/components/**` import 가 0건(직접 grep 확인)이라 위반이 아니다. `fs.readFileSync`로 backend/packages 소스·`.env.example`·compose YAML을 텍스트로 읽을 뿐 import 하지 않으며, 같은 패턴이 선례(`impl-anchor-existence.test.ts` 등)에 이미 존재한다.

## 발견사항

- **[정보 — 신규 아님, 위험도 불변]** 가드가 자칭하는 SoT(`user-guide-evidence.md §2`)에 여전히 미등재
  - target 위치: `guide-identifier-scan.ts` 최상단 주석("SoT: spec/conventions/user-guide-evidence.md (가드 가족)"), `guide-identifier-existence.test.ts` JSDoc, `PROJECT.md`/`CHANGELOG.md` 가드 서술 — 모두 동일 주장 유지.
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표) · §2.1 관계표 · frontmatter `code:` 목록 — 세 곳 모두 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts` 없음(실측: 세 파일명 모두 `spec/` 전체 grep 0건, 라운드 1~7 전부 동일 결과).
  - 상세: 이번 라운드의 유일한 코드 변경(주석 정리 + INFO 처분)은 이 SoT 인용 문구 자체를 건드리지 않았다 — gap 의 크기·성격이 직전 라운드(`16_28_53`, WARNING→위험도 NONE 판정)와 동일하며 새로 벌어지거나 좁혀지지 않았다. `plan/in-progress/guide-identifier-existence.md §D`(`--impl-prep` 3-checker 수렴, `12_33_41`)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 `project-planner` 항목으로 이미 정식 등재돼 있다(§2.1 표 3건→5건 승격 + `code:` frontmatter 경로 추가 + "허용목록 없음→4강제" 원칙 번복의 Rationale 반영을 한 턴으로 묶으라는 지시 포함). `spec/**` 쓰기는 `developer` 권한 밖이고, 자기-반증형 소정정 예외(제품 정의/코드 evidence 목록은 명시적 제외 대상)에도 해당하지 않는다.
  - 제안: 추가 조치 불요 — 이미 올바른 채널(`project-planner` 트래커)로 이관돼 있다. 다음 planner 턴에서 `user-guide-evidence.md` §2/§2.1/frontmatter `code:`를 한 번에 갱신하면 닫힌다.

- **[없음]** `cafe24-api-metadata.md §4` Principle 7/0 오인용 — 이번 diff와 무관한 선재 결함이며 이미 별도 planner 항목(`spec-draft-nullable-notation-followups.md`)에 등재돼 있어 중복 언급하지 않는다.

- **[확인 후 기각]** `guide-identifier-scan.ts` 상단 주석이 인용하는 `spec/5-system/3-error-handling.md §1.4`("코드 앵커가 셋으로 갈리고 나머지는 앵커 없는 맨 문자열")의 정확성을 직접 대조 — §1.4 본문과 문구·구조가 일치한다(오인용 아님).

## 요약

이번 라운드(커밋 `82a23bf0a`)는 스캐너 주석의 미확정 PR 번호 제거와 이전 `/ai-review` INFO 3건 처분(전부 리뷰어 제안과 반대 방향 — 대조군 고정)만 담고 있어, spec 이 정의하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새로운 표면을 열지 않는다. `spec/conventions/**` 델타는 이번에도 0이며 Cross-Spec 관점에서 새로 발생한 CRITICAL/WARNING은 없다. 라운드 1부터 일관되게 확인돼 온 유일한 항목("가드가 자칭하는 SoT `user-guide-evidence.md §2`에 아직 미등재")은 이번 라운드의 코드 변경으로 크기·성격이 달라지지 않았고, 이미 `project-planner` 트래커에 상세 처리 지침과 함께 정식 등재돼 있어 재차단 사유가 아니다.

## 위험도
NONE
