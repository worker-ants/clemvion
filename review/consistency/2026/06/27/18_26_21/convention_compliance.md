# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/`
검토 모드: 구현 완료 후 검토 (--impl-done, diff-base=origin/main)
검토 일자: 2026-06-27

---

## 발견사항

### 1. **[WARNING]** `10-auth-flow.md` 내 서브섹션 번호 역순 배치

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/mc-modellistdto-fix/spec/2-navigation/10-auth-flow.md`, 105행·119행
- **위반 규약**: CLAUDE.md 문서 구조 권장 (Overview / 본문 / Rationale 3섹션, 논리적 순서)
- **상세**: `## 2. 회원가입 (Register)` 아래 서브섹션이 `2.4 처리 플로우` → `2.6 초대 토큰을 통한 가입` → `2.5 이메일 인증 안내 화면` 순으로 배치되어 있다. `grep -n "^### 2\." spec/2-navigation/10-auth-flow.md` 실행 시: 96행 §2.4, 105행 §2.6, 119행 §2.5 순으로 확인된다. 숫자가 2.6 다음에 2.5가 오는 역순이므로 문서를 순서대로 읽는 독자에게 혼란을 준다. §2.6 (초대 가입 경로)은 §2.4 처리 플로우의 변형 경로로 나중에 삽입된 것으로 보이며, 삽입 후 기존 §2.5의 번호를 재번호매김하지 않아 발생한 것이다.
- **제안**: §2.6의 내용을 §2.5 뒤로 이동하거나, 현재 §2.5 이메일 인증 화면을 §2.5로 유지하고 초대 가입 경로를 §2.6으로 그 뒤에 둔다. 또는 §2.6을 §2.5로 번호를 바꾸고 현재 §2.5를 §2.6으로 교체한다.

---

### 2. **[WARNING]** `14-execution-history.md` 목록 API 응답 예시에 공통 래퍼(TransformInterceptor) 주의 문구 누락

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/mc-modellistdto-fix/spec/2-navigation/14-execution-history.md`, §5 "목록 API 응답 형식" 예시 (414~451행)
- **위반 규약**: `spec/conventions/swagger.md §2-5` (응답 wrapping — 모든 성공 응답을 `{ data: ... }` 로 감싸는 TransformInterceptor 적용). 동일 영역 `spec/2-navigation/0-dashboard.md` 가 "응답 본문은 공통 래퍼(`{ \"data\": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다" 라고 명시하는 패턴.
- **상세**: `14-execution-history.md §5` 의 목록 API 응답 예시는 `{ "data": [...], "pagination": {...} }` 구조를 보여 준다. 이는 실제 HTTP 응답 본문인 `{ "data": { "data": [...], "pagination": {...} } }` 의 내부 값을 나타내는 것이나, `0-dashboard.md` 와 달리 "아래 예시는 `data` 내부 형태다" 와 같은 주의 문구가 없다. 읽는 사람이 이 예시를 완전한 HTTP 응답 본문으로 오해하면 `data` 래퍼 하나가 빠진 클라이언트 구현으로 이어질 수 있다. swagger.md §2-5가 "Swagger 응답 스키마 표기 시에도 이 구조를 반영합니다"라고 명시한 원칙의 연장선에서, spec 예시도 동일 주의를 따라야 한다.
- **제안**: 응답 예시 앞에 `0-dashboard.md` 패턴과 동일한 주의 문구를 추가한다: "응답 본문은 공통 래퍼(`{ \"data\": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다."

---

### 3. **[INFO]** `16-agent-memory.md` Rationale 섹션 소제목 포맷 불일치

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/mc-modellistdto-fix/spec/2-navigation/16-agent-memory.md`, `## Rationale` 섹션 (57~65행)
- **위반 규약**: 동일 영역 문서들의 Rationale 소제목 형식 관례 (`### R-N. 제목` 헤딩 패턴). `14-execution-history.md`는 `### R-1.`, `### R-2.` 등 넘버드 헤딩을 사용. `15-system-status.md`도 `### R-1.`, `### R-2.`, `### R-3.` 패턴 사용.
- **상세**: `16-agent-memory.md`의 Rationale은 `**별도 화면 vs 노드 에디터 인라인**:` 와 `**조회는 viewer+, 삭제는 editor+**:` 형태의 볼드 텍스트로 소제목을 표현한다. 이는 `###` 헤딩이 아니라 단락 내 볼드 패턴으로, 목차 링크(anchor) 생성이 안 되고 다른 spec doc에서 섹션 직접 링크가 불가능하다.
- **제안**: `### R-1. 별도 화면 vs 노드 에디터 인라인` 과 `### R-2. 조회는 viewer+, 삭제는 editor+` 형태의 헤딩으로 교체한다.

---

### 4. **[INFO]** `spec/2-navigation/` 대부분 문서에 공식 `## Overview` 섹션 없음

- **target 위치**: `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md`, `2-trigger-list.md` 등
- **위반 규약**: CLAUDE.md 정보 저장 위치 — "제품 정의·요구사항 | `spec/<영역>/_product-overview.md` **또는** 진입 문서의 `## Overview`". CLAUDE.md가 권장하는 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)".
- **상세**: CLAUDE.md는 "또는(or)" 관계로 둘 중 하나를 허용하며, 해당 영역에 `spec/2-navigation/_product-overview.md`가 존재하므로 각 spec 파일이 별도 `## Overview` 없이 `_product-overview.md`를 링크하는 것은 허용된 방식이다. 다만 `14-execution-history.md`는 `## Overview (제품 정의)` 섹션을 가지면서도 `_product-overview.md`를 함께 참조하는 반면, 나머지 문서는 `_product-overview.md` 링크만 있다. 같은 영역 내에서 3-섹션 구조 채택 여부가 일치하지 않는다. 이는 권장사항 위반이므로 CRITICAL은 아니지만 지속되면 신규 spec 작성 시 어느 패턴을 따를지 불명확해진다.
- **제안**: `14-execution-history.md`의 `## Overview` 방식을 `spec/2-navigation/` 내 다른 문서들에도 일관되게 채택하거나, 혹은 반대로 `14-execution-history.md`의 Overview 내용을 `_product-overview.md`로 이전하고 문서 서두 참조 링크만 남기는 방향으로 통일한다. 후자가 영역 진입점을 단일화하는 CLAUDE.md 취지에 더 부합한다.

---

## 요약

`spec/2-navigation/` 문서들은 전반적으로 정식 규약을 잘 준수하고 있다. frontmatter(`id`/`status`/`code`) 의무 사항은 모두 충족되며, `error-codes.md` 위반 에러 코드나 swagger.md 위반 DTO 명명 패턴은 발견되지 않았다. `id: nav-agent-memory` (`16-agent-memory.md`) 는 `spec-impl-evidence.md §2.1` 의 basename 충돌 회피 패턴이 명시적으로 허용하는 의도된 표기다. 단, `10-auth-flow.md`의 서브섹션 번호 역순 배치(§2.6→§2.5)는 문서 구조의 명백한 결함이며, `14-execution-history.md`의 응답 예시에 `swagger.md §2-5` 및 동일 영역 `0-dashboard.md`가 설정한 래퍼 주의 문구가 빠진 점은 클라이언트 구현 오해를 유발할 수 있다.

---

## 위험도

LOW
