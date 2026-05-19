# 정식 규약 준수 검토 — convention_compliance

대상: `plan/in-progress/button-cap-spec-validator.md`
검토 모드: plan draft 검토 (--plan)

---

### 발견사항

- **[INFO]** plan frontmatter 구조는 규약에 완전히 부합
  - target 위치: frontmatter (L1–L6)
  - 위반 규약: 해당 없음 (준수 확인)
  - 상세: `worktree`, `started`, `owner` 세 필드 모두 존재하며 CLAUDE.md §PLAN 문서 라이프사이클 명세와 정확히 일치한다. `worktree: button-cap-spec-validator` 값도 실제 worktree 디렉토리 basename 과 일치한다.
  - 제안: 없음.

- **[INFO]** plan 문서 위치 및 파일명 규약 준수
  - target 위치: 파일 경로 `plan/in-progress/button-cap-spec-validator.md`
  - 위반 규약: 해당 없음 (준수 확인)
  - 상세: `plan/in-progress/` 하위 평문 파일명 패턴을 따른다. CLAUDE.md 명명 컨벤션 표의 `plan/in-progress/<name>.md` 형식과 일치.
  - 제안: 없음.

- **[INFO]** 문서 구조 — plan 문서에 권장 3섹션(Overview/본문/Rationale) 적용 여부
  - target 위치: 전체 문서 구조
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 "권장 3섹션 구성"
  - 상세: 권장 3섹션(Overview/본문/Rationale)은 **spec 문서**에 대한 권장 사항이며, plan 문서에 대한 구조 규약은 CLAUDE.md 에 별도로 정의되어 있지 않다. 현재 문서는 배경 → 결정 → 현 cap 인벤토리 → 작업 항목 → 관련 문서 순으로 구성되어 있어 plan 문서의 실용적 목적(작업 추적)에 적합하다. 단, spec 문서가 아닌 plan 문서에 3섹션을 요구하는 규약은 존재하지 않으므로 위반이 아니다.
  - 제안: 없음. 현 구조가 plan 문서 용도에 적합하다.

- **[INFO]** `작업 항목` 내 "단일 commit" 주석의 모호성
  - target 위치: `## 작업 항목` 블록쿼트 (L62)
  - 위반 규약: 직접 위반하는 정식 규약은 없으나, CLAUDE.md §PLAN 문서 라이프사이클에서 "plan 이동만 담은 별 PR 로 분리하지 않는다"고 하며 코드 변경 commit 과 plan 이동 commit 을 동일 PR 내 별도 commit 으로 분리할 것을 요구한다.
  - 상세: 블록쿼트에 "모든 변경은 **단일 commit** — spec + frontend default + backend validators + tests + plan + investigation 갱신" 으로 적혀 있다. 그러나 CLAUDE.md 는 plan 이동을 `chore(plan): mark <name> complete` 형태의 **별도 commit** 으로 분리하고 코드 변경 commit 과는 구분할 것을 명시한다. 하단 작업 항목에서는 이미 `git mv` 를 별도 chore commit 으로 계획했으므로 상위 블록쿼트의 "단일 commit" 설명이 혼란을 줄 수 있다.
  - 제안: 블록쿼트를 "모든 코드/spec 변경은 단일 commit — spec + frontend default + backend validators + tests 갱신. plan 이동은 별도 chore commit (CLAUDE.md §PLAN 라이프사이클)" 로 정정하면 규약과 정합성이 높아진다.

- **[WARNING]** plan 이동 항목이 아직 미체크(`[ ]`)인 상태에서 "본 PR chore commit" 언급이 규약과 충분히 정렬되는지 확인 필요
  - target 위치: L88–L89 (작업 항목 하단 `git mv` 체크박스)
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 "이동은 마지막 작업 PR 안에서 처리"·"plan 이동만 담은 별 PR 로 분리하지 않는다"
  - 상세: L88–L89에 두 개의 `git mv` 항목이 각각 `[ ]` 로 남아 있고, 두 항목 모두 "동일 PR chore commit" 으로 계획돼 있다. `presentation-button-render-investigation.md` 의 이동(L89)은 해당 plan 에 대한 모든 항목이 완료됐을 때만 이동 가능하지만, 현재 본 plan 의 작업 항목에서 그 plan 의 완료 여부를 판단하는 기준이 명시되어 있지 않다. 미완 항목이 단 하나라도 남아 있으면 `in-progress/`에 두어야 한다는 규약을 위반할 위험이 있다.
  - 제안: L89 항목에 `presentation-button-render-investigation.md` 의 모든 항목 완료 확인을 선행 조건으로 명시한다. 예: "[ ] `git mv plan/in-progress/presentation-button-render-investigation.md plan/complete/` (동일 PR chore commit — 해당 plan 내 미해결 항목 0건 확인 후)".

- **[INFO]** 관련 문서 링크 — 상대 경로 사용 일관성
  - target 위치: `## 관련 문서` 섹션 (L91–L95)
  - 위반 규약: 정식 규약에 링크 경로 형식을 직접 강제하는 조항은 없음.
  - 상세: `./node-config-required-defaults-sweep.md`, `./presentation-button-render-investigation.md` 등 상대 경로 링크는 plan 문서 내 상호 참조에 적합하다. 동일 디렉토리 내 파일이므로 규약상 문제없다.
  - 제안: 없음.

- **[INFO]** 정식 규약(`spec/conventions/`) 직접 연관 항목 — 규약 자체에 대한 위반 없음
  - target 위치: 전체 문서
  - 위반 규약: 해당 없음
  - 상세: 본 plan 문서는 코드·API·DTO 를 직접 정의하지 않으므로 `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, `spec/conventions/migrations.md`, `spec/conventions/cafe24-api-metadata.md` 등의 정식 규약 적용 대상이 아니다. plan 문서가 참조·계획하는 구현 내용(backend `MAX_BUTTONS_PER_NODE` 상수, validateButtons 등)이 해당 규약을 준수할지는 구현 단계에서 별도 검토가 필요하다.
  - 제안: 없음 (plan 단계에서 검토 불가).

---

### 요약

`plan/in-progress/button-cap-spec-validator.md` 는 CLAUDE.md 의 plan frontmatter 규약(worktree/started/owner 3필드), 파일 위치(`plan/in-progress/`), plan 문서 라이프사이클 규칙 대부분을 준수하고 있다. 정식 규약(`spec/conventions/`) 직접 위반은 발견되지 않는다. 단, 작업 항목 상단의 "단일 commit" 설명이 CLAUDE.md 의 "코드 변경 commit 과 plan 이동 chore commit 분리" 규약과 표면적으로 충돌할 수 있어 혼란 가능성이 있고(INFO), `presentation-button-render-investigation.md` 이동 항목에 선행 완료 확인 조건을 명시하지 않은 점이 미약한 규약 위반 위험을 내포한다(WARNING). 전반적으로 규약 준수 수준은 양호하다.

### 위험도

LOW
