# 신규 식별자 충돌 검토 — spec-draft-swagger-http-status-guard.md

## 검토 범위

target 은 `plan/in-progress/spec-draft-swagger-http-status-guard.md` (spec draft, `--spec` 모드). 이 draft 가
새로 도입하는 식별자는 사실상 다음 넷뿐이다 — (1) 저장소 가드 이름 `http-status-advertised` 및 그 frontmatter
`code:` glob 2줄, (2) `spec/conventions/swagger.md` §2-4 아래 새 규칙 문단, (3) §5-4 체크리스트 새 항목 1줄과
그 안의 상대 앵커 링크 `#2-4-상태-코드-응답-규칙`, (4) `## Rationale` 끝의 새 소제목
`§2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가 (2026-09-26)`. 새 요구사항 ID, 새 API endpoint,
새 이벤트/메시지명, 새 ENV var 는 없다.

## 발견사항

없음.

- **가드 이름 `http-status-advertised`** — 직전 라운드(`review/consistency/2026/09/26/09_10_09/naming_collision.md`)가
  이미 `find codebase/backend/src -iname "*http-status-advertised*"` 로 0건을 확인했고, 본 라운드에서도
  동일 명령으로 재확인했다(여전히 0건 — `codebase/backend/src/repo-guards/__tests__/` 기존 24개 가드 중
  `http-status`/`advertised` 를 포함하는 것은 없다). target 은 그 이름을 `swagger.md` frontmatter `code:`
  에 등재만 할 뿐 새로 짓지 않는다 — 구현 plan(`post-status-openapi.md` §요구 1)이 이미 같은 이름으로
  선언했고, glob(`http-status-advertised*.ts`)과 fixtures 경로(`fixtures/http-status-advertised/**`)가
  두 문서에서 byte 단위로 일치한다.
- **frontmatter `code:` 삽입 위치** — `param-uuid-pipe*.ts` 두 줄 바로 아래에 넣는 배치는 기존 관례(각 세부
  규칙 가드를 그 축 이름 주석과 함께 순서대로 나열)와 형식이 같다. 새 주석("§2-4 의 광고한 성공 코드 ↔
  실제 성공 코드 … 짝을 세는 가드와 그 대조군")은 바로 위 param-uuid-pipe 주석과 동일한 서술 패턴이라
  충돌이 아니라 일관성 유지다.
- **`api-convention.md` 미등재** — target 은 W1 처분에서 `swagger.md` 에만 등재하고
  `spec/5-system/2-api-convention.md` 는 기각한다고 적는다. 실제로 `api-convention.md` frontmatter `code:`
  를 확인한 결과 `http-status-advertised` 관련 glob 이 전혀 없어(위 grep), target 의 "등재 안 함" 결정과
  현재 상태가 일치한다 — 두 문서에 같은 가드가 중복 등재되는 충돌은 없다.
- **`spec-draft-swagger-http-status-guard.md` 파일명** — `find plan -iname "*swagger*"` 로 기존 파일들
  (`plan/complete/swagger-double-wrap-fix.md` · `swagger-decisions.md` ·
  `plan/complete/spec-draft-swagger-401-drift.md` · `swagger-pagination-followups.md` ·
  `spec-fix-swagger-forbidden-response.md`)과 대조했다. `spec-draft-swagger-<topic>.md` 명명 패턴은
  `spec-draft-swagger-401-drift.md` 선례와 형태가 같고, 대상(http-status-guard)이 겹치지 않아 파일명
  충돌이 없다.
- **Rationale 소제목 `§2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가 (2026-09-26)`** —
  `grep -rn "광고한 성공 코드" spec/` 결과 0건(target 반영 전 기준)이라 기존 Rationale 항목과 제목이
  겹치지 않는다. 날짜 접미 표기(`(2026-09-26)`)도 `§5-4 확장 배경 … (2026-08-08)` · `§0 … (refactor 04 M-1)`
  등 기존 Rationale 소제목 명명 관례와 형식이 같다.
- **§5-4 체크리스트 앵커 `[§2-4](#2-4-상태-코드-응답-규칙)`** — `swagger.md` 안에 `#2-4-` 로 시작하는
  기존 내부 링크는 없어(grep 0건) 이 앵커는 새로 생기는 것이지만, heading `### 2-4. 상태 코드 응답 규칙`
  으로부터 GitHub 방식 슬러그를 정확히 도출한 형태라 다른 heading 과 슬러그가 겹치지 않는다(같은 문서에
  `2-4` 로 시작하는 다른 heading 없음).

## 요약

target 이 새로 들여오는 유일한 실질 식별자는 저장소 가드 이름 `http-status-advertised` 이며, 이는 이미
직전 `--impl-prep` 라운드에서 전수 `find` 로 충돌 0건이 확인된 이름을 그대로 재사용해 `swagger.md`
`code:` 에 등재하는 것뿐이다. 새 문단·체크리스트 항목·Rationale 소제목은 모두 텍스트 삽입이며 기존 절
번호·앵커·명명 관례와 형식이 일치하고, 동일 문구 재사용도 없다. `api-convention.md` 에는 의도적으로
등재하지 않기로 했고 실제로도 그쪽 `code:` 에 해당 glob 이 없어 이중 등재 충돌도 없다. 새 요구사항 ID·
API endpoint·이벤트명·ENV var 발급이 전혀 없어 이 관점에서 이 draft 를 막을 사안이 없다.

## 위험도

NONE
