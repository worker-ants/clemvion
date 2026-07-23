### 발견사항

- **[INFO]** 신규 exit code 3(`EXIT_TOOLING_BROKEN`)의 fail-open 처리가 "의존성 미설치"와 "의존성 손상/변조"를 동일하게 취급함
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs` (jsdom/mermaid `import` catch 블록), `.claude/hooks/lint_mermaid_posttooluse.py` (`_EXIT_TOOLING_BROKEN` 분기), `.githooks/pre-commit` (`mermaid_rc -eq 3` 분기)
  - 상세: 기존에는 (문서화되지 않은 채로) import 실패 시 node 기본 exit 1로 크래시해 "파싱 오류"로 오인·차단됐다. 이번 변경은 이를 명시적 exit 3으로 분리하고 세 소비자 모두 fail-open(스킵)으로 통일했다. 의도된 설계이며 세 지점 모두 일관되게 갱신되어 있어 부작용 관점에서 결함은 아니지만, "node_modules 손상"의 원인이 단순 미설치뿐 아니라 서드파티 패키지 변조·공급망 문제일 수도 있어, 이 경로가 계속 조용히 스킵되면 실제 린트 기능이 장기간 비활성 상태로 남을 수 있다(stderr 메시지만 존재, 커밋/세션을 막지는 않음).
  - 제안: 현재 설계 의도(리뷰 이력 `review/code/2026/07/17 §A W1`)를 감안하면 변경 불요. 다만 후속으로 exit 3 발생 빈도를 세션 부트스트랩 로그 등으로 가시화하는 안을 검토할 수 있음(본 PR 스코프 밖).

- **[INFO]** `lint-mermaid.mjs`의 exit code 계약(0/1/2/3)에 대한 저장소 내 소비자는 두 곳(PostToolUse 훅, `.githooks/pre-commit`)뿐이며 둘 다 이번 diff에서 동반 갱신됨 — 시그니처/인터페이스 파급 없음
  - 위치: 위 두 소비자 + `.claude/tools/bootstrap-session.sh`(주석에서만 언급, 실제 호출 없음), `.github/workflows/harness-checks.yml`(직접 호출 없음)
  - 상세: grep 결과 `lint-mermaid.mjs`를 직접 실행하는 곳은 이 두 훅과 신규/기존 테스트뿐이다. 외부에서 이 스크립트의 exit code를 소비하는 숨은 호출자는 발견되지 않았으므로, exit 1의 암묵적 의미(구분 불가한 크래시)가 exit 3으로 재정의된 것이 하위 호환성 문제를 일으키지 않는다.
  - 제안: 없음 (확인용 기록).

- **[INFO]** 신규 테스트(`test_lint_mermaid_exit_codes.py`)는 `tempfile.mkdtemp()` 하위에 `lint-mermaid.mjs`만 복사해 "조상 디렉터리에 `node_modules`가 없다"는 전제(주석: "Under /var/folders there is no ancestor node_modules")로 import 실패를 재현함
  - 위치: `.claude/tests/test_lint_mermaid_exit_codes.py` `setUp()`
  - 상세: OS temp 디렉터리 위치·구조에 암묵적으로 결합된 가정이라, 프로젝트가 특이한 위치(예: 리포 내부 임시 경로, 상위에 우연히 `node_modules`가 존재하는 CI 러너)에서 실행되면 이 테스트만 실질적으로 vacuous 해질 가능성이 있다. 이는 프로덕션 코드의 부작용이 아니라 테스트 신뢰성 이슈이며, 파일시스템 생성/정리 자체는 `addCleanup(shutil.rmtree, ..., ignore_errors=True)`로 안전하게 처리된다.
  - 제안: 현재로선 문제 없음. 향후 CI 환경 변경 시 참고.

### 요약
diff는 mermaid-lint 도구 체인에 새 exit code 3(툴링 손상)을 도입하고, 이를 소비하는 두 훅(PostToolUse 파이썬 스크립트, bash pre-commit)을 모두 동반 갱신해 fail-open 정책을 일관되게 적용했다. 함수 시그니처·공개 인터페이스 변경 없음, 새 전역 변수는 모듈 스코프 상수(`_EXIT_TOOLING_BROKEN`/`EXIT_TOOLING_BROKEN`) 추가뿐, 환경변수·네트워크 호출은 관여하지 않으며(안내 메시지에 `npm install` 문자열이 있으나 실제 실행하지 않음), 신규/수정 테스트의 파일시스템 조작은 모두 임시 디렉터리 내에서 정리(cleanup)까지 포함되어 있다. 저장소 내 이 스크립트의 실제 호출자는 두 훅뿐임을 grep으로 확인했고 둘 다 갱신되어 부작용 파급 범위가 명확히 닫혀 있다. 유일한 유의점은 fail-open 설계가 "미설치"와 "손상/변조"를 동일 취급해 장기 미탐지 가능성을 남긴다는 점이나, 이는 이미 검토된 의도적 트레이드오프다.

### 위험도
LOW
