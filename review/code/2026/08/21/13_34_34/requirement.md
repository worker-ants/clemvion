# 요구사항(Requirement) 리뷰 — masked-marker-contract-7d2e14

## 검토 방법

프롬프트가 나열한 36개 diff 파일(코드 22 + 이전 리뷰 라운드 산출물 14) 중 실질 코드/spec/plan
변경분을 직접 `Read`/`Grep`으로 현재 worktree 소스에서 재확인했다. 이 PR 은 이미 5라운드
(`11_27_29`→`13_14_29`)의 `/ai-review`→`RESOLUTION` 사이클을 거쳤고(CRITICAL 0 유지, WARNING
3→3→1→3→3, 위험도 MEDIUM→MEDIUM→MEDIUM→MEDIUM→**LOW**), 각 라운드가 지적한 결함이 실제로
현재 HEAD(`10fcc43e2`)의 소스에 반영돼 있는지를 재현이 아니라 **직접 열어서** 확인하는 방식으로
검토했다(과거 세션 교훈 — 리뷰 문서 서술만 믿지 않는다).

## 발견사항

- **[INFO] 확인 — backend/frontend 미러-소멸 가드가 실제로 대칭이다 (라운드4·5 W2/W3 반영 확인)**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:149`
    (`if (relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)) continue;`) vs
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:144,151`
    (`const sotPrefix = SOT_DIR.split(path.sep).join("/");` 를 루프 밖에서 한 번만 계산 후 사용)
  - 상세: 라운드5 RESOLUTION 이 주장한 "backend 쌍둥이는 `SOT_DIR` 이 모듈 레벨 리터럴이라 이
    섀도잉/재계산 문제가 애초에 없었다"는 서술을 실제 소스로 대조했다. backend `SOT_DIR =
    'codebase/packages/masked-markers'`(리터럴, 이미 `/` 구분자)이므로 `startsWith(SOT_DIR)`
    를 직접 써도 정확하고, frontend 는 `path.join()` 산물이라 `sotPrefix` 정규화가 루프 밖으로
    올라가 있다 — 두 파일 모두 `SOT_SYMBOLS`(패키지 export 파생)·`resolveScanDirs`(2단계 실측
    파생)·`findRedeclaredSymbols`(AST 기반, 선언만 카운트)·`findMirrorRedeclarations` 로직이
    구조적으로 동일함을 라인 단위로 대조 확인했다. 서술과 구현이 일치한다.
  - 제안: 없음(확인용 기록).

- **[INFO] 확인 — spec R17 SoT 서술과 frontmatter `code:` 목록이 실제 이관과 일치한다**
  - 위치: `spec/5-system/14-external-interaction-api.md:1625-1631`(본문 "마커 집합과 깊이 상한의
    SoT 는 공유 패키지 `@workflow/masked-markers` 다") 및 `:16`(frontmatter `code:` 목록에
    `codebase/packages/masked-markers/src/index.ts` 포함)
  - 상세: `plan/in-progress/masked-marker-shared-package.md`의 "spec R17 정정" 작업 항목이
    `[x]`로 표시돼 있고, 실제 spec 본문을 열어 대조한 결과 backend가 SoT라는 낡은 서술 없이
    패키지가 SoT임을 정확히 반영하고 있다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    의 트래커 두 항목(`:373`, `:757`)도 `[x]` + 대체 근거로 닫혀 있어 plan 서술과 실제 spec
    상태가 어긋나지 않는다.
  - 제안: 없음(확인용 기록).

- **[INFO] 확인 — 마커 값·함수 시그니처가 이관 전후 완전히 동일하다(순수 리팩터 목표 달성)**
  - 위치: `codebase/packages/masked-markers/src/index.ts:27-59`
    (`VALUE_MASK_MARKER='***'` · `KEY_MASK_MARKER='[REDACTED]'` · `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`
    · `MAX_MASK_DEPTH=10` · `isMaskedMarker(v: unknown): boolean`)
  - 상세: backend `sanitize-error-message.ts`(`deepRedactCore`의 `depth >= MAX_REDACT_DEPTH`
    비교, `CREDENTIAL_KEY_PATTERN` 매칭 값에 `isMaskedMarker` 가드)와 frontend
    `masked-markers.ts`(`hasMaskedMarkerLeaf`/`scanForMarker`)를 직접 읽은 결과, 재export 로
    전환된 지점 외 마스킹/스캔 로직 자체는 변경이 없다. 기존 소비처
    (`reject-masked-resubmission.ts`가 backend 파일에서 `MAX_REDACT_DEPTH`·`isMaskedMarker`를
    그대로 import)도 재컴파일 외 영향이 없음을 확인했다. `hasMaskedMarkerLeaf`의 깊이 경계는
    frontend 테스트(`masked-markers.test.ts:92,96` — `nest(10)→true`/`nest(11)→false`)가 여전히
    정확한 값(10)으로 행동을 고정하고 있어, 패키지 자체 spec(`index.spec.ts`)이 `MAX_MASK_DEPTH`
    값을 직접 pin 하지 않는 것(타입·부호만 검사)이 실질적 커버리지 공백은 아니다.
  - 제안: 없음(확인용 기록). 다만 backend 쪽에는 이 깊이 경계를 정확한 값으로 고정하는 동등한
    테스트가 없다는 점은 plan 문서 "후속(이 PR 밖)"에 이미 등재돼 의도적으로 이월된 상태다
    (`plan/in-progress/masked-marker-shared-package.md` 하단) — 새로운 결함이 아니다.

- **[INFO] 확인 — CI 등록 표면 8곳 전부 실측과 일치, `channel-web-chat`도 파생 스캔으로 커버됨**
  - 위치: `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,82-85`,
    `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`,
    `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`,
    `codebase/frontend/package.json:40`
  - 상세: 6개 패키지 매트릭스·"6개를 전부 등록" 주석·pathspec이 모두 정확히 6행으로 일치한다
    (직접 카운트 확인). `resolveScanDirs()`가 `codebase/<stack>/src`를 실측 파생하므로
    `codebase/channel-web-chat/src`(실존 확인)도 자동으로 스캔 대상에 들어가며, 이는 라운드2가
    지적한 "세 번째 스택 무방비" 문제를 `frontend-checks.yml`의 pathspec 확장뿐 아니라 스캔
    로직 자체의 일반화로도 이중 보강한 것이다.
  - 제안: 없음(확인용 기록).

## 요약

이 PR은 backend/frontend에 손으로 복제돼 있던 마스킹 마커 상수·판정 함수·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터이며, 값·함수 시그니처·마스킹
동작은 이관 전후로 동일하다. 5라운드에 걸친 자체 `/ai-review`→fix 사이클에서 CI 경로 게이팅
사각지대(backend/frontend/web-chat 세 스택), 감시 목록 자체의 미러화, 파생 스캔의 "전수처럼
보이지만 아닌" 함정, 섀도잉·루프 재계산, 반증된 절대 서술의 잔존 등 요구사항 충족과 직결되는
결함들을 CRITICAL 없이 WARNING 단계에서 순차적으로 잡아 고쳤고, 본 리뷰에서 그 수정 결과를
소스 직접 대조로 재확인한 결과 서술(JSDoc·plan·spec)과 구현이 일치했다. spec fidelity 점검
결과 `spec/5-system/14-external-interaction-api.md` §R17의 SoT 서술·frontmatter `code:`
목록도 이번 이관을 정확히 반영하고 있다. 새로 발견된 CRITICAL/WARNING은 없으며, 남은 항목(backend
깊이 경계 값-고정 테스트 부재)은 이미 plan에 의도적 이월로 명시된 기존 갭이다.

## 위험도

NONE
