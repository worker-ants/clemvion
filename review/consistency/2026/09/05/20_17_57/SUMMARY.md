# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음(cross_spec: LOW, rationale_continuity: LOW, convention_compliance: LOW, plan_coherence: LOW, naming_collision: NONE). 전문 5/5 확보(모두 성공 반환 + 인라인 전문 확인, 디스크 파일도 기존재).

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-notification-secret-storage.md`, 이미 3라운드 `--spec` 검토를 거쳐 `spec/**`에 반영된 4차 확인)에 CRITICAL 없음. WARNING 4건은 전부 "이미 내린 결정의 문서 배치/상호참조 정합"에 관한 것으로 실행 가능한 저비용 수정으로 해소 가능.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | "반증 1"이 `chat-channel.md R-K`의 결정 범위(컬럼 **명명**의 semantic 직교)를 저장 **형태**(ref vs 평문) 직교로 넓혀 인용. 같은 문서 뒷부분("기각한 대안" 절)과 내부 자기모순이고, 이미 병합된 `EIA §7.1:922`("그 결정은 R-K가 소유한다")에도 전파됨 | plan 파일 §② "반증 1"(68~77행), Rationale 절(262~264행) | `spec/5-system/15-chat-channel.md` R-K 원문(컬럼 명명만 결정, 저장형태 언급 없음) vs `spec/5-system/14-external-interaction-api.md:922` | "반증 1"을 "R-K는 의미상 직교만 결정, 저장형태 직교는 `secret-store.md §1` 신규 예외 문단(+ §1.5 승격 경로)이 근거"로 좁히고, Rationale 절의 "R-K를 다시 여는 별도 결정" 문구도 동일 방향 정정. 이미 병합된 `EIA §7.1:922`도 후속 정정 대상으로 트래커에 등재 |
| 2 | convention_compliance | §1.1 삽입으로 `notification_secret_v2` 비대상 예외의 재사용 방지 닫음 note("다음 필드가 이 문단을 인용하려면…")가 새 §1.1 뒤로 밀려나 대상과 시각적으로 분리됨. 파일 고유의 "섹션당 `---` 1개" 관행과도 어긋남(§1만 `---` 2개) | `spec/conventions/secret-store.md` §1, 항목4~§1.1~`## 2.` 사이(60~109행) | 파일 자체의 서식 관행(§2~§7 전 구간 `---` 1개) 및 §1 자신이 선언한 "세 번째 필드 예외 방지" 불변식 | 닫음 note(103~105행)를 항목4 바로 뒤로 되돌리고 `### 1.1`을 그 뒤·단일 `---` 앞으로 재배치(헤딩 앵커 불변, 텍스트 이동만) |
| 3 | plan_coherence | 신설 `secret-store.md §1.1`(응답 DTO 비선언 규범)과 진행 중인 `spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 2단계"(TriggerDto/ScheduleDto에 검증자 배선) 후속이 같은 표면(TriggerDto)을 겨냥하는데 상호 참조가 없음 — 2단계가 "DTO에 필드 추가해 RED 해소"를 고르면 방금 세운 §1.1을 위반 | `spec/conventions/secret-store.md §1.1` | `plan/in-progress/spec-draft-nullable-notation-followups.md:331`("§5.4 drift 배치 2단계") 및 `:615`("트리거 회전 secret 유출 차단") | `:331` 항목에 caveat 한 줄 추가 — "TriggerDto/ScheduleDto 도달 시 notificationSecretV2/chatChannelTokenV2는 선언 금지(secret-store.md §1.1), RED 해소는 응답 스트립으로만" |
| 4 | plan_coherence + cross_spec (통합, 최강 등급 채택) | `1-data-model.md §2.8`의 `notification_secret_v2` 행에 저장 형태(평문) 미기술 — 자매 행(`chat_channel_token_v2`, "reference")과 서술 밀도 비대칭. 이 후속이 draft 본문 prose bullet에만 있고 체크박스 트래커(`spec-draft-nullable-notation-followups.md`)에 없어, draft가 `plan/complete/`로 이동되는 순간 추적 수단이 사라짐(`spec_impact`에도 `1-data-model.md` 미등재) | draft `### 후속 (이 PR 밖)` 절(203행 부근, INFO#2 항목) | `spec/1-data-model.md:240`(저장형태 미기술) vs `:245`(명시적 "reference") | `spec-draft-nullable-notation-followups.md`의 `## 후속` 체크박스 절에 `- [ ] 1-data-model.md §2.8 notification_secret_v2 행 저장 형태 명시` 로 옮겨 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | §7.1 "ref만 보관" 오기술의 최초 출처가 `ad0ea7cdb`(#264, 2026-05-22)이고 코드(`triggers.service.ts` 평문 rotation, 그 이전 커밋)와 애초부터 무관한 aspirational 서술이었다는 사실이 target 서사에 없음 | draft §② "그래서 바뀌는 결론" 표 / "그래도 남는 것" 절 | 원 출처(`ad0ea7cdb` #264) 한 줄 추가 권장(필수 아님) — "왜 3.5개월간 못 잡았나"에 답을 남겨 재발 방지 |
| 2 | convention_compliance | 신설 `### 1.1` 헤딩 바로 위에 빈 줄 없이 blockquote 잔여 줄(`>`) 남음 | `spec/conventions/secret-store.md` 81~82행 | 81~82행 사이 빈 줄 1개 삽입 |
| 3 | convention_compliance | `select:false`(공백 없음, 72행) vs `select: false`(공백 있음, 95행) 표기 불일치. 기능 영향 없음, 선행 사례(followups.md)에도 이미 존재 | `spec/conventions/secret-store.md` 72행·95행 | 우선순위 낮음 — 다음에 그 문단을 손댈 때 `select: false`(TypeORM 실제 표기)로 통일 |
| 4 | plan_coherence | draft 자신의 1차 반영 "후속" 항목(:199-202, "미머지 브랜치 문구 정정")이 2차 반영 I6(:235)에서 이미 정정("여기서 고쳤다")됐는데 앞쪽 블록이 갱신 안 됨 | draft :199-202 vs :235(I6) | :199-202에 취소선 또는 "→ 2차 반영 I6에서 해소 확인" 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 데이터모델·API계약·요구사항ID 전 축 정합 확인. `1-data-model.md §2.8` 서술 밀도 비대칭 INFO 1건(→ WARNING#4로 plan_coherence와 통합) |
| rationale_continuity | LOW | "반증 1"의 R-K 오귀속(문서 내부 자기모순 + 병합된 EIA §7.1:922로 전파) WARNING 1건, §7.1 오기술 출처 미기재 INFO 1건 |
| convention_compliance | LOW | §1.1 삽입으로 닫음 note 위치 이탈 WARNING 1건, 서식 사소 INFO 2건. 명명·API문서·금지항목·문서구조·review-citations 규약 전부 준수 확인 |
| plan_coherence | LOW | §1.1 vs §5.4 drift 배치 2단계 상호참조 부재 WARNING 1건, `1-data-model.md` 후속 트래커 누락 WARNING 1건(cross_spec과 통합), 1차반영 미갱신 INFO 1건 |
| naming_collision | NONE | 신규 식별자(§1.1 섹션번호, `notification_secret_v2` 예외 등재, `code:` glob) 전부 코퍼스 대조 결과 충돌 없음. 위반 0건 |

## 권장 조치사항
1. `secret-store.md` §1 닫음 note를 §1.1 삽입 이전 위치(항목4 직후)로 되돌리고 `---` 중복 정리 (WARNING#2 — 저비용, 즉시 가능)
2. `spec-draft-nullable-notation-followups.md:331`에 "TriggerDto/ScheduleDto 도달 시 secret 필드 선언 금지(§1.1)" caveat 추가 (WARNING#3 — 향후 §5.4 drift 배치 2단계 담당자의 오판 방지)
3. `1-data-model.md §2.8` 저장형태 명시 후속을 `spec-draft-nullable-notation-followups.md` 체크박스 트래커로 이관 (WARNING#4 — draft archive 전 유실 방지)
4. draft §② "반증 1" 문구를 R-K 결정 범위에 맞게 좁히고, 병합된 `EIA §7.1:922`의 "그 결정은 R-K가 소유한다" 문장도 후속 정정 대상으로 트래커 등재 (WARNING#1 — 다음 편집자가 잘못된 문서로 안내되는 것 방지)
5. INFO 4건은 우선순위 낮음, 다음 해당 문단 편집 시 함께 처리 권장
