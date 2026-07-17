# 신규 식별자 충돌 검토 — `spec/conventions/frontend-layering.md` (id: `frontend-layering`)

## 발견사항

- **[CRITICAL]** 동일 파일 경로·동일 frontmatter id 가 미병합 sibling 브랜치에 이미 완결 커밋됨
  - target 신규 식별자: 파일 경로 `spec/conventions/frontend-layering.md`, frontmatter `id: frontend-layering`
  - 기존 사용처: 브랜치 `claude/zen-kapitsa-c5e1de` (merge-base `e370d1d02` — 현재 브랜치 `claude/spec-frontend-layering` 와 **동일 base**에서 분기)
    - 커밋 `b74eb4e1a` (2026-07-17 18:30:40) — `spec/conventions/frontend-layering.md` 신설. frontmatter `id: frontend-layering`, `status: partial`, 본문 계층 정의(`types < lib < components < app`), §1~§4 + Rationale 전부 포함. `spec/0-overview.md` §4 표에도 1줄 추가.
    - 커밫 `caeeacadb` (2026-07-17 19:01:37) — Phase 2 구현까지 완료: `codebase/frontend/eslint.config.mjs` 의 `files` glob 을 `src/types/**` 로 확장(target draft 의 D2 를 이미 실행), 회귀 테스트를 실제 ESLint API 기반으로 전환.
    - 두 커밋 모두 `git merge-base --is-ancestor claude/zen-kapitsa-c5e1de main` = `NO` → **아직 main 미병합**이지만, 현재 세션(본 검토 시각 19:44:52)보다 **먼저 완결**된 상태다.
  - 상세: target 문서(`plan/in-progress/spec-draft-frontend-layering.md`, 현재 69줄, D1~D3 결정 + "구현 위임(developer 후속)" 상태)는 sibling 브랜치의 완결본과 **의미상 사실상 동일**하다 — 동일한 3-way 결정(D1 레이어 순서 `types<lib<components<app>`, D2 가드 스코프를 `src/types/**` 로 확장, D3 `app` 은 제외)을 독립적으로 재도출했다. 차이는 sibling 브랜치가 이미 D2 의 코드 구현(`eslint.config.mjs` glob 확장 + 테스트 전환)까지 마쳤고 `spec/0-overview.md` §4 표 갱신도 커밋했다는 점뿐이다. 이 상태로 두 브랜치가 각각 PR 화되면:
    1. `spec/conventions/frontend-layering.md` 신규 생성이 두 PR 모두에서 발생 — 나중에 머지되는 쪽이 **동일 경로 파일 add/add 충돌**을 겪는다.
    2. `spec/0-overview.md` §4 표에 같은 자리(진입 문서 표)에 유사하지만 문구가 다를 수 있는 행이 두 번 추가되며 충돌한다.
    3. `codebase/frontend/eslint.config.mjs` 의 `files: ["src/lib/**"]` → `["src/lib/**", "src/types/**"]` 확장이 sibling 브랜치에서 이미 끝나 있어, 본 브랜치가 "구현 위임(developer 후속)" 으로 남겨둔 작업은 **이미 중복 완료된 작업**이다.
  - 제안: 병합 전 조율 필요. project-planner/사용자가 (a) `claude/zen-kapitsa-c5e1de` 브랜치를 우선 채택해 병합하고 본 브랜치의 draft/plan 은 폐기(rebase 하여 이미 존재하는 spec 파일을 그대로 흡수)하거나, (b) 본 브랜치가 진행 중이라면 sibling 브랜치를 rebase 기준(base)으로 먼저 pull-in 해 중복 작업을 제거해야 한다. 두 브랜치를 그대로 각각 PR 로 올리면 파일 경로·spec ID 충돌이 사실상 확정적이다. 이 상황은 좁은 의미의 "동일 식별자가 다른 의미로 쓰이는 CRITICAL" 은 아니지만(오히려 두 브랜치가 같은 결론에 도달) 병합 시점 실제 충돌·중복 작업 낭비가 확실시되므로 CRITICAL 로 표기한다.

- **[INFO]** target 자체 내부에서는 신규 식별자 충돌 없음 (기존 spec/conventions 코퍼스 대비)
  - target 신규 식별자: `frontend-layering` (id) / `spec/conventions/frontend-layering.md` (경로)
  - 기존 사용처: 없음 — `spec/conventions/*.md` 23개 문서의 frontmatter `id` 전수 조회 결과 `frontend-layering` 과 동일하거나 유사한 id 는 현재 (sibling 브랜치를 제외한) 이 브랜치 자체 코퍼스에는 없다. 파일명도 kebab-case id 와 파일 stem 이 일치하는 기존 컨벤션(`cafe24-api-metadata.md`↔`id: cafe24-api-metadata` 등)을 그대로 따른다.
  - 상세: "레이어"(layer) 라는 용어 자체는 `spec/1-data-model.md`(애플리케이션 레이어), `spec/4-nodes/1-logic/0-common.md`(에러 정책 레이어), `spec/conventions/cafe24-api-metadata.md`(§레이어 경계 — MCP tool provider 의 prefix/bare id 경계)에서 이미 다른 문맥으로 쓰이고 있으나, 모두 서술적 표현일 뿐 정식 식별자(ID/제목)가 아니라 충돌로 보지 않는다. 실제로 sibling 브랜치의 완결본에도 "본 문서의 '레이어' 는 frontend 디렉터리 의존 방향(§1)만을 가리킨다 — 타 문서의 동명 용어와 무관하다" 는 명시적 disambiguation 문구가 이미 포함되어 있어, target 문서도 최종화 시 동일한 문구를 유지해야 한다.
  - 제안: 위 sibling 브랜치 충돌이 해소되면(§1 CRITICAL 대응) 이 항목은 자연히 소멸한다. 병합 후 남는 단일 문서에도 "타 문서의 동명 '레이어' 용어와 무관" 이라는 disambiguation 문장을 유지할 것을 권고.

- **[INFO]** `spec/0-overview.md` §4 진입 문서 표에 추가될 신규 행의 표기 형식 확인 필요
  - target 신규 식별자: `spec/0-overview.md` §4 표에 추가될 "프론트엔드 레이어 경계 규약" 행 (target draft 본문에는 표 갱신 내용이 명시돼 있지 않으나 산출물 목록에 `spec/0-overview.md` 갱신이 암시됨 — sibling 브랜치 diff 에서 `spec/0-overview.md | 1 +` 확인됨)
  - 기존 사용처: `spec/0-overview.md` §4 표는 이미 "노드 Output 규약" · "ExecutionContext 설계 규약" · "에러 코드 명명 규약" 3행을 `spec/conventions/*.md` 항목으로 갖고 있다 (기존 형식: `| 항목명 | — | [`./conventions/xxx.md`](./conventions/xxx.md) |`).
  - 상세: 충돌은 아니며, 신규 행을 추가할 때 기존 3행과 동일한 표 형식(항목명 한글 라벨 + 상세 spec 링크)을 따라야 한다는 일관성 확인. sibling 브랜치가 이미 추가한 행 문구와 본 브랜치가 추가할 행 문구가 서로 다르면 병합 시 표 셀 단위 충돌이 발생한다(위 CRITICAL 항목과 동일 원인).
  - 제안: 병합 조율 후 단일 문구로 통일.

## 요약

target 이 새로 도입하는 식별자(`spec/conventions/frontend-layering.md`, `id: frontend-layering`) 는 본 브랜치가 참조하는 spec/plan/conventions 코퍼스 **내부**에서는 다른 의미로 쓰이는 기존 사용처가 없어 순수 신규 도입으로 보인다. 그러나 git 히스토리 조회 결과, **동일 base 커밋(`e370d1d02`)에서 분기한 sibling 브랜치 `claude/zen-kapitsa-c5e1de`** 가 이 정확히 동일한 파일 경로·frontmatter id 로 문서를 이미 커밋했고(18:30), 심지어 target draft 가 "developer 후속" 으로 위임해 둔 구현(D2: eslint glob 확장 + 회귀 테스트)까지 이미 완료(19:01)한 상태다. 두 브랜치 모두 아직 main 에 병합되지 않았으나, 이 상태로 각각 독립적으로 병합을 진행하면 `spec/conventions/frontend-layering.md` add/add 충돌, `spec/0-overview.md` §4 표 라인 충돌, 그리고 `eslint.config.mjs` glob 확장의 중복 작업이 확실시된다. 이는 좁은 의미의 "동일 식별자·다른 의미" 충돌은 아니지만(오히려 결론이 거의 동일) 실질적 머지 충돌과 작업 중복 낭비가 예정돼 있어 최우선으로 조율이 필요하다.

## 위험도
CRITICAL
