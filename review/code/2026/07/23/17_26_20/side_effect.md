### 발견사항

- **[INFO]** `import _harness` 의 `sys.path` 전역 변경은 신규 패턴이 아니라 기존 harness 테스트 전체가 공유하는 확립된 관례
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:36` (해당 줄 `import _harness  # noqa: F401  — side effect: harness path setup`)
  - 상세: `_harness.py`(`.claude/tests/_harness.py:32-33`)가 import 시점에 `sys.path.insert(0, str(HOOKS_DIR))` 로 인터프리터 전역 상태(`sys.path`)를 변경한다. 이 자체는 이번 diff 가 도입한 것이 아니라 `.claude/tests/` 하위 모든 테스트 파일이 재사용하는 공유 harness 로더이며, 중복 삽입 가드(`if str(HOOKS_DIR) not in sys.path`)도 이미 있어 반복 import 에도 안전하다. noqa 주석으로 "side effect" 임을 스스로 명시해 신규 리뷰어의 혼동을 예방한 점도 확인됨.
  - 제안: 조치 불요. 기존 컨벤션과 일치하며 새로운 위험을 추가하지 않음.

- **[INFO]** 신규 테스트가 실제 저장소 파일(`e2e.yml`, `PROJECT.md`)을 read-only 로 참조
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py` `WorkflowMirrorsWhitelistTest.setUpClass` (라인 237-243)
  - 상세: `E2E_WORKFLOW.read_text(...)`, `PROJECT_MD.read_text(...)` 로 실제 파일을 읽기만 하며, 어떤 파일도 쓰거나 삭제하지 않는다. 파싱 함수(`_yaml_scalar`, `parse_paths_ignore_blocks`, `parse_exemption_whitelist`)는 모두 순수 함수로 입력 텍스트를 변형하지 않고 새 리스트/문자열을 반환한다. 네트워크 호출, 환경 변수 읽기/쓰기, 전역 변수 도입(모듈 스코프 상수 `REPO_ROOT`/`E2E_WORKFLOW`/`PROJECT_MD`/`WHITELIST_HEADING`/`UNMIRRORED_WHITELIST_ENTRIES` 는 테스트 모듈 로컬이며 다른 모듈과 충돌하지 않음) 등 없음.
  - 제안: 조치 불요.

- **[INFO]** README.md·plan 문서 변경은 순수 서술 갱신
  - 위치: `.claude/tests/README.md:26`(신규 표 행), `plan/in-progress/harness-guard-followups.md` §E·§F 잔여 항목
  - 상세: 문서 텍스트/체크박스 상태 갱신뿐이며 코드·설정·인터페이스에 영향을 주는 부작용 없음.
  - 제안: 조치 불요.

## 요약

이번 변경은 (1) 신규 harness 자기-테스트 파일 `test_e2e_exemption_paths_sync.py` 추가, (2) 그 카탈로그 문서화(README.md), (3) plan 문서의 체크리스트/서술 갱신으로 구성된다. 신규 테스트는 `.github/workflows/e2e.yml`·`PROJECT.md` 를 read-only 로 파싱하는 순수 함수 기반이며, 파일 시스템 쓰기·환경 변수 조작·네트워크 호출·기존 함수 시그니처 변경·공개 API 영향이 전혀 없다. 유일하게 눈에 띄는 "부작용"인 `import _harness` 의 `sys.path` 변경은 이 저장소 harness 테스트 전체가 공유하는 기존 확립된 패턴(중복 삽입 가드 포함)이며 이번 diff 가 새로 도입한 위험이 아니다. 부작용 관점에서 우려할 사항은 발견되지 않았다.

## 위험도
NONE
