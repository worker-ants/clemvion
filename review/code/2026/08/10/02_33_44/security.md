# Security Review — plan-frontmatter.test.ts

## 리뷰 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (전체, vitest 테스트 파일)

## 컨텍스트
이 파일은 프로덕션 런타임 코드가 아니라 **CI/로컬 개발 시점에만 실행되는 vitest 가드**다. 리포지토리 자신의 `plan/in-progress/**`, `plan/complete/**` 마크다운 파일을 읽어 frontmatter(`worktree`/`started`/`owner`)와 상대링크 무결성을 검증한다. 입력 소스는 원격 사용자나 네트워크가 아니라 이미 리포지토리 쓰기 권한을 가진 기여자가 커밋한 파일이므로, 외부 공격자가 통제 가능한 입력이 유입되는 경로가 아니다.

## 발견사항

- **[INFO]** `gray-matter`(내부적으로 `js-yaml`)로 리포지토리 내 마크다운 frontmatter 를 파싱
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:99` (`data = matter(raw).data ?? {};`)
  - 상세: YAML 파서는 일반적으로 안전하지 않은 태그(`!!js/function` 등)를 통한 코드 실행 이력이 있는 라이브러리 계열이다. 다만 `gray-matter@^4.0.3`(package.json 확인)은 기본적으로 `js-yaml` 의 safe schema 를 사용하며, 입력값도 신뢰된 리포지토리 자체 콘텐츠(이미 커밋 권한을 가진 사람만 수정 가능)이므로 실질적 악용 경로는 없다. 새로운 공격 표면을 추가하지 않는다.
  - 제안: 별도 조치 불필요. 향후 이 파서가 외부/미신뢰 입력(예: 사용자 업로드 마크다운)을 처리하도록 재사용될 경우에는 반드시 safe-load 옵션이 명시적으로 유지되는지 재검토할 것.

- **[INFO]** 파일 경로 조합에 리포지토리 루트 기준 고정 서브경로만 사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:66` (`collectTopLevelPlans` → `collectLivePlanMarkdown(root)`), `:112`/`:126` (`path.join(root, "plan", "in-progress")`)
  - 상세: `root` 는 `repoRoot()` 로 결정되고 이후 결합되는 경로 세그먼트(`"plan"`, `"in-progress"`)는 모두 리터럴 문자열이다. 사용자 입력이 경로 조합에 개입하지 않으므로 경로 탐색(path traversal) 위험이 없다.
  - 제안: 없음.

- **[INFO]** 테스트 실패 메시지에 파일 상대경로·frontmatter 값·링크 대상 경로를 그대로 노출 (`rel`, `wtStr`, `v.source`/`v.target` 등)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:119`, `:154`
  - 상세: CI 로그/터미널에만 출력되는 값으로 시크릿이나 자격증명이 아니라 리포지토리 내 문서 경로·plan 메타데이터일 뿐이다. 민감정보 노출로 볼 수 없다.
  - 제안: 없음.

인젝션(SQL/XSS/커맨드/LDAP), 하드코딩 시크릿, 인증/인가, 안전하지 않은 암호화, 알려진 취약 의존성 사용 등은 이 파일 범위 내에서 해당 사항이 발견되지 않았다. 정규식(`ISO_DATE`, `WORKTREE_PLACEHOLDER`)도 중첩 정량자나 재앙적 backtracking 형태가 없어 ReDoS 우려가 없다. 쓰기 연산(`fs.writeFileSync` 등) 없이 순수 읽기 전용 검증 로직만 존재한다.

## 요약
대상 파일은 프로덕션 코드가 아닌 리포지토리 자체 plan 문서의 frontmatter/링크 무결성을 검증하는 개발용 vitest 가드이며, 처리하는 입력은 이미 리포지토리 쓰기 권한을 가진 기여자가 만든 신뢰된 콘텐츠다. 경로 조합은 리터럴 세그먼트로 고정되어 경로 탐색 위험이 없고, YAML 파싱(`gray-matter`)도 안전한 기본 스키마를 사용하는 버전이며 미신뢰 입력을 처리하지 않는다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 암호화 결함, 민감정보 노출 등 보안상 실질적 결함은 발견되지 않았다.

## 위험도
NONE
