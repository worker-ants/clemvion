# 문서화(Documentation) 리뷰 — trigger-deletion-release (3라운드, `19_14_29` 처분 확인)

검증을 위해 저장소 파일을 수정하지 않았다(`Read`/`Grep`/`Bash` 대조만 수행). `git status --short` 로 확인한 잔여 변경 없음.

## 배경

이 라운드는 직전 `/ai-review` 라운드(`review/code/2026/09/17/19_14_29/`, 2라운드)의 지적사항에 대한 처분
결과(커밋 `d2184dcf2` 코드 수정 + `614a3561f` docs)를 포함한다. 2라운드 documentation 리뷰가 지적한 유일한
항목(INFO — plan 체크리스트 단위 테스트 건수 9,746 vs 9,747 불일치)의 처분 여부와, 2라운드에서 새로 들어온
코드 변경(`d2184dcf2`, 부모 삭제 트랜잭션 `lock_timeout` 추가)의 문서 정합성을 확인했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 2라운드 리뷰로 고친 동작 결함(부모 삭제 트랜잭션의 무한 대기 hang)을
  반영하지 않았다 — 이 저장소가 **같은 파일 안에서** 스스로 확립한 관행(후속 라운드 발견을 같은
  `## Unreleased` 항목에 "갱신" 블록으로 추가)과 어긋난다
  - 위치: `CHANGELOG.md:3-33`(`## Unreleased — 워크플로·워크스페이스를 지워도 트리거의 자원이 남았다`)
  - 상세: 이 섹션은 1라운드 리뷰가 잡은 결함(스케줄 job 배치 해제 부분 실패)을 `**리뷰가 잡은 것**` 단락으로
    이미 문서화하고 있다. 그런데 2라운드 리뷰가 잡아 `d2184dcf2`(`fix(triggers): 부모 삭제 트랜잭션의 잠금
    대기에도 5초 상한`)로 고친, **성격이 같은 클래스의 결함**(워크플로·워크스페이스 삭제가 되돌릴 수 없는
    외부 자원 해제 뒤 부모 행을 잠그는데 `lock_timeout` 이 없어 동시 트랜잭션과 겹치면 무기한 hang 으로
    굳는 결함)은 이 섹션에 전혀 반영되지 않았다. `git show d2184dcf2 -- CHANGELOG.md` · `git show 614a3561f
    -- CHANGELOG.md` 둘 다 결과 없음으로 직접 확인했다. 더 결정적으로, 같은 `CHANGELOG.md` 파일의 바로 다른
    항목(`## Unreleased — 락을 잡아도 못 막는 세 번째 삭제 경로...`, 67행 이하)이 "이 창은 이제 실측됐다"는
    `> **갱신(2026-09-17)** — ...` 블록으로 후속 라운드에서 발견한 사실을 같은 항목에 소급 추가하는 패턴을
    **바로 이 PR 작업 기간 동안** 실제로 쓰고 있다 — 즉 이 저장소는 "후속 라운드가 잡은 같은 기능의 후속
    결함은 원 `Unreleased` 항목에 갱신 블록으로 합류시킨다"는 관행을 이미 실천 중인데, 이번 항목만 그
    관행을 따르지 않았다. `lock_timeout` 부재는 순수 리팩터가 아니라 "동시 요청이 겹치면 관측 불가능한
    hang 이 된다"는 운영 영향이 있는 동작 결함(SUMMARY 2라운드 WARNING#2, `deleteWorkspace`/`WorkflowsService.
    remove` 모두 영향)이라 CHANGELOG 대상 기준(1라운드 문서화 리뷰가 이미 세운 기준: "운영 영향이 큰 변경")에
    부합한다.
  - 제안: `CHANGELOG.md:3-33` 항목의 "리뷰가 잡은 것" 단락 뒤(또는 새 `> **갱신(2026-09-17)**` 블록)에
    "워크플로·워크스페이스 삭제의 부모 행 잠금에도 `lock_timeout` 이 없어 동시 요청과 겹치면 반쯤 삭제된
    상태가 무기한 hang 으로 굳을 수 있었다 — 트리거·스케줄 삭제와 같은 5초 상한을 적용했다" 한 문단을
    추가한다.

## 검증한 항목 (문제 없음 — 근거만 기록)

- **2라운드 documentation INFO(plan 체크리스트 단위 테스트 건수 불일치) 해소 확인**: `plan/in-progress/
  trigger-deletion-release.md:171`("첫 구현 시점 backend 9,746 GREEN")과 `:173`("첫 TEST WORKFLOW 시점 —
  리뷰 처분 뒤 1라운드 9,755 · 2라운드 9,756")을 직접 열어 대조했다. 두 숫자에 측정 시점이 명시돼 어느
  쪽이 최신인지 문서만으로 판별 가능해졌다 — 조치 완료.
- **신규 JSDoc 정합성**: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 의 신규
  `setLocalLockTimeout()`(트랜잭션의 모든 락 대기에 상한을 건다는 목적·근거)과, `trigger-resource-
  release.ts` 의 `TriggerResourceReleasePort.lockParentAndListTriggerIds` JSDoc에 새로 추가된
  "**트랜잭션의 첫 호출이어야 한다**" 계약(잠그기 전에 삭제 상한을 걸어야 뒤따르는 멤버십·CASCADE 행
  잠금까지 상한이 적용된다)을 실제 구현(`trigger-resource-releaser.service.ts:76` `setLocalLockTimeout`
  이 `manager.findOne` 잠금보다 먼저 호출됨) 및 두 호출부(`workflows.service.ts:271`, `workspaces.
  service.ts:522`)와 대조했다 — 문서와 코드가 정확히 일치한다. 오류 메시지 접두를 `acquireTriggerConfigLock:`
  에서 `setLocalLockTimeout:` 로 바꾼 것도 실제로 그 문자열을 던지는 함수 이름 변경과 일치한다(정확).
- **주석 정확성 — 잠금 순서 재배치**: `workspaces.service.ts:520-524` 의 "**첫 호출이다**" 주석과
  `assertWorkspaceDeletable` JSDoc(`:561` "잠금 순서는 워크스페이스 → 멤버십")을 실제 실행 순서(
  `lockParentAndListTriggerIds` 로 워크스페이스 선잠금 → `assertWorkspaceDeletable` 재검사가 워크스페이스
  재잠금 후 멤버십 잠금)와 대조해 일치를 확인했다. 회귀 테스트(`workspaces.service.spec.ts` 의 `deleteEvents`
  단언 순서 `lockAndList` → `check:locked`)도 이 순서와 일치하도록 함께 갱신돼 있다.
- **테스트 주석**: `trigger-resource-releaser.service.spec.ts` 에 추가된 `// 잠금 대기 상한이 **잠그기
  전에** 걸린다 ...(`/ai-review` `review/code/2026/09/17/19_14_29` WARNING#2)` 주석이 리뷰 발견 위치를
  정확히 인용하고 있고, 실제 단언(`query:SET LOCAL lock_timeout = '5000ms'` 이 `lock:...` 보다 먼저 옴)과
  일치한다.
- **README/설정 문서**: 이번 라운드 변경에도 새 환경변수·설정 옵션·API 엔드포인트 변경이 없다 — 갱신
  대상 없음(2라운드 판정과 동일).

## 요약

3라운드에서 2라운드 documentation 리뷰가 지적한 INFO(plan 체크리스트 테스트 건수 불일치)는 측정 시점
표기로 해소됐고, 이번 라운드의 신규 코드(`d2184dcf2` — 부모 삭제 트랜잭션 `lock_timeout`)는 JSDoc·주석·
회귀 테스트 주석 모두 실제 구현·호출 순서와 정확히 일치해 문서화 수준이 높다. 다만 `CHANGELOG.md` 가 이
신규 결함 수정(워크플로·워크스페이스 삭제 부모 잠금의 무한 대기 hang 방지)을 반영하지 않았다 — 특히 같은
파일이 다른 항목에서 "후속 라운드 발견을 원 항목에 갱신 블록으로 합류"하는 관행을 이 PR 작업 기간 동안
실제로 쓰고 있어서, 이번 누락이 우연이 아니라 관행 이탈로 보인다. 기능적 결함은 아니며 차단 사유는
아니다.

## 위험도

LOW
