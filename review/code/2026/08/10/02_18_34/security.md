# 보안(Security) 리뷰 — plan-frontmatter.test.ts

## 발견사항

없음.

본 변경은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 단일
테스트 파일로, vitest 로 실행되는 **저장소 내부 plan 문서(`plan/**/*.md`) 정합성
검증 가드**다. 네트워크 입력, 사용자 인증/세션, DB 쿼리, 외부 요청, 시크릿 등 공격
표면이 되는 요소가 전혀 없다.

- **인젝션**: `matter(raw)` (gray-matter → js-yaml v4 `DEFAULT_SCHEMA`)로 frontmatter 를
  파싱하지만, `raw` 는 리포지토리에 커밋된 `plan/in-progress/*.md`·`plan/complete/*.md`
  로컬 파일만 대상이다. 외부 네트워크 입력이 아니며, js-yaml v4 기본 스키마는
  `!!js/function` 등 코드 실행 태그를 지원하지 않아 임의 코드 실행 가젯이 없다.
  파일 경로도 `repoRoot()` → `path.join`/`path.relative` 로만 조합되고 외부 입력을
  받지 않아 경로 탐색 여지가 없다.
- **하드코딩된 시크릿**: 없음.
- **인증/인가**: 해당 없음 (테스트 코드, 런타임 인가 로직 없음).
- **입력 검증**: 정규식(`ISO_DATE`, `WORKTREE_PLACEHOLDER`)은 중첩 정량자가 없는
  단순 패턴으로 ReDoS 위험 없음.
- **암호화/평문 전송**: 해당 없음.
- **에러 처리**: `try { matter(raw) } catch { parseOk = false }` 로 파싱 실패를
  잡아 테스트 실패 메시지(`${rel}: frontmatter failed to parse`)로만 노출한다.
  스택트레이스나 시스템 경로 등 민감 정보 노출 없음 — 테스트 러너 출력이라 배포
  환경에 노출되지도 않는다.
- **의존성 보안**: `gray-matter`/`js-yaml` 은 기존 의존성이며 이번 diff 로 신규
  도입되거나 버전이 바뀌지 않았다. 이론적으로 CI 가 외부 포크 PR 을 자동 실행하며
  해당 PR 이 `plan/*.md` 를 포함한다면 조작된 YAML frontmatter 가 파싱 대상이 될 수
  있으나, js-yaml v4 기본 스키마 사용으로 실질 익스플로잇 가젯은 없다 (참고용 INFO,
  이번 diff 로 인한 신규 리스크 아님).

## 요약

리뷰 대상은 프로덕션 런타임 코드가 아닌 순수 개발/CI 시점 테스트 가드로, 로컬
리포지토리 plan 문서의 lifecycle frontmatter(worktree/started/owner)와 상대링크
무결성을 검증한다. 사용자 입력·인증·네트워크·시크릿·DB 등 전형적인 공격 표면이
전혀 존재하지 않으며, YAML 파싱도 안전한 기본 스키마로 신뢰된 로컬 파일만 대상으로
하므로 보안 관점에서 이슈가 없다.

## 위험도

NONE
