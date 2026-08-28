# 정식 규약 준수 검토 — convention_compliance

## 검토 모드
--impl-done, scope=`spec/5-system/`, diff-base=`origin/main`

## 검토 범위 판정 (선행 확인)

`git diff origin/main...HEAD --stat` 실측 결과, 이번 변경(코드 영역)은 다음으로만 구성된다:

- `codebase/frontend/eslint.config.mjs` — 상단 주석(eslint 10 상향 차단자 표) 갱신
- `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts` (신규) — lockfile peer range 파서/판정 순수 로직
- `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` (신규) — 위 로직을 쓰는 vitest 캐너리 가드
- `plan/in-progress/deps-peer-gating-and-eslint10.md` — plan 갱신
- `review/code/2026/08/28/23_20_05/**` — 직전 코드 리뷰 산출물(RESOLUTION/SUMMARY 등)

target 으로 지정된 `spec/5-system/`(인증/세션/RBAC/감사로그, API 공통 규약, 에러 처리 등)이 다루는
어떤 도메인 모듈·API 엔드포인트·DTO·이벤트 페이로드·에러 코드도 이번 diff 에 포함되어 있지 않다.
변경은 순수 빌드 툴체인(eslint 설정 주석) + 그 전제를 감시하는 repo-guard 테스트 신설이며, 대상
파일 경로(`codebase/frontend/src/lib/repo-guards/__tests__/**`, `codebase/frontend/eslint.config.mjs`)는
`spec/5-system/*.md` 의 `code:` frontmatter 목록 어디에도 속하지 않는다(1-auth.md 의 `code:` 목록,
2-api-convention.md 등 다른 5-system 문서에도 매핑되는 코드 영역이 없음).

## 발견사항

없음.

정식 규약(`spec/conventions/**`)이 규율하는 대상 — API 엔드포인트/DTO 명명, 응답·이벤트 페이로드
형식, 에러 코드 레지스트리, audit action 명명, 문서 3섹션 구조, `_product-overview.md`/`0-` prefix
등 — 중 어느 것도 이번 diff 가 건드리지 않는다. 구체적으로 확인한 항목:

- **명명 규약**: 신규 파일 `eslint10-unblock-guard.ts` / `eslint10-unblock.test.ts` 는 API/DTO/endpoint
  가 아니라 내부 테스트 유틸이다. 동일 디렉터리의 기존 형제 가드(`typescript-toolchain.test.ts`)와
  `-guard.ts`/`.test.ts` 분리 패턴이 일치하고, backend 대칭물은 `.spec.ts`(jest)로 프레임워크별
  기존 관례를 그대로 따른다 — 이는 `spec/conventions/`에 명시된 규칙이 아니라 기존 코드베이스
  관행이므로 위반 대상이 아니다.
- **출력 포맷 규약**: 변경 파일에 API 응답·이벤트 페이로드·에러 코드 정의가 없다.
- **문서 구조 규약**: `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter 는
  `spec_impact: none`(리스트 아님이지만 CLAUDE.md/Gate C 규약상 `none` bare string 은 허용값)으로,
  이번 변경이 spec 에 영향 없음과 일치한다. `spec/5-system/**` 문서 자체는 이번 diff 로 수정되지
  않았다.
- **API 문서 규약(OpenAPI/Swagger)**: 해당 없음 — NestJS 컨트롤러/DTO 변경 없음.
- **금지 항목**: `spec/conventions/`가 명시적으로 금지한 패턴(예: 억제 데코레이터 무검증 사용,
  비-페이징 컬렉션 포맷 오용 등)에 해당하는 코드가 diff 에 없다. 오히려 diff 내 주석은
  "`peerDependencyRules` 억제는 미검증 fail-open 이라 채택하지 않는다"고 명시해 규약 취지(무검증
  억제 금지)에 부합하는 방향이다.

과거 유사 케이스(`feedback_impl_done_spec_bundle_bug` — prompt grep 0건이면 오탐 소지)와 동형이라,
"target 영역 spec 코드가 diff 에 없음"을 근거로 BYPASS 판정한다. spec 문서 자체 내용에 대한
규약 위반 여부는 이번 diff 범위 밖이라 별도로 재검토하지 않았다(직전 커밋들에서 이미 다수의
Rationale·명명 검토를 거친 안정 문서로 보인다).

## 요약

이번 PR 의 실제 변경분은 `spec/5-system/` 이 규율하는 어떤 도메인 표면(API/DTO/이벤트/에러코드/
감사로그)도 건드리지 않는 순수 프런트엔드 빌드 툴체인 변경(eslint 10 상향 차단자 문서화 + 그
전제를 감시하는 vitest 캐너리 가드 신설)이다. 정식 규약(`spec/conventions/**`) 위반 소지가 있는
명명·포맷·문서구조·API문서·금지패턴 어느 관점에서도 위반이 발견되지 않았으며, target scope 와
diff scope 가 교차하지 않는다는 점에서 이 검토는 실질적으로 해당 없음(N/A)에 가깝다.

## 위험도
NONE
