# 정식 규약 준수 검토 — `spec/5-system/` (`--impl-prep`)

검토 범위: 번들에 전문 포함된 `spec/5-system/1-auth.md` · `2-api-convention.md` ·
`3-error-handling.md` (나머지 `spec/5-system/*`, 대부분의 `spec/conventions/*` 는 컨텍스트 예산
초과로 스텁 — 필요한 부분은 저장소에서 직접 `Read` 하여 대조: `spec/conventions/error-codes.md` ·
`node-output.md` · `swagger.md` · `secret-store.md` · `review-citations.md` 전문 확인).

## 발견사항

- **[INFO]** bare `hh_mm_ss` 리뷰 인용 — `review-citations.md` §2 위반 (grandfathered)
  - target 위치: `spec/5-system/1-auth.md` L545 `> 출처: \`#1245\` 의 \`--impl-done\`(\`21_59_41\`) cross_spec 이 찾은 기존 불일치.` · `spec/5-system/3-error-handling.md` L598 `> 두 항목 다 \`#1247\` 작업 중 \`--spec\`(\`10_46_44\`) cross_spec 이 인접해서 찾아 범위 밖으로 등재해 뒀던 건이다.`
  - 위반 규약: `spec/conventions/review-citations.md` §2 ("bare `hh_mm_ss` 는 쓰지 않는다 — 날짜가 없으면 해소 불가", 판정표의 "금지" 행) · 적용 범위는 §3 표가 `spec/**` 문서를 명시적으로 포함
  - 상세: 두 인용 모두 PR 번호(`#1245`/`#1247`)와 세션 시각만 있고 **날짜가 없다**. review-citations.md 는 이런 형태를 실측(2026-09-05)으로 이미 `spec/**` 36건 중 다수로 집계해 두었고, 같은 문서 §4 가 "기존 bare 인용은 소급 정리 대상이 아니다 — 다음에 그 자리를 건드릴 때 함께 맞춘다"고 grandfather 조항을 두고 있어 **차단 사유는 아니다**. 다만 바로 인접한 L565 의 동일 성격 인용(`review/consistency/2026/07/28/17_21_27`)은 전체 경로로 이미 규약을 지키고 있어, 같은 문서 안에서 두 형태가 혼재한다.
  - 제안: 규약이 명시한 대로 이번 배치가 아니어도 **다음에 해당 Rationale 블록을 건드리는 사람이** `#1245`/`#1247` 커밋 시각으로 날짜를 특정해 `YYYY-MM-DD HH_MM_SS` 또는 전체 `review/**` 경로로 승격. 지금 당장 별도 PR 로 소급 수정할 필요는 없음(§4 명시).

- **[INFO]** `## Overview` 헤딩 표기가 인접 문서와 불일치
  - target 위치: `spec/5-system/1-auth.md` L27 `## Overview` · `spec/5-system/3-error-handling.md` L19 `## Overview`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` 를 canonical 헤딩으로 명시 (CLAUDE.md 가 이 SKILL.md 를 문서 구조 규약의 SoT 로 참조)
  - 상세: `spec/5-system/` 안에서 `2-api-convention.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md` 는 모두 `## Overview (제품 정의)` 를 쓰는데, `1-auth.md`·`3-error-handling.md`·`4-execution-engine.md` 세 파일만 괄호 없는 `## Overview` 다. "3섹션 권장" 은 강제(hard rule)가 아니고 툴링이 헤딩 문자열을 정확 매칭으로 파싱하는 지점도 확인되지 않아(SKILL.md·doc-sync 스크립트에 해당 문자열 의존 없음) 기능적 영향은 없다.
  - 제안: 사소한 표기 통일 — 다음에 이 두 파일의 Overview 섹션을 편집할 때 `## Overview (제품 정의)` 로 맞추면 폴더 내 일관성이 회복됨. 강제 수정 요구 아님.

- **[INFO]** `2-api-convention.md §5.4` 의 Swagger 규약 앵커가 실제 근거 절보다 한 단계 앞을 가리킴
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언이 wire 를 반영해야 한다 ([Swagger 규약 §1-3](../conventions/swagger.md#1-3-optional-필드))"
  - 위반 규약: 규약 위반이라기보다 **상호 인용 정합성** 이슈 — `spec/conventions/swagger.md` §1-4 자신은 "부재 표현 판정과 선언 형태의 SoT: [API 규약 §5.4]"라고 역방향 링크를 걸어 두어 §5.4 를 SoT 로 인정하는데, 정작 §5.4 가 그 대칭 근거로 인용하는 절은 §1-3(단순 optional 필드 예시)이다.
  - 상세: `null` vs 키-생략에 따른 `@ApiPropertyOptional()`/`@ApiProperty({nullable:true})` 선택 이유와 예시(`context: ButtonsContextDto | NodeOutputContextDto | null` 콜아웃 "왜 `@ApiPropertyOptional` 이 아니라 `@ApiProperty({ nullable: true })` 인가")는 swagger.md **§1-4**(닫힌 union 절)에 있고, §1-3 은 일반 optional 필드 예시만 보여준다. 앵커 자체는 정확히 그 heading 에 착지하므로 "깨진 링크"는 아니며, 순수 텍스트 근거 정밀도 문제.
  - 제안: `2-api-convention.md §5.4` 의 인용을 `swagger.md#1-4-nested--enum--union` (또는 §1-3·§1-4 병기)로 갱신하면 상호 참조가 서로를 정확히 가리키게 됨.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 문서는 `spec/conventions/`
(특히 `error-codes.md`·`node-output.md`·`swagger.md`·`audit-actions.md`·`secret-store.md`)와의 명명·출력
포맷·문서 구조·API 문서화 규약을 매우 높은 밀도로 준수한다. 에러 코드는 `UPPER_SNAKE_CASE` 원칙과
historical-artifact 예외 레지스트리(초대 흐름 lowercase 코드 등)를 정확히 상호 인용하며, 감사 액션
명명은 `audit-actions.md` §3 레지스트리와 1:1 로 일치하고, 응답 포맷(`{data}`/`{data,pagination}`/
`{data:{items}}`)·부재 표현(`null` vs 키 생략) 규칙도 `swagger.md`·자기 문서의 §5.4 사이에서 상호
정합적이다(다수의 과거 라운드가 이미 이 정합성을 반복 검증한 흔적이 Rationale 전반에 남아 있음).
발견된 사항은 전부 INFO 등급으로, (1) `review-citations.md` §2 를 위반하는 bare 시각 인용 2건(같은
규약 §4 grandfather 조항 대상이라 비차단), (2) 폴더 내 `## Overview` 헤딩 표기 불일치, (3) §5.4↔
swagger.md 상호 인용의 절 번호 정밀도 1건이다. 정식 규약을 깨뜨려 다른 시스템의 invariant 를
위협하는 CRITICAL 급 위반이나, 규약 자체의 재검토가 필요한 WARNING 급 괴리는 발견되지 않았다.

## 위험도

LOW
