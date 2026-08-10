# 보안(Security) 코드 리뷰

## 대상

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

이 파일들은 저장소 자체의 `plan/`·`spec/`·소스 트리를 스캔해 라이프사이클/링크 불변식을
검증하는 **로컬 vitest 가드**다. 네트워크로 노출되는 서비스 코드가 아니고, 입력은 항상
"이 저장소 자신의 로컬 파일 트리"(`repoRoot()` 로 결정된 절대경로) — 외부 사용자나
원격 클라이언트가 통제하는 값이 아니다. 이 전제 위에서 아래 항목을 점검했다.

## 발견사항

- **[INFO]** `rawScalar` 의 동적 `RegExp` 생성이 `key` 를 문자열 보간한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:154` (`function rawScalar` 내부 `new RegExp(...)`)
  - 상세: `new RegExp(\`^[ \\t]*${key}:[ \\t]*(.*)$\`, "m")` 형태로 `key` 를 정규식 문자열에 직접 삽입한다. 일반적으로 이 패턴은 "정규식 인젝션"(호출자가 `key` 에 정규식 메타문자를 넣어 매칭 범위를 조작) 위험 클래스에 속한다. 다만 이 코드베이스에서 `rawScalar` 는 `checkPlanFrontmatter` 내부에서 `rawScalar(block, "started")` 로 **한 곳에서만, 하드코딩된 리터럴 키로만** 호출되며, `key` 가 외부 입력(파일 내용·사용자 입력)에서 오지 않는다. 따라서 현재 코드에서는 악용 경로가 없다.
  - 제안: 실질 위험은 없으나, 향후 `rawScalar` 가 동적 키(예: frontmatter 필드 목록을 순회)로 확장될 경우를 대비해 `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 이스케이프하거나 키를 화이트리스트 상수로 제한하는 방어적 관례를 남겨두면 좋다. 지금 당장의 수정은 불필요.

- **[INFO]** YAML frontmatter 파싱에 `gray-matter`/`js-yaml` 사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:226`(`matter(raw, {})`), `:124`(`matter(fs.readFileSync(f.absPath, "utf8")).data`)
  - 상세: YAML 파서는 과거 버전(`js-yaml` <=3, 특히 `safeLoad` 미사용 시)에서 임의 타입 태그(`!!js/function` 등) 실행이나 prototype pollution 계열 이슈가 있었다. `gray-matter` 는 내부적으로 `js-yaml` 의 안전한 로더를 기본 사용하므로 최신 버전에서는 이 클래스의 문제가 발생하지 않는다. 이 diff 에는 `package.json` 버전 변경이 포함돼 있지 않아 실제 취약 버전 사용 여부는 별도 의존성 감사 대상이다.
  - 제안: 별도 의존성 스캔(`pnpm audit` 등)으로 `gray-matter`/`js-yaml` 버전을 확인하되, 이 PR 자체의 변경으로 인한 신규 노출은 없다. 입력 소스도 저장소 자신의 `plan/**.md` 로 신뢰 경계 밖 데이터가 아니다.

- **[INFO]** 파일시스템 경로 조합이 외부 입력을 받지 않음 (경로 탐색 비대상)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:58`(`walkPlanMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:226`(`path.resolve(path.dirname(f.absPath), pathPart)`), `:337`(`collectCodebaseSources`)
  - 상세: `path.resolve`/`path.join` 으로 조합되는 대상은 전부 (a) `repoRoot()` 로 고정된 로컬 저장소 루트, (b) 그 안의 마크다운 링크 텍스트(`pathPart`)다. 링크 텍스트는 저장소에 커밋된 문서 내용이지 원격 사용자가 실행 시점에 주입하는 값이 아니므로, 고전적인 경로 탐색(디렉터리 이스케이프로 임의 파일 접근) 시나리오와는 신뢰 모델이 다르다 — 이 스캐너는 "무엇이 깨진 링크인지" 를 보고할 뿐, 파일 내용을 반환하거나 실행하지 않는다.
  - 제안: 조치 불필요. 참고로 이 스캐너가 향후 CI 외부 트리거(예: PR 작성자가 제어하는 브랜치의 `spec/**`) 로 확장될 경우, `pathPart` 가 `../../../etc/passwd` 류로 저장소 루트 바깥을 가리킬 수 있는지(현재는 `fs.existsSync` 존재 확인만 하고 파일 내용을 노출하지 않으므로 영향 낮음)는 그 시점에 재검토할 것.

- **[INFO]** 에러 메시지 노출 범위
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:229`(`catch { add("unparseable", ...) }`), `:125`(`catch { continue; }`)
  - 상세: 파싱 실패 시 원본 예외 메시지(스택 트레이스 등)를 그대로 노출하지 않고 고정 문자열(`"frontmatter 파싱 실패"`)만 기록한다. 민감정보 노출 소지 없음. 테스트 실패 메시지(`plan-frontmatter.test.ts`)도 저장소 내부 상대경로만 담아 로컬 CI 로그 맥락에서 문제 없음.
  - 제안: 조치 불필요.

## 인젝션 / 시크릿 / 인증-인가 / 암호화

- SQL/커맨드/LDAP 인젝션: 해당 클래스의 호출부(`child_process`, DB 쿼리, LDAP 클라이언트) 없음.
- XSS: 렌더링 대상이 아닌 순수 Node 스캔 로직 — DOM/HTML 출력 경로 없음.
- 하드코딩된 시크릿: 없음. 자격증명·API 키·토큰 패턴 grep 결과 없음.
- 인증/인가: 해당 코드는 인증 경계가 없는 로컬 빌드/테스트 유틸리티 — 인가 로직 자체가 스코프 밖.
- 암호화: 암호화/해시 연산 없음(날짜 검증에 쓰이는 `Date` 파싱은 암호와 무관).
- 의존성: `gray-matter`, `mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger` — 신규 도입이 아니라 기존 사용 확장으로 보이며, 버전 고정 값은 이 diff 범위 밖(별도 `pnpm audit` 권장, 위 INFO 항목 참고).

## 요약

이 변경은 네트워크에 노출되지 않는 로컬 vitest 가드(문서 라이프사이클/링크 무결성 검증)이며, 처리하는 입력은 전부 저장소 자신의 신뢰된 로컬 파일 트리다. 인젝션·시크릿 하드코딩·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 등 OWASP Top 10 관점의 실질적 취약점은 발견되지 않았다. `rawScalar` 의 동적 `RegExp` 생성은 이론적으로 정규식 인젝션 클래스에 속하지만 호출부가 하드코딩 리터럴 키 1곳뿐이라 현재는 악용 불가능한 INFO 수준이다. 전반적으로 보안 위험은 사실상 없다.

## 위험도

NONE
