STATUS=success

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[INFO]** `deleteByPrefix()` 인터페이스 동작 변경 — 기존 호출부에는 무해하나 향후 호출부에 새 예외 표면 추가
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:169`
  - 상세: 기존 시그니처(`deleteByPrefix(prefix: string): Promise<number>`) 자체는 그대로지만, `prefix` 에 `%`/`_`/`\` 가 섞이면 새로 `throw new Error(...)` 하도록 동작이 바뀌었다. 현재 프로덕션 호출부는 `triggers.service.ts:875` 한 곳(`secret://triggers/${uuid}/`)뿐이고 UUID 라 메타문자가 절대 섞이지 않음을 개발자가 실측·문서화(`plan/in-progress/backend-lint-gate-broken-on-main.md`)했으므로 이번 변경으로 현재 호출부가 깨지는 일은 없다. 다만 이는 "호출부 목록이 지금 이대로일 때만" 안전한 가정이라, 향후 사용자 입력이 섞인 prefix 를 넘기는 신규 호출부가 생기면 이전에는 조용히(의도보다 넓게) 지워지던 것이 이제는 런타임 예외로 즉시 실패하는 쪽으로 바뀐다. 이는 fail-closed 방향의 의도된 강화이고, `secret-resolver.service.spec.ts` 에 정상/거부 양방향 테스트가 모두 추가돼 있어 side-effect 로서는 위험하지 않다 — 다만 "인터페이스 변경이 호출자에 미치는 영향" 관점에서 명시적으로 기록해 둔다.
  - 제안: 별도 조치 불요(이미 문서화·테스트됨). 향후 `deleteByPrefix` 를 사용자 입력 기반 prefix 로 호출하는 코드가 추가될 때 이 throw 를 인지하고 있어야 한다는 점만 유의.

- **[INFO]** 신규 CI 워크플로 `backend-checks.yml` 은 `paths:` 필터 없이 모든 PR/push 에서 트리거 — 의도된 설계
  - 위치: `.github/workflows/backend-checks.yml:29` (`on:` 블록)
  - 상세: required status check 로 등록하기 위해 의도적으로 `paths:` 필터를 뺐다(주석에 명시, `scripts/ci-paths-changed.sh` 로 실제 필터링을 `changes` 잡 내부로 옮김). 그 결과 `changes` 잡(checkout + 경로 판정)은 backend 와 무관한 모든 PR/push 에서도 항상 실행되어 네트워크 호출(체크아웃)이 발생한다. 다만 무거운 단계(pnpm install/eslint/jest/tsc)는 `needs.changes.outputs.relevant != 'false'` 로 게이트돼 있어 무관한 PR 에서는 `echo` no-op 으로 끝난다 — 이미 전환된 `deps-security-checks.yml`/`frontend-checks.yml` 와 동일한 기존 패턴이라 신규 side-effect 클래스는 아니다.
  - 제안: 조치 불요 — 문서화된 의도이며 기존 패턴과 일관됨.

- **[INFO]** `check-backend-typecheck-ratchet.py` 의 파일시스템 쓰기는 `--update` 플래그로만 발동 — CI 잡은 읽기 전용 경로만 탄다
  - 위치: `scripts/check-backend-typecheck-ratchet.py:137-148`(`write_baseline`), 호출부 `main()` L162-165
  - 상세: `write_baseline()` 이 `scripts/backend-typecheck-baseline.json` 을 덮어쓰는 유일한 지점인데, `main()` 에서 `args.update` 가 `True` 일 때만 호출된다. `.github/workflows/backend-checks.yml` 의 `typecheck-ratchet` 잡은 `python3 scripts/check-backend-typecheck-ratchet.py` 를 인자 없이 호출하므로 CI 에서 baseline 파일이 조용히 갱신될 경로는 없다. 테스트(`test_backend_typecheck_ratchet.py`)도 `mock.patch.object(MOD, "BASELINE", tmp)` 로 실제 커밋된 baseline 을 건드리지 않게 격리했다. 부작용 없음, 확인 목적의 기록.
  - 제안: 조치 불요.

그 외 항목(`.claude/tests/README.md`·`test_required_check_skip_jobs.py`·`test_workflow_yaml_structure.py` 의 표/레지스트리 추가, `harness-checks.yml` 의 `paths:` 항목 추가, 5개 backend `*.spec.ts` 의 mock 시그니처/누락 import 정정, `review/consistency/**` 스냅샷 산출물, `scripts/backend-typecheck-baseline.json` 신설)은 모두 기계적 등재·데이터·문서 변경이거나 순수 테스트 코드 보정이며, 전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 대한 의도치 않은 영향은 발견되지 않았다. `run_tsc()` 가 실제 `npx tsc` 서브프로세스를 실행하는 것은 게이트의 존재 목적 자체이고, 판정 테스트(`VerdictTest`)에서는 `mock.patch.object(MOD, "run_tsc", ...)` 로 완전히 격리되어 있어 테스트 스위트 실행 중 네트워크/장시간 서브프로세스가 유발되지 않는다.

### 요약

이번 변경은 신규 CI 워크플로(`backend-checks.yml`) 도입, 신규 ratchet 스크립트/baseline, 그리고 그 스크립트가 잡아낸 5개 `*.spec.ts` 파일의 타입 정합 수정(모두 테스트 전용, 프로덕션 코드 무변경)과 `SecretResolverService.deleteByPrefix()` 에 대한 방어적 입력 검증 추가로 구성된다. 파일시스템 쓰기(baseline 갱신)는 명시적 `--update` 플래그로만 발동하고 CI 경로·테스트 스위트 모두 그 플래그를 쓰지 않아 의도치 않은 파일 변경 위험이 없다. `deleteByPrefix()` 의 동작 변경은 시그니처는 그대로 유지한 채 예외 표면을 넓히는 것으로, 유일한 프로덕션 호출부가 UUID 기반이라 실질 영향이 없음이 실측·테스트로 뒷받침된다. 신규 CI 워크플로가 `paths:` 필터 없이 항상 트리거되는 것은 required check 등록을 위한 의도된 설계이며 무거운 단계는 변경 감지 잡으로 게이트돼 있다. 전역 변수 신설, 예상 밖의 환경 변수 접근, 의도치 않은 외부 서비스 호출, 이벤트/콜백 변경 등 다른 부작용 클래스에서는 문제를 발견하지 못했다.

### 위험도
LOW
