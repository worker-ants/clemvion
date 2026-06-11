# Plan 정합성 검토 결과

검토 대상: V-06/V-08 makeshop catalog 구현 완료 (makeshop-catalog-labels 브랜치)
diff-base: origin/main
검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] spec/2-navigation/4-integration.md §9.3 Rationale L1147 stale — spec 갱신 누락

- **target 위치**: 구현 변경 없음 (`4-integration.md` 는 target 브랜치 변경 파일 목록에 없음)
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §후속 — V-06/V-08 해소 기록
- **상세**: `spec/2-navigation/4-integration.md` L1147 의 Rationale 표제 "**왜 초기엔 cafe24 만 응답하나**" 는 구현 변경으로 더 이상 사실이 아니다. target 코드가 `getServiceCatalog` 에 makeshop 분기를 추가해 `cafe24·makeshop` 두 provider 가 operations 목록을 채워 반환하는데, 해당 Rationale 본문은 "나머지 3종은 apiLabel 이 NULL 이라 lookup 자체가 발생하지 않는다" 라는 cafe24 단독 전제로 작성되어 있다. 같은 파일의 §9.2 표 (L816) 는 이미 `cafe24·makeshop` 양쪽 지원을 정확히 명시했으므로 Rationale 만 stale 상태다. 본 PR 범위(코드+plan만) 안에 spec 갱신이 포함되지 않았다.
- **제안**: target 브랜치에서 `spec/2-navigation/4-integration.md` L1147 Rationale 표제와 본문을 "왜 cafe24·makeshop 만 operations 를 채워 반환하나" 취지로 갱신 (developer write-only 대상이 spec 이므로 project-planner 위임 또는 현재 브랜치에서 함께 수정). 미수정 시 merge 후 별도 spec-fix 항목으로 `spec-code-cross-audit-2026-06-10.md` 후속에 등재 권장.

---

### [WARNING] plan/in-progress/cafe24-catalog-i18n.md 미존재 — 코드 주석의 follow-up 참조가 비어 있음

- **target 위치**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` JSDoc `@see plan/in-progress/cafe24-catalog-i18n.md` (diff 내 렌더링된 주석 L843 구역)
- **관련 plan**: `plan/in-progress/` 디렉터리 내 `cafe24-catalog-i18n.md` 가 존재하지 않음 (전체 `plan/` 탐색 결과 없음)
- **상세**: target 의 `tryTranslateLabel` 함수 JSDoc 에 `@see plan/in-progress/cafe24-catalog-i18n.md — cafe24 dict 채우기 follow-up` 를 명시했으나, 해당 plan 파일이 `plan/in-progress/` 에 없다. main HEAD 의 동일 파일도 동일 주석(`@see plan/in-progress/cafe24-catalog-i18n.md`) 을 갖고 있어 pre-existing 누락이다. spec-frontmatter.test.ts 의 plan existence 가드가 이 주석 경로를 검사하는지는 별도 확인이 필요하나, 코드 내 dead plan 링크가 후속 작업 가시성을 떨어뜨린다.
- **제안**: `plan/in-progress/cafe24-catalog-i18n.md` 를 신규 생성해 cafe24 i18n dict 채우기 scope 를 공식 plan 으로 등록하거나, JSDoc 주석에서 해당 경로를 제거·대체한다. pre-existing 이므로 이번 PR 차단 사유는 아니나 후속 plan 관리 항목으로 기록.

---

### [INFO] db-pool-creds-pubsub worktree 가 integrations.service.ts / integrations.service.spec.ts 를 동시 편집 중 — 병합 충돌 위험 낮음

- **target 위치**: `codebase/backend/src/modules/integrations/integrations.service.ts`, `integrations.service.spec.ts`
- **관련 plan**: `plan/in-progress/` 에 db-pool-creds-pubsub 대응 plan 확인 필요 (worktree `db-pool-creds-pubsub` 활성)
- **상세**: `claude/db-pool-creds-pubsub` 브랜치가 `integrations.service.ts` (L17 import, L381/388 constructor injection, L672/985 credential rotate/remove) 및 `integrations.service.spec.ts` 를 편집 중이다. target 은 같은 파일의 `getServiceCatalog` 함수 (L1164 구역) 와 `buildOperationCatalog` 헬퍼 추가를 수정한다. 편집 구역이 서로 다른 함수라 **텍스트 병합 충돌 가능성은 낮지만**, 동일 파일을 두 브랜치가 동시에 손대고 있어 rebase/merge 순서에 따라 diff 충돌 라인이 발생할 수 있다. 두 변경이 독립 함수 영역이므로 자동 3-way merge 로 해소될 가능성이 높다.
- **제안**: target 을 먼저 merge 후 db-pool-creds-pubsub 브랜치를 origin/main 으로 rebase 하면 getServiceCatalog 추가분이 포함된 상태에서 빌드·테스트 재검증이 가능하다. 명시적 병렬화 주의 항목으로 기록.

---

### [INFO] spec-code-cross-audit-2026-06-10.md 의 V-06/V-08 해소 기록 — plan 갱신 범위 확인

- **target 위치**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (target 브랜치 버전에서 V-06/V-08 체크됨)
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §후속
- **상세**: main 버전의 동 파일은 "잔여: V-02(AI override UI), V-04~V-06·V-08~V-14·V-18 (major/minor — 결정 대기)" 로 V-06/V-08 이 미해결 상태다. target 브랜치 버전은 V-06/V-08 을 `[x]` 로 체크하고 `makeshop-catalog-labels` 브랜치에서 해소 완료 기록을 추가했다. 이는 cross-audit plan 에서 "코드 수정 vs spec 하향 결정 대기" 로 분류된 항목을 target 이 코드 수정으로 일방 결정한 것처럼 보이나, V-06/V-08 은 "makeshop catalog 미충전"·"cafe24 namespace 고정" 로서 구현 방향이 명확한 gap 이지 의사결정이 필요한 설계 분기가 아니다. plan 에서 "결정 대기"로 묶인 것은 전체 19건을 일괄 카테고리화한 것이며 V-06/V-08 개별은 developer 트랙으로 즉시 처리 가능한 항목이다. 따라서 이 갱신은 정상 범위 내의 해소 기록이다.
- **제안**: 특별 조치 불필요. 단, plan의 "잔여: V-04~V-06·V-08~V-14·V-18" 목록에서 V-06/V-08 을 명시적으로 제외하는 문구 갱신 (이미 target 브랜치에서 처리됨) 이 merge 후 반영되면 정합.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 결과:

- `cafe24-backlog-residual-batch` (branch `claude/cafe24-backlog-residual-batch`) — Step 1: `git merge-base --is-ancestor` 결과 ACTIVE, Step 2: PR `[]` (PR 없음), Step 3 Fallback 적용. 그러나 `git log origin/main..claude/cafe24-backlog-residual-batch` 결과 커밋 0건 — branch 가 origin/main 과 동일 HEAD. 실질적으로 stale (commits-ahead=0). 대상 파일 편집 없음 확인됨 → 충돌 후보 제외.

활성 worktree 충돌 후보: `claude/db-pool-creds-pubsub` — Step 1 ACTIVE, Step 2 PR 없음, Step 3 active 처리 (커밋 있음). 위 §발견사항 INFO 항목으로 보고.

---

## 요약

makeshop-catalog-labels 브랜치의 V-06/V-08 구현 변경(backend `getServiceCatalog` makeshop 분기 + frontend `tryTranslateLabel` provider-prefix 일반화)은 plan 간 미해결 결정을 일방 우회하지 않으며, 선행 plan 미해소 조건도 없다. 주요 WARNING 은 두 가지: (1) 구현 변경으로 stale 이 된 `spec/2-navigation/4-integration.md` Rationale L1147 ("왜 초기엔 cafe24 만 응답하나") 가 본 PR 에서 갱신되지 않았고, (2) 코드 주석에 참조된 `plan/in-progress/cafe24-catalog-i18n.md` 가 pre-existing 으로 존재하지 않는다. 두 항목 모두 현재 PR merge 를 차단할 수준은 아니나 후속 추적 필요. db-pool-creds-pubsub worktree 가 동일 `integrations.service.ts` 를 편집 중이나 편집 구역이 달라 병합 충돌 위험은 낮다. worktree 충돌 후보 2건 분석, stale 확정 1건(cafe24-backlog-residual-batch) skip, active 1건(db-pool-creds-pubsub) INFO 보고.

---

## 위험도

LOW
