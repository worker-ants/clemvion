# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 모두 전문 확보. Critical 발견 없음.

## 전체 위험도
**LOW** — 대상(`spec-draft-review-citations-class-jsdoc`)은 `review-citations.md` §3 표 한 행을 필드/클래스로 가르는 좁은 범위의 문서 정정이며, cross-spec 충돌·Rationale 번복·명명 충돌은 전혀 없고, convention 준수와 plan 정합 두 축에서 각 2건씩(1건 중복) WARNING 만 발견됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, plan_coherence | draft 의 실측이 반증한 "JSDoc → 공개 OpenAPI description" 과잉일반화 문장이 짝 규약 `swagger.md §3` 에도 동일하게(필드/클래스 구분 없이) 남아 있는데, `spec_impact` 와 "구현 위임" 절 어디에도 포함되지 않음 | `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` frontmatter `spec_impact`(L5-6), "구현 위임" 절(L67-70) | `spec/conventions/swagger.md` §3 (L355-367) — `review-citations.md` 신설 §3 표 행과 가드 헤더 주석(`dto-jsdoc-citation.spec.ts` L15-16) 둘 다 이 문장을 근거로 인용 | `spec_impact` 에 `spec/conventions/swagger.md` 추가하고 §3 문장에 "(DTO 필드: 플러그인이 프로퍼티별 description 으로 싣는다 — 클래스 JSDoc 은 실리지 않는다)" 등 필드/클래스 한정을 붙이거나, 스코프를 의도적으로 좁힌 것이면 그 사실을 Rationale 에 명시 |
| 2 | convention_compliance | draft 본문에 project-planner 워크플로가 요구하는 draft 자체의 최상위 `## Rationale` 섹션이 없음(§3 표에 삽입될 blockquote 안의 (A)/(B) 비교와는 별개) | `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` 문서 구조 — `## 실측`→`## 변경안`→`## 구현 위임`으로 종료 | `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3·4항 (본문 끝 `## Rationale` 명시, `--spec` Warning 노트 기재 위치) | 문서 끝에 draft 고유 `## Rationale` 섹션을 추가해 이번 `--spec` 라운드의 WARNING 대응 노트와 draft-레벨 결정 근거 요약을 남긴다 |
| 3 | plan_coherence | 선행 tracker(`spec-draft-nullable-notation-followups.md` ~1277행)가 이 draft 의 결정을 기다리던 체크리스트 항목을 누가/언제 닫을지가 "구현 위임" 절에 없음 | `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` "구현 위임 (developer, 같은 PR)" 절 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `- [ ] Ref DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다` 항목 | "구현 위임" 절에 "완료 후 해당 tracker 체크박스를 닫고 이 결정을 참조로 남긴다" 문구 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 가드 spec 파일(`dto-jsdoc-citation.spec.ts` 17행 부근)의 §3 인용 문구가 draft 반영 후 stale — 단 이미 "구현 위임" 절이 커버 | draft "## 구현 위임" 절 | 조치 불요, review 단계에서 해당 docstring 전체 갱신 여부만 확인 |
| 2 | cross_spec | `spec-impl-evidence.md` §2.1 이 여전히 "응답 DTO 축"(필드+클래스 통합)/"컨트롤러 축" 이분법으로 서술 — 사실 관계 충돌은 아님 | `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 설명 | 비차단. 다음에 해당 문서를 건드릴 때 "응답 DTO(필드·클래스) 축"으로 조금 더 명시 |
| 3 | rationale_continuity | 새 Rationale 절의 "이번 결정에서 처음 나온 선택지다" 단언이 `git log -S` 로 재확인되지 않음(반증되지는 않았음) | 신설 `## Rationale` 절, "그래서 클래스 JSDoc 에 대해 두 방향을 검토했다" 문장 | 커밋 전 `git log -S '클래스' -- spec/conventions/review-citations.md spec/conventions/swagger.md` 로 재확인해 "확인 완료"를 문구에 덧붙이면 다음 검토자 재확인 불요 |
| 4 | rationale_continuity | §3 표 "대상 아님" 결론 자체는 유지되고 근거만 정정되는 구조 — 결정 번복이 아니라 정정임을 재확인 | 변경안 §3 표 두 번째 행 | 변경 불필요, 기록용 |
| 5 | rationale_continuity | 기각한 대안(A: 클래스 JSDoc 인용 허용+가드 완화)의 기각 근거가 `swagger.md` §1-6 "가드/규약 책임 분리" 원칙과 같은 방향 | 신설 Rationale 절 "(A)" 대목 | 변경 불필요 |
| 6 | convention_compliance | 신설 표 행 "두 번째 칸"에 값+부가설명이 섞여 기존 표의 테르스 값 관행(적용/대상 아님 단독)과 다름 | §3 표 신설 두 번째 행 L42 | 두 번째 칸은 `대상 아님`으로 통일, 근거는 세 번째 칸에만 (서식 제안, 비차단) |
| 7 | naming_collision | 새 Rationale 헤더 앵커가 기존 헤더 5개와 겹치지 않음, 저장소 전체에 이 앵커를 가리키는 참조도 없음 | `review-citations.md` 신설 Rationale 헤더 | 조치 불요 |
| 8 | naming_collision | 신설 헤더의 `§3` 라벨이 `swagger.md` 자신의 `§3` 과 이름은 겹치나 파일 스코프가 달라 기존에도 있던 관행 | review-citations.md vs swagger.md 각자의 §3 | 조치 불요, 교차 인용 시 문서명 명시 관행 유지 권장 |
| 9 | naming_collision | 신설 표 행 라벨 "응답 DTO 클래스"가 `swagger.md` §5-1·review-citations.md 자신의 기존 용어와 일관 | 신설 표 행 | 조치 불요 |
| 10 | naming_collision | 구현 위임이 가리키는 `plan/in-progress/dto-class-jsdoc-citation.md` 는 아직 미생성, 명명 관례에는 부합 | draft "구현 위임" 절 | developer 착수 시 파일 미존재 재확인만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터모델·API계약·요구사항ID·상태전이·RBAC·계층책임 어느 축도 미충돌. 실측 주장 전부 1차 소스로 재확인됨 |
| rationale_continuity | NONE | §3 "대상 아님" 결론은 유지, 근거만 정정. 신설 Rationale 이 과거 결정 번복 없이 (A)/(B) 비교·기각 사유 명시 |
| convention_compliance | LOW | draft 자체의 `## Rationale` 섹션 누락(WARNING), swagger.md §3 동일 문장 미동기화(WARNING), 표 서식 사소한 불일치(INFO) |
| plan_coherence | LOW | swagger.md §3 짝 규약 미동기화(WARNING, convention_compliance 와 중복), 선행 tracker 체크리스트 닫는 절차 누락(WARNING) |
| naming_collision | NONE | 신규 엔티티/DTO/endpoint/이벤트명/ENV 미도입. 표 라벨·Rationale 헤더 앵커 모두 기존 관행과 일관, 충돌 0건 |

## 권장 조치사항
1. `spec_impact` 에 `spec/conventions/swagger.md` 를 추가하고 §3 의 과잉일반화 문장에 필드/클래스 한정을 붙이거나(권장), 스코프를 의도적으로 좁힌 것이라면 그 사실을 draft 의 Rationale 에 명시한다 (WARNING #1).
2. draft 본문 끝에 project-planner SKILL 이 요구하는 draft 고유 `## Rationale` 섹션을 추가해 이번 `--spec` 라운드 WARNING 대응 노트를 남긴다 (WARNING #2).
3. "구현 위임" 절에 완료 후 `spec-draft-nullable-notation-followups.md` 의 관련 체크박스를 닫으라는 문구를 추가한다 (WARNING #3).
4. (선택) §3 표 신설 행의 두 번째 칸 서식을 기존 관행(`적용`/`대상 아님` 단독 값)에 맞춘다 (INFO #6).