# Security Review

## 리뷰 대상 요약

- `.claude/tests/README.md` — 카탈로그 테이블에 신규 테스트 1행 추가 (문서만)
- `.claude/tests/test_e2e_exemption_paths_sync.py` — 신규 harness 자체-테스트. `.github/workflows/e2e.yml` 의
  `paths-ignore` 와 `PROJECT.md` 의 e2e 면제 화이트리스트 간 drift 를 잡는 stdlib-only 텍스트 파서 + 단언
- `plan/in-progress/harness-guard-followups.md` — plan 문서 갱신 (체크박스·서술)

세 파일 모두 애플리케이션 코드(`codebase/`)가 아니라 하네스 self-test 와 plan 추적 문서다. 처리 대상 입력은
저장소 자신이 관리하는(신뢰된) 로컬 설정 파일(`e2e.yml`, `PROJECT.md`) 뿐이며, 네트워크·사용자 입력·외부
신뢰 경계를 넘는 데이터는 없다.

## 발견사항

- **[INFO]** stdlib 전용 hand-rolled 파서가 신뢰 입력만 처리 — 보안 경계 아님
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:71` (`_yaml_scalar`), `:91` (`parse_paths_ignore_blocks`), `:126` (`parse_exemption_whitelist`)
  - 상세: 정규식 3종(`^(\s*)paths-ignore:\s*(#.*)?$`, `^\s*-\s+(.*)$`, `` `([^`]+)` ``)은 모두 선형 시간이며
    중첩 quantifier·backtracking 폭발 소지가 없다. 입력도 CI 워크플로가 아니라 이 저장소가 git 으로 버전
    관리하는 두 파일(`e2e.yml`, `PROJECT.md`)뿐이라 신뢰 경계를 넘지 않는다. ReDoS·인젝션 벡터 없음.
  - 제안: 없음 (현행 유지 가능). 다만 향후 이 파서에 외부(비-repo) 입력을 흘려보내는 재사용을 하게 되면
    이 가정이 깨지므로 그 시점에 재평가.

- **[INFO]** 예외 메시지에 파일 원문 스니펫 포함 — 정보노출 리스크 없음
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:83` (`raise ValueError(f"unterminated quote in list item: {raw!r}")`)
  - 상세: 테스트 실패/파서 오류 시 raw 텍스트를 `ValueError` 메시지에 그대로 담는다. 원본이 이미 공개
    저장소에 커밋된 CI 설정·문서 텍스트이고 노출 대상도 CI 로그/로컬 실행자뿐이라 민감정보 노출에
    해당하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 세 파일 전체
  - 상세: `UNMIRRORED_WHITELIST_ENTRIES` 딕셔너리·경로 상수(`E2E_WORKFLOW`, `PROJECT_MD`)는 모두 공개
    저장소 내부 경로/문자열이며 API 키·토큰·비밀번호 유형이 아니다.
  - 제안: 없음.

인젝션(SQL/XSS/커맨드/LDAP/경로탐색), 인증/인가, 암호화, 의존성 보안 항목은 이 변경분에 해당 코드 경로가
없어 평가 대상이 아니다(신규 외부 의존성 추가 없음, subprocess/네트워크 호출 없음, 인증·세션 로직 없음).

## 요약

세 파일 모두 애플리케이션 런타임이 아닌 CI/harness 자체-테스트와 plan 문서 변경이며, 처리하는 입력은
저장소가 신뢰하는 자신의 설정 파일뿐이라 OWASP Top 10 관점에서 공격 표면을 새로 열지 않는다. 신규
정규식 기반 파서는 backtracking 폭발 가능성이 없는 단순 선형 매칭이고, 하드코딩된 시크릿·인증 우회·평문
전송·안전하지 않은 암호화 등 전형적 보안 결함은 발견되지 않았다.

## 위험도

NONE
