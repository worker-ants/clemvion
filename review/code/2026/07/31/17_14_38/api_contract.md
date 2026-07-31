# API Contract Review

## 검토 범위

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_consistency_context_budget.py`
- `.claude/tests/test_prompt_omission_notice.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`

## 확인 절차

`git diff origin/main...HEAD` 로 실제 변경분을 직접 확인했다(프롬프트에는 unified diff 없이 전체
파일 컨텍스트만 제공되어, 어느 줄이 이번 diff 인지 별도로 대조 필요). 변경은 다음 세 가지로 요약된다.

1. `code_review_orchestrator.py`: `build_files_section` 의 예산(budget) 차감 산술을
   `_charge_notice()` 로 통합하고, 2단계 절단(파일 단위 cap → 프롬프트 전체 cap) 시 원본 총
   줄 수(`total_lines`)를 별도로 보존해 두 번째 절단이 첫 번째 절단의 주석을 총합으로 잘못
   보고하던 결함을 수정.
2. `consistency_orchestrator.py`: 파일 경계 마커를 `_BUNDLE_FILE_MARKER`(`"\n#### \`"`) 에서
   `_BUNDLE_FILE_SENTINEL`(`"\n<!-- @bundle-file -->\n"`) 로 교체(본문의 레벨-4 헤딩이 파일
   경계로 오인되는 결함 수정) + `_neutralize_sentinel()` 로 문서가 그 sentinel 자체를 쓰는
   엣지 케이스를 방어 + `collect_markdown_files`/`prioritize_bundle_files` 정렬을 사전순에서
   natural sort(`_natural_key`) 로 교체.
3. 나머지 3개 파일은 위 동작을 고정하는 테스트, 마지막 1개는 그 작업을 추적하는 plan 문서.

이 6개 파일 전부가 Claude Code 자신의 리뷰/일관성 검토 harness 내부 구현이며, 어떤 파일에도
HTTP 라우트·컨트롤러·요청/응답 DTO·OpenAPI/Swagger 정의·인증 미들웨어가 없다. 외부에 노출되는
"계약"에 해당할 만한 표면을 넓게 잡아 다음을 확인했다.

- **CLI 인자 계약(argparse)**: `--spec/--plan/--impl-prep/--impl-done/--diff-base/--resume/
  --summary-state/--update/--agent/--status/--reset-hint` 등 두 orchestrator 의 인자 정의는
  이번 diff 에서 손대지 않았다(그대로 유지).
- **stdout 응답 포맷**: `pending=N success=N fatal=N ...` 류의 한 줄 요약(다른 hook·SKILL 이
  파싱하는 부분)도 변경 없음.
- **`_retry_state.json` 온디스크 스키마**: 필드 추가/삭제 없음.
- **프로세스 종료 코드/에러 메시지**: `_require_target` 등 유효성 검증 로직 불변.
- **내부 private 상수 rename** (`_BUNDLE_FILE_MARKER` → `_BUNDLE_FILE_SENTINEL`): 저장소 전체
  grep 결과 이 파일 자신과 `.claude/tests/**` 외 외부 소비자 없음 — 하위 호환 영향 없음.

## 점검 관점별 코멘트 (참고용)

체크리스트 8개 항목(하위 호환성/버전관리/응답형식/에러응답/요청검증/URL 설계/페이지네이션/
인증인가) 중 이 diff 에 실질적으로 걸리는 항목은 없다. 다만 "페이지네이션" 항목과 개념적으로
유사한 지점 하나만 참고로 남긴다 — `build_files_section` 의 파일 절단(cut) + 생략 안내는
목록형 응답의 "일부만 반환 + total 메타데이터" 패턴과 유사하며, 이번 diff 는 그 "total" 값이
2차 절단 시 실제 총량이 아니라 1차 절단 주석 문자열의 길이로 잘못 보고되던 결함을 고쳤다(내부
프롬프트 조립 로직일 뿐 외부 응답 스키마는 아니므로 CRITICAL/WARNING 판정 대상은 아님).

## 발견사항

없음 — 이번 변경에 API 계약 관점의 검토 대상 코드가 없다.

## 요약

이번 diff 는 Claude Code 리뷰/일관성-검토 harness 내부의 컨텍스트 번들링·예산 절단·정렬
로직만 수정한다. HTTP 엔드포인트, 요청/응답 스키마, 버전 관리, 페이지네이션, 인증/인가 등
전통적 API 계약 요소가 존재하지 않으며, 느슨한 의미의 내부 계약(CLI 인자, stdout 요약 포맷,
`_retry_state.json` 스키마)도 이번 diff 에서 변경되지 않았다. 유일하게 변경된 private 상수
rename 은 grep 으로 외부 소비자 부재를 확인했다. API 계약 관점에서는 해당 없음.

## 위험도

NONE
