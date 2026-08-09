# 정식 규약 준수 검토 — backend-typecheck-gap

## 사전 확인 (프롬프트 이상 징후)

이번 세션의 `prompt_file` 은 `## Target 문서 경로: spec/conventions/` 로 선언한 뒤, 실제로는 `spec/conventions/**` 전체(316개 bundle-file, 약 33,538줄)를 "구현 대상" 으로 그대로 덤프했다. 반면 이 작업(`backend-typecheck-gap`)의 실제 diff 를 가리키는 `<git diff origin/main...HEAD -- code_areas>` 항목은 "컨텍스트 예산 초과로 생략된 파일" 목록 맨 끝에 **파일 경로처럼** 나열되어 있다 — 즉 실제 diff 본문이 예산 초과로 통째로 잘려나가고 그 자리에 플레이스홀더 문자열만 목록 항목으로 남았다. 결과적으로 prompt 만으로는 이번 task 가 실제로 무엇을 바꿨는지 전혀 알 수 없는 상태였다 (harness 갭 — `feedback_workflow_disk_write_gap_false_counts` / `feedback_unmeasured_premise_and_test_coupling` 류와 동일 클래스: diff 가 예산에 밀려 누락).

이 갭을 메우기 위해 target 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/backend-typecheck-gap-3d7a91`, HEAD=`claude/backend-typecheck-gap-3d7a91`)에서 직접 `git diff origin/main...HEAD --stat` 및 파일별 diff 를 재확인했다. 아래 판정은 그 실측 diff 기준이다.

## 실제 diff 요약 (38 files changed)

- `.github/workflows/backend-checks.yml` (신규) — backend lint/unit/typecheck-ratchet CI 잡
- `.github/workflows/harness-checks.yml` — `paths:` 에 신규 스크립트 2건 등재
- `scripts/check-backend-typecheck-ratchet.py` (신규), `scripts/backend-typecheck-baseline.json` (신규)
- `.claude/tests/test_backend_typecheck_ratchet.py` (신규), `test_required_check_skip_jobs.py`·`test_workflow_yaml_structure.py`·`README.md` 갱신
- `PROJECT.md` — "wrapper 4단계 밖의 CI 게이트" 표 추가
- backend 테스트 파일 6종의 타입 오류 수정(생성자 인자 누락·import 누락·제거된 파라미터 등, TS2554/TS2304 부류)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `deleteByPrefix` 에 LIKE 메타문자(`%`/`_`/`\`) 거부 가드 추가 + spec 4건
- `plan/in-progress/.../backend-lint-gate-broken-on-main.md`, `review/code/2026/08/09/17_25_39/**`, `review/consistency/2026/08/09/16_45_26/**` (plan/review 산출물)

**`spec/conventions/**` 를 건드리는 변경은 diff 안에 하나도 없다.** 이번 task 는 순수 CI/하네스/타입체크 인프라 작업이며 제품 spec·API·명명 규약이 규율하는 표면(API endpoint, DTO, 이벤트 페이로드, 에러 코드, audit action, 문서 구조 등)을 전혀 건드리지 않는다.

## 관점별 판정

1. **명명 규약** — 해당 없음(N/A). 변경된 식별자는 CI 워크플로 job 명(`lint`/`unit`/`typecheck-ratchet`), Python 스크립트, backend 테스트 helper 뿐이며 `spec/conventions/**` 가 규율하는 API endpoint·audit action·DTO 명명 대상이 아니다.
2. **출력 포맷 규약** — N/A. API 응답·이벤트 페이로드·에러 코드 변경 없음. `check-backend-typecheck-ratchet.py` 가 파싱하는 `TS\d+` 는 TypeScript 컴파일러 진단 코드이며 `spec/conventions/error-codes.md` 가 다루는 제품 API 에러 코드 체계와 무관하다.
3. **문서 구조 규약** — N/A. `spec/**` 문서 신설·수정 없음(`PROJECT.md` 는 루트 운영 문서로 `spec/` 3섹션 구조 대상이 아님).
4. **API 문서 규약** — N/A. NestJS 컨트롤러/DTO/Swagger 데코레이터 변경 없음.
5. **금지 항목** — `secret-resolver.service.ts` 의 `deleteByPrefix` 메타문자 거부는 [`spec/conventions/secret-store.md` §5.3/§6](../../../../spec/conventions/secret-store.md) 이 규정한 "prefix 일괄 삭제" 호출 계약(시그니처·`secret://triggers/{id}/` 형태)을 바꾸지 않는 내부 방어 로직 추가이며, 같은 문서 §7 이 강제하는 "interface 변경 시 callers 동시 갱신" 의무를 트리거하지 않는다(인터페이스 시그니처 불변, 실제 호출부는 UUID 기반이라 영향 없음 — 신규 테스트로 확인). 규약 위반 아님.

## 발견사항

- **[INFO] prompt 구성 갭 — 실제 diff 가 예산 초과로 누락되고 target 이 spec/conventions/ 전체로 오치환됨**
  - target 위치: `prompt_file` 상단 `## Target 문서` ~ 파일 말미 "컨텍스트 예산 초과로 생략된 파일" 목록의 마지막 항목(`<git diff origin/main...HEAD -- code_areas>`)
  - 위반 규약: 해당 없음(정식 규약 위반이 아니라 checker 호출 payload 자체의 결함)
  - 상세: `--impl-done` 모드에서 검토 대상이어야 할 실제 코드 diff 가 컨텍스트 예산에 밀려 통째로 생략되고, 그 생략 사실이 "생략된 파일" 목록의 파일 경로 자리에 플레이스홀더 문자열로만 남았다. 반면 이 checker 와 무관한 `spec/conventions/**` 전량이 "Target 문서" 로 그대로 번들링돼, prompt 만 보고 판정하면 실제 변경 내용을 전혀 모른 채 "spec/conventions/ 자체가 target" 이라는 잘못된 전제로 검토가 진행될 위험이 있었다.
  - 제안: 본 세션은 target 워킹트리에서 `git diff origin/main...HEAD` 를 직접 실행해 이 갭을 메웠다(별도 도구 권한으로 가능했음). 재발 방지를 위해 orchestrator 쪽에서 diff 와 `spec/conventions/**` 참조 번들의 예산 배분 순서를 조정하는 편이 좋다 — diff(실제 판정 대상)를 우선 포함하고, 참조 conventions 는 예산이 부족하면 생략하는 쪽이 안전하다(현재는 반대로 참조 conventions 가 diff 를 밀어냈다).

- **판정: CRITICAL/WARNING 없음.** 실측 diff 는 `spec/conventions/**` 가 규율하는 표면(명명·출력 포맷·문서 구조·API 문서·금지 패턴)을 전혀 건드리지 않는 CI/하네스/타입체크 인프라 변경이다.

## 요약

이번 checker 호출은 prompt 자체의 결함(실제 diff 예산 초과 누락 + target 을 `spec/conventions/` 전체로 오치환)으로 정상적으로는 판정이 불가능한 payload 였다. 직접 target 워킹트리에서 `git diff origin/main...HEAD` 를 재확인한 결과, `backend-typecheck-gap` 작업은 backend 타입체크 ratchet CI 게이트 신설과 그로 인해 드러난 6개 테스트 파일의 TS2554/TS2304 오류 수정, `secret-resolver.deleteByPrefix` 의 LIKE 메타문자 방어 추가로 구성되며 `spec/conventions/**` 가 규율하는 API/명명/문서 규약 표면을 전혀 건드리지 않는다. 따라서 정식 규약 준수 관점에서 위반 사항은 없다. 유일한 이슈는 harness 의 prompt 조립 갭(diff 누락)이며, 이는 target 코드의 결함이 아니라 checker 호출 파이프라인의 결함으로 별도 기록해 둔다.

## 위험도

NONE
