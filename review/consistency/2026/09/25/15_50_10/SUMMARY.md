# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 전문 확보(모두 인라인 authoritative, 재시도 필요 없음).

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(cross_spec: 동일 전파 누락 결정의 세 번째 미반영 지점), 나머지는 INFO/NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 같은 decision("경로 파라미터 워크스페이스는 header-first/토큰-클레임이 아니라 경로 값 자체가 인가 대상")의 전파 누락이 draft 가 잡은 두 곳(`9-user-profile.md` §3, `1-auth.md` 부트 캐너리 (b)) 외에 `spec/5-system/2-api-convention.md` §2.3 에도 남아 있음. §2.3 은 "모든 리소스 API" 전칭으로 header-first→토큰-클레임 모델을 서술하며 새 경로 파라미터 예외를 반영하지 않음 | 변경 1 (`spec/2-navigation/9-user-profile.md` §3 각주 추가 부분) | `spec/5-system/2-api-convention.md` §2.3 "워크스페이스 스코핑" (실측 line 82) | §2.3 에도 변경 1 과 동일 패턴(각주 추가, 원문 보존)으로 "경로 파라미터로 워크스페이스를 받는 라우트는 예외" 각주 추가, 또는 draft `spec_impact` 에 이 파일을 추가해 이번 턴 처리/명시적 defer 결정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 변경 4 의 일반 원칙("발행된 적 없는 코드는 §5 에 오지 않는다")이 §5 머리말에 들어가지만 실제 선례(`forbidden` 제거 처리 기록)는 §3 행 비고에 있어, §5 만 읽는 사람은 실제 기록을 못 찾을 수 있음 | `error-codes.md` §5 첫 문단 뒤 추가문 (변경 4) | (선택) §5 추가문 끝에 "실제 처리 기록은 §3 [해당 행]" 역참조 한 줄 추가. 이번 턴 필수 아님 |
| 2 | convention_compliance | Rationale "기각한 대안" 문단의 "저장소의 `code:` 는 전부 개별 glob" 문장이 스코프(repo-guards 테스트 한정) 미명시 — `spec-impl-evidence.md` §R-1 의 디렉터리 glob 허용 원칙과 문맥상 충돌하는 것처럼 읽힐 수 있음(실제로는 좁은 의미로 정확) | `## Rationale` "기각한 대안" 문단 (파일 끝에서 세 번째 문단) | 변경 3 을 실제 spec 에 반영할 때 "repo-guards 항목 한정" 등 한정어 추가하여 후속 세션의 일반화 인용 방지 |
| 3 | naming_collision | draft 는 새 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 경로)를 하나도 신설하지 않음 — 전부 `e2e257707` 이 이미 만든 앵커/데코레이터/가드파일/엔드포인트의 미러링·등재뿐 | 변경 1~4 전체 | 없음(문제 없음, 기록 목적) |
| 4 | naming_collision | 직전 `--impl-prep`(`15_15_21`) WARNING #5(`workspace-param-binding` vs `workspace-roles-attachment` 명명 근접)는 코드 docstring("## 이웃 가드와의 경계")으로 이미 해소됨. 이 spec-write-only draft 범위 밖인 것이 올바른 스코프 판단 | (해당 없음 — draft 가 다루지 않는 항목) | 없음. 향후 checker 가 이 WARNING 을 미해소로 재-flag 하면 오탐 |
| 5 | naming_collision | plan 파일명 `spec-draft-workspace-path-guard-followup.md`(단수)이 유일 선례 `spec-draft-nullable-notation-followups.md`(복수)와 단/복수 표기가 갈림. 실제 경합·충돌은 없음 | 파일명 `plan/in-progress/spec-draft-workspace-path-guard-followup.md` | 강제 조치 불요. 후속 `spec-draft-*-followup(s)` 명명 시 한쪽으로 고정해 관례화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `2-api-convention.md` §2.3 이 동일 decision 의 세 번째 전파 누락 지점(WARNING 1건). 그 외 전 인용문·앵커·가드 파일 존재 실측 전부 정합 |
| rationale_continuity | NONE | 새 결정 없음, 기존 착지된 decision 의 미러링만 확인. §5/§3 인용 위치 가독성 INFO 1건 외 문제 없음 |
| convention_compliance | LOW | frontmatter·앵커·`code:` 등재 패턴·경로 표기 전부 규약 정합. Rationale 문구 스코프 미명시 INFO 1건 |
| plan_coherence | NONE | W1~W3·INFO1 전부 `--impl-prep` 이 위임한 방향과 문장 단위 일치, 다른 in-progress plan 과 겹침 없음. 발견사항 없음 |
| naming_collision | NONE | 신규 식별자 0건(전부 기존 재참조). 이전 WARNING 코드 레벨 해소 확인. 파일명 단/복수 INFO 1건 |

## 권장 조치사항
1. (선택, BLOCK 사유 아님) `spec/5-system/2-api-convention.md` §2.3 에 경로 파라미터 워크스페이스 예외 각주를 추가하거나, draft `spec_impact` 에 명시적으로 추가/defer 결정 — cross_spec WARNING 해소
2. (선택) 변경 3 spec 반영 시 "저장소의 `code:` 는 전부 개별 glob" 문구에 "repo-guards 항목 한정" 한정어 추가
3. (선택) `error-codes.md` §5 추가문에 §3 처리 기록 역참조 한 줄 추가
4. (선택) 향후 `spec-draft-*-followup(s)` 명명 단/복수 통일

---
※ 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 인라인 전문 확보. 재시도 필요 checker 없음.
