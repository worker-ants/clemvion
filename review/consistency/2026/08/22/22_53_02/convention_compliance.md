# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-swagger-401-drift.md`

검토 모드: `--spec` (spec draft 검토)

> 검토 방법: 프롬프트에 번들된 `spec/conventions/error-codes.md`·`spec/conventions/swagger.md`·
> `spec/conventions/audit-actions.md` 는 전문 확인. 그 외 `spec/conventions/**` (특히
> `cafe24-*` 대량 카탈로그)는 "컨텍스트 예산 초과"로 절단돼 있었으나 본 target 문서와 직접
> 연관이 없어 영향 없음. target 문서가 인용하는 실측 주장(코드 라인 번호·문자 수·grep 건수)은
> 저장소 원본을 직접 `Read`/`grep`/문자열 길이 계산으로 전수 재현·대조했다.

## 발견사항

### [WARNING] §3 예외 확장이 swagger.md 자신의 "본문=규칙 / `## Rationale`=근거" 분리 관행에서 벗어난 기존 이탈을 그대로 답습한다

- target 위치: target 문서 ② "제안 — 예외 문면을 **양방향**으로 넓힌다" (라인 100–115)
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  + `spec/conventions/swagger.md` 자신이 세운 선례(§0/§1-4/§5/§5-4 전부 본문에는 규칙만 두고
  `## Rationale`에 대응 서브섹션 "### §0 …"/"### §1-4 …"/"### §5 …"/"### §5-4 …"으로 "왜"를 분리)
- 상세: swagger.md의 다른 다섯 개 결정(§0 Swagger UI 비노출, §1-4 닫힌 union, discriminator
  sound 조건, EIA context 열린 map, §5 single-wrap, §5-4 `@WorkspaceId()` 확대)은 모두 본문에는
  규칙만 적고 `## Rationale`에 대응 subsection을 둬 "왜"를 분리한다. 그런데 §3의 응답-필드
  길이-예외(2026-08-17 규약화)만 이 이중 구조를 따르지 않고, 근거("소비자가 OpenAPI 만 보고
  통합할 때 알 방법이 그 설명뿐" + "실측상 9곳 이상의 DTO 가 이미 이 형태")를 전부 본문
  blockquote 안에 욱여넣었다 — `## Rationale`에 "§3" 항목이 없다(전문 확인 결과 §0/§1-4×3/§5/§5-4
  6개 subsection 중 §3 없음). target 문서는 정확히 이 §3 예외를 확장하는 편집을 제안하는데,
  제안 diff 역시 같은 인라인-전용 패턴을 그대로 이어받아 새 실측(요청 DTO 34% 초과, 상위 사례
  등)까지 본문 blockquote 에 계속 추가한다 — `## Rationale`에 대응 subsection을 신설할 자연스러운
  기회였으나 target 문서는 이 gap 자체를 인지·언급하지 않는다.
- 제안: 제안 diff에 `## Rationale`쪽 "### §3 보안·정책 캐비엇 예외 — 양방향 확장 (2026-08-22)"
  서브섹션을 추가해 상세 근거(9곳 실측·요청측 34%/114개 실측·왜 양방향 대칭인지)를 그쪽으로
  옮기고, 본문 blockquote는 규칙 표 + 1~2문장 요약만 남기는 편이 이 문서 자신의 확립된
  컨벤션과 일치한다. 만약 의도적으로 "§3은 원래도 이 이중구조 밖이었고 이번에도 그대로
  둔다"는 결정이면 그 사실을 target 문서에 한 줄 명시하는 것도 대안.

### [INFO] 제안 diff 코드펜스가 동일 문서군(`spec-draft-*.md`)의 확립된 `diff` 언어 태그 관행과 다르다

- target 위치: 라인 41, 80 (` ```text `)
- 위반 규약: `spec/conventions/**`에 명문 규정은 없음 — 다만 같은 `plan/**` 문서 클래스의
  선례가 예외 없이 일관된다: `plan/complete/spec-draft-auth-invariants-sync.md`(6곳)·
  `spec-draft-eia-r8-alignment.md`(5곳)·`spec-draft-node-cancellation-chat-channel-correction.md`
  (4곳) 전부 ` ```diff ` 펜스를 쓴다. `git grep` 전수 확인 결과 이 문서만 ` ```text `.
- 상세: 렌더링 오류나 기능적 문제는 없으나(순수 스타일), "spec 드리프트 제안 diff"라는 동일
  성격의 블록에 이 문서군 전체가 일관되게 `diff` 하이라이팅을 쓰는 관행이 있다.
- 제안: ` ```text ` → ` ```diff ` 로 통일 (두 곳 모두).

### [INFO] "요청 DTO 파일 73개 · description 333개" 집계의 재현 방법이 명시되지 않음

- target 위치: ② "이것도 '이미 굳은 관행의 추인' 이다 (실측)" 표 (라인 89–94)
- 위반 규약: 직접적인 `spec/conventions/**` 조항은 없으나, 이 저장소 자신의
  `.claude/docs/plan-lifecycle.md §4`("`pending_plans` 카운트" 각주)가 이런 집계치에는
  "재현 방법을 함께 적는다 — 수치만 적으면 세는 방법이 갈린다"는 선례를 세웠다(그 문서 스스로
  겪은 재계산 오류 사례가 근거).
- 상세: 실측 대조 결과 개별 필드 값은 **전부 정확히 일치**했다 — `re-run.dto.ts` 3필드
  59·129·174자(코드 원문 문자열 길이 계산으로 재현), `create-auth-config.dto.ts` `config` 필드
  248자, `chat-channel-config.dto.ts` `inboundSigningPlaintext` 386자 및 `languageHints`(최장) 435자
  전부 grep 없이 원문 문자열 길이 계산으로 재현됨. 신뢰도는 높다. 다만 "요청 DTO 파일 73개 ·
  description 333개"는 어떤 폴더/패턴을 "요청 DTO"로 집계했는지(응답 DTO 제외는 명확하나
  `*.literal.ts`·쿼리 DTO 포함 여부 등) 문서에 없어, 별도 기준(`find src -iname '*.dto.ts' |
  grep -v /responses/`)으로 재현하면 77개 파일·424개 `description:` 로 다른 숫자가 나온다 —
  방법론 자체가 틀렸다기보다 기준이 다를 뿐일 가능성이 높다(개별 필드 값이 100% 일치하므로).
- 제안: 집계 기준(대상 디렉토리 패턴, `description:` 카운트인지 JSDoc 포함인지)을 표 옆에
  한 줄 부기.

## 그 외 검토 결과 — 위반 없음 확인 (교차검증 완료)

- **① 401 코드명 정정**: `AUTH_REQUIRED`가 `error-codes.md` 원칙(§1 의미 기반 명명)에 부합하는
  기존 표준 카탈로그 코드임을 `2-api-convention.md:171`·`3-error-handling.md:42`·
  `http-exception.filter.ts:145` 세 곳 모두에서 정확한 라인 번호까지 재현·확인. "계약 변경이
  아니므로 §5(Rename 이력) 대상이 아니다"라는 target의 분류 판단도 §2(rename 정책)의 적용
  범위(실제 코드/wire 값 변경)와 정확히 일치 — 오분류 없음. "spec 전역에서 `UNAUTHORIZED`는
  정확히 2곳, 둘 다 이 파일"이라는 자매 전수 확인 주장도 `grep -rn "UNAUTHORIZED" spec/`로
  재현해 정확히 일치(다른 17개 `5-system/*.md` 문서 오염 없음).
- **② 양방향 확장 근거**: `ReRunRequestDto.inputOverride`의 실제 JSDoc이 이미 target이 인용한
  문구("마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED`로 거부. SoT: EIA
  §R17")를 코드 그대로 담고 있어 "실무가 이미 이 형태" 주장이 사실과 일치. `MASKED_VALUE_RESUBMITTED`
  가 `error-codes.md §4.2`가 정의하는 정규화 후 public 코드와 정확히 일치하고, "SoT: EIA §R17"도
  같은 §4.2 표의 "정의 SoT" 열과 일치 — 명명 규약 위반 없음.
- **기본 수치 규칙(10~40자) 재검토를 이번 편집 범위에서 제외**하고 트래커에 별도 항목으로
  등재하겠다는 스코프 절제는 `spec/conventions/` 편집 시 요구되는 최소 변경 원칙에 부합.
- **frontmatter**: `worktree`/`started`/`owner` 3필드(top-level `plan/in-progress/*.md` 필수
  스키마, `.claude/docs/plan-lifecycle.md §4`) 모두 존재. `spec_impact`가 YAML 리스트(2건,
  실재 경로)로 선언돼 있어 Gate C 형식과도 무관하게(완료 시점 강제이나 미리 선언은 문제 없음)
  정상.
- **테이블-in-blockquote 포맷**(제안 diff의 부류/설명 표): `4-execution-engine.md:1080-1085`에
  동일 패턴(`> | 진입점 | nodeId 검사 | 이유 |`) 선례가 있어 이 저장소 spec 문서군에서
  이례적이지 않음.
- `MASKED_VALUE_RESUBMITTED`류 코드 표기(`UPPER_SNAKE_CASE`), 도메인 접두 없는 공용 코드 취급
  등 명명 표기 규약 위반 없음.

## 요약

target 문서(`spec-draft-swagger-401-drift.md`)는 두 건의 spec 드리프트 수정 제안 모두
`spec/conventions/error-codes.md`·`spec/conventions/swagger.md`의 명명·안정성·예외 도입 원칙을
정확히 이해하고 적용하고 있으며, 인용된 실측 주장(코드 라인 번호·문자 수·grep 건수)을 전수
재현한 결과 전부 정확했다 — 특히 "rename이 아니라 오기 정정"이라는 §2 정책의 미묘한 적용
판단과, "요청 필드도 같은 논거가 대칭적으로 성립한다"는 §3 예외 확장 논증 모두 conventions의
취지에 부합한다. 다만 (1) §3 확장 제안이 swagger.md 자신이 다른 5개 결정에서 지키는
"본문=규칙 / `## Rationale`=근거" 이중 구조에서 벗어난 기존 이탈을 그대로 답습하고 있고,
(2) 제안 diff의 코드펜스 언어 태그가 동일 문서군 선례(`diff`)와 다르며, (3) 핵심 집계치
하나의 카운트 방법론이 재현 가능하게 적혀 있지 않다 — 세 건 모두 착수를 막을 정도는 아닌
경미한 사항이다.

## 위험도

LOW
