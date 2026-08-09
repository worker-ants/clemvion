# 보안(Security) 리뷰 — plan-scan.ts / plan-scan.test.ts

## 리뷰 범위
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` — plan 트리 스캔 + 라이프사이클 불변식 검사용 순수 함수 (테스트/CI 전용 dev-tooling)
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` — 위 함수의 negative-path fixture 테스트

두 파일 모두 애플리케이션 런타임 코드가 아니라 vitest 로 구동되는 **CI/개발 도구**다. 네트워크 입력, 사용자 인증/세션, DB 접근, 외부 API 호출이 전혀 없고, `root` 인자는 저장소 로컬 경로(테스트에서는 `mkdtempSync` 임시 디렉터리, 실사용은 `plan-frontmatter.test.ts`/`spec-links.ts` 가 저장소 루트를 전달)로만 호출된다. 공격자가 통제하는 입력이 도달하는 경로가 없다.

## 발견사항

- **[INFO]** frontmatter 파싱 실패를 조용히 삼킴(silent catch)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:116-120` (`findNonTerminalCompletedPlans` 의 `try { ... } catch { continue; }`)
  - 상세: YAML frontmatter 파싱 예외를 로그 없이 무시하고 다음 파일로 넘어간다. 의도적으로 문서화된 설계(라인 110 주석: "frontmatter 파싱 실패는 이 검사의 관심사가 아니라 건너뛴다")이며, 대응 테스트(`plan-scan.test.ts:106-113`, `broken.md`)로 회귀도 잠겨 있다. 보안 취약점은 아니지만, 만약 향후 이 스캐너가 신뢰 경계를 넘는 입력(예: 외부 기여자가 여는 PR 의 `plan/**.md`)에 대해 "실패 시 조용히 스킵"을 하는 다른 보안-critical 검사로 재사용된다면 우회(스킵을 유도해 위반 탐지를 피함) 벡터가 될 수 있다.
  - 제안: 현재 스코프(라이프사이클 문구 린트)에서는 조치 불필요. 재사용 시 파싱 실패를 별도로 카운트/로그하는 것을 권장.

- **[INFO]** YAML frontmatter 파서(gray-matter → js-yaml) 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:22` (`import matter from "gray-matter"`), 사용부 `:117`
  - 상세: `gray-matter@^4.0.3`(codebase/frontend/package.json 확인)는 내부적으로 안전한 YAML 로더(js-yaml safe schema)를 사용하며, 알려진 심각 취약점이 있는 구버전이 아니다. 입력 소스가 저장소 내 `plan/complete/**.md` 로 한정되고 CI 환경에서만 실행되므로, YAML 폭탄/프로토타입 오염류의 실질 공격 표면은 사실상 없다(외부 미신뢰 사용자가 임의 파일 내용을 이 경로에 주입할 방법이 없음).
  - 제안: 별도 조치 불필요. dependabot/향후 `gray-matter`·`js-yaml` 상향 시 통상적인 의존성 점검으로 충분.

- **[INFO]** 인젝션·시크릿·인증/인가·암호화 항목 해당 없음
  - 위치: 전체 파일
  - 상세: SQL/커맨드/LDAP 인젝션 표면 없음(파일시스템 순회는 `fs.readdirSync`/`path.join` 만 사용하고 셸 실행 없음). 하드코딩된 시크릿·API 키 없음. 인증/인가/세션 로직 없음(런타임 서비스가 아님). 해시/암호화 알고리즘 사용 없음. 사용자 대면 에러 메시지 노출 없음(테스트/CI 산출물).

## 요약

두 파일은 plan 라이프사이클 문서(`plan/complete/**.md`, `plan/in-progress/*.md`)의 `status` frontmatter 불변식을 검사하는 순수 dev/CI 도구와 그 negative-path 테스트로, 네트워크 노출·사용자 입력·인증·암호화·시크릿 취급이 전혀 없다. 유일하게 눈에 띄는 지점은 frontmatter 파싱 실패를 의도적으로 조용히 무시하는 부분과 YAML 파서(gray-matter/js-yaml) 의존인데, 둘 다 이 스코프에서는 신뢰 경계를 넘지 않아 실질 위험이 없다. 보안 관점에서 차단 사유 없음.

## 위험도
NONE
