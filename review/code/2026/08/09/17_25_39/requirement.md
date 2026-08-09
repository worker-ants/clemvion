# 요구사항(Requirement) 충족 검토 — backend typecheck gap (`*.spec.ts` ratchet + backend CI 신설)

## 검증 방법 (요약)

정적 리뷰에 더해 **실측**으로 검증했다(모두 재현 가능):

- `codebase/backend` 에서 `npx tsc --noEmit -p tsconfig.json` 를 실제로 돌려 현재 워크트리의
  진단을 파싱 → `scripts/backend-typecheck-baseline.json` 과 **정확히 일치**(199건/38파일,
  increased=0, decreased=0, new=0). 이 baseline 으로 `check-backend-typecheck-ratchet.py::main()`
  을 직접 호출하면 `exit 0`.
- `.claude/tests/test_backend_typecheck_ratchet.py` 16/16, `test_required_check_skip_jobs.py` +
  `test_workflow_yaml_structure.py` 22/22, `secret-resolver.service.spec.ts` 20/20(신규 LIKE
  메타문자 케이스 포함), 그리고 이번 PR 이 고친 5개 spec 파일 전체(`slack-message.renderer`,
  `execution-engine.service`, `executions-rerun.service`, `integration-expiry-scanner.service`,
  `workflows.service`) jest 610/610 전부 통과.
- production 소스(`renderSlackEvent`, `updateExecutionStatus`, `ExecutionsService` 생성자,
  `IntegrationExpiryScannerService` 생성자)를 직접 grep/Read 하여 각 mock 수정이 실제 시그니처와
  1:1 일치함을 확인.

## 발견사항

- **[INFO]** `deleteByPrefix` 의 LIKE 메타문자 거부가 `spec/conventions/secret-store.md` 본문에는 반영되지 않음
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (JSDoc, `deleteByPrefix` 정의부 — 파일 컨텍스트 155행 부근) / `spec/conventions/secret-store.md` §2.1
  - 상세: 새 invariant("prefix 에 `%`/`_`/`\` 포함 시 throw")는 소스 JSDoc 과 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에는 근거와 함께 충분히 문서화됐지만, 이 메서드의 공식 계약을 담는 `spec/conventions/secret-store.md` §2.1(호출 규약 표)에는 언급이 없다. 다만 이 메서드는 외부에 노출되는 API 가 아니라 내부 전용 프로그래밍 계약이고, 현재 유일한 프로덕션 호출부(`triggers.service.ts`)는 UUID 기반이라 이 케이스에 절대 걸리지 않으므로 spec 본문과의 충돌은 없음(회색지대, spec 침묵) — CRITICAL/SPEC-DRIFT 아님.
  - 제안: 급하지 않음. 다음에 `secret-store.md` 를 손볼 기회에 §2.1 표 각주로 "prefix 는 LIKE 메타문자 금지(throw)"를 한 줄 추가하면 좋음.

- **[INFO]** 이번 커밋에 `spec/conventions/` 대상 consistency-check 산출물(review/consistency/2026/08/09/16_45_26/**, 파일 15~22)이 함께 포함됨
  - 위치: `review/consistency/2026/08/09/16_45_26/*`
  - 상세: 실제 코드 변경(backend `*.spec.ts` 5개 + 신규 ratchet/워크플로)과 이 consistency-check 의 target(`spec/conventions/`)이 서로 무관함을 그 산출물 자신(plan_coherence.md, rationale_continuity.md)이 이미 self-flag 했다. `review/**` 커밋은 저장소 관례(gitignore 대상 아님)이므로 위반은 아니며, 이 산출물 내부에서 CRITICAL 은 0건이었다. 요구사항 충족 판단에 영향 없음.
  - 제안: 조치 불요.

## 상세 검증 결과 (기능/스펙 정합)

1. **`scripts/check-backend-typecheck-ratchet.py`** — fail-closed 5경로(baseline 없음/파싱 실패/`files` 비-매핑/비-정수 값/tsc 실행·타임아웃 실패) 전부 `exit 2`, 증가·감소 양방향 실패, `DIAGNOSTIC` 정규식이 들여쓴 상세줄·`Found N errors` 요약줄을 정확히 배제함을 실측 확인. 문서화된 목적(테스트 코드 타입체크의 유일한 관측 지점)과 구현이 정확히 일치.
2. **`.github/workflows/backend-checks.yml`** — `test_required_check_skip_jobs.py`/`test_workflow_yaml_structure.py` 의 skip-job 계약(등재된 job `if:`, step `if:` 게이팅, `needs: changes`, no-op 안내 step, bare `pull_request:`) 을 전부 만족. `CONVERTED`/`_SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS` 3중 등재 동기화 확인.
3. **`.github/workflows/harness-checks.yml`** — 신규 `scripts/check-backend-typecheck-ratchet.py`/`scripts/backend-typecheck-baseline.json` 경로 등재 확인(스크립트 단독 수정 시에도 가드 트리거). `.github/workflows/**` 광역 glob 이 `backend-checks.yml` 자신도 이미 커버.
4. **5개 spec.ts mock 시그니처 수정** — 전부 production 시그니처와 정확히 일치(grep+실제 tsc 결과로 교차검증), jest 동작 회귀 없음(610/610 통과).
5. **`secret-resolver.service.ts` `deleteByPrefix`** — `secret://` prefix 검증 다음에 `/[%_\\]/` 검사를 추가, 정상 경로(UUID 기반 trigger prefix)는 통과·비정상 4종(`%`, `_`, `\`, `secret://%`) 은 모두 거부됨을 실제 테스트로 확인. 함수 반환 타입(`Promise<number>`) 그대로 유지.

## 요약

이번 diff 는 "backend `*.spec.ts` 가 어떤 게이트에서도 타입체크되지 않는다"는 실측된 공백을 ratchet 게이트(`check-backend-typecheck-ratchet.py` + `backend-typecheck-baseline.json`)로 메우고, 그 게이트를 새 `backend-checks.yml`(lint/unit/typecheck-ratchet 3잡, required-check skip-job 패턴)로 CI 에 연결하며, ratchet 이 실측으로 찾아낸 5개 파일의 실제 mock 시그니처 drift(TS2554 6건 + TS2304 4건)를 프로덕션 시그니처에 맞춰 수정하고, 별도로 발견된 `deleteByPrefix` 과다삭제 위험을 입력 거부로 방어한다. 실제로 `tsc --noEmit` 을 재현 실행해 커밋된 baseline(199/38)과 완전히 일치함을 확인했고, 관련 하네스 테스트·jest 스위트 전부(16+22+20+610건) 통과했다. TODO/FIXME/HACK 류 미완성 흔적 없음, 함수명·주석과 구현 간 괴리 없음, 에러 시나리오(fail-closed 5경로)·엣지 케이스(빈 카운트, 파일 drop-to-zero, 증가·감소 동시)가 테스트로 고정돼 있다. CRITICAL/WARNING 은 발견하지 못했고, spec 본문(`secret-store.md`)과의 미세한 문서 갭 1건만 INFO 로 남긴다.

## 위험도

NONE
