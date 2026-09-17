# 정식 규약 준수 검토 — spec-draft-deletion-releases-trigger-resources.md

## 발견사항

- **[CRITICAL]** `S7` 패치가 `secret-store.md` 를 자기모순 상태로 남긴다 — 본문(§2.1·§6)은 안 고치고 Rationale(§R4)만 고친다
  - target 위치: draft `## 변경안 § S7`
  - 위반 규약: `spec/conventions/secret-store.md` 자체 (본 draft 가 수정 대상으로 삼은 바로 그 문서) — §2.1 "호출 규약" 표의 "Trigger 삭제" 행(실제 파일 147행), §6 "Trigger 삭제 시 cascade" 절(실제 파일 388~392행)
  - 상세: draft 는 "spec 이 이미 서로 어긋나 있다" 표에서 `secret-store.md §R4` 한 곳만 지목하고 그 문장만 고치는 `S7` 을 낸다. 그런데 같은 파일 안에 **똑같이 좁은(narrow) 문장이 두 곳 더** 있고, 그중 하나는 draft 의 실측을 직접 반증한다.
    1. §2.1 "호출 규약" 표(147행, 이 문서의 **정본 call-contract**)는 여전히 `시점: Trigger 삭제` 한 줄만 남는다 — D1 의 새 규칙("트리거 행을 없애는 **모든** 경로")이 이 표에는 반영되지 않는다. Rationale 은 "모든 경로가 책임진다" 고 말하는데 본문 규약 표는 "Trigger 삭제만" 이라고 말하는 상태가 된다.
    2. §6(392행)은 "`workspace_id` 컬럼은 **workspace 삭제 시 cascade 정리용** (`DELETE FROM secret_store WHERE workspace_id = $1`)." 이라고 **이미 구현된 사실처럼** 서술한다. 그런데 draft 의 실측(§"실측" 절)은 "워크플로·워크스페이스 삭제는 위 넷 중 아무것도 하지 않는다" 라고 정반대로 확인했다. 즉 §6 은 지금 이 순간 **거짓** 서술이고, draft 가 새로 반증한 바로 그 명제를 이미 담고 있는데도 draft 의 "spec 이 이미 서로 어긋나 있다" 감사 표에는 이 지점이 빠졌다.
  - `S7` 적용 후 결과: §R4(Rationale) = "모든 경로가 책임진다(2026-09-17 실측 — 워크플로·워크스페이스 삭제가 정리하지 않고 있었다)" ↔ §6(본문) = "workspace 삭제 시 이미 정리된다" 가 **한 문서 안에서 동시에** 존재한다. `spec/conventions/secret-store.md` 는 CLAUDE.md 정보 저장 위치 표가 지정한 "정식 규약" 단일 진실 문서이므로, 같은 문서 안에서 본문과 Rationale 이 서로 반대 사실을 주장하면 이 문서를 읽는 다음 사람(특히 구현자)이 "§6 을 보면 이미 됐다" 고 오판해 D4 구현을 건너뛸 위험이 있다 — 이 draft 가 스스로 경계하는 실패 유형("경로 하나만 주어로 삼아 나머지가 계약 밖에 남는다")이 이 문서 자체 안에서 재발한다.
  - 제안: `S7` 범위를 §R4 단독에서 §2.1 표 + §6 까지 확장한다. 예:
    - §2.1 표의 "시점" 칸을 `Trigger 삭제 / Workflow·Workspace 삭제(FK CASCADE)` 로 넓히거나, 최소한 각주로 "트리거 행을 없애는 모든 경로에 적용(§R4)" 를 덧붙인다.
    - §6 문장을 규칙형으로 정정한다 — 예: "`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리에 쓰인다. **트리거 prefix 삭제(위)에 더해**, workspace 삭제 경로는 `secret_store` 를 `workspace_id` 로 명시 DELETE 한다(2026-09-17 결정 — 이 문장이 서술하는 동작은 그 결정 이전엔 구현되어 있지 않았다)." 처럼 "이미 그렇다"가 아니라 "이렇게 하기로 정했다" 로 시제를 바꾼다.

- **[WARNING]** `S5` 가 고치는 §1.10 액션 표와 짝을 이루는 §2.1 "Schema 매핑" 표가 그대로 남는다
  - target 위치: draft `## 변경안 § S5`
  - 위반 규약: 엄밀히는 `spec/conventions/**` 소속 파일이 아니라 `spec/data-flow/12-workspace.md` 본문 내부 정합성 문제라 이 트랙(정식 규약 준수)의 핵심 스코프 밖일 수 있으나, 위 CRITICAL 항목과 **동일한 실패 패턴**(같은 파일 안에서 한 표만 고치고 짝表는 방치)이라 함께 적는다.
  - 상세: `spec/data-flow/12-workspace.md` §2.1 Postgres 매핑 표(195~208행)는 `workspace`/`workspace_member`/`workspace_invitation` 각각의 sink 행을 나열하지만 `secret_store` 행이 없다. `S5` 가 §1.10 액션 표에 "`secret_store`(`workspace_id` 기준)를 명시 DELETE" 를 추가해도, 같은 문서의 §2.1 요약 표는 이 신규 DELETE 를 반영하지 않아 두 표가 다시 어긋난다.
  - 제안: §2.1 표에 `secret_store | 삭제(§1.10) | DELETE workspace_id=$1 (선행: 트랜잭션 전 트리거별 prefix 해제) | —` 류의 행을 추가한다.

- **[WARNING]** `S2` 의 편집 위치 지시(표 셀 내부)와 실제 삽입 콘텐츠(멀티라인 blockquote)가 형식적으로 불일치
  - target 위치: draft `## 변경안 § S2`
  - 위반 규약: 명시적 conventions 문서 조항은 없음(표 셀 마크다운 문법 자체의 제약) — 참고로만 남김
  - 상세: 절 제목이 "«상류» 행의 **동작 칸 끝에 덧붙임**" 이라 적혀 있는데, 실제 삽입 텍스트는 `>` blockquote 로 여러 줄에 걸쳐 있다. GFM 표 셀은 한 줄(파이프로 구분된 인라인 콘텐츠)만 허용하므로, 이 blockquote 를 문자 그대로 "칸 끝" 에 넣으면 표가 깨진다. spec 반영(§S2) 시 이 문단은 표 **바깥**(§4.3 표 다음 문단)에 두는 것이 의도였을 가능성이 높다 — 반영 담당자가 문구 그대로 표 셀에 붙여넣지 않도록 draft 자체의 절 제목을 "표 다음에 문단 추가" 로 정정하면 안전하다.

- **[INFO]** `secret-store.md §R4` 제목이 "Trigger FK 미설정" 으로 트리거 단수 주어를 유지한다
  - target 위치: `spec/conventions/secret-store.md` §Rationale R4 제목 (실제 파일 618행 부근)
  - 상세: 본문 내용은 `S7` 적용 후 "트리거 행을 없애는 모든 경로" 로 일반화되지만, 절 제목 자체는 여전히 "Trigger FK 미설정" 이다. FK 를 안 둔다는 설계 결정 자체는 트리거 단수로 서술해도 무방하지만(FK 미설정은 트리거-secret_store 관계에 대한 결정), 다음 독자가 제목만 보고 "트리거 삭제 한정 규칙" 으로 오독할 여지가 있다.
  - 제안: 필수는 아니나, 제목 아래 첫 문장에 "(2026-09-17부터 책임 범위를 트리거 행을 없애는 모든 경로로 확장)" 같은 캡션을 남기면 제목-본문 괴리를 줄일 수 있다.

## 준수 확인 (위반 아님 — 참고)

- `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 파일명은 `project-planner/SKILL.md` §작업 워크플로 3단계가 지정한 `spec-draft-<name>.md` 명명 규약과 정확히 일치하고, frontmatter 의 `worktree`/`started`/`owner` 필수 3필드·`spec_impact` 리스트(전부 실존 spec 경로)도 `.claude/docs/plan-lifecycle.md` §4/Gate C 요건을 만족한다. 문서 말미의 `## Rationale` 섹션도 동일 SKILL 지침과 일치한다.
- draft 는 이미 main 에 머지된 `V063__secret_store.sql` 마이그레이션 주석을 고치지 않기로 명시했는데, 이는 `spec/conventions/migrations.md` §3 "Append-only 원칙"(머지된 V번호 파일은 절대 수정 금지, checksum mismatch 로 부팅 실패)과 정확히 부합한다.
- `S1~S6` 이 인용하는 각 spec 문서의 현재 문면(§4.3 앵커, `1-workflow-list.md` 108행, `12-workspace.md` 188행, `11-workflow.md` 195행, `10-triggers.md` §1.4 표, `1-data-model.md` 791행)은 실측 결과 draft 의 인용과 정확히 일치했다 — draft 가 존재하지 않는 문면을 근거로 삼은 곳은 없었다.
- `D2`(트리거 단위 `trigger.deleted` 감사를 새로 만들지 않는다)는 `spec/conventions/audit-actions.md` 의 기존 원칙("짝 리소스는 호출된 엔드포인트 쪽만 기록한다" — 한 사용자 행위를 여러 감사 행으로 쪼개지 않는다)과 같은 방향이라 정합적이다.
- 이 draft 는 API 응답 포맷·에러 코드·DTO/decorator 패턴을 신설하지 않으므로 "출력 포맷 규약"(`spec/5-system/2-api-convention.md`)·"API 문서 규약"(`spec/conventions/swagger.md`) 관점은 해당 사항 없음(N/A) — 기존에 이미 확립된 `204 No Content`, `403 CANNOT_DELETE_PERSONAL` 등의 표기를 그대로 재인용할 뿐이다.

## 요약

가장 중요한 결함은 이 draft 가 **자신이 직접 수정하는 정식 규약 문서(`spec/conventions/secret-store.md`) 안에서 새로운 자기모순을 만든다**는 점이다 — `S7` 은 Rationale(§R4) 한 문장만 "모든 경로가 책임진다" 로 고치고, 같은 문서의 본문 두 곳(§2.1 호출 규약 표, §6 cascade 절)은 여전히 "Trigger 삭제" 단수 주어와 "workspace 삭제 시 이미 정리된다" 는, draft 자신의 실측이 반증한 문장을 그대로 남긴다. 이는 이 draft 가 스스로 지적한 결함 패턴(경로 하나만 주어로 삼아 나머지 경로가 계약 밖에 남는다)이 그 수정 대상 문서 안에서 그대로 재발하는 것이라 CRITICAL 로 판정한다. 그 외 명명 규약(파일명·frontmatter·상대링크·앵커)·마이그레이션 append-only 원칙·감사 액션 원칙 등은 모두 기존 규약과 정합적이었고, 이 draft 는 API 응답/에러코드/Swagger 데코레이터 표면을 건드리지 않아 해당 관점은 대체로 N/A 다.

## 위험도

HIGH
