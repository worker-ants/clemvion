# 보안(Security) 리뷰 결과

## 리뷰 대상

- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (신규/변경, vitest 테스트 파일)

## 분석

이 파일은 저장소 내부의 `plan/in-progress/*.md`, `plan/complete/**` 마크다운 파일을 스캔하여 frontmatter(`worktree`/`started`/`owner`) 및 상대링크 무결성을 검증하는 **개발 시점 CI 가드 테스트**다. 외부 입력(HTTP 요청, 사용자 폼, DB row 등)을 다루지 않고, 실행 환경은 로컬/CI 빌드 파이프라인이며 프로덕션 런타임 코드가 아니다.

관점별 점검:

1. **인젝션**: `fs.readFileSync(abs, "utf8")` (line 80), `matter(raw)` (line 84) 는 `collectLivePlanMarkdown(root)`/`repoRoot()` 가 저장소 내부에서 열거한 경로만 사용한다(line 46-48, 51). 외부에서 주입 가능한 경로 조작 지점이 없어 경로 탐색(path traversal) 위험 없음. 정규식(`ISO_DATE`, `WORKTREE_PLACEHOLDER`, line 37-39)은 중첩 정량자가 없는 선형 패턴이라 ReDoS 위험 없음.
2. **하드코딩된 시크릿**: 없음. 문자열 리터럴은 전부 테스트 메시지/sentinel(`"(unstarted)"`) 뿐이다.
3. **인증/인가**: 해당 없음 (인증/인가 로직을 다루는 코드가 아님).
4. **입력 검증**: `matter(raw)` 파싱 실패를 `try/catch` 로 흡수해 `parseOk` 플래그로 처리(line 83-87) — 안전하게 실패 처리됨. 외부 신뢰 경계를 넘는 사용자 입력이 없으므로 별도 새니타이징 불필요.
5. **OWASP Top 10**: 해당 카테고리(SQLi, XSS, SSRF, 역직렬화 등)에 해당하는 서버/클라이언트 런타임 코드가 아니므로 적용 대상 없음.
6. **암호화**: 해당 없음.
7. **에러 처리**: `expect(...)` 실패 메시지에 파일 상대경로·frontmatter 값·링크 목록을 포함(line 90-144 등)하지만, 이는 저장소 내부 plan 문서의 공개적인 메타데이터이며 테스트 실행자(CI 로그)에게만 노출된다. 민감정보(비밀번호·토큰 등) 노출 경로 없음.
8. **의존성 보안**: `gray-matter`(frontmatter 파서)는 기존에 이미 사용 중인 패키지의 재사용이며 이번 변경에서 새로 도입되지 않음. 별도 신규 의존성 추가 없음.

## 발견사항

없음 — 보안 관점에서 지적할 사항이 발견되지 않았다.

## 요약

이번 변경은 순수 개발/CI 시점의 테스트 코드로, plan 문서의 frontmatter 및 링크 무결성을 검증하는 가드다. 외부 신뢰 경계를 넘는 입력 처리, 인증/인가 로직, 시크릿, 암호화, 네트워크 통신이 전혀 없으며 파일 경로는 모두 저장소 내부 스캔 결과로 고정되어 인젝션/경로 탐색 표면도 없다. 보안 관점에서 우려되는 지점이 없다.

## 위험도

NONE
