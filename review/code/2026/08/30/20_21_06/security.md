# 보안(Security) 코드 리뷰

## 리뷰 범위

- `.claude/tests/test_agent_return.mjs` — 신규 단위 테스트 2건 (프롬프트 계약 문구 검증)
- `.claude/workflows/_lib/agent-return.mjs` — `REPORT_RETURN_CONTRACT` 텍스트 개정(파일 sink vs 반환 메시지 sink 분리) + 가드 테스트 파일명 주석 정정
- `.claude/workflows/ai-review.js` / `consistency-check.js` / `merge-coordinate.js` — 위 `_lib` 변경의 verbatim mirror (3곳 동일 diff)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — JSDoc 주석만 확장(코드 로직 무변경)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — plan 트래커 문서, 완료 항목 기록

전 파일이 (1) 하네스 오케스트레이션 워크플로 스크립트의 프롬프트/주석 텍스트, (2) 그 텍스트를 검증하는 단위 테스트, (3) 순수 주석, (4) plan 문서다. 애플리케이션의 사용자 입력 처리 경로, DB 쿼리, 인증/인가 로직, 암호화, 외부 네트워크 호출을 만지는 코드는 이번 diff 에 없다.

## 발견사항

없음. 점검 관점 1~8 (인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10, 암호화, 에러 처리 노출, 의존성 보안) 모두 해당 사항이 관측되지 않았다:

- **인젝션**: 신규/변경 코드는 문자열 리터럴을 배열로 조립해 `.join('\n')` 하는 프롬프트 텍스트 생성뿐이다. 사용자 입력이나 외부 데이터가 이 문자열에 보간되지 않는다 (`DELIM`, `SUMMARY_DELIM` 은 코드 내 상수). `parseAgentReturn()` 의 정규식(`/STATUS\s*[=:]\s*([A-Za-z_]+)/`)과 신규 테스트의 정규식(`/output_file[\s\S]*마크다운 본문만/`)은 모두 고정 문자열(하드코딩된 계약 텍스트)에 대해서만 실행되며, 길이가 짧고 입력이 신뢰 경계 밖에서 오지 않아 ReDoS 우려도 없다.
- **하드코딩된 시크릿**: 없음.
- **인증/인가**: 이 diff 는 sub-agent 프롬프트 계약(파일 vs 반환 메시지 sink 구분)만 바꾼다. `execution-engine.service.ts` 변경은 JSDoc 주석 추가뿐이며 `updateExecutionStatus` 의 실제 검증 로직·트랜잭션 경계는 변경되지 않았다(diff 에 코드 라인 변경 없음, 주석만).
- **입력 검증**: 해당 없음(사용자 입력을 다루는 코드가 없음).
- **에러 처리**: 해당 없음(신규 에러 처리 경로 없음).
- **의존성 보안**: 신규/변경 의존성 없음.

## 참고 (보안 판정에는 영향 없음, 정보 제공용)

- `.claude/workflows/_lib/agent-return.mjs` 및 3개 워크플로 파일의 주석 변경은 `.claude/tests/test_workflow_shared_block.py` → `.claude/tests/test_workflow_scripts.py` 로 가드 테스트 파일명을 정정한 것으로 보인다. 실제 가드 스크립트가 그 경로에 존재하는지는 코드 리뷰 관점 밖(구조/일관성 검토 영역)이라 본 리뷰에서는 검증하지 않았다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 본문 중 과거에 처리된 `deleteByPrefix()` LIKE 메타문자 이슈(TypeORM 파라미터 바인딩이라 SQLi 아님, 과다 삭제 방지 목적)가 언급되지만 이는 이번 diff 가 아니라 기존 파일 컨텍스트(선행 커밋)에 해당하며 이번 변경 대상이 아니다.

## 요약

이번 changeset 은 코드 리뷰 하네스(`ai-review`/`consistency-check`/`merge-coordinate` 워크플로)가 sub-agent 에게 보내는 프롬프트 계약 텍스트를 "파일에는 마크다운 본문만, STATUS 헤더/구분자는 반환 메시지에만" 으로 명확히 가르는 문서·테스트 변경이며, 백엔드 파일의 변경은 주석 1건뿐이다. 사용자 입력 처리, 인증/인가, DB 접근, 암호화, 시크릿 관리 등 실질적인 보안 표면을 건드리는 코드가 없어 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
