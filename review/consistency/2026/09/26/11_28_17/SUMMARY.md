# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원: cross_spec=NONE, rationale_continuity=NONE, convention_compliance=LOW, plan_coherence=LOW, naming_collision=LOW)

## 전체 위험도

**LOW** — 직전 라운드(`11_12_24`)가 낸 Critical 1건(§5-4 문구 ↔ data-flow 채택안 불일치)은 커밋 `f262a638e`·`eb40cc802` 로 해소가 실측 확인됐고, 이번 라운드 신규 발견은 WARNING 2건(§3 길이표 공백, 근접 상수명)과 INFO 다수뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance / rationale_continuity | §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표가 이번 변경이 129~157곳에 채워 넣는 `@ApiForbiddenResponse({ description })` 등 응답 데코레이터 `description` 범주를 여전히 분류하지 않는다. plan(`forbidden-desc-codes.md` "검토 경고 처리" 표 W2)은 이미 "트래커 신규 등재·이 PR 범위 밖"으로 defer 했고 자신의 "요구" 7단계에 그 등재를 넣어 뒀지만, 실측(`grep -rn "응답 데코레이터" plan/`) 결과 아직 등재가 이뤄지지 않았다 | `spec/conventions/swagger.md` §3 길이표 | `spec/conventions/swagger.md` §5-4 (129~157곳 신규 문구 생성원) | CRITICAL 은 아님(§3 은 지향 범주 위주, plan 이 스스로 닫기로 약속). 다만 이 PR 종결(7단계) 전 §3 표에 최소 각주 한 줄("`@ApiXxxResponse` 는 이 표 밖, 지향/무제한") 실제 반영 여부를 `--impl-done` 단계에서 재확인 |
| 2 | naming_collision | 신규 헬퍼 상수 `FORBIDDEN_NOT_A_MEMBER` 가 기존 module-private 상수 `FORBIDDEN_MEMBER`(`integrations.controller.ts:96`)·`FORBIDDEN_MEMBER_ROUTE`(`workspaces.controller.ts:71`)와 이름이 매우 근접해, "흡수"(spec 명시)가 완료되기 전 중간 상태에서 어느 것이 최신 SoT 인지 혼동 위험 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신설 예정) | `codebase/backend/src/modules/integrations/integrations.controller.ts:96`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71` | 구현 plan 5단계(129곳 교체 + 상수 흡수) 완료 시 `FORBIDDEN_MEMBER`/`FORBIDDEN_*_ROUTE` 계열 로컬 상수가 삭제(재-export 로 잔존하지 않음)됐는지 전수 grep 으로 확인 후 plan 체크리스트에 반영 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity / convention_compliance / cross_spec / plan_coherence | 직전 라운드(`11_12_24`) Critical(§5-4 문구가 data-flow 채택안(나)과 어긋남)이 커밋 `f262a638e`·`eb40cc802` 로 해소됨을 4개 checker 모두 실측 확인 | `spec/conventions/swagger.md` §5-4, `## Rationale` | 없음 — 재발 방지용 기록 |
| 2 | rationale_continuity | "가드가 이 짝을 강제한다"(양방향으로 읽힘) → "빠진 가드 코드만 잡는다"로의 방향 축소는 같은 세션 내 과장 반증·정정 사례이며 Rationale·plan 처분 표 양쪽에 근거가 남아 있음 | `spec/conventions/swagger.md` §5-4 마지막 문장 | 없음 |
| 3 | convention_compliance | 신규 guard 파일 경로(`forbidden-response-codes*.ts`)가 아직 코드로 존재하지 않는 채로 `code:` frontmatter 에 먼저 등재됐으나, `spec-code-paths.test.ts` 가드는 목록 중 최소 1개 매치만 요구하므로(swagger.md 는 이미 다른 엔트리로 충족) 규약 위반 아님 | `spec/conventions/swagger.md` frontmatter `code:` 마지막 줄 | 없음 |
| 4 | plan_coherence | `plan/in-progress/integration-personal-owner-followup.md` L44 의 신규 상호 포인터가 아직 존재하지 않는 `plan/complete/forbidden-desc-codes.md` 를 가리킴(원본은 현재 `plan/in-progress/`) | `plan/in-progress/integration-personal-owner-followup.md` L44 | 당장은 `plan/in-progress/forbidden-desc-codes.md` 로 수정하거나 "이동 후 유효" 임을 명시. `forbidden-desc-codes.md` 가 `complete/` 로 이동하는 커밋에서 이 링크도 함께 갱신하도록 그 plan 체크리스트에 한 줄 추가 |
| 5 | cross_spec | integrations 4곳(`@Roles('editor')`) 의 Viewer 자기 personal 키 권한 결정은 `integration-personal-owner-followup.md` 로 미결정 상태이나, target 의 403 설명 갱신은 "지금 역할에 맞는 설명"만 반영하고 그 순서를 바꾸지 않음 — 이미 plan 상호 포인터로 인지·처분됨(WARNING 표 참고) | `spec/2-navigation/4-integration.md` §8, `plan/in-progress/integration-personal-owner-followup.md` | 없음(플랜 처분 유지 확인만) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 직전 Critical 해소 확인 + RBAC/에러코드/naming 전 영역 정합, 신규 CRITICAL/WARNING 없음 |
| rationale_continuity | NONE | 직전 Critical 해소, 방향 축소도 일관, §3 갭은 이미 defer 됨(INFO) |
| convention_compliance | LOW | §3 길이표가 응답 데코레이터 `description` 미분류(WARNING, 아직 미등재 실측) + 직전 Critical 해소 확인 |
| plan_coherence | LOW | 직전 Critical/WARNING/INFO 전부 해소 확인, 신규는 dangling forward-reference(INFO) 1건뿐 |
| naming_collision | LOW | 신규 식별자 4종 충돌 없음, 단 `FORBIDDEN_NOT_A_MEMBER` ↔ 기존 `FORBIDDEN_MEMBER*` 근접명(WARNING) |

## 권장 조치사항

1. (WARNING 1) `--impl-done` 단계에서 §3 길이 규약 표에 응답 데코레이터(`@ApiXxxResponse` description) 범주 각주가 실제로 추가됐는지 확인 — plan 이 스스로 약속한 트래커 등재가 이번 검토 시점까지 미실행 상태였음.
2. (WARNING 2) 구현 5단계 완료 시 `FORBIDDEN_MEMBER`/`FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 등 옛 로컬 상수가 삭제됐는지 전수 grep 으로 확인.
3. (INFO 4) `integration-personal-owner-followup.md` L44 의 `plan/complete/forbidden-desc-codes.md` 링크를 현재 유효 경로(`plan/in-progress/`)로 수정하거나, 이동 시 함께 갱신하도록 체크리스트에 명시.
4. 그 외 조치 불요 — 구현 착수를 막을 미해결 결정 충돌 없음.
