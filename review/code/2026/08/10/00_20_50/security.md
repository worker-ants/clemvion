# Security Review

## 리뷰 대상

- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`

세 파일 모두 저장소 자체(`plan/`, `spec/`, `codebase/`)의 markdown/frontmatter 정합성을 검사하는 **개발 시점 테스트/린트 도구**다. 외부 네트워크 요청을 받지 않고, 인증/세션/DB/암호화를 다루지 않으며, 입력은 전부 같은 git 저장소에 커밋된(팀이 작성한) 파일이다. 즉 전형적인 웹앱 공격 표면(신뢰 경계를 넘는 사용자 입력)이 존재하지 않는다.

### 발견사항

- **[INFO]** 상대경로 링크 해석이 저장소 루트 밖으로 나갈 수 있음 (path traversal, 낮은 실효 위험)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:224` (`const resolved = path.resolve(path.dirname(f.absPath), pathPart);`), 및 `:225`(`fs.existsSync(resolved)`), `:236`(`slugsFor(resolved)` → `headingSlugs` 내부 `fs.readFileSync`, `:52`)
  - 상세: `extractLinks` 로 추출한 markdown 링크의 `pathPart` 에 대한 이스케이프/정규화 검증 없이 `path.resolve` 로 절대경로를 만들고, 그 경로가 `.md` 로 끝나면 `fs.readFileSync` 까지 수행한다. `../../../../etc/hosts.md` 류의 target 이 있으면 저장소 루트 밖 파일도 이론적으로 열람 대상이 된다.
  - 다만 이 스캐너가 순회하는 파일 집합(`collectSpecMarkdown`/`collectLivePlanMarkdown`/`collectCodebaseSources`)은 전부 같은 저장소 내부에 커밋된 파일이며, 링크 target 도 같은 커밋 작성자가 적은 문자열이다. 즉 신뢰 경계를 넘는 공격자 제어 입력이 아니라 "이미 코드를 커밋할 수 있는 사람"이 만드는 값이라 실질 위협 모델이 성립하지 않는다(같은 권한으로 임의 코드를 이미 커밋할 수 있음).
  - 제안: 실질적 위험은 없으나, 방어적 코딩 관점에서 원한다면 `resolved` 가 `root` 하위인지 `path.relative(root, resolved).startsWith("..")` 로 확인하는 가드를 추가할 수 있다. 필수는 아님.

- **[INFO]** frontmatter YAML 파싱(`gray-matter`/내부 `js-yaml`)에 대한 의존성 인지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:116`, `:201` (`matter(raw).data`)
  - 상세: `gray-matter` 는 내부적으로 `js-yaml` 로 frontmatter 를 파싱한다. 과거 `js-yaml`의 unsafe load(`!!js/function` 등 임의 타입 태그)로 인한 코드 실행 이슈가 알려져 있었으나, `js-yaml` 4.x 이후로는 기본 `load()` 가 안전한 스키마만 사용하도록 바뀌었다. 이 코드가 파싱하는 대상은 저장소 내부 `plan/**/*.md` 로, 외부 공격자가 아닌 팀 구성원이 작성한 신뢰된 콘텐츠다.
  - 제안: `package.json` 의 `gray-matter`/`js-yaml` 버전이 최신(≥4)인지 정기 의존성 점검 시 확인 권장. 이번 diff 범위에서 조치 불필요.

- **[INFO]** try/catch 로 파싱 실패를 조용히 흡수 (정보 노출 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:114-119`(frontmatter parse), `:199-204`(completed-plan parse)
  - 상세: `catch { parseOk = false; }` / `catch { continue; }` 로 예외를 삼키고 원인 메시지를 노출하지 않는다. 테스트 실패 메시지에는 파일 경로·필드값만 포함되며 스택트레이스·시스템 경로·비밀값이 섞이지 않는다. 민감정보 노출 없음, 문제 없음.

인젝션(SQL/XSS/커맨드/LDAP), 하드코딩된 시크릿, 인증/인가 로직, 안전하지 않은 암호화, 평문 전송, `child_process`/`eval`/동적 코드 실행은 세 파일 어디에도 없다. 정규식(`LINK_RE`, `FENCE_RE`, `SPEC_MD_TARGET_RE`, `WORKTREE_PLACEHOLDER`, `ISO_DATE`)은 전부 부정 문자 클래스(`[^\]]*`, `[^)]+`, `[^`]*` 등) 또는 단순 앵커드 패턴으로, 중첩 정량자·모호한 교차가 없어 ReDoS 형태가 아니다.

### 요약

세 파일은 저장소 내부의 plan/spec markdown 정합성을 검증하는 CI/테스트 전용 도구로, 외부 사용자 입력이나 네트워크 경계를 다루지 않는다. 발견된 사항은 모두 INFO 수준이며 실질적 공격 표면이 되지 않는 신뢰된 저장소 콘텐츠에 국한된다. 하드코딩 시크릿, 인젝션, 인증/인가 결함, 안전하지 않은 암호화는 발견되지 않았다.

### 위험도

NONE
