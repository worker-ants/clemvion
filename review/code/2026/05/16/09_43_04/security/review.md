# Security Review

검토 대상: `CHANGELOG.md`, `Makefile`, `README.md`, `plan/in-progress/e2e-makefile-followup-2026-05-16.md`, `review/consistency/2026/05/16/09_34_14/` 하위 문서 17개

## 발견사항

- **[INFO]** `_retry_state.json` 에 절대 경로 하드코딩
  - 위치: `review/consistency/2026/05/16/09_34_14/_retry_state.json` L3–4
  - 상세: `session_dir` 및 `summary_output_file` 필드에 `/Volumes/project/private/clemvion/...` 형태의 로컬 머신 절대 경로가 그대로 기록되어 있다. 이 파일이 원격 저장소(GitHub 등)에 커밋되면 팀원 또는 외부 기여자가 로컬 디렉토리 구조·볼륨명·사용자명을 추론할 수 있다. 직접적인 시크릿 노출은 아니지만 정보 노출(OWASP A05: Security Misconfiguration 의 불필요한 시스템 정보 공개) 범주에 해당한다.
  - 제안: `_retry_state.json` 은 로컬 세션 전용 임시 파일이므로 `.gitignore` 에 `review/**/_retry_state.json` 또는 `review/**/_*.json` 패턴을 추가해 원격 저장소에 포함되지 않도록 한다. 이미 커밋된 경우 `git rm --cached` 로 추적에서 제거한 뒤 `.gitignore` 에 등록한다.

- **[INFO]** Makefile `e2e-test-full` 의 short-circuit 동작과 cleanup 보장
  - 위치: `Makefile` diff `+154–157` (새로 추가된 주석 블록 및 기존 `e2e-test-full` 타겟)
  - 상세: 신규 주석은 `runner1 && runner2; STATUS=$$?` 패턴을 올바르게 설명한다. 보안 관점에서 `e2e-down` 이 항상 실행되어 격리 컨테이너가 확실히 정리된다는 점은 긍정적이다. 다만 `docker compose run --rm` 플래그가 이미 컨테이너를 자동 제거하므로 실질 위험은 낮다. 현 변경은 동작 변경 없이 주석만 추가한 것이므로 추가 조치 불요.
  - 제안: 현 구현 유지. 향후 runner 추가 시에도 동일 패턴(`&&` + `; STATUS=$$?` + `$(MAKE) e2e-down; exit $$STATUS`)을 일관 적용할 것.

## 요약

이번 변경은 `CHANGELOG.md`, `Makefile`(help 텍스트·인라인 주석 추가), `README.md`(e2e 안내 섹션 신설 및 폐기 경로 정리), plan/review 메타 문서 추가로만 구성된 순수 문서·인프라 변경이다. 프론트엔드·백엔드 애플리케이션 코드는 전혀 포함되지 않았다. 인젝션, 인증/인가, 암호화, 의존성 취약점 등 주요 보안 관점에서 리스크가 되는 코드 변경은 없다. 유일한 지적 사항은 `_retry_state.json` 에 로컬 절대 경로가 기록된 채 저장소에 커밋되어 있는 점(정보 노출)이며, `.gitignore` 등록으로 간단히 해소 가능하다.

## 위험도

LOW
