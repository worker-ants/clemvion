# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — Critical 없음. 실행 가능한 WARNING 4건(정정 비용 낮음) + INFO 5건(참고 수준). target(`plan/in-progress/spec-draft-scope-and-anchor-drift.md`)은 신규 엔티티/API/식별자를 발명하지 않는 순수 spec 정정 draft로, 5개 checker 전원이 코드/spec 실측 대조에서 직접 모순을 찾지 못했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §2.2 신설 "자원 액션" 규칙이 §12.1 "상태 토글 패턴" 과의 경계를 안 그음 — boolean 토글 필드에도 신규 verb-action 규칙이 오적용될 잠재 위험 | `plan/.../spec-draft-scope-and-anchor-drift.md` "③ §2.2" 변경안(A) | `spec/5-system/2-api-convention.md` §12.1 (line 403-417) | 변경안(A) 새 행 말미에 "boolean 상태 필드 단순 토글에는 적용하지 않는다 — §12.1 PATCH 패턴을 따른다" 문장 추가, 두 절 상호 참조 |
| 2 | rationale_continuity + convention_compliance | ④ Rationale 인용문의 출처가 오귀속됨 — `spec-conventions-engine-error-code-surface.md` 를 인용했다고 표시했으나 해당 문서에는 그 문장이 없음 | target `## Rationale` → "④ 를 '코드를 전부 const 로 옮기기' 로 하지 않은 이유" (약 256~261행) | 실제 원문은 `plan/complete/exec-intake-followups.md:56` ("셋 다 이미 타입 앵커가 있다. 상수로 또 옮기면 앵커가 둘이 되어 갈라진다.") | 인용 출처를 `exec-intake-followups.md` ARCH#5 ④ 로 정정하거나 두 문서 병기. 인용부호 문자 단위 일치 확인 |
| 3 | convention_compliance | ③ 변경안(A) 표 셀이 멀티라인으로 작성돼 있어 그대로 §2.2 표에 삽입하면 GFM 파이프 테이블 문법이 깨짐(표가 붕괴된 문단으로 렌더링) | target "## ③" → "### 변경안 (A)" (본문 149~156행) | `spec/5-system/2-api-convention.md` §2.2 기존 3개 예외 행(53~55행, 전부 한 줄 작성 선례) | 변경안(A)을 실제 삽입 시 한 줄로 합칠 것을 draft 에 명시하거나 애초에 한 줄로 제시 |
| 4 | plan_coherence + cross_spec | ①②③ 이 자매 plan `spec-draft-nullable-notation-followups.md` 의 열린 후속 체크박스 3건(§5.4 응답 바디 스코프 문구·§2.2 단일 동사 action 패턴·`3-schedule.md` §2.1)을 출처 표기까지 일치하도록 그대로 해소하는데, target 이 이 사실을 명시하거나 해당 체크박스를 닫겠다고 선언하지 않음 (④는 동일 패턴을 명시적으로 처리해 대조됨) | target ①②③ 전체 | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션 3개 unchecked 항목 + `## 종결 조건` | target 반영 커밋(또는 후속 커밋)에서 자매 plan 의 해당 3개 체크박스를 `[x]` 로 닫고 target 문서를 근거로 교차 링크. target 본문에 (④처럼) "이 변경 착지 시 자매 plan 체크박스도 함께 닫는다" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | ② 변경안이 인용하는 `1-data-model.md §2.9` 는 NULL 원인 중 절반(cron 파싱 실패)만 서술 — 두 원인(파서 예외 + `computeNextRuns` 빈 결과) 모두 갖춘 문서는 `data-flow/10-triggers.md §3.2` | target "② `3-schedule.md` §2.1" 변경안 | 링크를 `data-flow/10-triggers.md#32-...` 로 잡거나 병기, 또는 `2-trigger-list.md:100` 선례 표기와 통일 |
| 2 | convention_compliance | ② 데이터모델 링크에 섹션 앵커 프래그먼트(`#29-schedule`) 누락 — 같은 문서 18행 기존 선례는 앵커 포함 | target "② 변경안" (본문 96~99행) | `[데이터 모델 §2.9](../1-data-model.md#29-schedule)` 로 보완 |
| 3 | convention_compliance + naming_collision | ③ 신규 행 레이블 `**자원 액션**:` 이 §2.2 기존 "예외 — " 접두 관행과 다름(의도적 설계, Rationale 에 자체 정당화됨, 강제 규약 위반 아님) | target "③ 변경안(A)" (150행) + Rationale (245~250행) | 현행 유지 가능. 표 상단에 "행 종류가 섞여 있다" 안내 문구 고려 |
| 4 | plan_coherence | ④ 는 자매 plan(`spec-conventions-engine-error-code-surface.md`) 체크박스의 3개 하위 항목 중 2개만 해소(`error-codes.ts` JSDoc 은 developer 트랙으로 명시적으로 넘김) — 의도된 부분 해소이나 자매 plan 쪽 반영 필요 | target ④-a/④-c | target 착지 시 자매 plan 체크박스를 하위 3개로 쪼개거나 "2/3 완료, JSDoc 잔존" 문장 반영 |
| 5 | plan_coherence | ①③ 이 같은 파일(`2-api-convention.md`) §5.4·§2.2 를 자매 plan 이 이미 반영한 레이어 위에 순차 편집 — 동시-편집 경고 문구 부재(내용 충돌은 실측상 없음) | target 전체 (①·③) | 낮은 우선순위, 별도 조치 없이도 통과 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §2.2/§12.1 경계 미기술(WARNING), 나머지는 실측 정합 확인·자매 plan 동기화·링크 정밀도(INFO) |
| rationale_continuity | LOW | ④ Rationale 인용 출처 오귀속(WARNING, 사실 자체는 실재·반증 안 됨) 외 전 항목 정상 패턴 |
| convention_compliance | LOW | ④ 인용 오귀속 + ③ 표 서식 GFM 붕괴 위험(WARNING 2건), 나머지 규약·선례 정합 확인 |
| plan_coherence | LOW | ①②③ 자매 plan 체크박스 미동기화(WARNING), ④/①③ 은 INFO 수준 |
| naming_collision | NONE | 신규 식별자 3종(tri-state·자원 액션·앵커) 전부 기존 코퍼스와 비충돌 확인, 발견 없음 |

## 권장 조치사항
1. ④ Rationale 인용 출처를 `plan/complete/exec-intake-followups.md:56` 로 정정 (WARNING #2) — 가장 저비용.
2. ③ 변경안(A) 표 셀을 한 줄로 정리하거나 "삽입 시 한 줄화" 안내 추가 (WARNING #3).
3. ③ §2.2 신규 규칙과 §12.1 상태 토글 패턴의 적용 경계를 한 문장으로 명시 (WARNING #1).
4. target 반영과 함께(또는 후속 커밋으로) 자매 plan `spec-draft-nullable-notation-followups.md` 의 3개 체크박스를 닫고 교차 링크 (WARNING #4).
5. INFO 5건은 우선순위 낮음 — 여유 있을 때 링크 앵커 보완(INFO #2) 및 자매 plan `spec-conventions-engine-error-code-surface.md` 부분 해소 반영(INFO #4) 권장.
