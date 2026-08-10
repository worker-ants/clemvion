# 보안(Security) 리뷰

## 범위 요약

리뷰 대상 26개 파일 중 25개는 `.md` (`.claude/docs/plan-lifecycle.md` 규약 문서 1건 + `plan/complete/**`·`plan/in-progress/**` plan 문서 24건, 대부분 `status: in-progress` → `status: complete` frontmatter 갱신)이고, 실제 코드 변경은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 1건뿐이다. 이 테스트 파일도 런타임 애플리케이션 코드가 아니라 **빌드 타임 문서 가드**(vitest, CI 전용)로, 리포지토리 내부의 마크다운 문서(`plan/**`)만 읽어 frontmatter·상대링크를 검증한다. 사용자 입력·네트워크 요청·인증/인가·DB 쿼리·암호화·외부 API 호출을 다루는 코드는 이번 변경분에 전혀 없다.

## 발견사항

- **[INFO]** 신규 정규식 `relativeLinkTargets` 의 ReDoS 가능성 점검 — 안전
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:91` (`const re = /\[[^\]]*\]\(([^)#]+?)(?:#[^)]*)?\)/g;`)
  - 상세: 부정 문자클래스(`[^\]]`, `[^)#]`, `[^)]`)만 사용하고 중첩 정량자·모호한 교차 매칭 구간이 없어 입력 길이에 대해 선형이다. 또한 입력이 리포지토리 내부의 신뢰된 마크다운 문서(`plan/**`)로 제한되고 CI 빌드 타임에만 실행되므로 외부 공격자가 통제 가능한 입력 경로가 아니다.
  - 제안: 조치 불요 (정보성 확인).

- **[INFO]** `path.resolve(path.dirname(abs), target)` 기반 파일 존재 확인 — 경로 탐색 위험 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:187` (`top-level in-progress plans have no broken relative links` 테스트)
  - 상세: 마크다운 링크 타깃을 `path.resolve` 로 해석해 `fs.existsSync` 로 존재만 확인한다. `../../../etc/passwd` 같은 타깃이 있어도 파일 존재 여부만 boolean 으로 리포트할 뿐 파일 내용을 읽거나 서빙하지 않으며, 입력 소스가 저장소 내부 문서(신뢰 경계 안)이고 CI 전용 테스트라 경로 탐색 취약점으로 이어지지 않는다.
  - 제안: 조치 불요.

- **[INFO]** frontmatter 파싱 실패 시 조용히 스킵 — 의도된 fail-open이나 검토 대상
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (`no completed plan still declares 'status: in-progress'` 테스트, `try { matter(...) } catch { continue; }`)
  - 상세: `gray-matter` 파싱 실패 시 해당 plan 문서를 검사 대상에서 제외한다. 주석에 "frontmatter 파싱 실패는 이 검사의 관심사가 아니다"로 의도가 명시되어 있고, 이 가드는 보안 게이트가 아니라 문서 라이프사이클 위생 가드이므로 fail-open 이어도 보안 영향은 없다.
  - 제안: 조치 불요 (문서 위생 목적에 부합).

- **[INFO]** `TERMINAL_STATUSES` 화이트리스트 방식 — 안전한 설계
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:86` (`const TERMINAL_STATUSES = new Set([...])`)
  - 상세: 종료 상태를 화이트리스트로 고정하고 새 값 도입 시 명시적 등재를 요구하는 fail-closed 설계다. 임의 문자열이 조용히 "통과" 처리되지 않는다.
  - 제안: 조치 불요.

`plan/complete/**` 문서 내용(과거 pnpm audit override 대응·secret-store LIKE 가드 각주 정정·SSRF 에러 메시지 일반화 등)은 모두 **과거에 이미 검토·머지된 보안 조치의 기록**이며, 이번 diff 는 그 문서들의 `status:` frontmatter 필드 한 줄만 갱신한다. 문서 본문에 하드코딩된 시크릿, 평문 자격증명, 새로운 취약 의존성 선언 등은 없음을 확인했다(전체 프롬프트에 대해 비밀번호/API 키/토큰/PEM 헤더 패턴 grep — 0건).

## 요약

이번 변경은 plan 문서 라이프사이클 관리(완료 표시 + frontmatter 정합성/상대링크 무결성을 검증하는 신규 빌드 가드 테스트) 범위로, 애플리케이션 런타임 코드·API·인증/인가·DB·암호화 로직을 전혀 건드리지 않는다. 신규 테스트 파일의 정규식·경로 처리도 CI 전용·신뢰 경계 내부 입력만 다뤄 인젝션·ReDoS·경로 탐색 등 실질적 위험이 없다. 하드코딩된 시크릿이나 민감정보 노출도 발견되지 않았다.

## 위험도

NONE
