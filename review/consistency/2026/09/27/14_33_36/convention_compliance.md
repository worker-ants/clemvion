# 정식 규약 준수 검토 — spec/2-navigation/

## 검토 범위와 방법

- 이번 PR(`patch-omit-undefined`)은 `spec/2-navigation/` 을 **변경하지 않았다** (scope 델타 0개 파일). 구현 diff(10파일/654줄, `workflows.service.ts` `settings` 병합 가드 등)는 이 spec 영역 밖이라, 본 검토는 "이 PR이 새로 어긴 규약"이 아니라 **현재 `spec/2-navigation/` 전체가 `spec/conventions/**` 를 얼마나 따르는지**의 standing 점검으로 수행했다.
- 프롬프트 번들은 컨텍스트 예산으로 18개 파일 중 3개(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)만 본문이 실렸고 나머지 15개(+conventions 다수)는 절단됐다. 절단된 파일은 "본문이 없다"를 "위반이 없다"의 근거로 삼지 않기 위해, 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/patch-omit-undefined`)에서 `spec/2-navigation/*.md` 전체 파일에 대해 구조·명명 축(문서 섹션 유무, DTO 명명, 에러 코드 표기, frontmatter `code:`/`pending_plans:` 경로 실존)을 **grep 로 전수 스캔**해 보완했다. 단, 15개 파일의 산문(Rationale 논증 등)까지 정독하지는 못했다 — 아래 결론은 이 한계 내에서다.

## 점검 결과 (관점별)

### 1. 명명 규약
- 에러 코드: `spec/2-navigation/*.md` 전체에서 백틱 인용된 UPPER_SNAKE 토큰(`VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`DUPLICATE_NODE_LABEL`·`TRIGGER_ENDPOINT_PATH_CONFLICT`·`BOT_TOKEN_INVALID`·`INVALID_FIELD`·`CAFE24_*`·`INTEGRATION_*`·`MODEL_CONFIG_*` 등)를 전수 추출해 [`spec/conventions/error-codes.md`](../../../../../../spec/conventions/error-codes.md) §1(의미 기반 명명)·§3(historical 예외 레지스트리)과 대조했다. `lower_snake_case` 위반 사례(§3 이 명시적으로 예외 등재한 초대 모듈 코드류)는 2-navigation 안에서 발견되지 않았고, `ADMIN_REQUIRED` 등은 §3 이 설명하는 "가드 경로가 먼저 UPPER_SNAKE 로 던진다"는 신규 계열과 일치한다. 위반 없음.
- DTO 명명: 2-navigation 전체에서 `*Dto` 식별자를 전수 추출(`UpdateWorkflowDto`·`UpdateMeDto`·`WorkflowSettingsDto`·`ExportWorkflowDto`·`TriggerDto`·`ScheduleDto` 등)해 [`swagger.md`](../../../../../../spec/conventions/swagger.md) §1-7(`Update<Entity>Dto` = top-level 요청 바디 전용, nested 필드는 `<Domain><Role>Dto`)과 대조했다. `Patch` 접두(금지 패턴) 사용 0건, `Update` 접두 오용(=nested 필드에 얹은 사례) 0건 — 전부 규약과 일치한다.
- 문서 파일 명명: `0-`~`16-` 번호 prefix + `_layout.md`/`_product-overview.md` 언더스코어 prefix 구성은 CLAUDE.md "정보 저장 위치" 표·SKILL.md 3섹션 규칙과 일치.

### 2. 출력 포맷 규약
- 부재 표현(`null` vs 키 생략) — `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 모두 [`spec/5-system/2-api-convention.md §5.4`](../../../../../../spec/5-system/2-api-convention.md) 의 (a)/(b) 기준을 명시적으로 인용하며 판정 근거를 문서화한다 (예: `3-schedule.md` §4 `trigger.workflow` 키 생략 근거, `2-trigger-list.md` 연결 워크플로 필드). 규약을 따르는 모범 사례로 보인다.
- 페이지네이션·에러 봉투 참조(`API 규약 §5.2`/`§5.3`)는 대상 문서(`spec/5-system/2-api-convention.md`)에 해당 앵커가 실재함을 확인했다 (§5.2 목록 응답, §5.4 부재 표현, §6 HTTP 상태 코드 헤더 실존 확인).
- **이미 트래커에 등재된 기지(旣知) 갭 — 신규 아님**: `1-workflow-list.md` §3.2(워크플로 `settings`)에는 PATCH 의 "키 생략=값 불변·`null`=?" tri-state 중 `settings: null` 이 실제로는 **no-op**(값 불변과 동일 — 방금 `edd79ca40` 커밋이 재확인)이라는 서술이 없다. 이 정확한 갭은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (7)이 `1-workflow-list.md §3.2` / `6-config.md` 두 곳에 채울 문장까지 지정해 planner 턴 인계를 마쳤고, 같은 세션의 `/ai-review` 1R SUMMARY(§INFO #11)도 "이 code-only PR 범위 밖, 중복 지적 불요"로 명시했다. 따라서 본 검토에서 새 WARNING/CRITICAL 로 재기(再記)하지 않는다 — 처리 경로가 이미 존재한다.

### 3. 문서 구조 규약
- `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 는 로컬 `## Overview` 섹션이 없지만, 대신 `_product-overview.md` 로 위임한다(각 문서 서두 "관련 문서: PRD 내비게이션" 링크). 이는 SKILL.md "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 규칙과 정확히 일치 — 위반이 아니라 규약이 요구하는 형태다.
- `## Rationale` 섹션 유무를 2-navigation 전체 18개 파일에 대해 전수 확인 — `_product-overview.md` 1개만 없고 나머지는 모두 보유. `_product-overview.md` 는 제품 정의 전용 문서라 결정 근거(Rationale) 섹션이 구조적으로 불필요한 문서 유형이므로 위반으로 보지 않는다.
- frontmatter `status`/`code`/`pending_plans` 스키마: `1-workflow-list.md`(`partial`+`pending_plans`), `2-trigger-list.md`(`partial`+`pending_plans`), `3-schedule.md`(`implemented`+`code:`)를 [`spec-impl-evidence.md`](../../../../../../spec/conventions/spec-impl-evidence.md) §3 상태 어휘·의무와 대조 — 일치. `pending_plans` 로 지목된 3개 plan 경로(`marketplace-and-plugin-sdk.md`·`workflow-duplicate-nodes-edges.md`·`spec-draft-nullable-notation-followups.md`) 전부 실존 확인.
- `code:` glob 경로 표본 15개(트리거·스케줄·워크플로 모듈 전체)를 워킹트리에서 직접 확인 — 전부 실재.

### 4. API 문서 규약 (Swagger/OpenAPI)
- `writeOnly`/`readOnly` 패턴 — `2-trigger-list.md` 의 `hasBotToken: boolean` 서술(§2.3.1)이 [`swagger.md §1-5`](../../../../../../spec/conventions/swagger.md) 의 예시 필드와 동일 개념·동일 근거로 일치.
- nullable/optional 선언 기준(§1-4) 위반 사례 없음 — 2-navigation 문서들이 `oneOf`/닫힌 union 을 직접 선언하는 대목은 없고, 서술 수준에서 `~는 null`/`~는 키 생략` 판정 근거를 각 필드마다 인용하는 패턴이 §5.4 요구("그 필드를 문서화하는 절에 사유를 명시")와 일치.

### 5. 금지 항목
- `Patch*Dto` 접두, `lower_snake_case` 에러 코드 신설, "빈 껍데기" 페이지네이션 스키마 서술 등 swagger.md §6/§1-7 이 금지하는 패턴은 2-navigation 전수 스캔에서 발견되지 않았다.

## 발견사항

- **[INFO]** 링크 라벨-타깃 불일치 (경미, 규약 위반은 아님)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, `botToken` 행 (파일 138번째 줄)
  - 위반 규약: 없음 — 순수 문서 품질 이슈. 굳이 걸자면 문서 상호참조의 신뢰성이라는 점에서 "문서 구조 규약"과 인접.
  - 상세: `([Spec Chat Channel §1.11](../5-system/3-error-handling.md#111-트리거-authconfig-binding-에러-코드-도메인-spec-참조) 은 별 코드다 — 혼동 말 것.)` — 링크 **라벨**은 "Spec Chat Channel §1.11"이라고 적지만 실제 **타깃**은 `spec/5-system/3-error-handling.md` §1.11("트리거 AuthConfig binding 에러 코드")이다. 앵커 자체는 유효하지만 라벨이 잘못된 문서를 가리키는 것처럼 읽혀 "혼동 말 것"이라는 문장의 취지와 반대로 혼동을 유발할 수 있다.
  - 제안: 라벨을 "Spec 에러 처리 §1.11" 또는 "에러 처리 §1.11" 로 정정. `spec/conventions/**` 규약 위반은 아니므로 이번 회차 차단 사유는 아니다.

- **[INFO]** PATCH `settings` null 의미 미문서화 — 이미 처리 경로 존재, 재기(再記) 아님
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 항목 6
  - 위반 규약: [`spec/5-system/2-api-convention.md §5.4`](../../../../../../spec/5-system/2-api-convention.md) 의 tri-state 문서화 기대(참고 인용)
  - 상세: `UpdateWorkflowDto.settings` 는 "strict 정책"만 서술하고 `settings: null` 자체의 의미(no-op, 값 불변과 동일)는 적지 않는다. 다만 이 정확한 문장까지 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (7)에 지정돼 planner 인계가 끝났고, 같은 세션 `/ai-review` SUMMARY 도 "code-only PR 범위 밖 · 중복 지적 불요"로 명시했다.
  - 제안: 신규 조치 불요. 후속 planner 턴에서 항목 (7) 처리 시 함께 반영될 사안이므로 본 검토에서 별도 액션을 요구하지 않는다 (검증 차원에서 "이미 알려진 문제"임을 확인한 기록으로만 남긴다).

CRITICAL/WARNING 등급 발견사항 없음.

## 요약

`spec/2-navigation/` 은 이번 PR 의 diff 스코프 밖이며, 본문이 확인 가능했던 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)과 나머지 15개 파일에 대한 구조·명명 전수 스캔 모두에서 `spec/conventions/**`(에러 코드 명명, Swagger DTO 명명, 문서 3섹션 구조, frontmatter 스키마) 위반이 발견되지 않았다. 유일하게 실질적인 갭(워크플로 `settings` 의 PATCH `null` 의미 미문서화)은 이미 별도 plan 트래커(`spec-draft-nullable-notation-followups.md` 항목 7)와 직전 코드 리뷰 SUMMARY 에 정확히 포착·인계돼 있어 이번 검토에서 새로 지적할 실익이 없다. 다만 15개 파일은 예산 절단으로 산문 수준까지 정독하지 못했다는 방법론적 한계는 남는다.

## 위험도

NONE
