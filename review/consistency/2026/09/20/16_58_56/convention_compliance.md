# 정식 규약 준수 검토 — `spec/2-navigation`

## 검토 범위·방법

프롬프트 번들에는 `spec/2-navigation/**` 18개 파일 전부가 "컨텍스트 예산 초과로 생략" 처리되어 본문이 없었고, `spec/conventions/**` 도 `spec-impl-evidence.md`·`audit-actions.md`·`cafe24-api-catalog/_overview.md` 3건만 전문이 실렸다(나머지는 절단). 생략을 "내용 없음"으로 해석하지 말라는 프롬프트 지시에 따라, target 문서 18개 전부와 `swagger.md`·`spec-status-lifecycle.test.ts` 등 관련 규약·가드 소스를 직접 `Read`/`grep` 으로 열어 대조했다.

검토 대상 커밋 맥락: 현재 `plan/in-progress/rotate-lost-update.md` 는 `spec_impact: none` 을 선언했다(integration rotate 의 lost-update 를 락 재설계로만 닫고 spec/API 계약은 바꾸지 않음). 즉 이번 `--impl-prep` 은 "이 변경이 spec/2-navigation 을 건드리지 않는다"는 전제의 사전 점검이며, 실제로 대상 문서들에 diff 는 없다. 아래는 `spec/2-navigation` 현재 상태 자체의 규약 준수 여부다.

## 발견사항

- **[INFO]** `backlog` id 의 로드맵 등재가 우연한 substring 일치로만 가드를 통과
  - target 위치: `spec/2-navigation/8-marketplace.md` frontmatter (`id: marketplace`, `status: backlog`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `backlog` 행 — "`id:` 가 `spec/0-overview.md` 본문 텍스트에 등장 의무 (§6.3 로드맵 항목에 등재 권장)"
  - 상세: `spec-status-lifecycle.test.ts` 의 가드는 `overviewText.includes(id)` 단순 substring 매칭이다. `spec/0-overview.md` §6.3 로드맵 표에는 이 항목이 한국어 "마켓플레이스"로만 적혀 있고, 영문 리터럴 `marketplace` 는 §6.3 이 아닌 다른 표(§6.1 근처, `./2-navigation/8-marketplace.md` 링크 경로)에 우연히 포함돼 있어 가드를 통과한다. 가드는 통과하지만, 권장 사항인 "§6.3 로드맵 항목에 `id` 로 등재"라는 취지에는 못 미친다 — 다음에 그 링크가 삭제/치환되면 가드가 조용히 깨질 수 있는 취약한 결합이다.
  - 제안: `spec/0-overview.md` §6.3 "마켓플레이스" 행에 `` `marketplace` `` id를 인라인 코드로 명시 (예: "**마켓플레이스** (`marketplace`)") 하면 의도와 가드 매칭 경로가 일치해 더 견고해진다. 이번 작업 범위(`spec_impact: none`) 밖이므로 즉시 수정을 요구하지는 않음.

- **[INFO]** `## Overview`/`## 개요` 헤딩 표기가 파일마다 불일치
  - target 위치: `spec/2-navigation/*.md` 전반 (`0-dashboard.md`·`10-auth-flow.md`·`14-execution-history.md`: "## 1. 개요"; `6-config.md`: "## Overview (제품 정의)"; 나머지 다수는 "## 1. 화면 구조" 등으로 바로 시작하고 Overview 성격 텍스트는 헤딩 없이 타이틀 직후 산문으로만 존재)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 권장 사항이라 CRITICAL/WARNING 대상은 아니다. 다만 표기가 세 갈래(번호 있는 "개요" 섹션 / "Overview (제품 정의)" / 헤딩 없는 도입 산문)로 갈려 있어, 영역 전체를 기계적으로 스캔하는 도구(§6.3 이 아닌 지금은 없지만 향후 생길 수 있는)의 파싱 근거로 쓰기 어렵다.
  - 제안: 규약 갱신이 필요하다면 "Overview 섹션은 번호 헤딩 없이 타이틀 직후 산문으로 대체 가능"이라는 예외를 SKILL.md/CLAUDE.md에 명문화하는 편이, 18개 중 13개가 이미 그 형태를 쓰는 현실과 맞다(규약이 현실보다 좁게 말하는 사례일 수 있음 — 강제 수정은 불필요).

- **[INFO]** `spec/2-navigation` 파일 번호열에 `12-` 결번
  - target 위치: `spec/2-navigation/` 디렉토리 (0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16 — 12 없음)
  - 위반 규약: 없음 — `spec/conventions/**` 나 CLAUDE.md 어디에도 "영역 내부 화면 파일이 연속 번호여야 한다"는 규정은 없다(`0-` prefix 규칙은 루트 `spec/0-overview.md` 전용, 도메인 인덱스 파일 번호는 그 대상이 아님). 정식 규약 위반이 아니므로 등급 부여하지 않으며 순수 참고 사항으로만 남김 — 히스토리컬 삭제/재편성 여부는 이번 검토 범위 밖.

- 그 외 확인했으나 위반 없음 (근거 남김):
  - **frontmatter 의무 필드**: 18개 파일 모두 `id`/`status`/`code` 보유, `status ∈ {backlog, partial, implemented}` 로 유효. `partial` 3건(`1-workflow-list.md`·`2-trigger-list.md`·`9-user-profile.md`) 모두 `pending_plans:` 실재 경로 보유, 대상 plan 파일 실존 확인함(`ls` 로 3건 모두 확인).
  - **id kebab-case·basename 충돌 회피**: `16-agent-memory.md` 가 `spec/5-system/17-agent-memory.md` 의 `agent-memory` 와 충돌을 피해 `nav-agent-memory` 를 쓴 것은 §2.1 이 명시한 선례와 정확히 일치. 저장소 전체 grep 으로 `layout`/`config`/`schedule` 등 18개 id 전부 충돌 없음 확인.
  - **API 응답 봉투·DTO 명명**: `{ data: ... }` / `{ data: ..., pagination }` / 비-페이징 `{ data: { items } }` 표기가 `swagger.md` §2-5·§5-2, `api-convention.md §5.2` 와 전부 일치(`4-integration.md`·`9-user-profile.md`·`14-execution-history.md` 확인). `UpdateMeDto`·`UpdateWorkflowDto` 등 DTO 명명도 §1-7 Update 접두 규칙(top-level 요청 바디) 및 실제 코드(`update-me.dto.ts`)와 일치. `Patch*Dto`·double-wrap 패턴(금지 항목) 검색 결과 0건.
  - **에러 코드 명명**: `EMAIL_HOST_BLOCKED`·`OAUTH_INVALID_SCOPE`·`INSUFFICIENT_SCOPE` 등 UPPER_SNAKE_CASE 로 `error-codes.md` 규율과 일치하며, 문서 스스로 그 규약을 인용하며 명명 근거(§Rationale)를 밝히고 있다.
  - **감사 로그 액션명**: `trigger.deleted`·`trigger.updated`·`integration.created/updated/deleted/rotated/reauthorized/scope_changed` 전부 `audit-actions.md` §3 레지스트리 표와 정확히 일치, prefix 없는 표기(금지 패턴) 없음.

## 요약

`spec/2-navigation` 은 이번 작업(`rotate-lost-update`, `spec_impact: none`)이 직접 손대지 않는 영역이며, 현재 상태를 정식 규약(`spec-impl-evidence.md`·`swagger.md`·`error-codes.md`·`audit-actions.md`) 기준으로 대조한 결과 CRITICAL/WARNING 급 위반은 발견되지 않았다. Frontmatter 스키마·id 충돌 회피·`pending_plans` 실존·API 응답 봉투 표기·DTO 명명·에러 코드·감사 로그 액션명 모두 규약과 일치했다. 발견된 것은 INFO 3건뿐이며, 그중 하나(`8-marketplace.md` backlog id 매칭)는 가드 통과 여부와 별개로 "§6.3 등재 권장" 취지를 우연한 substring 일치로만 충족하고 있어 견고성 관점의 개선 여지가 있다는 참고 사항이다. 이번 PR 범위에서 spec 수정은 불필요하다는 plan 의 판단(`spec_impact: none`)과 배치되는 사실은 발견하지 못했다.

## 위험도

NONE
