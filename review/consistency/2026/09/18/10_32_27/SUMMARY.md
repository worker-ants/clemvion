# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 없음. 전문 확보 못 한 checker 없음(5/5 인라인 전문 확보, 디스크 파일도 이미 전부 존재 확인 — 별도 영속화 불요).

## 전체 위험도

**LOW** — CRITICAL 0건. WARNING 1건(C3 두 YAML 블록 중 하나에만 남은 "네 경로 모두" 과잉 일반화, 인접 블록에서 이미 자체 교정한 것과 같은 결함 클래스). 나머지는 전부 INFO(조치 불요 또는 후속 참고용).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | C3 첫 번째 `code:` YAML 블록 주석 "네 삭제 경로와 쓰기 보상이 **모두** 이 둘을 지난다"가 사실과 다름 — `SchedulesService.remove()`는 `trigger-resource-releaser.service.ts`를 지나지 않고 순수 함수(`trigger-resource-release.ts`)만 직접 호출(grep·JSDoc으로 확인: 서비스 클래스 자신이 "스케줄 삭제만 이 서비스를 쓰지 않는다"고 명시). 같은 C3의 두 번째 YAML 블록(e2e 주석)은 1회차 검토에서 정확히 같은 오탐 패턴을 이미 자체 교정했는데 인접한 첫 블록은 빠짐 | `plan/in-progress/spec-draft-deletion-release-current-tense.md` C3 첫 번째 YAML 블록 2번째 줄 | `trigger-resource-releaser.service.ts` JSDoc("스케줄 삭제만 이 서비스를 쓰지 않는다"), `schedules.service.ts`(releaser.service.ts import 없음) | 주석을 커버리지대로 좁힌다 — 예: "순수 함수(`trigger-resource-release.ts`)는 네 경로 모두, 서비스 배선(`trigger-resource-releaser.service.ts`)은 트리거·워크플로·워크스페이스 삭제 셋만 지난다 — schedule은 모듈 순환 때문에 순수 함수를 직접 부른다." |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `5-system/15-chat-channel.md` §R8 "teardownChannel() (또는 TriggersService.remove)" 서술이 여전히 "teardownChannel() 호출"과 "삭제 경로들"을 별개 조건처럼 병렬 나열 — 실제 코드는 유일 호출부(`TriggerResourceReleaserService.releaseExternalMany`)뿐이라 독립적 teardownChannel() 호출 경로는 없음. draft 범위 밖의 pre-existing 모호성 | `spec/5-system/15-chat-channel.md` §R8, target C9 | 이번 PR 범위 조치 불요. 후속으로 `CCH-AD-03` disable 절반 구현 여부를 `/spec-coverage`나 별도 트래커 항목으로 확인 권고 |
| 2 | rationale_continuity | C10/R-11 공유 트래커 승격 예외는 자동 가드(`spec-status-lifecycle.test.ts`)가 보지 않는 방향 — "판정 근거를 승격 commit에 남긴다"는 절차적 규율에만 의존. draft 스스로 이 한계를 명문화함 | `spec/conventions/spec-impl-evidence.md §3.1` 신설 자식 불릿 + R-11 | 조치 불요(이미 명문화·2회차 WARNING으로 이미 반영). 후속으로 이 예외 재사용 시 "공유 트래커 승격 판정 커밋 존재" 체크를 advisory 가드에 추가하는 것 고려 |
| 3 | rationale_continuity | `spec-impl-evidence.md §3.1` 자식 불릿 삽입 위치(3번째 항목 아래 2칸 들여쓰기)가 기존 리스트 구조와 충돌 없음 — 확인 완료, 조치 불요 | `spec/conventions/spec-impl-evidence.md §3.1` | 없음(확인 완료) |
| 4 | convention_compliance | C10 삽입 지시문의 `>`가 리터럴 blockquote 문법인지 "인용 표시 장치"인지 불명확 — C1은 "인용 블록이라 `>` 유지"를 명시했지만 C10은 그렇게 밝히지 않아, 실제 적용 시 §3.1에 불필요한 중첩 blockquote가 생길 위험 | draft §"C10. spec/conventions/spec-impl-evidence.md §3.1 · 새 R-11" | C10 지시문에도 "`>`는 draft 내부 인용 표시일 뿐, 실제로는 `  - `만 삽입"이라고 한 줄 명시 |
| 5 | plan_coherence | 새로 문서화하는 "권한 선검사 → 외부 해제 → 잠금 재검사 거부" 잔여 창이 #1345의 D7 카탈로그(D7-1/2/3)에 편입되지 않음 — spec(C1)에는 정확히 서술됐으나 번호 붙은 잔여 창 카탈로그 층위에는 없어 향후 D7 시리즈를 세는 사람이 놓칠 수 있음 | target C1 새 문단, Rationale "권한 선검사 창을 잔여 목록에 넣는 이유" | 차단 사유 아님. 트래커의 sweeper 항목 본문에 포인터 한 줄 추가 권고 |
| 6 | naming_collision | 새 plan 파일명 `spec-draft-deletion-release-current-tense.md`이 기존 완료 plan `spec-draft-deletion-releases-trigger-resources.md`(#1345)·`trigger-deletion-release.md`(#1346)와 접두어 공유(단수/복수 한 글자 차이) — 계보 관계가 본문에 명시돼 있어 실질 오인 위험은 낮음 | `plan/in-progress/spec-draft-deletion-release-current-tense.md` | 이름 변경 불요. 향후 같은 계열 문서 추가 시 더 구분되는 접미어 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 8개 spec 문서 간 사실관계(잠금 순서·5초 락 상한·secret_store 정리 4경로·unregister 단일 호출부) 전부 코드와 일치. 직전 라운드 지적(문서 개수 오기, anchor placeholder) 모두 재검증으로 해소 확인. 잔여는 chat-channel §R8 pre-existing 모호성(INFO) 하나 |
| rationale_continuity | LOW | #1345 D1~D7 계약 재도입·번복 없음. C9(listener unregister 범위 확장)는 #1345가 예고한 후속의 정상 이행. C10(R-11) 신규 정책은 결정 번복 정상 경로(새 Rationale 동반) 충족, 감사 근거(17개 중 6개 열림) 독립 재현 검증 완료 |
| convention_compliance | LOW | 이전 두 라운드 CRITICAL(anchor placeholder)·WARNING(§3.1 승격 조건 명문화 누락) 모두 실질 해소 확인(slug 파이프라인 독립 재계산으로 정확 일치 검증). frontmatter·code: 주석·명명 체계 위반 없음 |
| plan_coherence | LOW | CRITICAL 없음, «결정 필요» 우회 없음. C3 두 YAML 블록 중 하나에 남은 과잉 일반화 1건(WARNING) — 인접 블록에서 이미 같은 결함 클래스를 자체 교정했으면서 놓친 자리 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV키 신설 없음. 유일 신규 식별자 R-11은 기존 R-1~R-10과 무충돌. code: 4개 경로 중복 등재 없음(schedule-trigger.e2e-spec.ts 이중 인용은 기 확립된 컨벤션 재사용) |

## 권장 조치사항

1. (WARNING 해소) C3 첫 번째 YAML 블록의 "네 삭제 경로와 쓰기 보상이 모두 이 둘을 지난다" 주석을 실제 커버리지대로 좁힌다 — schedule 삭제는 순수 함수만 지나고 서비스 배선(`trigger-resource-releaser.service.ts`)은 트리거·워크플로·워크스페이스 셋만 지난다는 점을 명시.
2. (선택) C10 삽입 지시문에 `>`가 draft 내부 인용 표시일 뿐 실제 삽입 내용이 아님을 한 줄 명시.
3. (선택, 차단 아님) 트래커의 sweeper 재판단 항목 본문에 "권한 선검사→외부 해제→잠금 재검사 거부" 잔여 창 포인터 한 줄 추가 — D7 카탈로그류가 향후 이 창을 놓치지 않도록.
4. 나머지 INFO 항목은 조치 불요(이미 명문화됐거나 draft 범위 밖 pre-existing 사안).
