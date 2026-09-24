# 보안(Security) 리뷰

## 관측된 워킹트리 이상 상태 (내가 만든 변경 아님)

리뷰 도중 `git status --short` 로 확인한 결과, 이 세션이 어떤 파일도 Write/Edit 하지 않았음에도
`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 가 워킹트리에서
**수정된 상태(unstaged)** 로 나타났다:

```diff
 export function isPendingPlanPath(relPath: unknown): boolean {
-  // YAML parses `- 42` or `- true` as non-strings. ...
-  if (typeof relPath !== "string") return false;
-  const norm = path.posix.normalize(relPath);
-  if (!norm.endsWith(".md")) return false;
-  return PENDING_PLAN_DIRS.some((dir) => norm.startsWith(dir));
+  return true;
 }
```

이 형태는 `plan/in-progress/pending-plan-is-plan.md` §D 판별 뮤테이션 표의 **"M5 술어가 항상
true"** 뮤턴트와 정확히 일치한다 — 즉 이 diff 를 작성한 developer 또는 동시에 도는 다른
reviewer 가 병렬 fan-out 중에 판별 뮤테이션을 실행하던 잔여물로 보인다. **내가 만든 변경이
아니며, 다른 세션의 미완료 작업일 수 있어 `git checkout`/`git restore`/직접 수정으로 되돌리지
않았다** (되돌리면 그 세션의 진행 중 상태를 파괴할 위험이 있다는 공지에 따름). 아래 발견사항은
모두 `Read` 도구로 확인한 **원래(정상) 소스**를 근거로 작성했다 — `isPendingPlanPath` 가
`return true` 로 훼손된 현재 워킹트리 상태를 근거로 판단하지 않았다. 다음 사람은 이 잔여물을
새 결함으로 오인하지 말고, 해당 세션이 원복을 마쳤는지 `git status --short` 로 재확인할 것.

## 발견사항

- **[INFO]** `isPendingPlanPath` 의 정규화는 POSIX 구분자(`/`) 기준이라 백슬래시 세그먼트는 `..` 로 인식되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:102` (`path.posix.normalize(relPath)`, 정상 소스 기준 줄 번호)
  - 상세: `path.posix.normalize`는 `/`로 분리된 세그먼트만 `..`/`.` 축약을 수행한다. 예를 들어
    `"plan/in-progress/..\\..\\secret.md"` 를 넣으면 `..\\..\\secret.md` 전체가 하나의 리터럴
    세그먼트로 취급되어 `..` 로 인식되지 않고, `norm.startsWith("plan/in-progress/")` 와
    `norm.endsWith(".md")` 를 둘 다 통과해 `isPendingPlanPath` 가 `true` 를 반환한다. 다만 실제
    악용 경로는 거의 없다 — (1) 이 값의 신뢰 경계는 실행 시점의 사용자 입력이 아니라 PR 리뷰를
    거쳐 저장소에 병합된 spec frontmatter 텍스트다, (2) 이 술어의 유일한 소비처인
    `spec-pending-plan-existence.test.ts`(빌드/CI 시점 vitest 가드, 런타임 서버 경로 아님)는
    이 값을 다시 `fs.existsSync(path.join(root, planRel))` 에 넘기는데, POSIX 파일시스템에서는
    백슬래시가 경로 구분자가 아니라 파일명의 리터럴 문자이므로 실제로 해당 이름의 파일이
    존재할 가능성은 사실상 없다 — 따라서 「plan 인가」 검사만 (거짓으로) 통과하고 바로 다음의
    「실존하는가」 단언이 대부분의 경우 실패해 가드 자체는 여전히 RED 를 낸다. Windows CI 에서
    돈다면 얘기가 달라지지만 이 저장소의 CI 는 그런 환경이 아니다.
  - 제안: 필수 조치는 아니다. 다음에 이 함수를 만질 기회가 있으면 `relPath.includes("\\")`
    를 거부하거나 `path.win32`/`path.posix` 어느 쪽으로도 해석되는 세그먼트를 방어적으로
    막아 두면 이 이론적 틈까지 닫힌다.

- **[INFO]** (선행 리뷰 재확인) 신뢰 경계·검증 표면 관점에서 이번 변경은 오히려 개선
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-105`,
    `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:51-58`
  - 상세: `isPendingPlanPath`/`PENDING_PLAN_DIRS` 를 코드베이스 전체에서 `grep` 한 결과
    `__tests__/` 밖에서 쓰이는 곳이 없다 — HTTP 엔드포인트·컨트롤러·런타임 요청 경로와
    무관한 순수 빌드타임 문서 가드다. `pending_plans:` 값의 출처는 PR 리뷰를 거쳐 병합된
    spec 파일이지 익명 사용자 입력이 아니며, 이번 변경은 검증 표면을 "디스크의 아무 파일"에서
    `plan/in-progress/**.md`·`plan/complete/**.md` 로 명시적으로 좁혔다(닫힌 allow-list,
    fail-closed). 이전 라운드(`review/code/2026/09/24/19_57_00/security.md`)의 판정과 일치한다.
  - 제안: 조치 불요.

하드코딩된 시크릿, SQL/커맨드/LDAP 인젝션, XSS, 인증/인가 우회, 안전하지 않은 암호화, 민감정보
노출 에러 처리, 알려진 취약 의존성 도입은 발견되지 않았다. `CHANGELOG.md`·`plan/**.md`·
`review/**` 산출물은 순수 문서이며 검토 결과 시크릿·자격증명·내부 인프라 세부사항의 노출은 없다.

## 요약

이번 변경은 spec frontmatter `pending_plans:` 항목이 실제 work plan 경로(`plan/in-progress/**.md`
또는 `plan/complete/**.md`)를 가리키는지 검증하는 순수 함수 `isPendingPlanPath` 와 그 테스트,
그리고 관련 plan/리뷰 문서로 구성된다. 런타임 요청 경로·HTTP 표면·DB·인증 로직과 무관한 빌드타임
문서 가드이며, 신뢰 경계(PR 리뷰를 거친 저장소 콘텐츠)와 소비처(오직 CI 테스트)를 함께 고려하면
실질적 공격 표면이 없다. `path.posix.normalize` 가 백슬래시 세그먼트까지는 `..` 로 인식하지 못하는
이론적 틈이 있으나, 신뢰 경계와 후속 `fs.existsSync` 호출의 플랫폼 특성상 실제로 악용 가능한
경로 탈출로 이어지지 않는다. 전반적으로 기존 `#1386` 사고(존재 검사가 임의 파일을 통과시킴)를
닫는 방향의 보안 개선으로 평가한다. 리뷰 도중 이 세션이 만들지 않은 워킹트리 뮤테이션(위 섹션)을
관측했으며, 이를 근거로 판단을 내리지 않았음을 명시한다.

## 위험도

NONE
