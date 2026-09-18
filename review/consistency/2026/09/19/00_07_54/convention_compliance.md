# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`

## 검토 방법

`spec/conventions/**` 번들이 컨텍스트 예산 초과로 다수 잘려 있어(특히 `migrations.md` 는 전문
로드됐으나 `error-codes.md`·`swagger.md`·`spec-impl-evidence.md`·`review-citations.md` 는
"의도된 절단"으로 생략됨), 해당 파일들은 워크트리에서 직접 `Read`/`grep` 하여 원문으로
대조했다. 대조 대상: `spec/conventions/migrations.md`(전문), `error-codes.md`(전문),
`swagger.md`(발췌), `review-citations.md`(전문), `secret-store.md`(전문), `audit-actions.md`(전문),
관련 코드(`codebase/backend/migrations/`, `triggers.service.ts` 등).

## 발견사항

- **[INFO]** S2 diff 지시문의 중첩 백틱이 렌더링을 깨뜨린다
  - target 위치: target 문서 `## 변경안 › S2. spec/1-data-model.md §3 인덱스 전략 — Trigger 행 교체`
  - 위반 규약: 없음(정식 규약 위반 아님 — 순수 마크다운 렌더링 문제)
  - 상세: `` `| Trigger | ... | Webhook URL 라우팅 — 라우팅 키(`/api/hooks/:endpointPath`)가 ... |` `` 형태로, "old → new" 전체를 감싸는 바깥 백틱 안에 `` `/api/hooks/:endpointPath` ``·`` `(workspace_id, endpoint_path)` `` 같은 안쪽 인라인 코드용 단일 백틱이 그대로 섞여 있다. 마크다운은 백틱 쌍을 중첩 이스케이프 없이 구분하지 못하므로, 이 라인은 렌더러에 따라 바깥쪽 코드 스팬이 첫 안쪽 백틱에서 조기 종료되고 나머지가 생 텍스트로 노출될 수 있다. **실제로 삽입될 `spec/1-data-model.md` 테이블 행 자체**(여러 개의 독립된 인라인 코드 스팬을 포함하는 정상적인 테이블 셀)는 문제 없다 — 문제는 이 plan 문서가 "old → new" 를 통짜 코드 스팬으로 보여주려는 표현 방식에 한정된다.
  - 제안: 반영 시(S1~S10 실제 적용 단계) 문제 없이 지나가므로 소급 수정은 선택 사항이나, 리뷰어가 diff 를 재확인할 때 헷갈리지 않도록 이런 지시문은 outer code span 대신 코드 블록(펜스)으로 감싸는 편이 낫다.

- **[INFO]** S7 의 「자기-반증형 소정정」 인용이 다른 role 의 조항을 스타일 근거로 빌려온다
  - target 위치: target 문서 `## 변경안 › S3` 근처("CLAUDE.md 자기-반증형 소정정과 같은 «원문 보존» 관례") 및 `## 체크리스트`/`## Rationale` 인접 서술
  - 위반 규약: `CLAUDE.md §자기-반증형 소정정` (정식 규약은 아니고 프로젝트 공통 규약 본문) — 직접 위반은 아니지만 인용 대상이 정확히 일치하지 않음
  - 상세: CLAUDE.md 의 "자기-반증형 소정정" 은 **developer 가 spec 을 planner 턴 없이 직접 고칠 수 있는 좁은 예외**(다섯 조건 — 특히 "developer 자신이 그 문장을 썼다")를 다루는 조항이다. 이 target 문서는 project-planner 가 정상 `--spec` 드래프트 절차로 spec 을 고치는 흐름이라 그 예외 자체가 적용되는 상황이 아니다. target 은 그 조항을 "예외 승인 근거"가 아니라 "원문 취소선 보존 + 정정 블록"이라는 **표현 관례**의 유비로만 쓰고 있고(실제 선례는 `2-trigger-list.md` R-2, `secret-store.md` 의 "정정 (날짜)" 블록), 문면상으로도 "관례"라고만 적어 절차적 권한을 주장하지는 않는다. 다만 이후 이 draft 를 근거 문서로 재인용하는 사람이 "developer 직접 수정 예외가 project-planner 의 일반 spec 수정에도 쓰인 선례"로 오독할 여지가 있다.
  - 제안: 인용 우선순위를 바꿔 "선례는 `2-trigger-list.md` R-2·`secret-store.md` 의 취소선+정정 블록 형식이며, CLAUDE.md 자기-반증형 소정정도 같은 *원문 보존* 스타일을 쓴다" 정도로 표현해 절차적 권한 주장이 아님을 더 명확히 하면 좋다. (조치 불요에 가까운 사소한 문구 제안 — 정식 규약 위반은 아님.)

- **[INFO]** 검토 대상 확인 — S7 정정 블록 서식은 이미 규약 형태를 지킴
  - target 위치: `## 변경안 › S7`
  - 위반 규약: 없음(양호 확인)
  - 상세: 2차 처분 INFO3 이 지적한 "정정 (날짜)" 표기(괄호 앞 공백)를 S7 본문이 `**정정 (2026-09-18)**` 형태로 정확히 반영하고 있음을 직접 대조로 확인했다. `spec/5-system/12-webhook.md:147`·`spec/7-channel-web-chat/5-admin-console.md:111` 등 인용 라인 번호도 실측과 대체로 일치한다(±1줄, 편집 중 자연 이동).

## 규약별 정합성 확인 (문제 없음)

- **명명 규약**: 신규 마이그레이션 파일명 `V131__trigger_endpoint_path_dedupe.sql`/`V132__trigger_endpoint_path_global_unique.sql`(+`.conf`)은 `migrations.md §1` 의 `V<번호>__<snake_case_descriptor>` 형식·소문자+숫자+`_` 문자집합을 지킨다. `origin/main` 실측 max 는 `V130`이라 `§2` 단조증가·gap-금지 정책(+1, +2)도 만족한다. 인덱스명 `idx_trigger_endpoint_path` 는 기존 저장소에 충돌이 없음을 실측 확인(`grep` 0건 사전 존재).
- **마이그레이션 구조 규약**: V131(트랜잭션 `DO $$…$$` 정리)과 V132(`CONCURRENTLY` 인덱스 교체, `.conf executeInTransaction=false`)를 파일 둘로 나눈 설계는 `codebase/backend/migrations/README.md` 의 "mixed 판정 회피" 요구와, "정리 코드는 생성과 같은 파일에 있어야 한다"는 경고를 **다른 종류의 "정리"** (invalid index self-heal vs. 데이터 중복 정리)로 정확히 구분해 적용하고 있다. V132 자체는 README §5 "교체" 패턴(0) DROP CONCURRENTLY IF EXISTS 새 이름 → CREATE → DROP 옛 이름, 선례 V110)을 그대로 따른다 — 규약 위반 아님.
- **에러 코드 규약**: `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 기존 코드(재사용, rename 아님)이며 `UPPER_SNAKE_CASE`·`RESOURCE_CONFLICT`/409 envelope 형식을 유지한다. 코드가 표현하는 "의미"(이 endpoint_path 를 쓰는 다른 트리거가 이미 있다)는 그대로이고 유일성 검사 **범위**만 워크스페이스→전역으로 넓어지므로, `error-codes.md §2` 가 요구하는 "의미가 분기되면 새 코드 신설" 요건에 해당하는 신규 조건 발생으로 보기 어렵다 — 이름이 워크스페이스 스코프를 함의하지 않아 이름-의미 불일치(§1 위반)도 생기지 않는다.
- **문서 구조 규약**: target 문서 frontmatter 는 `plan-lifecycle.md §4` 가 top-level `plan/in-progress/*.md` 에 요구하는 3필수 필드(`worktree`·`started`·`owner`)를 모두 갖췄고 `worktree` 값이 실제 세션 worktree(`webhook-endpoint-lookup-7a1f3c`)와 일치한다. `spec_impact` 로 선언한 7개 spec 경로는 전부 실재 파일임을 확인했다(Gate C 요건과 미리 정합). 문서 본문은 `본문 → ## Rationale` 구조를 갖춰 CLAUDE.md 가 권장하는 3섹션 구성에 부합한다.
- **spec 본문 3섹션(Overview/본문/Rationale) 준수 여부**: 변경 대상 spec 문서들(`1-data-model.md`, `12-webhook.md` 등)에 대한 편집 지시(S1~S10)는 모두 기존 섹션(필드 표·인덱스 전략 표·Rationale 신설 절) 안에서 이뤄지며 새 최상위 섹션을 임의로 만들지 않는다.
- **리뷰 인용 규약(`review-citations.md`)**: target 문서가 `review/consistency/2026/09/18/23_39_46` · `.../23_54_40` 를 인용하는 방식(전체 경로, 날짜 포함)은 §2 "권장" 형태를 이미 충족한다. 다만 이 규약의 적용 범위(§3)는 애초에 `plan/**` 문서를 명시적으로 제외하므로, 이 문서 자체는 규약의 강제 대상도 아니다(선의로 잘 지킨 상태).
- **secret-store / audit-actions 규약**: target 은 두 규약이 다루는 표면(비밀 저장·감사 로그 액션)을 건드리지 않는다 — 관련 없음, 위반 없음.
- **API 문서(swagger) 규약**: target 이 예고하는 `triggers.controller.ts` 의 `@ApiResponse` 설명문 텍스트 변경은 데코레이터·DTO 명명 패턴 자체를 바꾸지 않는 순수 설명 문구 수정이라 `swagger.md` 의 DTO/데코레이터 규칙과 충돌하지 않는다.

## 요약

target 문서는 spec draft 이며, 실제 spec 변경은 아직 반영 전 단계(S1~S10 의 "계획"만 존재)다.
정식 규약(`spec/conventions/**`) 관점에서는 마이그레이션 파일·인덱스 명명, mixed-transaction
분리 설계, 에러 코드 재사용, plan frontmatter 스키마, spec 3섹션 구조, 리뷰 인용 형식 등 점검한
전 항목이 실제 저장소 상태(`origin/main` 기준 V130, 기존 상수·인덱스명, README §5 규칙)와
대조해 일관됐다. 이미 1차·2차 `--spec` 컨시스턴시 검토에서 나온 Critical/Warning 은 S7·S8·S9·S10
으로 해소된 상태이며, 그 반영 결과도 규약 위반을 새로 만들지 않았다. 발견된 것은 마크다운
렌더링상의 사소한 흠(중첩 백틱)과 CLAUDE.md 조항 인용의 정밀도 문제뿐으로, 모두 INFO 수준이며
실제 반영본(스펙 파일)에는 영향이 없다.

## 위험도

LOW
