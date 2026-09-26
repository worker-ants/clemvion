# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-ed-ai-19-status.md`

## 검토 개요

target 은 `plan/in-progress/spec-draft-ed-ai-19-status.md` (spec draft, `--spec` 모드). 실제
변경 대상은 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행에 미구현 표기를
추가하는 한 줄 편집안이다. `spec/conventions/**` 전체(카탈로그 계열 제외 22개 실질 규약 문서 +
CLAUDE.md/SKILL.md 의 plan 명명·구조 규정)를 기준으로 아래 다섯 관점을 점검했다.

## 발견사항

이번 target 에서 CRITICAL/WARNING 급 규약 위반은 발견되지 않았다. 확인한 근거는 다음과 같다.

- **plan 파일 명명·frontmatter**: `plan/in-progress/spec-draft-<name>.md` 패턴(`project-planner`
  SKILL.md §draft 작성)을 정확히 따른다(`spec-draft-ed-ai-19-status.md`). frontmatter 의
  `worktree`(`assistant-e2e-contract-gaps`, 실제 gitStatus 브랜치와 일치) · `started`(ISO
  `2026-09-26`) · `owner`(`project-planner`) 3필드가 `plan-frontmatter.test.ts` 의무 스키마를
  충족한다(`.claude/docs/plan-lifecycle.md §4`). `spec_impact` 는 in-progress 단계에서는 의무가
  아니지만 실재 spec 경로(`spec/3-workflow-editor/_product-overview.md`, 확인됨) 목록으로 미리
  채워져 있어 Gate C(`spec-plan-completion.test.ts`) 요건과도 이미 정합적이다.
- **`spec-impl-evidence.md` 적용 여부**: 편집 대상 `_product-overview.md` 는 basename `_*.md`
  로 §1 의 frontmatter 의무 제외 목록에 명시적으로 등재돼 있다(예시로 직접 언급됨). 따라서 이
  draft 가 `_product-overview.md` 의 frontmatter 를 건드리지 않는 것은 위반이 아니라 규약이
  요구하는 대로다.
- **`4-ai-assistant.md` 상태 승격 보류 판단**: draft 는 `4-ai-assistant.md` frontmatter
  `status: implemented → partial` 전환을 **의도적으로 하지 않는다**고 명시하고, 이유로
  "§7·§10·§12.2 세 곳의 (계획) 표기가 있어 `pending_plans:` 를 함께 세워야 한다"를 든다. 이는
  `spec-impl-evidence.md` §3 라이프사이클 표(`partial` 은 `pending_plans:` 의무)와
  `spec-status-lifecycle.test.ts` 의 "partial 의 pending_plans 미작성" 가드를 정확히 읽은
  판단이다 — 성급한 상태 플립으로 가드를 깨뜨리는 대신 `--impl-prep WARNING 3` 트래커로 미루는
  선택이 오히려 규약 준수 방향이다.
- **미구현 표기 형식·앵커**: 제안한 표기 `_(미구현 — 계획, [§4-ai-assistant §12.2](...))_` 는
  같은 문서 안의 유일한 선례인 ED-DB-05 행(`_(미구현 — 로드맵, [§3-execution §6](...))_`)의
  링크 텍스트·이탤릭 감싸기 패턴을 그대로 따른다. "계획" 이라는 단어 선택도 `4-ai-assistant.md`
  §12.2 자신이 이미 쓰는 "(계획)" 표기와 일치해 문서 간 어휘가 어긋나지 않는다. 앵커
  `122-실행디버깅` 은 대상 헤딩 `### 12.2 실행/디버깅`(`4-ai-assistant.md:714`, 문서 내 유일
  출현)에 대해 `spec-link-integrity.test.ts` 가 요구하는 렌더러 동등 슬러그
  (github-slugger: 마침표·슬래시 제거 → 공백을 하이픈으로) 규칙과 실제로 일치함을 직접
  계산·확인했다.
- **`review-citations.md` 비대상**: target 은 `plan/**` 문서이므로 이 규약의 적용 범위표에서
  명시적으로 **제외**된다("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을
  담는다"). draft 안의 `review/consistency/2026/09/26/16_14_14` 인용은 규약 대상은 아니지만
  이미 권장 형식(전체 경로)이라 문제가 없다.
- **범위 외 관점**: 명명 규약(파일·API endpoint)·출력 포맷 규약(API 응답/이벤트 페이로드/에러
  코드)·API 문서 규약(OpenAPI/Swagger 데코레이터)은 이 draft 가 코드·API 표면을 전혀 건드리지
  않으므로 해당 사항이 없다. draft 가 인용하는 기존 식별자 `ASSISTANT_WORKFLOW_RUNNING` 은
  이 draft 가 새로 만든 것이 아니라 `4-ai-assistant.md` 가 이미 갖고 있던 (계획) 표기를
  실측(grep 0건)으로 확인만 한 것이며, 명명 형태(UPPER_SNAKE_CASE) 자체도 `error-codes.md §3.2`
  와 어긋나지 않는다.

### [INFO] "덧붙일 표기" 예시에 이탤릭 마크업이 생략됨

- target 위치: `## 변경안` 절, "덧붙일 표기: `(미구현 — 계획, §4-ai-assistant §12.2)`" 줄
- 위반 규약: 없음 (직전 문장이 "밑줄 기울임으로 «미구현 — 계획» 을 적고" 라고 산문으로는
  명시하나, 코드 스니펫 형태의 예시 자체에는 `_..._` 이탤릭 마크업이 표기돼 있지 않다)
- 상세: 실제 구현 시 실수로 이탤릭 없이(ED-DB-05 선례와 다른 스타일로) 삽입될 여지가 아주
  작게 있다. 규약 위반은 아니고 draft 문서 자체의 명확성 문제.
- 제안: 실제 반영 커밋에서 `_(미구현 — 계획, [§4-ai-assistant §12.2](./4-ai-assistant.md#122-실행디버깅))_`
  형태로 이탤릭 마크업을 포함해 ED-DB-05 행과 시각적으로 동일하게 맞출 것.

## 요약

target spec draft 는 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 제외 규칙(밑줄
prefix 파일)·상태 라이프사이클(`partial`+`pending_plans` 의무)을 정확히 읽고 그에 맞춰 스코프를
의도적으로 좁혔으며(4-ai-assistant.md 상태 플립을 별도 트래커로 유예), plan frontmatter 스키마·
plan 명명 컨벤션·문서 내 유일 선례(ED-DB-05)의 표기 스타일·헤딩 앵커 슬러그 규칙까지 실측으로
맞춘 흔적이 뚜렷하다. `review-citations.md` 는 애초에 `plan/**` 를 적용 대상에서 제외하므로
해당 사항이 없다. CRITICAL/WARNING 없음, INFO 1건(이탤릭 마크업 생략)만 남긴다.

## 위험도

NONE
