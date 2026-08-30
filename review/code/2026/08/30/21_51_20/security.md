# 보안(Security) 코드 리뷰

## 리뷰 범위

본 changeset(54개 파일, 3782줄 추가 / 40줄 삭제)은 다음 세 범주로 구성된다.

1. **하네스 프롬프트 계약 텍스트** — `.claude/workflows/_lib/agent-return.mjs` 의 `REPORT_RETURN_CONTRACT` 문자열을 "output_file 은 마크다운 본문만 / STATUS 헤더·구분자는 반환 메시지에만" 으로 sink 를 분리하고, 이를 verbatim 미러링하는 `.claude/workflows/ai-review.js` · `consistency-check.js` · `merge-coordinate.js` 3곳, 가드 테스트 파일명 오기 정정(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)
2. **신규 회귀 테스트** — `.claude/tests/test_agent_return.mjs`(node:test 2건), `.claude/tests/test_workflow_scripts.py`(마커 밖 파일명 참조 대조 1건)
3. **주석/문서 전용 변경** — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `updateExecutionStatus` JSDoc(self-deadlock 호출 스택 축 감사 결과 갱신, **코드 로직 변경 0**), `plan/complete/spec-draft-raw-query-results.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md`·`plan/in-progress/update-returning-tuple-shape.md` 서술 갱신, `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21,21_34_15}/**` 하위 이전 리뷰 라운드 산출물(전부 신규 markdown 리포트, 그 자체가 애플리케이션 코드가 아님)

전 파일이 (a) 하네스 오케스트레이션 스크립트의 프롬프트 문자열·주석, (b) 그 문자열을 검증하는 단위 테스트, (c) 순수 JSDoc 주석, (d) plan/review markdown 문서다. 사용자 입력 처리 경로, DB 쿼리, 인증/인가 로직, 세션 관리, 암호화, 외부 네트워크 호출, 신규/변경 의존성을 만지는 코드는 이번 diff 에 없다.

## 발견사항

없음. 점검 관점 1~8 모두 해당 사항이 관측되지 않았다.

- **인젝션**: 변경 코드는 문자열 리터럴 배열을 `.join('\n')` 하는 프롬프트 텍스트 생성뿐이다(`.claude/workflows/_lib/agent-return.mjs` 및 3개 미러). 사용자 입력이나 외부 데이터가 이 문자열에 보간되지 않는다 — `DELIM`(`'===REPORT_MARKDOWN_BELOW==='`)은 코드 내 상수다. 신규 테스트(`test_agent_return.mjs:117`, `:121`)의 정규식(`/output_file[\s\S]*마크다운 본문만/`, `/넣지 마세요/`)은 신뢰 경계 밖 입력이 아닌 고정 계약 문자열에만 실행되며 패턴 자체도 선형(중첩 정량자 없음)이라 ReDoS 우려도 없다. `test_workflow_scripts.py` 의 신규 `stale = re.compile(r"\.claude/tests/(test_\w+\.py)")` 도 저장소 소스 파일 텍스트에 대해서만 실행되는 정적 가드용 패턴이다.
- **하드코딩된 시크릿**: 없음. diff 전체(harness + `execution-engine.service.ts` + plan/review 문서)를 `password|secret|api[_-]?key|token|bearer|private[_-]?key|BEGIN (RSA|PRIVATE)|aws_|authorization` 로 grep 한 결과 매치 0건.
- **인증/인가**: `execution-engine.service.ts` 변경은 `updateExecutionStatus` 의 self-deadlock 관련 JSDoc 주석 확장뿐이며, diff 상 코드 라인 변경이 전혀 없다(주석 블록만 교체) — 트랜잭션 경계·상태 전이 검증 로직은 그대로다.
- **입력 검증**: 해당 없음(사용자 입력을 다루는 코드 없음).
- **OWASP Top 10**: 해당 표면(웹 요청 처리, 접근 제어, 취약한 설계 등) 자체가 이 diff 에 존재하지 않는다.
- **암호화**: 해시/암호화 알고리즘, 평문 전송 관련 변경 없음.
- **에러 처리**: 신규/변경된 에러 처리 경로 없음. `STATUS=<success|fatal>` 관련 텍스트는 fan-out sub-agent 결과 파싱 계약이며 스택 트레이스·내부 경로·자격증명 등 민감정보를 노출하는 변경이 아니다.
- **의존성 보안**: `package.json`/lockfile 등 의존성 변경 없음.

## 참고 (보안 판정에 영향 없음, 정보 제공용)

- 신규 테스트 `test_agent_return.mjs` 의 `indexOf('1)')`/`indexOf('2)')` 슬라이스 기반 파싱은 계약 문구가 바뀌면 취약해질 수 있으나, 이는 유지보수성 관점의 결함이지 보안 취약점은 아니다.
- `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21,21_34_15}/**` 는 harness 가 생성한 이전 라운드 리뷰 산출물이며 애플리케이션 실행 경로와 무관하다. 그 안에 `plan/in-progress/backend-lint-gate-broken-on-main.md` 관련 서술 중 과거 `deleteByPrefix()` LIKE 메타문자 이슈가 언급되지만(TypeORM 파라미터 바인딩으로 SQLi 아님, 과다 삭제 방지 목적) 이는 선행 커밋의 기존 컨텍스트이며 이번 diff 의 변경 대상이 아니다.

## 검증 메모

- 저장소 트리를 뮤테이션하지 않았다 — `Read`/`Grep`/`git diff --stat`/grep 패턴 매칭만 사용했다. `git status --short` 확인 불요(쓰기 작업 자체를 하지 않음).

## 요약

이번 changeset 은 코드 리뷰 하네스(`ai-review`/`consistency-check`/`merge-coordinate` 워크플로)가 sub-agent 에게 보내는 프롬프트 계약을 "파일에는 마크다운 본문만, STATUS 헤더/구분자는 반환 메시지에만" 으로 명확히 가르는 문서·테스트 변경과, 백엔드 파일의 self-deadlock 감사 JSDoc 주석 갱신(코드 로직 변경 없음), 그리고 plan/review 문서 갱신으로 구성된다. 사용자 입력 처리, 인증/인가, DB 접근, 암호화, 시크릿 관리 등 실질적인 보안 표면을 건드리는 코드가 이번 diff 에 전혀 없어 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
