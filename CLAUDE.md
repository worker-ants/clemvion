# 프로젝트 공통 규약

본 문서는 role에 무관하게 이 프로젝트에서 항상 지켜야 하는 공통 규약을 정의한다. 역할별 세부 워크플로는 `.claude/skills/` 하위의 각 skill 문서를 따른다.

## 폴더 구조

`Monorepo`로 구성되어 있다.

- 서버는 반드시 `backend`에 구성한다.
- 클라이언트는 반드시 `frontend`에 구성한다.

```text
./ (Root)
  ├── prd/                      # PRD (Product Requirement Document, 제품 요구 사항 정의서)
  ├── spec/                     # 프로젝트 스펙 문서 (Spec-Driven Development)
  ├── memory/                   # 기억 증강용. multi-depth tree 구조로 자유롭게 기록·활용
  ├── plan/                     # 작업 계획·질의 리스트·workflow·todo
  │   ├── in-progress/          # 처리할 항목이 남아있는 plan 문서 (작성·수정의 기본 위치)
  │   │   └── **/*.md           # 하위 폴더로 그룹핑 가능 (예: stages/)
  │   └── complete/             # 모든 항목이 처리 완료된 plan 문서 (역사 기록)
  ├── review/                   # 코드 리뷰
  │   └── **/                   # 요청 시간 구분
  │       ├── */*.md            # 각 분야 전문가들이 작성한 리뷰
  │       ├── SUMMARY.md        # 전문가 리뷰 요약
  │       └── RESOLUTION.md     # 코드 리뷰 이슈 조치 내용
  ├── user_memo/                # 사용자가 남긴 자료 (설계 제안·노트 등)
  │   └── node-specs-improvement/
  │       ├── CONVENTIONS.md    # 노드 Output 통일 규약 (Principle 0~11). 핸들러 주석의 "CONVENTIONS §N" 참조 원전
  │       ├── INCONSISTENCY_MATRIX.md
  │       └── <category>/<node>.md  # 노드별 개선안
  ├── frontend/                 # 클라이언트 (Next.js)
  │   ├── package.json
  │   ├── .env
  │   └── src/
  └── backend/                  # 서버 (Nest.js)
      ├── package.json
      ├── .env
      └── src/
```

## 개발 방법론

모든 개발은 반드시 **SDD(Spec-Driven Development)** 와 **TDD(Test-Driven Development)** 로 접근한다. 아래 공통 규약은 **반드시 누락 없이** 지켜진다.

### MEMORY

구현·기획을 진행할 때 절대 누락이 발생해서는 안 된다.

- 작업 이전과 이후에 `memory/`·`plan/` 경로에 markdown 파일을 적극적으로 작성·갱신한다.
- 작업을 시작할 때마다 항상 해당 파일들을 먼저 참고한다.
- 작업이 끝나면 결과에 맞춰 갱신하거나, 더 이상 필요 없는 항목은 제거한다.

### PLAN 문서 라이프사이클

`plan/` 하위는 **반드시** 다음 두 폴더 중 하나에 위치해야 하며, 최상위(`plan/*.md`)에는 plan 문서를 두지 않는다.

- **`plan/in-progress/`** — 처리할 항목이 하나라도 남아있는 plan 문서를 둔다. 새 plan 문서는 항상 여기에서 생성한다. 하위 폴더로 그룹핑(예: `plan/in-progress/stages/`)해도 된다.
- **`plan/complete/`** — 모든 작업·체크리스트·후속 항목까지 끝난 plan 문서만 둔다. 미완 항목이 단 하나라도 남아있으면 이 폴더로 옮기지 않는다.

규칙:

- **이동 시 `git mv` 사용** — 단순 복사·삭제가 아니라 `git mv` 로 옮겨 history를 보존한다.
- **상태 갱신 시점**: 작업 단계가 끝날 때마다 plan 문서를 갱신하고, 모든 항목이 완료된 순간에 `complete/`로 이동한다. 새로운 후속 항목이 발견되면 다시 `in-progress/`로 되돌린다.
- **분류 기준**: 미체크 체크박스(`[ ]`), "TODO", "남은 작업", "다음 단계", "결정 필요", 미해결 follow-up 항목이 하나라도 있으면 `in-progress/` 다.
- **인입 참조**: `review/**` 처럼 시점 기록 성격의 문서는 옛 경로를 그대로 둔다(역사 기록). `memory/`·`spec/`·`prd/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신한다.

## Skill 체계 (역할 분담)

이 프로젝트의 작업은 역할 단위로 분리되어 있다. 사용자의 요청이 어느 역할에 속하는지 판별한 뒤, 해당 skill의 지침을 따른다.

| 역할 | Skill | 담당 업무 |
| ---- | ----- | --------- |
| 기획자 | [`project-planner`](.claude/skills/project-planner/SKILL.md) | PRD / Product Spec의 신규 작성·개정. `prd/`·`spec/`에 최종 산출물 저장. **구현 금지** |
| 개발자 | [`developer`](.claude/skills/developer/SKILL.md) | 스펙 기반의 구현·리팩토링·테스트 작성·빌드·품질 검증. `frontend/`·`backend/`에 구현. **기획 금지** |
| 코드 리뷰어 | [`code-review-agents`](.claude/skills/code-review-agents/SKILL.md) (`ai-review`) | 다각도 코드 리뷰 실행. `review/**/SUMMARY.md` 생성 |

- PRD/Spec을 다루면 `project-planner`로 진입한다.
- 코드베이스(`frontend/`·`backend/`)를 다루면 `developer`로 진입한다.
- role을 벗어나는 요청이 섞여 있으면, 즉시 사용자에게 알리고 적절한 skill로 분기한다.

## 프로젝트 스펙 문서

`prd/`·`spec/` 하위의 문서는 제품의 **최종 스펙**을 정의한다. history가 아닌 latest에 대한 기술이므로, 변경이 누적되어 정합성이 흐려질 경우 문서를 전체적으로 정리·재구성한다.

## 패키지 매니저

frontend와 backend는 모두 npm을 사용한다. (yarn, pnpm 등을 사용하지 않는다.)

## README.md

`README.md`는 제품의 설명과 실행 방법 등을 기술한다. 구현 완료 후 변동 사항이 있을 경우 `spec/`을 참고해 다시 정리한다. history가 아닌 **제품의 최종 상태**를 서술한다.
