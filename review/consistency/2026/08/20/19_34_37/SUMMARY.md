# Consistency Check 통합 보고서

**BLOCK: YES** — re-run 호출부의 에러 응답 배선이 draft 의 전제("봉투는 기존과 같다")와 다르다는 CRITICAL 이
독립된 두 checker(cross_spec·naming_collision)에서 코드 실측으로 확인됐고, 나머지 세 checker(rationale_continuity·
plan_coherence)도 같은 결함을 다른 각도에서 재확인했다.

## 전체 위험도
**HIGH** — 결함은 국소적(re-run 한 호출부의 catch 블록 + 대응 spec 문서 3곳)이고 target(plan 문서) 자체의
권한 범위 안에서 수정 가능하지만, 그대로 구현되면 draft 가 막으려던 바로 그 UX 퇴화(#1188 재발)가 대상
호출부의 절반에서 재현된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, naming_collision (rationale_continuity·plan_coherence 도 별각도로 동일 결함 재확인) | draft 는 "봉투는 기존과 같다 — `INVALID_TRIGGER_PARAMETERS`(execute)·re-run 경로의 400. `details[]` 항목 코드만 새로 는다" 고 전제하지만, re-run 호출부는 실제로 `details` 가 아니라 **`errors`** 키로 raw(비정규화) reason 을 던지고, `GlobalExceptionFilter` 는 `details` 만 읽어 그 값을 조용히 버린다. draft 를 문구 그대로 구현하면 execute 경로는 `MASKED_VALUE_RESUBMITTED` 안내가 정상 도달하지만, re-run 경로는 400 은 뜨되 `details[].code` 자체가 응답에 없어 사용자는 여전히 일반 오류만 본다 — draft 가 막으려던 #1188 회귀가 대상 호출부의 절반에서 재현된다. | `plan/in-progress/spec-draft-inputoverride-marker-reject.md` "에러 계약 — 기존 헬퍼를 확장한다" 절 + "spec 변경 3곳" 목록 | 실측 코드: `codebase/backend/src/modules/executions/executions.service.ts:493-503`(`{ code: 'INVALID_INPUT', errors: err.errors }` — `toTriggerParameterErrorDetails()` 미호출) · `codebase/backend/src/common/filters/http-exception.filter.ts`(`GlobalExceptionFilter`, `details = resp.details ?? nested?.details` 로 `errors` 미인식) · spec `spec/5-system/13-replay-rerun.md` §8.1(`INVALID_INPUT` 행, `details[]` 언급 없음) · `spec/5-system/3-error-handling.md` §1.7 scope 주석(execute/save·webhook 만 열거, re-run 누락) · `spec/4-nodes/7-trigger/1-manual-trigger.md:184`(Manual·Webhook 만 `details` 포함 명시, re-run 은 이미 spec 상 제외돼 있음) | (a) `executions.service.ts` 의 해당 catch 블록을 `errors: err.errors` 대신 `details: toTriggerParameterErrorDetails(err.errors)` 로 변경(코드 수정, 구현 단계 필요). (b) `13-replay-rerun.md` §8.1 의 `INVALID_INPUT` 행에 "`details[]` 는 §1.7 카탈로그를 따른다" 명문화 — draft "spec 변경 3곳"에 4번째 항목으로 추가. (c) `3-error-handling.md` §1.7 의 scope 주석에 `INVALID_INPUT`(re-run) 을 세 번째 소비처로 추가. (a)를 이번 스코프에 포함하지 않을 경우 최소한 draft 본문에 "re-run 은 details 미노출 상태이므로 별도 배선 필요"라는 캐비엇을 명시해 구현 단계 누락을 막을 것. |

## planner 인계 (권한 밖 Critical)

(없음) — target 자체가 project-planner 소관의 spec-draft plan 문서이고, 발견된 CRITICAL 은 이 문서의 "에러
계약"·"spec 변경 3곳" 서술 범위를 넓히는 것으로 즉시 교정 가능하다(위 표 (b)(c)). 다만 (a)(코드 수정)는
`codebase/**` 이므로 draft 확정 후 developer 턴에서 구현해야 한다 — 이는 정상적인 "spec 확정 → 구현 위임"
순서이지 권한 밖 Critical 의 인계가 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence | "저장소 밖에서 `GET /api/executions*` 의 `inputData` 를 직접 소비하는 것은 없다"를 "확인된 사실"로 단정해 서버측 400 거부(breaking 성격)의 안전성 근거로 쓰지만, 같은 날(2026-08-20) 등재된 자매 트래커 항목(W5)이 정확히 같은 질문("외부 소비자 존재 여부 확인")을 여전히 미해결(`[ ]`)로 남겨 두고 있다. 이번 세션이 실제 조사(API 문서 공개 여부·파트너 연동 등)를 수행한 흔적이 diff/git log 에 없어, "확인된 사실"이 검증 없는 재서술일 가능성이 있다. | `plan/in-progress/spec-draft-inputoverride-marker-reject.md` "왜 지금인가" 문단 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:348-352`(W5, `14_44_08` 등재, open) · `review/code/2026/08/20/14_44_08/api_contract.md:10`·`side_effect.md:17-20`("실제 존재 여부는 diff 범위 밖"으로 명시적 미확인) | (a) 실제로 외부 소비자 부재를 확인했다면 그 근거(문서·게이트웨이 로그 등)를 target 에 명시하고 W5 체크박스를 함께 닫을 것. (b) 미확인이라면 "확인된 사실" 표현을 "가정"으로 낮추고 W5 를 미해결로 인용할 것. 서버측 거부 자체 착수를 막을 필요는 없으나 "안전성 근거"로 쓰는 것은 검증 전엔 부적절. |
| 2 | rationale_continuity | draft `## Rationale`(기각한 대안 — `coerce_failed` 재사용)이 "세 라운드에 걸쳐 리뷰어가 '기존 코드 재사용'을 제안했다"고 서술하지만, 실측하면 "재사용을 제안"한 곳은 5라운드(`15_32_34`~`17_38_33`) 중 **`17_38_33` 한 라운드의 reviewer 2명** 뿐이다. 그 이전 4라운드는 `coerce_failed` 를 "이미 존재하는 2차 방어"로만 언급했지 재사용을 제안하지 않았다 — "서버측 거부 여부 자체"를 3라운드 유예해 온 이력과 혼동된 것으로 보인다. | `plan/in-progress/spec-draft-inputoverride-marker-reject.md` `## Rationale` "기각한 대안 — `coerce_failed` 재사용" | `review/code/2026/08/20/{15_32_34,15_59_17,16_25_35,16_51_19,17_38_33}/*.md` | "세 라운드"를 "리뷰 라운드(`17_38_33`)에서 두 reviewer 가" 로 정정하거나, "서버측 거부 여부의 3라운드 유예"와 "`coerce_failed` 재사용 제안의 1라운드"를 분리 서술할 것. 기각 사유 자체(#1188 UX 퇴화 관측)는 실측과 일치하므로 유지 가능. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `INVALID_INPUT` 코드가 `3-error-handling.md` §1 전체 카탈로그(§1.3 유효성 검증 에러 표)에 미등재 — `13-replay-rerun.md §8.1` 에만 등재돼 있다. 이 문서 Rationale 이 챙겨온 "§1 카탈로그 완결성" 관행과 어긋난다. | `spec/5-system/3-error-handling.md` §1.3 | draft 가 §1.7 을 손대는 김에 §1.3 에 `INVALID_INPUT`(400) 행 추가 검토, SoT 참조는 `13-replay-rerun.md §8.1`. 필수 아님, 값싸게 닫을 수 있는 항목. |
| 2 | naming_collision | CLAUDE.md 프로젝트 지시가 병렬 워크트리(`eia-inputdata-marker-guard`)를 가리키고 있고 거기도 같은 트래커 항목(`inputOverride` 서버측 마커 리터럴 거부, 미착수)을 갖고 있다. 이 시점 기준 관련 3개 spec 파일 + `trigger-parameter.types.ts` 는 두 워크트리 간 diff 없음 — 실제 식별자 충돌 없음. | (해당 없음 — 병렬 세션 관찰) | 병합 시 재확인 권장 (MEMORY "백로그 착수 전 병렬 세션 머지 확인" 패턴과 동일 성격). |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | re-run 호출부가 `details[]` 대신 `errors` 로 던져 `GlobalExceptionFilter` 가 버림(CRITICAL) + §1.7 scope 주석 비대칭(WARNING) + `INVALID_INPUT` §1.3 미등재(INFO) |
| rationale_continuity | MEDIUM | "외부 소비자 없음" 미검증 단정(W5 충돌) + `coerce_failed` 제안 라운드 수 과장 + re-run `details[]` 미채움(critical과 동일 결함 재확인) |
| convention_compliance | NONE | 신규 에러 코드 명명·envelope 확장·frontmatter 모두 기존 규약과 정합. 위반 없음. |
| plan_coherence | MEDIUM | "spec 변경 3곳"에 `13-replay-rerun.md §8.1` 표 갱신 누락(critical과 동일 결함 재확인) + W5 트래커 미동기화(rationale_continuity 와 동일 지적) |
| naming_collision | HIGH | 신규 식별자 명명 충돌은 없음(NONE) 이나, 목표 위치(`error.details[].code`)가 re-run 경로엔 존재하지 않는다는 CRITICAL 배선 공백 |

## 권장 조치사항

1. **(BLOCK 해소)** draft 의 "에러 계약"·"spec 변경 3곳" 절에 re-run 호출부 항목을 명시 추가한다 — 코드 수정
   (`executions.service.ts` 의 catch 블록이 `toTriggerParameterErrorDetails(err.errors)` 를 거쳐 `details` 로 던지도록)을
   구현 스코프에 포함시키고, `13-replay-rerun.md §8.1`·`3-error-handling.md §1.7` 두 spec 문서에도 이 사실을 반영한다.
2. "왜 지금인가" 절의 "확인된 사실"(외부 소비자 없음) 표현을 실제 검증 여부에 맞게 재서술하고,
   `spec-sync-external-interaction-api-gaps.md` W5 항목과 동기화한다(닫거나, 미해결로 정합되게 인용).
3. `## Rationale` "기각한 대안" 절의 "세 라운드" 인용을 실제 리뷰 이력(1라운드·2 reviewer)에 맞게 정정한다.
4. (선택) `3-error-handling.md` §1.3 에 `INVALID_INPUT` 행을 추가해 카탈로그 완결성을 유지한다.
5. 병렬 워크트리(`eia-inputdata-marker-guard`)의 동일 트래커 항목과 diff 유무를 push/머지 직전 재확인한다.