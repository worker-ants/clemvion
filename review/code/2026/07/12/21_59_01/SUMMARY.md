# Code Review 통합 보고서 (carousel 잘림 배너)

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 2(테스트 커버리지 갭·검증 로직 중복). documentation·user_guide_sync disk-write gap(내용 미회수) — fresh 리뷰 라운드에서 재실행되며 해소 예정.

## Critical
없음.

## 경고 (WARNING) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | testing | AI `render_carousel` top-level `PresentationPayload.truncation` → `truncated`/`totalCount` 투영 경로 미검증(toTable 은 촘촘). 신규 테스트는 output 직접 주입만 | ✅ top-level truncation 흡수 경로 unit 테스트 추가(toTable 대칭) |
| 2 | maintainability | `totalCount` 신뢰성 판정이 toCarousel/toTable 인라인 복제 — as* 헬퍼 관례 위반 | ✅ 공용 `asTotalCount(v): number\|undefined` 추출, 양쪽 공유 |

## 참고 (INFO) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | requirement | 코드 guard 가 spec §R8("비음수 **정수**")보다 느슨(Number.isInteger 없음) | ✅ 공용 `asTotalCount` 에 `Number.isInteger` 포함 — 코드가 spec 에 맞춰짐(toTable 도 동반 tighten, 동일 대칭) |
| 2 | side_effect | `CarouselData.truncated` non-optional 추가 | 조치 불요 — 유일 생성/소비 지점 동일 diff 동기화 |
| 3 | side_effect | dead field 활성화로 기존 잘림 carousel 응답에 배너 소급 노출 | 의도된 spec 반영. PR 노트 명시 |
| 4 | testing | `totalCount===0` 경계 미검증 | ✅ 0 경계 테스트 추가 |
| 5 | maintainability | 신규 이형 테스트가 for 루프(toTable 은 it.each) | ✅ it.each 로 통일 |
| 6 | maintainability | 배너 JSX 2번째 반복 | rule-of-three — 조치 불요(3번째 배너 시 `<TruncationBanner>` 추출) |
| 7 | scope | spec/plan 이 code 와 같은 changeset | 조치 불요 — 단일 feature 국한(Phase A planner+Phase B developer 한 worktree 명시) |

## 에이전트별 위험도
security NONE · requirement LOW(→INFO1) · scope NONE · side_effect LOW(의도된 변경) · maintainability LOW(→W2) · testing MEDIUM(→W1) · documentation/user_guide_sync 재시도(disk-write gap, fresh 라운드 해소)

## 권장 조치 → 처리
1. documentation·user_guide_sync 재실행 → fresh 리뷰 라운드가 수행(user_guide_sync 는 channel-web-chat 이 doc-sync-matrix 밖이라 무발견 예상)
2. ✅ W1 top-level truncation 투영 테스트
3. ✅ W2 asTotalCount 헬퍼 추출
4. ✅ INFO1 Number.isInteger(코드↔spec 정합)
5. ✅ INFO4/5 0 경계·it.each
