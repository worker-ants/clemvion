# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문을 제출했고 CRITICAL 발견 없음 (재시도 필요 checker 없음)

- 검토 모드: `--impl-prep spec/4-nodes/4-integration/`
- 실제 트리거 작업: `plan/in-progress/ssrf-catch-instanceof.md` — SSRF 가드 소비자 4곳(`http-request.handler.ts`/`http-redirect.ts`/`database-query.handler.ts`/`database-connection-tester.ts`)의 `catch`를 `instanceof SsrfBlockedError`로 판정/비판정 분류하는 순수 코드 변경. `spec_impact: none`.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(모두 spec 문서의 완전성/증거 갭이며 이번 plan의 `spec_impact: none` 선언 자체를 무효화하지 않음), INFO 다수(대부분 "충돌 없음 확인" 성격).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에는 CRITICAL이 없어 인계 대상 자체가 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 조립된 `_prompts/convention_compliance.md` 번들이 이번 검토 관점(1~5)에 직접 필요한 정식 규약 원문(`egress-masking.md`·`error-codes.md`·`node-output.md`·`secret-store.md`·`spec-impl-evidence.md` 등)과 대상의 `_product-overview.md`를 컨텍스트 예산 초과로 전량 절단, 대신 대상과 무관한 자동생성 카탈로그(cafe24/makeshop API 카탈로그 leaf 250여개)를 실음 | `_prompts/convention_compliance.md` 라인 2627~2696 | 규약 원문 부재 상태로 판정하면 구조적 false-negative 위험 (기존 알려진 패턴, `feedback_consistency_spec_mode_budget`) | 이번 라운드는 checker가 저장소에서 직접 `Read`로 규약 원문을 보완해 판정을 마쳤으므로 이번 판정 자체는 유효. 다만 번들 조립 로직이 대상과 무관한 대용량 생성 카탈로그보다 `spec/conventions/*.md`(flat) 파일을 우선 배정하도록 예산 배분 순서 조정 필요 — harness 개선 항목으로 별도 추적 |
| 2 | convention_compliance | `1-http-request.md` frontmatter `code:` 증거 목록이 §4 step 9(리다이렉트 5홉 수동 follow + 매 홉 SSRF 재검증)를 실제 구현하는 `http-redirect.ts`를 누락 — 이 파일은 이번 plan이 직접 수정하는 대상이기도 함 | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (라인 185~190) | `spec/conventions/spec-impl-evidence.md` §2.1 (code: = 약속한 surface의 구현 경로 증거) | `spec/` 쓰기는 developer 권한 밖(자기-반증형 소정정 5조건 중 "예고 문장의 정정"에 해당 안 됨 — 증거 목록 누락이므로). 이번 plan은 `spec_impact: none` 유지 가능(동작 계약 자체는 안 바뀜). 후속 project-planner 턴에서 `code:`에 `http-redirect.ts` 추가 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `INTEGRATION_CALL_FAILED`의 신규 트리거 사례("SSRF 가드가 판정 아닌 오류를 던진 경우")가 `1-http-request.md` §4.2 / `2-database-query.md` §6.2 표에 열거되어 있지 않음 (모순은 아니고 완전성 갭) | `spec/4-nodes/4-integration/0-common.md` §4.2, `1-http-request.md` §4.2, `2-database-query.md` §6.2 | `--impl-done` 시점에 두 표에 한 줄 추가하는 spec 갱신을 project-planner 턴에서 고려 |
| 2 | cross_spec | `database-query.handler.ts`의 `IntegrationError` 승격은 `spec/5-system/3-error-handling.md` §6의 `cause` 부착 규약(C1/C2) 적용 대상 | `spec/5-system/3-error-handling.md` §6 | 구현 시 C1/C2 판정 후 `cause` 부착 여부 결정, 미부착 시 `eslint-disable-next-line preserve-caught-error -- <사유>` 필요 |
| 3 | rationale_continuity | plan은 `2-database-query.md`(2026-06-12)·`1-http-request.md` §8.3(2026-07-05)·`spec/2-navigation/4-integration.md`(2026-09-19) 세 Rationale이 이미 확립한 "판정 vs 그 외" 경계로 코드를 되돌리는 것 — 새 결정 아님, drift 교정 | 위 세 문서 Rationale | 결함 없음. 커밋 본문에 세 Rationale 인용 권고(필수 아님) |
| 4 | rationale_continuity | connection-tester no-throw 계약이 `spec/2-navigation/4-integration.md` §5.3/§5.4 결과-코드 모델과 일치 | `spec/2-navigation/4-integration.md` §5.3/§5.4 | 확인만, 조치 불요 |
| 5 | rationale_continuity | SMTP 가드 선례가 plan의 전제와 spec상으로도 일치 | `3-send-email.md` §4/§5.3 | 확인만, 조치 불요 |
| 6 | convention_compliance | `0-common.md`만 형제 문서와 달리 별도 `## Rationale` 섹션이 없음(인라인 callout으로만 존재) | `spec/4-nodes/4-integration/0-common.md` | 3섹션 구성은 "권장"이라 조치 불요, 이번 plan과 무관 |
| 7 | plan_coherence | `plan/in-progress/node-output-redesign/http-request.md`(143행)·`database-query.md`(149/161행)의 catch 서술이 이번 구현 후 "무엇이든 승격" 표현의 정밀도가 떨어짐 | 위 두 audit 문서 | 블로킹 아님. 다음 node-output-redesign 전수 재검증(주기적 "N차 갱신") 때 반영, 이번 plan 체크리스트에 추가 불요 |
| 8 | naming_collision | 결정 라벨 `D4`가 `0-common.md`/`execution-engine.md`/`conversation-thread.md`에서 각각 다른 결정을 가리키는 문서-로컬 넘버링(기존 프로젝트 관례, 실질 혼선 사례 없음) | `spec/4-nodes/4-integration/0-common.md` §4.2 외 2곳 | 조치 불요. 문서 간 결정 라벨 인용 시 파일명 병기 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | CRITICAL/WARNING 없음. `INTEGRATION_CALL_FAILED` 표 완전성 갭, `cause` 부착 규약 적용 대상 INFO 2건 |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. plan은 기존 3개 Rationale(2026-06-12/07-05/09-19)이 확립한 경계로의 drift 교정 — 새 결정·번복·기각안 재도입 없음 |
| convention_compliance | LOW | WARNING 2건 — (1) prompt 번들 컨텍스트 예산이 관련 규약 원문 전량 절단(구조적 위험, 이번 판정은 직접 Read로 보완), (2) `1-http-request.md` code: 증거가 `http-redirect.ts` 누락. 실체 규약(에러코드 명명·D4 라우팅·5필드 invariant) 준수 확인 |
| plan_coherence | LOW | 소스 트래커 파생·스코프 분리·SMTP 가드 선행조건 전부 정합. `node-output-redesign` 감사 문서 2곳의 서술 정밀도 저하만 INFO |
| naming_collision | NONE | 에러코드·환경변수·Redis 키·DB 인덱스·API endpoint 등 신규 식별자 전수 대조, 의미가 어긋나는 충돌 없음. `D4` 라벨 재사용은 기존 관례 |

## 권장 조치사항

1. (BLOCK 사유 없음 — 즉시 조치 불요) 이번 plan(`ssrf-catch-instanceof`)은 코드 진행 가능.
2. [WARNING #2, project-planner 턴] `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:`에 `http-redirect.ts` 추가.
3. [WARNING #1, harness 개선] consistency-check 번들 조립 시 대상과 무관한 자동생성 카탈로그(`cafe24-api-catalog`/`makeshop-api-catalog`)보다 `spec/conventions/*.md`(flat)를 예산상 우선 배정 — 기존 `feedback_consistency_spec_mode_budget` 이슈에 이번 사례 추가.
4. [INFO #1, project-planner 턴, `--impl-done` 이후] `0-common.md` §4.2 / `1-http-request.md` §4.2 / `2-database-query.md` §6.2 표에 "SSRF 가드의 비-판정 오류 → `INTEGRATION_CALL_FAILED`" 트리거 사례 한 줄 추가 고려.
5. [INFO #2, 구현 시] `database-query.handler.ts`의 `IntegrationError` 승격 시 `spec/5-system/3-error-handling.md` §6 C1/C2 판정에 따라 `cause` 부착 여부 결정.
6. [INFO #7, 차기 주기 감사] `plan/in-progress/node-output-redesign/http-request.md`·`database-query.md`의 catch 서술을 다음 전수 재검증 라운드에서 갱신.
