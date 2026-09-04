# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-numeric-wire-convention.md`

## 검토 방법

target draft(`spec-draft-numeric-wire-convention.md`)가 제안하는 세 변경(① `1-data-model.md`
threshold 라벨 정정, ② `swagger.md` §1-6 신설, ③ `swagger.md` §3 JSDoc 공개 명시)을
`spec/conventions/swagger.md`(번들에 전문 포함, 디스크와 diff 0 확인) 및 CLAUDE.md 의 문서
구조·정보 저장 규약에 대조했다. 아울러 draft 가 인용하는 코드 사실(마이그레이션,
`statistics.service.ts`, `alert-rule-response.dto.ts`, `swagger-dto-contract-guard.ts`,
`nest-cli.json`, 출처 리뷰 라운드 `19_43_18`/`20_05_42`/`21_10_30`)을 저장소에서 직접
재확인했다 — 전부 실측과 일치했다.

## 발견사항

### [WARNING] 신설 규칙 2건이 `swagger.md` 자신의 `## Rationale` 과 짝지어지지 않음

- target 위치: draft §3 "변경안 (B) — `swagger.md` §1-6 신설", §4 "변경안 (C) — `swagger.md`
  §3 에 'JSDoc 은 공개된다' 한 문단"
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `결정의 배경·근거 | 해당 spec 문서 끝의
  ## Rationale`. 그리고 `spec/conventions/swagger.md` 자신이 이미 세워 둔 패턴 — §1-4(닫힌
  union), `discriminator` sound 성, §3 길이/캐비엇, §5 pass-through, §5-4 확장 배경처럼
  **비자명하거나 논쟁적인 결정**은 본문에 규칙만 적지 않고 문서 하단 `## Rationale` 에
  대응 절 + `> 근거: [...]` 역링크를 둔다.
- 상세: draft 가 제안하는 두 신설 규칙은 이 패턴에 해당하는 "비자명한 결정"이다 — 특히
  §1-6 은 "가드를 명시 변환 경로까지 넓히는 대안을 기각했다"는, 다른 사람이 반복해서
  물을 만한 설계 근거를 갖고 있다(draft 자체가 이를 "기각한 대안"으로 정리해 뒀다). 그런데
  이 근거는 **plan draft 문서**(→ 결국 `plan/complete/` 로 아카이브됨)에만 있고, `swagger.md`
  본문에 삽입될 §1-6/§3 문단에는 `> 근거: [...]` 역링크도, `swagger.md` 하단 Rationale 에
  대응 절도 계획돼 있지 않다. §1-6 본문 안에 "**둘 다 정당하다**" 한 줄 요약은 있지만, 이는
  §1-4 의 인라인 요약과 비슷한 수준이고 §1-4 가 **별도로** 갖고 있는 하단 Rationale 3절에
  대응하는 짝이 없다. 결과적으로 `swagger.md` 를 직접 읽는 다음 작성자는 "왜 이 경계가
  가드/규약으로 나뉘는가"를 알 방법이 문서 자체에는 없고, plan 아카이브를 다시 찾아야 한다.
- 제안: `2. 변경안 (B)`/`4. 변경안 (C)` 삽입 지시에 `swagger.md` 하단 `## Rationale` 추가
  절(예: "§1-6 numeric/decimal wire 타입 — 가드와 규약의 책임 분리")과 본문 쪽 `> 근거:
  [...]` 역링크를 함께 명시한다. draft 의 기존 "기각한 대안 — 가드를 명시 변환 경로까지
  넓히기" 문단을 그대로 옮기면 비용이 크지 않다. (또는: 의도적으로 §1-5 처럼 인라인
  근거만으로 충분하다고 판단했다면, 그 판단 자체를 draft `## Rationale` 에 한 줄 남겨 다음
  검토자가 같은 질문을 반복하지 않게 한다.)

### [INFO] 신규 인용 enforcement 파일이 `swagger.md` frontmatter `code:` 글롭 밖

- target 위치: draft §3 "변경안 (B)" 의 `> **가드**: ... swagger-dto-contract.spec.ts 의
  findNumericAsNumber 가 저장소 전역으로 강제한다"
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 — `code:` 필드 의미("본 spec 이
  약속한 surface 의 구현 경로")
- 상세: 실측 결과 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  는 `swagger.md` frontmatter 의 `code:` 4개 글롭
  (`common/swagger/**`/`nest-cli.json`/`production-guards.ts`/`main.ts`) 중 어느 것과도
  매칭되지 않는다(`repo-guards/__tests__/` 는 별도 디렉터리). §1-4/§5-4 Rationale 이 인용하는
  다른 파일(`api-wrapped.ts`, `RolesGuard`)은 이미 `common/swagger/**` 글롭에 포섭돼
  있었던 것과 달리, 이번 인용은 이 문서에서 **처음으로** `code:` 밖의 파일을 본문에서
  이름으로 지목하는 사례다. 다만 build guard(`spec-code-paths.test.ts`)는 "글롭 중 하나 이상이
  실재 파일에 매칭"만 요구하고 완전성은 강제하지 않으므로 차단 사유는 아니다.
- 제안: `swagger.md` frontmatter `code:` 에
  `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 항목 추가를 검토.
  선택적 — 필수 아님.

## 검증 완료 항목 (참고 — 위반 아님)

아래는 draft 가 정확히 규약·현실을 반영하고 있음을 확인한 항목이다(오탐 방지용 기록):

- 파일명 `plan/in-progress/spec-draft-numeric-wire-convention.md` — `project-planner`
  SKILL.md §"draft 작성"의 `spec-draft-<name>.md` 명명과 정확히 일치.
- frontmatter 3필수 필드(`worktree`/`started`/`owner`) + 허용 선택 필드(`title`/`status`/
  `priority`) 모두 `plan-lifecycle.md` §4 스키마 부합. `spec_impact` 는 bare string 이나 빈
  배열이 아니라 **경로 리스트**로 Gate C 형식 준수.
- 삽입 위치 지시("1-5 다음, `## 2) Controller 패턴` 앞", "§3 길이 표 바로 뒤, 캐비엇 앞")가
  실제 `swagger.md` 구조와 라인 단위로 일치(디스크 대조 완료).
- 신설 `### 1-6.` 넘버링이 기존 `1-1`~`1-5` 연속성과 일치. §3 삽입은 §3 자체가 넘버링 없는
  볼드 타이틀 문단 스타일이라 그 로컬 관례를 그대로 따름(볼드 제목 + "(YYYY-MM-DD 규약화)"
  패턴까지 기존 §3 문단들과 동형).
- `@ApiProperty({ type: String, ... })` 표기는 swagger.md §2-3 기존 예시(`type: String`,
  `type: Number`)와 저장소 실 코드(`alert-rule-response.dto.ts`)에 이미 쓰이고 있는 패턴과
  일치 — 신규 관용구 아님.
- 마크다운 앵커 `#1-6-numericdecimal-컬럼의-wire-타입`, 상대경로
  `./conventions/swagger.md#...`(from `spec/1-data-model.md`)는 문서 내 기존 교차참조
  방식(`#discriminator-는-판별자가-sound-할-때만-1-4` 등)과 동형 슬러그 규칙을 따름.
- 인용된 출처(`19_43_18` INFO#6, `20_05_42` W2, `21_10_30` INFO#3)를 해당 리뷰 라운드
  원문에서 직접 대조 — 문구·번호 모두 정확히 일치(허구 인용 아님).
- 코드 사실 전수 재확인: 마이그레이션 `NUMERIC(12,4)`/`NUMERIC(12,6)`, `statistics.service.ts`
  라인 346/376/430/457 의 `::float`+`Number()`, `alert-rule-response.dto.ts` 의
  JSDoc/`//` 분리 실례, `findNumericAsNumber` 의 `<Entity>Dto` 이름 관례 의존(코드 361-ish
  `dto.replace(/Dto$/, '')`), `nest-cli.json` 의 `introspectComments: true` — 전부 draft 서술과
  일치.
- `1-data-model.md` 의 "타입" 컬럼은 어떤 코드젠·frontmatter 가드도 소비하지 않는 순수
  프레젠테이션 표(`1-data-model.md` 는 spec-impl-evidence `EXCLUDE_BASENAMES`)라, `Float` →
  `Numeric(12,4)` 라벨 정정이 다른 시스템의 invariant 를 깨지 않음.
- `rerank_score_threshold` 를 건드리지 않기로 한 오탐 배제 판단도 실측(`DOUBLE PRECISION`)과
  일치.

## 요약

target draft 는 파일 명명·frontmatter 스키마·본문 삽입 위치·섹션 번호 부여·마크다운
앵커·인용 근거 전부를 `spec/conventions/swagger.md` 및 `.claude/docs/plan-lifecycle.md` ·
`project-planner` SKILL.md 규약에 정확히 맞춰 작성됐고, 딸린 모든 코드·출처 인용을
저장소에서 재확인한 결과 사실과 어긋나는 곳이 없었다. 유일한 구조적 아쉬움은 신설되는
두 규칙(§1-6, §3 JSDoc 문단)의 설계 근거("가드 대신 규약이 명시 변환 갈래를 담당하는
이유")가 `swagger.md` 자신의 `## Rationale` 에는 반영되지 않고 plan draft 에만 남는다는
점이며, 이는 CLAUDE.md 의 정보 저장 위치 규약 및 `swagger.md` 자체가 이미 세운
Rationale-짝짓기 패턴과 결이 다르다(WARNING). `code:` frontmatter 완전성 이슈는 build
guard 가 요구하지 않는 선택 사항(INFO)이다. 두 항목 모두 채택 시 다른 시스템의
invariant 를 깨지는 않는다.

## 위험도

LOW
