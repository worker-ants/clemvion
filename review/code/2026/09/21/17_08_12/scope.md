# 변경 범위(Scope) 리뷰 — modelconfig-dup-delete (fresh review, 후속 커밋 포함)

## 검토 대상 요약

이번 리뷰는 이전 라운드(`review/code/2026/09/21/16_39_52`)의 fix-후 fresh review다.
diff 는 30개 파일로 구성되며 두 그룹으로 나뉜다.

**A. 핵심 코드/plan 변경 (6개)** — 이번 세션이 실제로 손댄 작업:
1. `CHANGELOG.md` — 8번째 항목 추가 + 직전(7번째) 항목의 과장 정정(취소선)
2. `codebase/backend/src/modules/model-config/model-config.service.spec.ts` — mock 전환 + 회귀 테스트 추가
3. `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` 를 `repo.remove(entity)` → `repo.delete(criteria)` + `affected===0` 판정으로 전환
4. `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (신규)
5. `plan/in-progress/modelconfig-dup-delete.md` (신규, 작업 plan)
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` (수정, 2 hunk — 트래커 동기화)

**B. 워크플로 산출물 (24개)** — `review/code/2026/09/21/16_39_52/*`(16개, 직전 `/ai-review` 라운드 산출) +
`review/consistency/2026/09/21/16_16_35/*`(8개, `--impl-prep` consistency-check 산출). 둘 다
`CLAUDE.md` 가 명시한 workflow 필수 산출물 위치·형식과 정확히 일치하며, 이번 작업 대상
(`ModelConfigService.remove()`) 외의 내용을 다루지 않는다.

## 검증 방법

`git log --oneline origin/main..HEAD` 로 8개 커밋을 확인하고, 각 커밋의 `--stat` 을 대조했다.
각 fix 커밋(`6a5571e70`, `153152d85`, `5f797583f`, `01c6130f5`)이 정확히 그 커밋이 다룬다고
주장하는 파일만 건드리는지 1:1로 확인했고, 저장소 파일은 뮤테이션하지 않았다(`Read`/`git diff`/`grep` 만 사용).

## 발견사항

없음. CRITICAL/WARNING/INFO 모두 해당 사항 없음.

### 확인 근거 (범위 이탈 없음)

- **커밋 단위 원자성**: `153152d85`(죽은 mock 제거, spec.ts 1줄), `6a5571e70`(JSDoc + e2e 주석 정정, service.ts 4줄 + e2e-spec.ts 3줄), `5f797583f`(CHANGELOG, CHANGELOG.md만), `01c6130f5`(plan 결정 고정, modelconfig-dup-delete.md만) — 각 커밋이 diff base 대비 정확히 그 목적에 필요한 파일만 수정했다. 서로 다른 관심사가 한 커밋에 섞이지 않았다.
- **CHANGELOG.md**: 새 항목 추가(맨 위) + 직전 항목의 정확히 한 문장("캐시 무효화 통지 `notifyInvalidated` 중복까지 함께 있음")에만 취소선 적용. 원문은 보존하고 인접 정정만 추가 — 그 외 서술은 손대지 않음을 `git diff` 로 직접 확인.
- **model-config.service.ts**: 변경은 `remove()` 메서드 본문에 국한(`const { affected } = await this.repo.delete(...)` + `if (affected === 0) throw this.notFound();` 및 그 근거 주석). 다른 메서드·import·설정은 무변경.
- **model-config.service.spec.ts**: `mockRepo.remove` → `mockRepo.delete` 전환에 직접 종속된 테스트만 수정. `import { DeleteResult } from 'typeorm'` 은 실제로 `jest.fn<Promise<DeleteResult>, [unknown]>()` 타입 애노테이션에 사용됨 — 미사용 임포트 아님(`grep -n "mockRepo\.remove"` 0건으로 재확인, `153152d85` 가 죽은 fixture 까지 마저 제거).
- **신규 e2e 스펙**: 이 결함 하나만 재현하는 단일 목적 파일. plan 자체가 "이 PR 은 e2e 공용 헬퍼 추출을 하지 않는다"고 범위를 명시적으로 좁혀 두었고(`01c6130f5` 로 그 유예를 "9번째 착수 시점 결정"으로 못박아 무기한 유예를 차단), 요청 이상의 리팩토링을 스스로 차단한 근거가 plan 에 있다.
- **plan 두 파일**: `modelconfig-dup-delete.md`(신규)는 이번 작업 전용 plan. `spec-draft-nullable-notation-followups.md` 의 2 hunk 는 (a) 이번 작업 자신이 등재한 항목의 과장 정정, (b) 트래커 옴니버스 스냅샷에 `6-config.md §Model Config API` 항목을 추가하는 것뿐 — 트래커의 다른 미해결 항목 본문은 무변경.
- **워크플로 산출물 24개**: 전량 `review/code/**`·`review/consistency/**` 표준 경로. 코드 변경이 아니라 강제 게이트의 증적이며, 이전 스코프 리뷰(`review/code/2026/09/21/16_39_52/scope.md`)가 동일 결론(NONE)을 이미 냈고 이번 재확인에서도 다른 파일이 섞여 들어온 흔적은 없다.
- **포맷팅/주석/설정**: 의미 없는 공백·줄바꿈만 있는 hunk 없음. 주석 변경은 전부 동작 변경(전환)에 직접 종속된 정정(예: "remove가 id를 지운다" → "delete는 엔티티를 안 건드린다")이며 무관한 주석 추가/삭제 없음. 설정 파일(`.eslintrc`, `tsconfig`, `package.json` 등) 변경 없음.

## 요약

핵심 변경은 `ModelConfigService.remove()` 단일 메서드를 형제 7건과 동일한 패턴("무락 조회 + 원자적 DELETE 의 affected 판정")으로 고치는 좁은 버그 수정이며, 대응 단위 테스트·신규 e2e·CHANGELOG·plan 문서 갱신 모두 그 수정에 직접 종속돼 있다. 4개 fix 커밋이 직전 `/ai-review` 라운드(16_39_52)의 WARNING 3건·INFO 3건을 각각 정확히 1:1로 대응하는 최소 diff 로 조치했고, 하나(e2e 헬퍼 추출)는 코드 무수정으로 "결정-시점 고정"만 plan 에 반영했다 — 이 역시 범위 확장이 아니라 결정 문서화다. 나머지 24개 파일은 프로젝트가 CLAUDE.md 에 명시한 workflow 필수 산출물(작업 plan, impl-prep consistency-check, ai-review 산출)이며 이번 작업 범위 밖의 내용을 끌어들이지 않는다. 의도 이상의 변경·불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 주석/임포트 변경·의도하지 않은 설정 변경 중 어느 것도 발견되지 않았다.

## 위험도

NONE
