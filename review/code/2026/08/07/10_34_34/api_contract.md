# API 계약(API Contract) 리뷰

## 대상 파일
1. `codebase/frontend/package.json` — devDependencies 4건 추가(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)
2. `plan/in-progress/harness-review-gate-ci-backstop.md` — 계획 문서 부록 추가
3. `pnpm-lock.yaml` — 위 의존성 추가에 따른 lockfile 갱신 (버전 pin 정합)

### 발견사항
해당 없음. 세 파일 모두 API 엔드포인트·라우트·컨트롤러·요청/응답 스키마·인증 로직과 무관하다. `package.json`/`pnpm-lock.yaml` 변경은 markdown 파싱용 devDependency(`mdast-util-*`, `github-slugger`, `@types/mdast`)를 명시적으로 선언한 것으로, plan 문서가 기록한 "미선언 의존이 CI 에서만 실패하던 결함(#6)"의 수정에 해당한다. API 계약 관점의 요소(하위 호환성, 버전 관리, 응답 형식, 에러 응답, 요청 검증, URL/경로 설계, 페이지네이션, 인증/인가)가 적용될 코드 변경이 없다.

### 요약
이번 diff 는 프론트엔드 devDependency 4건 추가와 그에 따른 lockfile 갱신, 그리고 계획 문서(plan) 부록 기록으로 구성되며 API 계약에 영향을 주는 코드(엔드포인트, 컨트롤러, DTO, 미들웨어 등)가 전혀 포함되어 있지 않다.

### 위험도
NONE
