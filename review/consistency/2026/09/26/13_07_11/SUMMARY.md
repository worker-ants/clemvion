# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. WARNING 3건(1건은 두 checker 중복 지적) 존재하나 모두 시퀀싱/표기 정정 수준.

## 검토 대상
- target: `plan/in-progress/spec-draft-swagger-success-advert.md` (spec draft, `--spec` 모드)
- checker 5개 전원 `success` 상태로 실행 완료, 결과 파일 전부 디스크에 존재(`cross_spec.md` · `rationale_continuity.md` · `convention_compliance.md` · `plan_coherence.md` · `naming_collision.md`) — 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — Critical 없음. draft 는 §2-4/§5-2/§5-4 순수 문서화 규약 변경이며 데이터 모델·API 계약·RBAC·상태 전이 등 다른 축과 충돌하지 않는다. 유일한 반복 지적은 아직 완료되지 않은 구현 plan(`success-advert.md`)을 Rationale 문장이 완료형·`plan/complete/` 경로로 선인용한다는 시퀀싱 문제.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 Critical 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec + plan_coherence (중복 지적) | Rationale 변경(4) 새 불릿이 아직 끝나지 않은 구현 작업을 과거형·완료 경로(`plan/complete/success-advert.md`)로 서술 | draft `## 변경 (4)` — `## Rationale` §2-4 절 불릿 교체문 | `plan/in-progress/success-advert.md`(현재 status: in-progress, 체크리스트 9항목 전부 미완) · `.claude/docs/plan-lifecycle.md §3`("살아있는 문서의 plan 링크는 이동과 동시에 갱신") | (a) `--spec` 반영 시 변경(4)는 보류하고 구현 완료·plan 이동 시점(developer 마무리 커밋)에 반영, 또는 (b) 지금 반영해야 한다면 프로스펙티브 시제로 낮추고("...채운다(예정)") 경로도 `plan/in-progress/success-advert.md`로 적은 뒤 `--impl-done`에서 `plan/complete/`로 정정(원 저자가 planner 이므로 정정도 planner 턴) |
| 2 | rationale_continuity | 3xx 리다이렉트 "짝 대조 예외" 신규 문장이 같은 절이 SSE 사례로 이미 닫아 둔 "`@Res()`를 면제하지 않는다" 원칙과 표면적으로 유사한데 구분을 명시하지 않음 | draft 변경 (1) — §2-4 규칙 문단 추가 문장 "리다이렉트만 광고한 라우트는 위 짝을 대조하지 않는다..." | `spec/conventions/swagger.md` `## Rationale` SSE 관련 불릿("`@Res()`를 면제하지 않는다") · 선례(`spec/1-data-model.md` `select: false`/응답 경계 절이 동일 클래스 혼동을 대조표로 명시 방지) | 새 문장 뒤(또는 Rationale)에 구분 문장 추가 — 예: "SSE 와 달리 `res.redirect(url)` 호출 자체가 상태를 명시적으로 덮어쓰므로 Nest 기본값을 대조할 여지가 없다. 이 예외는 `res.redirect`로 끝나는 라우트에 한정되며 다른 `@Res()` 핸들러에는 적용되지 않는다." |
| 3 | convention_compliance | `## Rationale (이 draft 의)` 두 번째 불릿에서 api-convention §5.4를 가리키며 하이픈 번호(§5-4, swagger.md 자신의 다른 절과 혼동 가능)를 문장 주어로 사용 | target line 67 — `"§5-4 는 wire 의 \`null\`을 \`nullable\`로 선언하라고 한다(api-convention §5.4)."` | 저장소 전역 표기 관례(하이픈=자기 문서 절 / 점=타 문서 절) · 동일 저자 선례 `plan/complete/spec-draft-swagger-http-status-guard.md` · 전담 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` | `"§5-4는..."` → `"api-convention §5.4는..."`로 주어 교체(괄호 정정 제거). swagger.md 본문에는 삽입되지 않아 파급은 이 plan 문서로 국한 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + rationale_continuity (중복 지적) | §2-4/api-convention §6 상태 코드 표에 3xx 행이 없어 신규 규칙(3xx=성공 광고)과 표 커버리지가 어긋남 | 변경 (1) | 표에 "3xx 리다이렉트(`res.redirect` 종결) \| `@ApiFoundResponse` 등" 행 추가 또는 "표는 2xx/에러만 다루며 리다이렉트는 별도" 각주 |
| 2 | cross_spec | `ApiOkWrappedNullableResponse`가 §1-4 가 이미 겪은 "`nullable`이 `$ref` 형제로 오면 무시된다" 문제를 재발시킬 구현 여지 (의미 계약은 맞지만 구현 형태 미규정) | 변경 (2) — §5-2 표 신규 행 | `success-advert.md`의 래퍼 구현 항목에 "`oneOf:[{$ref}], nullable:true` 형태로 구현" 캐비엇 한 줄 추가 |
| 3 | plan_coherence | "정하지 않는 것" 카브아웃 2건(리다이렉트 광고 형식·SSE 이벤트 본문 스키마화) 중 리다이렉트 건이 트래커에 미등재 | 상단 "**정하지 않는 것**" 문단 | 리다이렉트 광고 형식 건만 `spec-draft-nullable-notation-followups.md`에 한 줄 등재 (SSE 건은 §1-4/EIA 선례로 이미 답이 나와 등재 불요) |
| 4 | convention_compliance | frontmatter title 이 §2-4·§5-2 두 절을 한 줄에 결합 — 직전 두 선례는 단일 절만 표기 | frontmatter `title` (line 2) | 수정 불요, 참고만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Rationale 변경(4) 완료형 서술/조기 경로 인용(WARNING) + 3xx 표 누락·nullable 구현 여지(INFO) |
| rationale_continuity | LOW | 리다이렉트 예외와 SSE `@Res()` 불면제 원칙의 미명시 구분(WARNING) |
| convention_compliance | LOW | §5-4/§5.4 절 번호 표기 혼용(WARNING), 그 외 형식·인용은 선례와 문자 단위 일치 |
| plan_coherence | LOW | 미완료 구현 plan을 완료 경로로 선인용(WARNING, cross_spec과 동일 이슈) + 카브아웃 트래커 미등재(INFO) |
| naming_collision | NONE | 신규 식별자 `ApiOkWrappedNullableResponse` 전수 grep 충돌 0건, 기존 명명 축과 정합 |

## 권장 조치사항
1. (WARNING #1) Rationale 변경(4) 불릿 — `--spec` 반영 시점을 구현 완료 후로 미루거나, 지금 반영한다면 프로스펙티브 시제 + `plan/in-progress/` 경로로 수정 후 `--impl-done`에서 정정.
2. (WARNING #2) 변경(1) 새 문장에 "SSE `@Res()` 불면제 원칙과 무관한 이유"를 한 줄 명시.
3. (WARNING #3) `## Rationale (이 draft 의)` 두 번째 불릿의 주어를 `api-convention §5.4`로 교체.
4. (INFO) 여유가 있으면 3xx 표 보완, nullable 구현 캐비엇, 리다이렉트 카브아웃 트래커 등재도 함께 처리.
