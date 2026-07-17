# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-frontend-layering.md`

## 검토 방법

target plan 이 언급하는 "선행 작업과의 관계"(sibling 브랜치 `claude/zen-kapitsa-c5e1de` 채택+정정 처분)가
실제로 충돌을 해소했는지 확인하기 위해, 프롬프트에 첨부된 정적 코퍼스 대신 워크트리의 실제 git 상태를
직접 조회했다:

- `git branch -a` — sibling 로컬 브랜치 존재 여부 확인
- `git merge-base claude/zen-kapitsa-c5e1de HEAD` — sibling 브랜치의 분기점 확인
- `git show claude/zen-kapitsa-c5e1de:<path>` vs 현재 워크트리 파일 `diff` — "채택 시 정정" 주장이 실제 내용
  변경으로 이어졌는지 실측
- `spec/` 전체에 대한 `id:` frontmatter 전수 조회, `frontend-layering` 문자열 전수 grep

## 발견사항

- **[INFO]** 이전 Critical(경로 선점) 처분 — 실제로 해소됨 확인
  - target 신규 식별자: `spec/conventions/frontend-layering.md`(`id: frontend-layering`), `plan/in-progress/spec-draft-frontend-layering.md`
  - 기존 사용처: 로컬 브랜치 `claude/zen-kapitsa-c5e1de`(워크트리 `nifty-greider-35167d`, 커밋 `b74eb4e1a`/`caeeacadb`, base `e370d1d02` = PR #969 이전)가 동일 두 경로를 이미 커밋
  - 상세: `git show claude/zen-kapitsa-c5e1de:<path>` 로 뽑은 원본과 현재 워크트리 파일을 `diff` 한 결과, plan 의 "채택 시 정정한 내용" 절이 주장하는 4개 정정이 모두 실제 diff 에 나타난다 — (1) 실측 수치 `255/106/72` → `248/97/64` 로 갱신, (2) `no-restricted-syntax` selector 커버리지 서술이 "리터럴 specifier" 2종 → "문자열·백틱" 4종(§4 표 3행 모두 `× 2`)으로 확장, (3) §4.1 "왜 테스트가 필수인가" 신설(PR #969 의 fail-open 차단 mutation 근거 포함), (4) `## 4. CI 강제` 커버리지 한계 서술이 "문자열 리터럴만" → "문자열·백틱 모두, 계산 경로만 사각지대" 로 정정. plan 파일도 `worktree: nifty-greider-35167d` → `spec-frontend-layering` 로 frontmatter 가 갱신됐고 결정 근거(D1~D4) 문구가 전면 재작성돼 있다. 즉 이번 경로 재사용은 우연한 충돌이 아니라 의도된 "동일 경로 채택 + 내용 정정" 이며, 두 파일 다 병합 대상은 하나(현재 브랜치)만 남는 구조라 실제 identifier 충돌은 소멸했다.
  - 제안: 없음 — 처분이 유효함을 확인. 잔여 정리는 아래 WARNING 참고.

- **[WARNING]** 미정리 sibling 브랜치/워크트리 — 재충돌 잠재 리스크 (신규 발견 아님, 미해소 상태 재확인)
  - target 신규 식별자: 없음 (target 자체의 결함이 아니라 운영 정리 잔여)
  - 기존 사용처: `git branch -a` 로 `claude/zen-kapitsa-c5e1de` 가 이 검토 시점에도 여전히 로컬에 존재함을 확인. 이 브랜치는 PR #969 이전 base 라 `backtickSpecifier`(백틱 우회 차단) 가 없는, 정정 전 버전의 `spec/conventions/frontend-layering.md`/`plan/in-progress/spec-draft-frontend-layering.md` 를 그대로 보유하고 있다.
  - 상세: target plan 의 "후속" 절이 이미 "다른 세션이 사용 중일 수 있어 삭제하지 않는다 — 사용자 확인 후 정리" 라고 명시해 두었으므로 이번 검토가 처음 발견한 사실은 아니다. 다만 이 검토 시점까지도 정리가 완료되지 않았다는 점을 실측으로 재확인한다 — 이 브랜치/워크트리가 삭제되지 않은 채 남아 있는 한, 그쪽에서 별도 PR 이 열리거나 두 브랜치가 동시에 main 에 반영 시도되면 동일 경로(`spec/conventions/frontend-layering.md`, `plan/in-progress/spec-draft-frontend-layering.md`)에 대해 이번엔 진짜 git merge conflict 가 재발한다.
  - 제안: 본 PR 머지 확정 후 사용자 승인을 받아 `claude/zen-kapitsa-c5e1de` 브랜치와 워크트리 `nifty-greider-35167d` 를 정리(삭제)할 것. plan 문서에 이미 예정돼 있으므로 별도 plan 항목 신설은 불필요 — 실행 여부만 추적하면 됨.

- **[INFO]** 신규 `id: frontend-layering` — 전역 유일성 확인
  - target 신규 식별자: frontmatter `id: frontend-layering`
  - 기존 사용처: 없음
  - 상세: `spec/` 전체 `id:` frontmatter 전수 조회 결과 `frontend-layering` 은 본 문서 1건뿐이다. 중복이 실재하는 다른 id(`common` 6건, `chat-channel` 3건 — 둘 다 영역별 반복 사용이 기존에 이미 있는 패턴)와도 겹치지 않는다.
  - 제안: 없음

- **[INFO]** "레이어/계층" 용어 중의성 — 문서가 이미 자체 disambiguate
  - target 신규 식별자: "레이어" 용어 및 `types < lib < components < app` 4계층 순서
  - 기존 사용처: `spec/0-overview.md` §2.6 "Data Layer"(PostgreSQL/Redis/Vector DB/Object Storage 스토리지 계층), `spec/conventions/execution-context.md` "3계층"(L0 저장 시점/L1 pre-flight/L2 런타임 — 변수 예약 강제 계층) — 둘 다 "레이어/계층" 이라는 동일 단어를 다른 의미로 이미 사용 중
  - 상세: target 문서 Overview 절(§0, "본 문서의 '레이어' 는 frontend 디렉터리 의존 방향(§1)만을 가리킨다 — `0-overview.md` 의 Data Layer, `execution-context.md` 의 3계층 등 타 문서의 동명 용어와 무관하다")이 명시적으로 disambiguate 하고 있어 실질적 혼선 위험은 낮다. 세 개념(프론트엔드 디렉터리 의존 방향/백엔드 스토리지 계층/변수 예약 강제 계층)은 도메인이 완전히 분리돼 있어 실무자가 문서 간 혼동할 가능성도 낮다.
  - 제안: 현행 self-disambiguation 유지로 충분. 추가 조치 불필요.

- **[INFO]** Phase 2 가 언급하는 코드 식별자 — 실재 확인
  - target 신규 식별자: (target 이 새로 도입하는 것은 아님) plan Phase 2 절이 언급하는 `literalSpecifier`/`backtickSpecifier`/`COMPONENTS_PATH_RE`
  - 기존 사용처: `codebase/frontend/eslint.config.mjs` (PR #969 로 이미 도입)
  - 상세: 실제 파일을 조회한 결과 세 식별자 모두 현재 코드에 정확히 존재(`COMPONENTS_PATH_RE` 정규식 상수, `literalSpecifier`/`backtickSpecifier` 헬퍼 함수, selector 4곳에서 사용). plan 의 서술("현재 구조는 `literalSpecifier`/`backtickSpecifier` 헬퍼 + `COMPONENTS_PATH_RE` 상수")과 실제 코드가 일치 — 충돌도 오기재도 없다.
  - 제안: 없음

- **[INFO]** `spec/0-overview.md` §4 표 삽입 — 중복 없는 단일 행 추가
  - target 신규 식별자: "Frontend 레이어 경계 규약" 행
  - 기존 사용처: 없음
  - 상세: `git diff spec/0-overview.md` 로 확인한 실제 변경은 `에러 코드 명명 규약` 행 바로 아래 신규 행 1개 삽입뿐이며, 기존 표의 어떤 행과도 텍스트·경로가 겹치지 않는다. 파일 경로 `./conventions/frontend-layering.md` 도 kebab-case 명명 컨벤션(`data-hydration-surfaces.md`, `execution-context.md`, `error-codes.md` 등)과 일치한다.
  - 제안: 없음

## 요약

target 이 도입하는 두 신규 경로(`spec/conventions/frontend-layering.md`, `plan/in-progress/spec-draft-frontend-layering.md`)와 frontmatter `id: frontend-layering` 은 앞선 세션(19_44_52)에서 Critical 로 지적된 sibling 브랜치 `claude/zen-kapitsa-c5e1de` 와의 경로 선점 충돌이 있었으나, 이번 실측(diff 기반)으로 그 처분 — "sibling 문서를 채택하되 PR #969 기준으로 정정" — 이 실제 내용 변경(실측 수치·selector 커버리지 서술·§4.1 신설·frontmatter worktree 필드)으로 정확히 반영됐음을 확인했다. 따라서 이 경로 재사용은 우연한 신규 충돌이 아니라 의도된 단일화이며, `id` 전역 유일성·용어 disambiguation·코드 식별자 참조 정확성·spec 표 삽입 등 다른 신규 식별자 축에서도 추가 충돌은 발견되지 않았다. 유일한 잔여 사항은 sibling 브랜치/워크트리가 아직 삭제되지 않아 재충돌 가능성이 남아있다는 점인데, 이는 target plan 문서 자체가 이미 명시적으로 "사용자 확인 후 정리" 대상으로 기록해 둔 알려진 후속 작업이라 신규 발견은 아니다.

## 위험도

LOW
