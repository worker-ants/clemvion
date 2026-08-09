STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 2 INFO

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 리뷰 범위

이번 diff 는 세 워크플로(`backend-checks.yml`/`deps-security-checks.yml`/`frontend-checks.yml`)에
복제돼 있던 `changes` 잡을 `.github/workflows/_changed-paths.yml` reusable workflow 로 추출하는
CI 리팩터가 중심이며, 그에 딸린 하니스 테스트(`test_changed_paths_reusable.py` 신설,
`test_required_check_skip_jobs.py` 갱신)·문서(`README.md`)·plan 갱신·이전 리뷰 라운드(18_32_41)
산출물 커밋, 그리고 무관해 보이는 백엔드 테스트 픽스 1건
(`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`)을 포함한다.
아래는 점검 관점 8개 축을 이 파일들 각각에 적용한 결과다.

## 발견사항

- **[INFO]** 신규 테스트 헬퍼가 만드는 임시 디렉터리가 정리되지 않는다 (파일시스템 부작용)
  - 위치: `.claude/tests/test_changed_paths_reusable.py:57-62` (`run_with()` 함수 — `tmp = tempfile.mkdtemp()` ~ `stub.chmod(0o755)`)
  - 상세: `run_with()`가 호출될 때마다 `tempfile.mkdtemp()`로 임시 디렉터리(및 그 안의 `scripts/ci-paths-changed.sh` 스텁)를 만들지만, `tempfile.TemporaryDirectory()` 컨텍스트 매니저나 `addCleanup`/`shutil.rmtree` 로 정리하는 코드가 없다. `ArgumentSplittingTest`(7개 메서드)가 각각 최소 1회 이 함수를 호출하므로, 로컬에서 반복 실행하면 OS 임시 디렉터리에 정리되지 않는 디렉터리가 누적된다. 같은 판정 스크립트를 실행 검증하는 자매 파일 `.claude/tests/test_ci_paths_changed.py`는 `tempfile.TemporaryDirectory()` + `setUp`/`tearDown` 패턴으로 이 문제를 피하고 있어, 이 신규 파일이 그 관례를 따르지 않은 것이 눈에 띈다. CI 러너(매 실행이 폐기됨)에서는 실질적 위험이 없고, `.claude/tests/` 안에 같은 정리-누락 패턴을 쓰는 파일이 이미 다수 있어(`test_block_integrity.py` 등) 이번 diff 가 새로 도입한 리스크 등급은 아니다.
  - 제안: `tmp = tempfile.mkdtemp()`를 `with tempfile.TemporaryDirectory() as tmp:` 로 감싸거나(호출부에서), 최소한 `run_with()`가 반환 전에 `atexit`/`addCleanup` 등으로 정리하도록 자매 파일과 정리 정책을 맞춘다.

- **[INFO]** 인라인 `changes` 잡 → `uses:` 잡 전환으로 GitHub 이 노출하는 체크(check) 표시 이름이 바뀔 수 있다 (인터페이스 변경)
  - 위치: `.github/workflows/backend-checks.yml:46-48`, `.github/workflows/deps-security-checks.yml:47-49`, `.github/workflows/frontend-checks.yml:28-30` (`changes:` 잡이 `uses: ./.github/workflows/_changed-paths.yml`로 치환)
  - 상세: 종전에는 `changes` 잡이 워크플로 내부에 인라인 스텝을 가졌고 `name: 변경 경로 판정`으로 노출됐다. 이제 `changes` 잡이 reusable workflow(`_changed-paths.yml`)를 호출하는 형태이므로, GitHub Actions UI 상 이 잡의 체크 이름 표기가 `<caller job name> / <called workflow의 job name>` 형태로 바뀔 가능성이 있다(코드만으로는 실제 렌더링을 확정할 수 없음). 다만 이 저장소의 설계상 required status check 대상은 `changes` 자체가 아니라 `lint`/`unit`/`typecheck-ratchet` 등 리프 잡이고, 그 잡들은 이번 diff 로 전혀 손대지 않았다(각 호출 워크플로의 `needs.changes.outputs.relevant` 참조 문법도 잡 이름 `changes` 그대로 유지되므로 잡 간 wiring 은 안전). `plan/in-progress/ci-required-check-skip-jobs.md`에 이미 "머지 후 Actions 에서 실제 표시 이름 1회 확인" 액션 항목이 명시돼 있어(§사용자 액션, 2026-08-09 추가), 이 위험은 코드 밖에서 추적되고 있다.
  - 제안: 코드 변경 불요 — plan 에 이미 기록된 대로 머지 후 Actions 실행 화면에서 표시 이름을 1회 육안 확인할 것.

## 확인했으나 발견사항으로 잡지 않은 것 (근거 기록)

- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts:1687-1709`: 기존에 `addEventListener('abort', …)` 만 달던 fetch mock 이, 이미 `aborted`인 signal 에 대해 즉시 `reject`하도록 조건 분기(`if (observedSignal!.aborted) failAsAborted(); else observedSignal!.addEventListener('abort', failAsAborted);`)가 추가됐다. 이 변경은 **테스트 파일 내부의 mock 콜백 등록 로직**에만 있고, `http-request.handler.ts` 등 프로덕션 코드·프로덕션 이벤트 배선은 이 diff 에 포함되어 있지 않다(파일 목록 확인). 새 리스너가 등록되지 않는 분기(이미 aborted)에서도 `failAsAborted`가 정확히 1회만 호출되어 중복 reject/leaked listener 위험은 없다. 프로덕션 부작용 없음.
- `.github/workflows/_changed-paths.yml:62-71`: `PR_BASE_SHA`/`PR_HEAD_SHA`/`PUSH_BEFORE_SHA`/`PUSH_AFTER_SHA`/`PATHSPECS` 는 전부 `github.event.*`/`inputs.*` 에서 **읽기만** 하고, 잡·워크플로 스코프의 전역 상태나 환경 변수를 쓰지 않는다. 새로운 외부 네트워크 호출(체크아웃 대상 저장소 자신 외)도 없다.
- `.github/workflows/_changed-paths.yml`의 `outputs.relevant.value: ${{ jobs.detect.outputs.relevant }}` → `jobs.detect.outputs.relevant: ${{ steps.detect.outputs.relevant }}` 3단 체인이 호출부의 `needs.changes.outputs.relevant` 참조 문법과 정확히 맞물려, 잡 이름이 `changes` 로 유지되는 한 다운스트림 소비자(`if: needs.changes.outputs.relevant != 'false'`)는 아무 수정 없이 그대로 동작한다 — 시그니처/인터페이스 파손 없음.
- 빈 `pathspecs` 입력에 대한 `exit 2` fail-closed 로직(`_changed-paths.yml:91-94`)은 이번 추출이 새로 필요로 하게 된 방어(예전엔 pathspec 이 YAML 리터럴로 하드코딩돼 있어 "빈 입력"이 애초에 발생할 수 없었다)이며, 단순 코드 이동이 아니라 신규 동작이라는 점을 헤더 주석이 명시하고 테스트(`test_empty_input_fails_closed`)로 고정하고 있다 — 문서화·테스트 모두 갖춰져 부작용 리스크로 잡지 않는다.
- `review/code/2026/08/09/18_32_41/*.{md,json}` 신규 커밋은 이전 리뷰 라운드의 산출물이며, 이 저장소 관행상 review 산출물은 git-tracked 로 남기는 것이 정상 practice(CLAUDE.md·과거 세션 기록)다 — 의도치 않은 파일시스템 부작용이 아니라 정상 워크플로 산출물.

## 요약

이번 변경은 CI 워크플로의 `changes` 잡 wiring 을 reusable workflow 로 추출하는 순수 리팩터링이며, 프로덕션 코드·공개 API·전역 상태·환경 변수 쓰기·네트워크 호출 표면을 새로 건드리지 않는다. 잡 이름(`changes`)과 출력 키(`outputs.relevant`)가 그대로 유지돼 호출부 3곳의 `needs.changes.outputs.relevant` 참조가 깨지지 않고, 새로 도입된 fail-closed 빈-입력 처리는 추출 자체가 만든 필요악이며 테스트로 고정돼 있다. 별개로 포함된 `http-request.handler.spec.ts` 수정은 테스트 mock 내부의 이벤트 리스너 등록 로직에 한정되고 프로덕션 코드는 손대지 않아 부작용이 없다. 실질적으로 남는 것은 INFO 2건 — 신규 테스트 헬퍼의 임시 디렉터리 미정리(기존 관행과 동일 수준, 저위험)와 reusable workflow 전환에 따른 GitHub 체크 표시 이름 변경 가능성(설계상 위험 낮고 이미 plan 에 머지 후 확인 액션이 기록됨)뿐이다.

## 위험도

LOW
