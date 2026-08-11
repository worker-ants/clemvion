# API 계약(API Contract) 리뷰

## 대상 파일 검토
- `.claude/_shared/git_probe.py` — git 서브프로세스 래퍼 (hook/orchestrator 공용 유틸)
- `.claude/skills/code-review-agents/lib/session.py` — 리뷰 세션 디렉터리/메타데이터/로깅 유틸
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — consistency-checker CLI 오케스트레이터
- `.claude/tests/test_consistency_bundle_priority.py` — 위 오케스트레이터의 파일 우선순위 테스트
- `.claude/tests/test_consistency_context_budget.py` — 컨텍스트 예산/트렁케이션 테스트
- `.claude/tests/test_review_session_dir_collision.py` — 세션 디렉터리 충돌 테스트
- `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts` — plan 문서 링크 무결성 가드 테스트
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — spec/plan 마크다운 링크 파싱 유틸
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` — plan 완료 시 spec_impact frontmatter 가드 테스트

## 판정

해당 변경 세트는 전부 (1) `.claude/` 하위 개발 하네스 CLI/서브에이전트 오케스트레이터·git 프로브·세션 유틸과 그 유닛 테스트, (2) `codebase/frontend`의 문서(마크다운) 링크/frontmatter 무결성을 검증하는 **빌드타임 vitest 가드**로 구성된다. 어느 것도 HTTP 엔드포인트, REST 컨트롤러, 요청/응답 DTO, 라우팅 데코레이터, 인증/인가 미들웨어 등 제품 API 표면을 정의·수정하지 않는다:

- `git_probe.py`/`session.py`/`consistency_orchestrator.py`: subprocess 로 `git` 을 호출하고 로컬 파일시스템에 세션 디렉터리·JSON 메타데이터를 쓰는 CLI 스크립트다. 외부에 노출되는 HTTP API 가 아니며, 이 코드의 "인터페이스"는 CLI 인자와 stdout/파일 산출물이지 API 계약이 아니다.
- 나머지 테스트 파일들은 리포지토리 내부 문서(`spec/`, `plan/`) 의 링크 무결성·frontmatter 규약을 검사하는 정적 분석 유틸(`spec-links.ts`)과 그 vitest 스펙이다. `fs.readFileSync`/`path.resolve` 로 로컬 파일을 순회할 뿐, 백엔드 컨트롤러나 프론트엔드 API 클라이언트 코드가 아니다.

API 계약 관점(하위 호환성/버전 관리/응답 형식/에러 응답/요청 검증/URL 설계/페이지네이션/인증·인가)에서 평가할 대상이 없다.

## 위험도

NONE
