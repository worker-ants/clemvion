# Rationale 연속성 검토 — `variables.__*` 예약 prefix 강제 (task_7f283553)

## 대상
draft: `reserved-prefix-draft.md` (spec + code 원자 PR 계획) — `spec/conventions/execution-context.md` 원칙 5 갱신 + `spec/4-nodes/1-logic/4-variable-declaration.md` / `5-variable-modification.md` §6 에러 코드 추가 + 2개 노드 schema-level reject 코드 도입.

## 조사 방법
- `spec/conventions/execution-context.md` 원칙 4/5 전문 + `## Rationale` 전체 정독.
- `git log -p`로 원칙 5 최초 도입 커밋(`d2b4590a2`, PR #889, 2026-07-10) 커밋 메시지·diff 확인 — "강제 갭" 문구가 어떤 의도로 작성됐는지 원저자 의도 추적.
- carousel `__item_` reject 선례: `spec/4-nodes/6-presentation/1-carousel.md:368,450`, `spec/4-nodes/6-presentation/0-common.md`, `codebase/backend/src/nodes/presentation/_shared/button.types.ts:79-82`, `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts:349-351` 대조.
- `spec/4-nodes/1-logic/4-variable-declaration.md` §6 "⚠ silent fallback"/"⚠ silent skip" 콜아웃 vs `execution-engine.service.ts:7554-7561`(`filterUserVariables`, 로그·메타 노출 없음) 코드 대조.
- 기존 동일 task 계열의 선행 리뷰(`review/consistency/2026/07/10/10_56_04/rationale_continuity.md`, 원칙 5 신설 자체에 대한 검토) 참고 — 중복 판단 회피 및 이전에 열려있던 권고사항 확인.

## 발견사항

### [Info] 원칙 5 "강제 갭"은 기각된 결정이 아니라 **명시적으로 예고된 후속 작업** — 번복 아님

- target 위치: `reserved-prefix-draft.md:7-15` ("본 PR 이 그 강제를 도입하고 원칙 5 의 '강제 갭' 문구를 갱신한다")
- 과거 결정 출처: `spec/conventions/execution-context.md:70` 원칙 5 "강제 갭 (잔여 리스크)" + 도입 커밋 `d2b4590a2`(PR #889, 2026-07-10) 커밋 메시지: "노드 레벨 미강제 '강제 갭' 잔여 리스크 명시 (**스키마 가드 하드닝은 별도 task**)."
- 상세: 커밋 메시지가 "스키마 가드 하드닝은 별도 task" 라고 명문화하고 있어, 원칙 5의 "강제 갭"은 **"강제하지 않기로 결정"**한 합의가 아니라 **"아직 하지 않았고, 이후 별도 task 로 한다"**고 이미 예고된 미완 항목이다. 본 draft(task_7f283553)는 정확히 그 예고된 후속 task를 수행하는 것이므로 과거 결정을 뒤집는 것이 아니라 **예정된 완결**이다. 원칙 5 문구 자체도 "강제 도입 시 선례는 carousel `__item_` prefix schema-level reject" 라고 미리 방법론까지 지정해 둬(`execution-context.md:70`), draft가 그 지정된 선례를 그대로 따르는 것도 연속성에 부합한다.
- 제안: 조치 불요 (연속성 위반 없음 확인). draft §"변경 2"의 계획대로 원칙 5 문구를 "강제 갭"→"강제(schema-level reject)"로 전환하고 `## Rationale`에 결정 근거를 남기는 것으로 충분 — 이는 CLAUDE.md/원칙 3 "결정의 무근거 번복 금지" 요건(새 Rationale 동반)도 이미 충족하는 설계다.

### [Info] 원칙 4 / 원칙 5 구분은 흐려지지 않음 — 단, 테스트/문구에서 "원칙 4가 `_foo`를 허용한다"는 표현은 과잉 귀속

- target 위치: `reserved-prefix-draft.md:54-56` ("`_foo`(단일 underscore)는 허용됨을 단언 — 원칙 4(top-level `_`)와 원칙 5(`variables` 맵 내부 `__`)의 구분을 고정")
- 과거 결정 출처: `spec/conventions/execution-context.md:57` 원칙 4 (top-level 엔진 전용 필드), `:68` "top-level `_`-prefix(원칙 4)와 구분" 문단 (스코프: top-level vs `variables` 맵, prefix: 단일 `_` vs 이중 `__` 모두 다름을 명시)
- 상세: 원칙 4는 `ExecutionContext` **최상위 필드** 이름 규칙이지 `variables` 맵의 **키** 이름 규칙이 아니다. 따라서 사용자가 `variables` 맵 안에 `_foo`라는 이름의 변수를 선언하는 것은 원칙 4의 관할 대상이 아예 아니다(원칙 4는 필드명이지 변수명이 아님) — "원칙 4가 이를 허용한다"기보다는 "어떤 원칙도 이를 규제하지 않는다"가 더 정확하다. 실질적 결론(둘 다 `_foo`를 막지 않음)은 같지만, draft의 테스트 코멘트/향후 spec 문구가 "원칙 4 관할"인 것처럼 서술하면 두 원칙의 스코프 경계(엔진 top-level 필드 vs 사용자 variables 맵 키)를 흐릴 소지가 있다.
- 제안: 변경 2(spec 3파일) 작성 시 "단일 `_`는 원칙 4에 의해 허용된다"가 아니라 "`variables` 맵 내부 변수명에 대해 예약되는 것은 오직 이중 `__`(원칙 5)이며, 단일 `_` 접두는 어떤 원칙의 규제 대상도 아니다"로 명확히 구분해 서술할 것을 권고 (Critical/Warning 아님, 표현 정밀도 문제).

### [Info] carousel `__item_` 선례 인용은 정당 — 단, 새 Rationale은 메커니즘 차용이 아닌 독자적 근거를 함께 적어야 함

- target 위치: `reserved-prefix-draft.md:12-13,20-21,49`
- 과거 결정 출처: `spec/conventions/execution-context.md:70`(이미 이 선례를 "강제 도입 시" 참조점으로 명시), `spec/4-nodes/6-presentation/1-carousel.md:368,450`, `codebase/backend/src/nodes/presentation/_shared/button.types.ts:79-82`
- 상세: 이 선례 인용은 두 가지 의미에서 정당하다 — (1) execution-context.md 원칙 5 자체가 이미 이 선례를 지정 후속 조치 방법으로 못 박아 뒀다(위 발견 1). (2) 둘 다 "config 필드에 엔진 예약 문자열 패턴이 쓰이면 pre-flight throw"라는 동일한 **메커니즘**(schema-level reject, 기존 검증 경로 재사용, 신규 에러 포트 없음)을 취한다. 다만 두 결정의 **동기**는 다르다 — carousel의 `__item_` reject는 라우팅 시 엔진이 `<id>__item_<idx>`를 문자열 split 하는 **파싱 모호성 방지**(기능적 필연)이고, 본 변경의 `__` reject는 **시스템 키 충돌/park 시 silent 소실 방지**(네임스페이스 보호)다. carousel 선례가 이미 지정돼 있으므로 인용 자체는 문제 없으나, 메커니즘만 차용하고 "carousel도 그랬으니까"로 근거를 대체하면 새 결정의 진짜 이유(네임스페이스 보호 vs 파싱 안전)가 spec Rationale에서 흐려질 수 있다.
- 제안: `execution-context.md` `## Rationale`에 추가할 새 단락에서 "carousel과 같은 메커니즘(schema-level reject)을 쓰지만, carousel은 라우팅 파싱 안전을 위한 것이고 본 결정은 시스템 키 보호 + park silent-loss 방지를 위한 것"이라고 동기를 분리해 명시할 것.

### [Warning] "명시적 실패가 낫다" 근거가 `variable-declaration.md` §6의 기존 silent 정책과 표면적으로 충돌 — 관찰가능성 구분을 새 Rationale에 명문화 필요

- target 위치: `reserved-prefix-draft.md:23-30` ("조용한 데이터 손실보다 명시적 실패가 낫다")
- 과거 결정 출처: `spec/4-nodes/1-logic/4-variable-declaration.md` §6 "⚠ **silent fallback**"(coerce 실패 시 `null`, throw 없음) / "⚠ **silent skip**"(중복 이름 시 등록 무시) 콜아웃 — 이 문서는 silent 동작을 **의도적으로 채택**하고 있다.
- 상세: draft의 breaking-change 정당화 문구("조용한 데이터 손실보다 명시적 실패가 낫다")를 그대로 spec Rationale에 옮기면, 같은 노드 계열(§6)이 두 곳에서 정반대 원칙을 천명하는 것처럼 읽힐 위험이 있다 — 한쪽은 "silent해도 괜찮다"(§6 기존), 다른 한쪽은 "silent보다 명시적 실패가 낫다"(본 PR 신규). 실제로는 모순이 아니라 **관찰가능성(observability) 기준이 다르다**: §6의 기존 silent 동작들은 **모두 노드 자신의 출력 메타 필드로 관찰 가능**하다 — coerce 실패는 `meta.coercionWarnings`, 중복 skip은 `meta.skipped`(둘 다 `4-variable-declaration.md` §5.1 표에 명시). 반면 park 시 `filterUserVariables`(`execution-engine.service.ts:7554-7561`)가 `__` 접두 변수를 드롭하는 것은 로그도 메타 필드도 없는 **완전 불투명(opaque) silent** 드롭이다(직접 코드 확인 — `logger` 호출 없음). 즉 이 프로젝트의 실제 원칙은 "silent 금지"가 아니라 "**관찰 불가능한 silent만 금지**"에 가깝다. draft의 문구는 이 구분을 명시하지 않고 있어, 향후 이 Rationale만 읽는 독자가 "이 프로젝트는 왜 어떤 곳(§6)은 silent를 허용하고 여기서는 안 되는가"라는 정합성 의문에 부딪힐 수 있다.
- 제안: `execution-context.md`(또는 변경되는 두 노드 spec)의 `## Rationale`에 "본 결정은 silent 동작 일반을 금지하는 것이 아니라, `meta` 필드 등 어떤 진단 채널로도 노출되지 않는 **불투명 silent 소실**(park-filter drop, 로그/메타 부재)만을 막는다 — variable-declaration §6의 `meta.skipped`/`meta.coercionWarnings`처럼 관찰 가능한 silent 동작은 본 결정과 별개로 유지된다"는 취지의 한 문장을 명시적으로 추가할 것을 권고. 이렇게 하면 두 결정이 "일관된 관찰가능성 원칙의 두 적용 사례"로 정합되고, 향후 유사 사안(다른 노드의 silent 동작 재검토)에서도 판단 기준으로 재사용 가능하다.

### [Info] (부가) 원칙 5 자체의 선행 리뷰가 남긴 미해결 권고 — 같은 편집 기회에 흡수 가능

- target 위치: `spec/conventions/execution-context.md` 원칙 5(`:63-70`) vs `## Rationale` 절(`:92-104`)
- 과거 결정 출처: `review/consistency/2026/07/10/10_56_04/rationale_continuity.md` 발견 #3 — 원칙 2/3/4는 모두 `## Rationale`에 "왜 ~ 인가" 대응 단락을 갖는데 원칙 5만 없다는 INFO(비차단) 지적.
- 상세: 본 draft는 이미 "`## Rationale`에 전면 reject 결정 + breaking 성격 근거 기록"을 계획하고 있어(`reserved-prefix-draft.md:64`), 위 [Warning] 항목의 관찰가능성 구분과 이 미해결 INFO 권고("왜 원칙 5를 신설했는가" 미러 단락)를 **같은 편집에서 함께 해소**할 수 있는 좋은 기회다.
- 제안: 새 `## Rationale` 단락 제목을 "**왜 `variables.__*` 를 schema-level로 강제하는가**"로 잡고, 그 안에 (a) 원칙 5 신설 동기 요약(미러), (b) 전면 reject 채택 근거, (c) breaking 성격 수용 근거(관찰가능성 구분 포함)를 한 곳에 정리할 것을 권고.

## 요약

본 draft는 `execution-context.md` 원칙 5가 이미 "강제 갭"으로 명시하고 "강제 도입 시 선례"까지 지정해 둔 예고된 후속 작업을 정확히 수행하는 것으로, 과거 결정의 무근거 번복이나 기각된 대안의 재도입에 해당하지 않는다(도입 커밋 메시지가 "스키마 가드 하드닝은 별도 task"라고 명문화한 것으로 확인). 원칙 4/원칙 5의 스코프 구분(top-level 단일 `_` vs `variables` 맵 내부 이중 `__`)도 실질적으로 흐려지지 않으며, carousel `__item_` 선례 인용도 정당하다(이미 원칙 5가 지정한 참조점). 다만 두 지점에서 보완이 필요하다 — (1) carousel 선례는 메커니즘은 같지만 동기(파싱 안전 vs 네임스페이스 보호)가 다르므로 새 Rationale에 독자적 근거를 병기해야 하고, (2) "명시적 실패가 낫다"는 breaking-change 정당화가 `variable-declaration.md` §6의 기존 "silent skip/fallback 허용" 결정과 표면적으로 충돌해 보일 수 있어, 그 차이(관찰 가능한 silent vs 관찰 불가능한 silent)를 새 Rationale에 명시적으로 구분해 적어야 한다. 두 보완 모두 draft가 이미 계획한 "`## Rationale` 갱신" 단계에서 문구 추가만으로 해소 가능한 수준이며, 코드/구조적 재설계를 요하지 않는다.

## 위험도

LOW

STATUS: DONE
