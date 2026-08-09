# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

4개 파일 모두 저장소 자체의 `plan/`·`spec/`·소스 트리를 대상으로 하는 **개발/CI 전용 정적 가드(테스트) 코드**다. 외부 네트워크 입력, 인증된 사용자 요청, DB 쿼리, 시크릿을 다루지 않고, 오직 로컬 파일시스템(리포지토리 checkout 자체)만 읽는다. 공격 표면은 "이 리포지토리에 커밋 권한이 있는 사람이 `plan/*.md` frontmatter 나 markdown 링크를 어떻게 쓰는가" 로 사실상 제한된다.

## 발견사항

- **[INFO]** `bucket` 파라미터는 하드코딩 상수만 전달되어 경로 탐색 공격 표면이 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:43-49` (`walkPlanMarkdown` 정의), 호출부 `plan-scan.ts:74`, `plan-scan.ts:79`
  - 상세: `walkPlanMarkdown(root, bucket, options)` 는 `path.join(root, "plan", bucket)` 로 스캔 디렉터리를 만든다. `bucket` 이 외부/사용자 입력이라면 `../../etc` 같은 경로 탈출이 우려되겠으나, 실제로는 두 곳의 호출부(`collectLivePlanMarkdown`→`"in-progress"`, `collectCompletePlanMarkdown`→`"complete"`) 모두 리터럴 문자열이고 export 되는 것은 이 두 래퍼 함수뿐, `walkPlanMarkdown` 자체는 export 되지 않는다. 따라서 실질적인 경로 탐색 취약점은 없음.
  - 제안: 조치 불요. 향후 `bucket` 을 export 하거나 외부 입력을 받게 확장할 경우에만 화이트리스트 검증을 추가할 것.

- **[INFO]** YAML frontmatter 파싱(`gray-matter`/`js-yaml`) 은 신뢰 경계 밖 입력을 받지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:113-114` (`findNonTerminalCompletedPlans`), `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:92-93`
  - 상세: `matter(fs.readFileSync(...))` 로 YAML 을 파싱한다. YAML 파서 일반론상 `!!js/function` 등 임의 태그를 통한 코드 실행/DoS 이슈가 알려진 라이브러리 계열이 있으나(예: 구버전 `js-yaml` 의 `load` vs `safeLoad`), `gray-matter` 는 내부적으로 `js-yaml` 의 안전한 스키마를 기본 사용하고, 무엇보다 입력이 리포지토리에 커밋된 자체 `plan/**.md` 파일이라 신뢰 경계 밖 데이터가 아니다. 파싱 실패는 모두 `try/catch` 로 흡수되어 크래시·정보노출도 없음(`plan-scan.ts:113-117`).
  - 제안: 조치 불요. 의존성 보안은 별도 `package.json`/lockfile 변경 시점에 점검.

- **[INFO]** ReDoS 관점에서 신규/변경 정규식은 모두 선형(비-재귀) 패턴
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:47-48` (`WORKTREE_PLACEHOLDER`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:78-79`,`:100`,`:317` (`LINK_RE`, `FENCE_RE`, 타이틀 스트립 정규식, `SPEC_MD_TARGET_RE`)
  - 상세: 중첩 정량자(`(a+)+` 류)나 겹치는 문자클래스 반복이 없다. `[^\]]*`, `[^)]+`, `.+` 등은 모두 단일 레벨 반복이라 입력 길이에 선형으로 스캔된다. 입력도 리포지토리 markdown 파일(신뢰된 소스)로 제한되어 공격자가 악의적 입력 길이를 임의로 늘릴 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** 에러 처리에서 민감정보 노출 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:889-894` (`decodeAnchor`), `plan-scan.ts:113-117`
  - 상세: 모든 예외는 조용히 흡수(`catch { return ... }` / `catch { continue }`)되거나, 테스트 실패 메시지로만 노출되며 이는 CI 로그에 리포지토리 상대경로·frontmatter 값만 포함한다. 시크릿, 스택트레이스, 시스템 경로 등의 노출이 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 리포지토리 `plan/` 라이프사이클 정합성을 검증하는 순수 read-only 정적 스캐너(테스트 유틸)의 리팩터링으로, 애플리케이션 런타임·인증/인가·네트워크 경계·시크릿 관리와 무관하다. 경로 처리(`path.join`)는 하드코딩된 인자만 받고, YAML/markdown 파싱 대상은 신뢰된 자체 저장소 파일이며, 정규식은 전부 선형 시간이다. 인젝션·시크릿 노출·인증 우회·안전하지 않은 암호화·민감정보 노출 등 OWASP Top 10 관련 실질적 취약점은 발견되지 않았다.

## 위험도

NONE
