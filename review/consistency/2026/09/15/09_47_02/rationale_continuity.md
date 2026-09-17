# Rationale 연속성 검토 — `trigger-lock-followups` (`--impl-done`, scope=`spec/5-system/`)

## 검토 범위와 전제

`spec/5-system/` 델타는 0 파일(정상 — 이 브랜치는 spec 을 바꾸지 않는다). 실제 검토 대상은
`git diff origin/main...HEAD`(5 파일 / 346줄, `trigger-config-lock.ts` ·
`triggers.service.ts` · `schedules.service.spec.ts` · `trigger-transaction-mock.ts` ·
`trigger-config-lock.spec.ts` + `CHANGELOG.md`)이며, 이 코드가 아래 세 문서에 이미 기록된
Rationale/결정과 충돌하는지를 봤다:

- `plan/complete/trigger-config-lost-update.md` (`#1334` — 트리거 config advisory lock 설계의
  원 결정문. 14라운드 리뷰 처분 + `### 후속(developer 범위)` 표)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (살아 있는 후속 트래커)
- `plan/in-progress/trigger-lock-followups.md` (이번 브랜치의 작업 plan)
- `spec/2-navigation/4-integration.md` `## Rationale` (Cafe24 advisory-lock 기각 선례)

직전 사이클의 `--impl-prep` rationale_continuity(`review/consistency/2026/09/15/08_58_18`)가
이미 이 다섯 항목의 착수 전 판정을 마쳤으므로(BLOCK: NO), 이번엔 그 판정대로 **구현이 실제로
귀결됐는지**에 집중했다.

## 발견사항

이번 diff 에서 **CRITICAL·WARNING 급 Rationale 연속성 위반은 발견되지 않았다.** 오히려 이
diff 는 이 저장소가 요구하는 "결정 번복 시 새 Rationale 동반" 원칙을 모범적으로 지킨 사례다 —
아래 확인 근거와, 사소한 정합 보완 제안(INFO) 두 건만 남긴다.

### 확인된 정합성 (위반 아님 — 근거 기록)

- **기각된 대안 재도입 없음**: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ
  `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소"가 명시 기각한 "외부 HTTP 호출을
  advisory lock 트랜잭션 안에 묶는" 설계를, 이번 diff 는 건드리지 않는다(`acquireTriggerConfigLock`·
  `rewriteTriggerConfigLocked` 모두 순수 SQL 임계구간만 다룬다). 경계가 유지되고 있다.
- **명명 결정이 실제 이력에 근거함**: `findByIdForPatchValidation` 채택와 `…ForPatchPrecheck`
  기각 이유(`Precheck` 가 Cafe24/MakeShop mall-id 사전검증 전용 어휘)를 코드로 확인했다 —
  `PrecheckResultDto`·`MallIdPrecheck`·`MakeshopPrecheckQueryDto` 가 `integrations/` 도메인에
  실재한다. 채택한 `findByIdFor<목적>` 패턴의 선례 `AuthConfigsService.findByIdForResponse` 도
  실재한다(`auth-configs.service.ts:144`). 지어낸 선례가 아니다.
- **결정 번복이 새 Rationale 과 함께 이뤄짐(item ④)**: `plan/complete/trigger-config-lost-update.md`
  가 확정한 "삭제 경로 둘 다 같은 락을 잡아 실무적으로 닫혀 있다"(12라운드 W1)라는 전제가, 이번
  착수 전 실측에서 **세 번째 경로**(`Workflow`/`Workspace` 삭제의 FK `onDelete: 'CASCADE'`,
  `trigger.entity.ts:37-39,44-46` 로 실측 확인됨)로 반증됐다. 이 번복은 (a) `CHANGELOG.md` 에
  원문을 취소선 없이 남기되 `> 정정(2026-09-15)` 블록으로 명시 정정하고, (b)
  `spec-draft-nullable-notation-followups.md` 에 원문을 취소선(`~~...~~`)으로 보존한 채 실측을
  덧붙였다. "번복은 하되 왜 번복하는지 새 Rationale 을 함께 쓴다"는 이 저장소의 규율을 그대로
  따른다.
- **미확정 부분을 "추정"으로 명시적으로 낮춤**: 창 1(`TriggersService.update()` 의 인라인
  `save()`)이 같은 FK CASCADE 창에 노출돼 있다는 사실을 이번 PR 은 고치지 않고 후속 등재했는데,
  그 실패 방식을 "FK 위반으로 시끄럽게 실패할 것"이라 **추정**이라고 명시하고 "안전하다"라고
  단정하지 않았다(`review/code/2026/09/15/09_30_03/RESOLUTION.md` W2, CHANGELOG 동일 문구).
  근거 없는 확신을 새 Rationale 인 것처럼 꾸미지 않았다는 점에서 바람직하다.
- **락 설계 원칙(외부 호출은 락 밖) 미위반**: `MIN/MAX_LOCK_TIMEOUT_MS` clamp 와 `affected`
  판정 모두 트랜잭션 내부 SQL 만 다루고, 어떤 호출부도 외부 provider 호출을 락 안으로 옮기지
  않았다.

### [INFO] CHANGELOG 정정 블록의 "아래 각주 참조"가 가리키는 대상이 실제로는 위에 있다

- target 위치: `CHANGELOG.md:80` (블록 `> **정정(2026-09-15)**...` 마지막 문장)
- 과거 결정 출처: 같은 파일 상단 신규 섹션 `CHANGELOG.md:23` ("**창 1 은 이 수정의 범위가
  아니다.** ...")
- 상세: 정정 블록은 "창 1(`update()` 의 인라인 `save()`)은 그 항목의 범위가 아니다 — **아래
  각주 참조**"라고 적었다. 그러나 창 1 이 범위 밖인 이유를 설명하는 유일한 문단은 파일 내에서
  이 문장보다 **위**(신규 섹션, `:23`)에 있다 — 이 문장 아래에는 그 설명을 이어받는 각주가
  없다(`grep -n "창 1\|각주" CHANGELOG.md` 로 확인, `:56`·`:63`은 무관한 기존 문단). 같은 커밋의
  `/ai-review` W1 이 정확히 같은 클래스의 결함("새 항목은 prepend 되므로 방향이 반대였다")을
  이미 한 번 잡아 다른 문장에서 고쳤는데, 이 두 번째 인스턴스는 그 수정에서 빠졌다.
- 제안: "아래 각주 참조"를 "위 항목 참조" 또는 직접 인용("«락을 잡아도 못 막는 세 번째 삭제
  경로» 항목 참조")으로 바꾼다. Rationale/CHANGELOG 상호 참조가 방향을 잃으면 다음 사람이
  "창 1 처리가 어딘가 더 있는데 못 찾는다"고 오인할 수 있다.

### [INFO] 트래커의 "완료" 각주가 아직 존재하지 않는 경로를 인용한다

- target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 새 각주
  `> ✅ 2026-09-15 — 2~6 해소 (`plan/complete/trigger-lock-followups.md`, 브랜치
  `claude/trigger-lock-followups-0c79a0`)`
- 과거 결정 출처: 없음(신규 기록 — 정확성 점검 사안이며 Rationale 위반은 아님). 다만 이 저장소가
  이미 겪은 패턴("plan 체크박스 = 실제 상태", "체크와 `complete/` 이동은 한 동작")과 같은 클래스다.
- 상세: 인용된 경로 `plan/complete/trigger-lock-followups.md`는 현재 워킹트리에 없다. 실제
  파일은 `plan/in-progress/trigger-lock-followups.md`이고 frontmatter `status: in-progress`다.
  그 문서 자신의 체크리스트에는 `[x] 트래커 갱신 + plan → complete/`가 이미 체크돼 있으나 실제
  이동은 아직 일어나지 않았다 — "해소됐다"는 각주가 가리키는 완료 상태(파일 이동 포함)와 현재
  워킹트리 상태 사이에 시차가 있다.
- 상세(영향): 이 각주는 Rationale 급은 아니지만, 살아 있는 트래커에서 "닫힌 항목의 근거가
  어디 있는지" 를 알려주는 포인터 역할을 한다 — 이전 rationale_continuity 리뷰
  (`review/consistency/2026/09/15/08_58_18`)가 바로 이 종류의 "정정 완료를 실제로 확인할 것"을
  INFO 로 남긴 선례가 있다. 이 PR 이 머지되며 plan 이 실제로 `plan/complete/` 로 이동한다면
  이 지적은 자동 해소된다.
- 제안: `plan/in-progress/trigger-lock-followups.md`를 `plan/complete/`로 옮기는 커밋과 이
  각주를 같은 시점에 맞추거나(권장 — 이 문서가 요구하는 "체크와 이동은 한 동작"), 그때까지는
  각주가 in-progress 경로를 가리키도록 둔다.

## 요약

이번 diff(`trigger-lock-followups`)는 `#1334`가 명시적으로 developer 범위 후속으로 등재해 둔
5건을 닫으며, 그중 하나(④ `affected` 미확인)는 착수 전 재실측으로 과거 결정의 전제가
반증됐음을 발견하고 CHANGELOG·트래커 양쪽에 **취소선 보존 + 정정 근거 명시**로 번복했다 — 이
저장소가 요구하는 "결정 번복 시 새 Rationale 동반" 원칙에 정확히 부합하는 사례다. 명명 결정
(`findByIdForPatchValidation`)과 기각한 대안(`…ForPatchPrecheck`) 모두 실재하는 코드 근거를
인용했고, Cafe24 advisory-lock 기각 선례의 경계(외부 호출을 락 밖에 둔다)도 넘지 않았다.
CRITICAL·WARNING 은 없으며, 남은 것은 CHANGELOG 내부 상호 참조 방향 오류 1건과 트래커 각주가
아직 존재하지 않는 `plan/complete/` 경로를 선참조하는 것 1건, 둘 다 INFO 수준의 정합 보완
사안이다.

## 위험도

LOW
