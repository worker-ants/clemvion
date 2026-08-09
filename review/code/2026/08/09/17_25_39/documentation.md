# 문서화(Documentation) 리뷰

## 검증 방법
프롬프트에 전문이 실리지 않은 파일은 `Read`로 직접 열어 대조했다. 특히 `scripts/backend-typecheck-baseline.json`을 `python3 -c "json.load(...)"`로 직접 파싱해 파일 수·합계를 실측했고, `renderSlackEvent`/`deleteByPrefix` 등 프로덕션 시그니처를 `Read`/`Grep`으로 직접 열어 신규 주석의 서술과 대조했다.

## 발견사항

- **[WARNING]** `scripts/check-backend-typecheck-ratchet.py` 모듈 docstring의 "199건 / 39파일" 수치가 같은 PR이 커밋한 실제 baseline과 파일 수가 어긋난다
  - 위치: `scripts/check-backend-typecheck-ratchet.py:24` (모듈 docstring, "## 왜 전면 승격이 아니라 ratchet 인가" 절)
  - 상세: docstring은 "착수 시점 잔여가 **199건 / 39파일**"이라고 적는다. 그런데 같은 PR이 커밋한 `scripts/backend-typecheck-baseline.json`을 직접 파싱하면 `total=199`(합계는 일치)이지만 `files` 매핑의 키 개수는 **38**이다(diff의 `files` 목록도 라인 5~42, 38개 항목). 진단 총량은 맞고 파일 개수만 1개 어긋나 있어, 이 스크립트 자신의 baseline과 자신의 설명 주석이 서로 다른 숫자를 말한다. 이 스크립트는 "baseline이 곧 계약"이라는 취지로 다른 파일(README, 테스트 docstring, plan)에서도 반복 인용되는 SoT 성격의 숫자라 더 눈에 띈다.
  - 제안: `39파일`을 `38파일`로 정정하거나, `scripts/check-backend-typecheck-ratchet.py --update` 실측 후 재계산해 docstring 수치를 baseline과 동기화할 것.

- **[INFO]** README/테스트 docstring의 "209건 / 40파일"과 실제 커밋된 baseline("199건 / 38파일")의 관계가 어느 문서에도 명시적으로 연결돼 있지 않다
  - 위치: `.claude/tests/README.md:44`("Measured 2026-08-09: 209 diagnostics across 40 files … Full promotion would mean disposing of all 209 first"), `.claude/tests/test_backend_typecheck_ratchet.py:153`("착수 시점 실측: 진단 209건이 전부 테스트 파일이었고 프로덕션은 0건이었다")
  - 상세: 209/40은 이 PR 착수 시점(수정 전) 측정치, 199/38(스크립트 docstring상은 199/39)은 이 PR이 진짜 결함 10건(TS2554 6 + TS2304 4)을 고쳐 그중 2개 파일(`executions-rerun.service.spec.ts`, `slack-message.renderer.spec.ts`)이 진단 0건으로 완전히 빠진 뒤의 값이다. 이 산술은 `plan/in-progress/backend-lint-gate-broken-on-main.md`에는 명시돼 있지만(“의도적 느슨함 ~199” / “진짜 stale 10”), README·테스트 docstring·스크립트 docstring 어디에도 “그래서 실제 커밋된 baseline은 199/38(또는 199/39)이다”라는 연결 문장이 없다. 두 수치를 나란히 보는 독자가 불일치로 오인할 여지가 있다.
  - 제안: README 행 또는 스크립트 docstring에 "이 PR이 그중 진짜 결함 10건을 수정해 baseline은 199건/38파일로 커밋됐다" 정도의 한 문장을 추가해 209 → 199 델타를 명시적으로 잇는다.

- **[INFO]** `slack-message.renderer.spec.ts`의 인자 제거 2곳에는 같은 PR의 다른 4개 spec 수정과 달리 "왜 지워지는지" 설명하는 인라인 주석이 없다 (스타일 불일치)
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.spec.ts` — `renderSlackEvent(...)` 호출부 2곳(diff 기준 새 파일 182~186번째 줄, 192~196번째 줄 부근; 실제로 제거된 `'D1'` 인자 줄 자체는 unified diff 상 게이트 없는 삭제 줄)
  - 상세: 실제 프로덕션 `renderSlackEvent(event, config)`(`slack-message.renderer.ts:44`)는 인자가 2개뿐이라 기존 테스트의 3번째 인자 `'D1'`은 TS2554(초과 인자)였다. 같은 PR의 다른 4개 파일(`execution-engine.service.spec.ts`, `executions-rerun.service.spec.ts`, `integration-expiry-scanner.service.spec.ts`, `workflows.service.spec.ts`)은 모두 "이 drift가 왜 다른 게이트에 안 걸렸는지"를 설명하는 인라인 주석을 동반했지만, 이 파일만 주석 없이 조용히 인자를 지운다. 같은 근본 원인(테스트 코드 타입체크 사각)을 보여주는 사례인데 유일하게 설명이 빠져 일관성이 떨어진다.
  - 제안: 다른 4곳과 동일한 패턴으로 "3번째 인자는 프로덕션 시그니처에 없던 TS2554였고 jest/`nest build` 양쪽에서 안 보였다" 수준의 짧은 주석을 추가해 스타일을 통일.

- **[WARNING]** 신설 `backend-checks.yml`(특히 로컬에 상응 명령이 없는 `typecheck-ratchet` 잡)이 `PROJECT.md`의 CI/게이트 문서에 반영되지 않았다
  - 위치: `PROJECT.md`(diff 밖 — 이번 변경에서 손대지 않음). 참고 지점: `PROJECT.md:25-28`(TEST WORKFLOW 표, lint/unit/build/e2e만 등재)과 `PROJECT.md:48`(`deps-security-checks.yml`이 유사하게 "CI 전용, 로컬 wrapper에 없는 게이트"로 별도 문단 서술된 기존 선례)
  - 상세: `lint`·`unit` 잡은 `.claude/tools/run-test.sh lint`/`unit`이 이미 로컬에서 동일하게 돌리므로 문제 없지만, `typecheck-ratchet` 잡(`python3 scripts/check-backend-typecheck-ratchet.py`)은 `run-test.sh`에 대응 단계가 없다(grep 확인, 매치 0). 즉 개발자가 PROJECT.md의 TEST WORKFLOW를 그대로 따라 5단계(lint→unit→build→e2e)를 전부 통과시켜도, push 후 CI의 `backend-checks.yml / typecheck-ratchet`에서 처음 실패를 볼 수 있다. 이 저장소는 `deps-security-checks.yml`의 `check-override-floors.py`/`check-pnpm-security-config.py`처럼 CI 전용 게이트가 있을 때 PROJECT.md에 그 사실과 실행 방법을 별도 문단으로 명시하는 선례를 이미 갖고 있다(`PROJECT.md:48`). 신설된 `typecheck-ratchet`도 같은 성격(로컬 wrapper 미포함, CI에서만 발견)인데 그 선례가 적용되지 않았다.
  - 제안: `PROJECT.md`에 `deps-security-checks.yml` 문단과 같은 형식으로 "backend-checks.yml의 typecheck-ratchet은 `run-test.sh`에 포함되지 않는다 — 로컬 확인은 `python3 scripts/check-backend-typecheck-ratchet.py`, baseline 갱신은 `--update`" 수준의 한 문단을 추가할 것.

## 요약
새 CI 워크플로(`backend-checks.yml`)·판정 스크립트(`check-backend-typecheck-ratchet.py`)·테스트(`test_backend_typecheck_ratchet.py`)·`.claude/tests/README.md` 신규 행·`plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신 모두 전반적으로 문서화 밀도가 높고("왜 필요한가"·판정 규칙·fail-closed 근거를 각 파일에서 반복 서술) `secret-resolver.service.ts`의 신규 JSDoc(LIKE 메타문자 거부 이유)도 실제 유일한 프로덕션 호출부(`triggers.service.ts:875`)와 정확히 대조된다. 다만 이번 PR의 핵심 수치(baseline 진단 건수/파일 수)가 스크립트 자신의 docstring·README·plan 사이에서 199/38 vs 199/39 vs 209/40으로 조금씩 다르게 인용되고 있어(합계 199는 일관, 파일 개수만 어긋남) SoT 스크립트 안의 오탈자성 수치 하나(WARNING)와 델타 미설명(INFO) 하나를 정정 대상으로 남긴다. 그 외 로컬 wrapper(`run-test.sh`)에 대응 단계가 없는 신규 CI 전용 게이트를 `PROJECT.md`에 반영하지 않은 점(WARNING)이 개발자가 push 전에 이 게이트의 존재를 알 방법이 없다는 실질적 위험으로 남는다. 이 셋 모두 머지를 막을 성격은 아니다.

## 위험도
LOW
