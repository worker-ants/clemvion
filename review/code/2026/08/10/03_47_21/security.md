# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (신설/추출 — plan 트리 스캔 + 라이프사이클 불변식)
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (신설 — negative-path fixture 테스트)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (기존 — `plan-scan.ts` 로부터 `collectLivePlanMarkdown` re-export 하도록 리팩터)
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (Gate C — 기존)
- `.claude/docs/plan-lifecycle.md` (문서)

이 변경은 전부 **레포지토리 자체(`plan/`, `spec/`)를 대상으로 하는 빌드-타임 docs/lifecycle 가드**(vitest 로 실행되는 정적 검사)이며, 네트워크 요청을 받는 런타임 서버·API·인증 경로가 아니다. 입력은 로컬 파일시스템의 마크다운 frontmatter 이고, 외부 사용자 입력이나 원격 데이터를 직접 처리하지 않는다.

## 발견사항

- **[INFO]** 정규식을 문자열 보간으로 구성 — 현재는 안전하지만 방어적 이스케이프 부재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:217` (`rawScalar` 함수 내부 `new RegExp(...)` 호출)
  - 상세: `rawScalar(block: string, key: string)` 이 `key` 를 이스케이프 없이 `new RegExp(`^[ \\t]*${key}:[ \\t]*(.*)$`, "m")` 형태로 문자열 보간한다. 현재 호출부는 `rawScalar(block, "started")` 단 한 곳뿐이라 `key` 가 정적 리터럴이며 실질적인 익스플로잇 경로는 없다(regex-injection/ReDoS 실공격면 없음). 다만 이 헬퍼가 향후 동적/외부 유래 `key` 로 재사용되면 정규식 특수문자(`.`, `*`, `(` 등)가 이스케이프되지 않아 의도치 않은 매칭이나 정규식 injection 으로 이어질 수 있다.
  - 제안: 당장 수정 불요(공격 표면 없음). 향후 `key` 를 동적으로 넘기는 호출이 추가될 경우 `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 같은 이스케이프를 추가하는 것을 코드 리뷰 체크리스트에 남겨두면 좋다.

- **[INFO]** frontmatter YAML 파싱은 `gray-matter`/`js-yaml` 의 기본(안전) 스키마에 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:139,249`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:97,118`
  - 상세: `matter(fs.readFileSync(...), {})` 로 YAML frontmatter 를 파싱한다. `js-yaml` 최신 버전의 기본 로더는 `DEFAULT_SCHEMA`(안전 스키마, `!!js/function` 등 임의 코드 실행 태그 비활성)를 쓰므로 임의 코드 실행 위험은 없다. 파싱 대상은 저장소 자체의 `plan/**.md` 이며, 외부에서 업로드되는 신뢰되지 않은 콘텐츠가 아니다(PR 리뷰를 거친 저장소 콘텐츠). 실질적 위협은 없으나, `gray-matter`/`js-yaml` 의존성 버전이 안전 스키마를 기본으로 유지하는지는 향후 의존성 업그레이드 시 확인 대상이다.
  - 제안: 별도 조치 불요. 의존성 업그레이드(`package.json`) 시 `js-yaml` major 변경 여부만 인지하면 충분.

- **[INFO]** 에러 스왈로잉(try/catch 무시)이 다수 존재하나 정보 노출 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:129-142`(`findNonTerminalCompletedPlans` catch 블록), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:92-100`
  - 상세: frontmatter 파싱 실패 시 `catch { continue; }` / `catch { return false; }` 로 조용히 스킵한다. 이는 빌드-타임 테스트 가드이고 예외 메시지가 최종 사용자에게 노출되는 경로가 없어(스택 트레이스가 vitest 콘솔에만 출력) 정보 노출 위험은 없다. 의도적으로 문서화된 설계(다른 가드의 소관)이다.
  - 제안: 조치 불요.

- **[INFO]** 경로 조합에 `path.resolve` 사용, 하지만 경로 탐색(path traversal) 실공격면 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:226-227` (`findBrokenLinksInFiles` 내부 `path.resolve(path.dirname(f.absPath), pathPart)`)
  - 상세: 마크다운 링크의 상대 경로(`pathPart`)를 소스 파일 디렉터리 기준으로 `path.resolve` 한 뒤 `fs.existsSync` 로 존재만 확인한다. `../` 를 포함한 임의 상대 경로가 리포지토리 루트 밖으로 나가더라도, 결과는 "DEAD 링크로 보고"뿐이며 파일 내용을 읽거나 외부에 노출하지 않는다. 입력(마크다운 파일)도 저장소 자체 콘텐츠다. 전형적 경로 탐색 취약점의 전제(신뢰 경계를 넘는 사용자 입력 + 민감 파일 읽기/쓰기)가 없다.
  - 제안: 조치 불요.

## 요약

리뷰 대상은 전부 `plan/`·`spec/` 마크다운 트리를 대상으로 하는 **빌드-타임/테스트-타임 docs-lifecycle 정적 가드**(vitest 로 실행)이며, 네트워크 엔드포인트·인증/인가 로직·사용자 입력 처리 경로·DB 접근·시크릿 취급이 전혀 없다. 하드코딩된 시크릿, 인젝션(SQL/XSS/커맨드/경로탐색), 인증/인가 우회, 안전하지 않은 암호화 사용은 발견되지 않았다. YAML frontmatter 파싱(`gray-matter`)은 신뢰된 저장소 콘텐츠에 대해 안전 스키마 기본값으로 동작하며, 정규식(`WORKTREE_PLACEHOLDER`, `ISO_DATE`, `LINK_RE`, `SPEC_MD_TARGET_RE` 등)은 중첩 정량자가 없어 ReDoS 실공격면도 없다. `rawScalar` 의 문자열 보간 정규식 구성은 현재 정적 리터럴로만 호출돼 위험하지 않으나 향후 동적 키로 재사용될 경우를 대비한 이스케이프 부재를 INFO 로 남긴다. 전반적으로 보안 관점에서 실질적 우려사항은 없다.

## 위험도

NONE
