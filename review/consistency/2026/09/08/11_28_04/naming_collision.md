# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 방법

프롬프트 코퍼스가 예산 초과로 대부분 생략되어 있어, target 이 실제로 새로 도입하는
식별자(신규 섹션 번호, 신규 테이블 행, 신규 anchor, 신규 `code:` glob)를 항목별로 추출한 뒤
해당 SoT 파일을 직접 `Read`/`grep` 하여 대조했다. 대상: `CLAUDE.md`,
`.claude/skills/{developer,project-planner}/SKILL.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`, `spec/1-data-model.md`,
`spec/2-navigation/2-trigger-list.md`, `spec/5-system/15-chat-channel.md`,
`codebase/backend/src/{repo-guards/__tests__,shared/testing}/`.

## 항목별 대조 결과

- **A-1 (`.claude/**` 권한 행)** — `CLAUDE.md` Skill 표, `developer/SKILL.md`·
  `project-planner/SKILL.md` 「경로별 권한」 표 어디에도 현재 `.claude/**` 행이 없음을 직접
  확인(실측 grep). target 이 추가하는 두 축(`developer`→`hooks/`·`tools/`·`tests/`,
  `project-planner`→`docs/`·`skills/**/SKILL.md`·`CLAUDE.md`)은 **서로 겹치지 않는 disjoint
  path set** 이고, 기존 `spec/**`·`codebase/**`·`plan/**`·`review/**` 행과도 경로가 겹치지
  않는다. 충돌 없음.
- **A-2-1 (R-2 anchor 변경)** — 제목에 `— 폐기` 를 붙이면 slug 가 바뀐다는 target 의 지적은
  맞다. 재실측(`grep -rn "r-2-webhook-hmac-secret" spec/ codebase/ plan/ .claude/`): 현재
  `spec/` 안의 인입은 `15-chat-channel.md:610` **1건**뿐이며, 이는 target 이 스스로 적은
  실측치와 일치한다(코드베이스·`.claude/` 에는 인입 없음). 앵커 변경으로 새로 발생하는
  깨진 링크는 target 이 이미 동반 갱신하는 그 1건 외에는 없다.
- **A-3 (`TRIGGER_ENDPOINT_PATH_CONFLICT` 카탈로그 등재, `3-error-handling.md §1.10`)** —
  `3-error-handling.md` 실측: 현재 최대 절 번호는 `### 1.9`(위 220행)이고 `### 1.10` 은
  존재하지 않는다 — 번호 충돌 없음. `TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열은 이미
  `2-trigger-list.md:94,164` 와 `triggers.controller.ts`/`triggers.service.ts`/
  `triggers.service.spec.ts` 에 **동일한 의미**(409 `RESOURCE_CONFLICT` 의 `details.code`)로
  일관되게 쓰이고 있다 — target 은 새 의미를 만드는 것이 아니라 이미 실재하는 값을 공용
  카탈로그에 옮겨 적는 것이다. 충돌 없음.
- **A-4 (§5.4 검증 층 4행 + `code:` glob 2줄)** — `2-api-convention.md` 의 §5.4 는
  "부재 표현 — `null` vs 키 생략" 이고 그 하위 `#### 검증 층 …` 서브섹션이 이미 존재함을
  확인(224행) — target 이 가리키는 절은 실재한다. `swagger.md:371` 의 "두 검증자의 경계는 …"
  문구도 실재해 정정 대상이 정확하다. glob `user-entity-exposure*.ts` /
  `user-secret-absence*.ts` 를 `find` 로 재현한 결과 정확히 의도한 2파일씩만 매치되고
  (`user-entity-exposure-guard.ts`+`.spec.ts`, `user-secret-absence.ts`+`.spec.ts`) 다른
  무관한 파일을 끌어들이지 않는다 — glob 충돌 없음. 두 파일 경로는 어떤 spec 의 기존
  `code:` 리스트에도 등장하지 않음(grep 0건) — 새 등재이지 기존 등재와의 중복이 아니다.
- **A-5 (`1-data-model.md §2.1` 규범 블록 + Rationale)** — `§2.1 User` 는 기존 섹션(54행)이라
  절 번호 신설이 아니라 기존 절에 내용을 추가하는 것. 새로 붙는 Rationale 헤딩
  *"`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계로 둔 이유 (2026-09-06)"* 는
  `## Rationale` 하위 기존 5개 헤딩(Schedule 인덱스·alert_rule·WorkflowVersion.snapshot·
  execution_path·install_token)과 겹치지 않는 고유 제목.
- **A-6 (정정 콜아웃 삽입)** — 기존 문장을 취소선 처리하고 정정 블록만 추가하는 것으로,
  신규 식별자를 도입하지 않는다.
- **plan 파일 경로/라벨** — `plan/in-progress/spec-draft-followups-batch-a.md` 자체(target)는
  기존 `spec-draft-*` 명명 컨벤션을 따르고 디렉터리에 동명 파일 없음(정상). target 이 쓰는
  `A-1`~`A-6` 항목 라벨은 자매 트래커(`spec-draft-nullable-notation-followups.md`)가 쓰는
  `①②③` 심볼 체계와 형태가 달라 서로 오인될 우려 없음(자매 트래커에 `A-`, `## A-` 패턴 매치
  0건 확인).

## 종합

target 문서는 대부분 **이미 코드/타 spec 에 존재하는 식별자**(값·파일 경로·엔드포인트·
에러 코드)를 문서 SoT 에 등재하거나 오기(誤記)를 정정하는 성격이고, 완전히 새로 발명하는
식별자는 문서 내부 헤딩(§1.10, 신규 Rationale 제목, 신규 표 행) 정도다. 위 항목별 실측
대조에서 기존 사용처와 의미가 다른 동일 식별자, 겹치는 API endpoint/이벤트명/ENV·config
key, 명명 컨벤션을 깨는 파일 경로는 발견되지 않았다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 미발견 — 위 "종합" 참조).

## 요약

target 이 새로 등재하는 식별자(신규 섹션 §1.10, 신규 Skill 권한표 행, 신규 `code:` glob
2쌍, R-2 anchor 변경에 따른 slug)를 모두 추출해 관련 SoT 파일을 직접 열어 대조한 결과,
기존에 다른 의미로 쓰이는 동일 식별자와의 충돌, glob 이 의도치 않은 파일을 추가로
포섭하는 경우, 앵커 변경으로 인한 미처리 인입 링크는 발견되지 않았다. 문서 대부분이
이미 코드/타 spec 에 실재하는 식별자를 재등재·정정하는 성격이라 애초에 신규 식별자
충돌 표면이 좁다.

## 위험도

NONE
