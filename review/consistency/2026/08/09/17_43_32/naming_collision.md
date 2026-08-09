# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인 (선행 사실 확인)

검토 모드는 `--impl-done, scope=spec/conventions/, diff-base=origin/main` 이다. 실제
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/backend-typecheck-gap-3d7a91`)에서
`git diff --stat origin/main -- spec/` 를 절대경로 기준으로 재확인한 결과 **`spec/` 전체에
변경이 0건**이다 (`spec/conventions/` 포함). 즉 이번 diff 는 `spec/conventions/` 에
**새 식별자를 전혀 도입하지 않는다** — 프롬프트에 번들된 `spec/conventions/` 전문은
grep 대조용 "기존 사용처" 컨텍스트이며, 이번 target 변경분이 아니다.

실제 diff(`origin/main` 대비)는 다음 파일에 한정된다:
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (+ spec) — `deleteByPrefix()` 에 LIKE 메타문자 거부 가드 추가
- `.github/workflows/backend-checks.yml` (신규) — `lint`/`unit`/`typecheck-ratchet` 3-job 워크플로
- `.github/workflows/harness-checks.yml` — paths 트리거 2줄 추가
- `scripts/check-backend-typecheck-ratchet.py` (신규), `scripts/backend-typecheck-baseline.json` (신규)
- `.claude/tests/test_backend_typecheck_ratchet.py` (신규)
- `PROJECT.md`, 각종 `*.service.spec.ts`, `review/**` 산출물

이 중 spec/conventions 문서 자체가 소유하는 "요구사항 ID·엔티티/DTO명·API endpoint·이벤트명"
범주에 해당하는 신규 식별자는 없다. 아래는 나머지 관점(환경변수·설정키, 파일 경로)에서
실제 신규 식별자를 기존 명명 컨벤션과 대조한 결과다.

## 발견사항

### 파일 경로 — 신규 CI/스크립트 식별자 (충돌 없음, 확인용 기록)

- **[INFO]** 신규 파일 경로의 기존 컨벤션 준수 확인
  - target 신규 식별자: `.github/workflows/backend-checks.yml`, `scripts/check-backend-typecheck-ratchet.py`, `scripts/backend-typecheck-baseline.json`, `.claude/tests/test_backend_typecheck_ratchet.py`
  - 기존 사용처: `.github/workflows/{frontend,packages,web-chat}-checks.yml` (동일 `<영역>-checks.yml` 패턴), `scripts/check-{override-floors,migration-versions,pnpm-security-config,doc-links,e2e-playwright-config,review-gate}.py` (동일 `check-<대상>.py` 패턴), `.claude/tests/test_*.py` (동일 `test_<대상>.py` 패턴)
  - 상세: `ls .github/workflows/`, `ls scripts/`, `ls .claude/tests/` 로 전수 대조한 결과 신규 4개 파일 모두 **기존 파일과 이름이 겹치지 않고**, 기존 명명 컨벤션(워크플로=`<영역>-checks.yml`, 스크립트=`check-<대상>.py`, 하네스 테스트=`test_<대상>.py`)을 그대로 따른다. `ratchet` 용어도 신규가 아니라 `hardcoded-korean-ratchet.test.ts`·`KNOWN_MISSES` baseline ratchet 과 같은 기존 패턴의 재사용이다.
  - 제안: 없음 (충돌 없음, 컨벤션 준수 확인만 기록).

### 워크플로 job 식별자 — 충돌 없음

- **[INFO]** `backend-checks.yml` job id/이름 대조
  - target 신규 식별자: job id `changes`/`lint`/`unit`/`typecheck-ratchet`, workflow `name: backend-checks`, concurrency group `backend-checks-${{ github.ref }}`
  - 기존 사용처: 다른 workflow 파일(`frontend-checks.yml`, `packages-checks.yml`, `web-chat-checks.yml` 등)도 각자 `changes`/`lint`/`unit` job id 를 자체 파일 안에서 쓴다.
  - 상세: GitHub Actions 의 job id·concurrency group 은 **workflow 파일 스코프**이므로 파일 간 동일 id 재사용은 충돌이 아니다(오히려 W7 followup 이 지적한 "skip-job 보일러플레이트 반복" 패턴과 일관). `name: backend-checks` 도 다른 workflow 의 `name:` 과 겹치지 않는다.
  - 제안: 없음.

### 프로덕션 코드 변경 — 신규 식별자 없음

- **[INFO]** `deleteByPrefix()` LIKE 메타문자 가드
  - target 신규 식별자: 없음 (신규 `Error` 메시지 문자열만 추가, `error-codes.md` 카탈로그에 편입되는 코드형 식별자 아님 — 호출부가 내부 전용 예외를 그대로 throw)
  - 기존 사용처: 해당 없음
  - 상세: plan(`backend-typecheck-gap`)의 후속 항목에 "`spec/conventions/secret-store.md §2.1` 호출 규약 표에 `deleteByPrefix` 새 invariant 각주 추가"가 planner 권한으로 명시 이관돼 있고, 그 항목 자체가 "내부 전용 계약이라 spec 충돌은 없다"고 스스로 기록하고 있다 — 이번 diff 범위에서는 신규 식별자 충돌 검토 대상이 아니다.
  - 제안: 없음 (spec 반영은 별도 planner 턴 대상이며 이미 plan 에 추적됨).

## 요약

이번 검토 대상(`spec/conventions/`)은 `origin/main` 대비 **diff 가 0건**이라 spec 레벨에서
새로 도입되는 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·spec 파일 경로가 존재하지
않는다. 실제 코드 변경은 backend CI 게이트 신설(`backend-checks.yml`)과 타입체크
ratchet 스크립트/baseline, `secret-resolver.service.ts` 의 방어적 가드 추가에 국한되며,
이들이 새로 도입한 파일 경로·워크플로 job id·스크립트명은 기존 `<영역>-checks.yml` /
`check-<대상>.py` / `test_<대상>.py` 명명 컨벤션을 그대로 따르고 기존 식별자와 겹치지
않는다. 신규 식별자 충돌 관점에서 이번 변경분에 실질적 위험은 없다.

## 위험도

NONE
