# Rationale 연속성 검토 — trigger-canary-hardening (impl-done, 2026-09-14 12:17)

## 검토 범위와 방법

target scope(`spec/conventions/`) 델타는 **0개** — 이 브랜치는 spec 을 편집하지 않는 순수 코드
하드닝이다(`plan/in-progress/trigger-canary-hardening.md`, `spec_impact: none`). 번들에 실린
"구현 대상 spec 영역" 은 예산으로 대부분 절단됐으므로, 실제 코드 diff 는 워킹트리에서 직접
확인했다 — `git diff origin/main -- codebase/` 기준 **6개 파일 / 380줄**(신규 297 / 삭제 23):

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}` (신규 — 트리거 비밀 컬럼 3중 사본 정합 가드)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 주석 번호 표기 정리: 원문자 → 아라비아 숫자)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts` (teardown 주석 재작성)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 3건 신규 배선)

동일 세션에서 이미 세 차례 rationale_continuity 검토가 돌았다
(`review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23}` — 각각 impl-prep LOW, impl-done
NONE, impl-done NONE). 본 검토는 그 이후 추가된 마지막 코드 커밋(`3f5e451b3` "라운드 2")까지
포함한 **최종 상태**를 대상으로 독립적으로 원문을 재대조했다. 직접 연 문서:
`spec/conventions/secret-store.md`(§R4·§2.1·§390 부근), `spec/1-data-model.md`(응답 경계
원칙, §960 부근), `spec/conventions/review-citations.md`(§1~§4), `spec/conventions/swagger.md`
(repo-guards 시행 코드 선례), `git log -S CREATOR_PROJECTION` 이력, 형제 가드
`redis-fail-open-catalog-guard.ts`, 그리고 `3f5e451b3` 커밋 diff 전문.

## 발견사항

없음 — CRITICAL·WARNING 수준의 발견 없음.

## 확인된 정합 사항 (참고용, 비대상 확인)

- **`secret-store.md §R4`(Trigger FK 미설정 — explicit application 경로 정리, implicit
  cascade 기각)와 충돌하지 않는다.** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註는
  raw `DELETE FROM trigger` 로 `secret_store` 고아 row 를 남기는 기존 e2e teardown 관례를
  유지하면서, "R4 가 요구하는 대상은 **프로덕션 삭제 경로**(`TriggersService.remove()` →
  `deleteByPrefix`)이고 그 경로는 R4 대로 동작한다 — 이 한정을 적지 않으면 '정리 불필요'가
  프로덕션 쪽으로 번진다"고 명시적으로 범위를 좁혔다. 과거 이 자리는 "미검증"으로만 남아
  있었는데, 이번 diff 는 두 개의 실측(세션 간 `e2e-down`=`docker compose down -v` 볼륨
  삭제, 세션 내 유일한 소비 e2e 가 `ref LIKE <접두>` 로 스코프됨)으로 "검증됨"으로 정정했다
  — **결정을 뒤집은 것이 아니라 같은 결정에 근거를 보강**한 사례다(등급 기준 3 "결정의
  무근거 번복" 에 해당하지 않음 — 새 Rationale 을 함께 실었다).
- **부수적으로 §R4 본문 자체의 기존 오기(`TriggersService.delete()`, 실제 메서드명은
  `remove()`)를 이 배치가 처음으로 가시화했다.** `3f5e451b3` 커밋은 이를 spec 을 직접 고치지
  않고 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§ "secret-store.md §R4 가
  `TriggersService.delete()` 라 쓰는데 실제는 `remove()`")에 planner 턴 대상 항목으로만
  등재했다 — developer 가 쓴 문장이 아니므로 자기-반증형 소정정 요건(조건 1)에 해당하지
  않고, 절차대로 처리됐다. Rationale 연속성 위반이 아니라 이미 올바르게 처리된 발견이다.
- **응답 경계 secret-strip 원칙(`spec/1-data-model.md` "응답 경계에서 지운다 — 내부 소비자가
  있는 컬럼은 `select: false` 금지")과 정합.** 신규 `trigger-secret-columns-guard.ts`/
  `.spec.ts` 는 정본(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 비-export) + 사본 둘
  (`schedule-trigger-ref.ts`/`trigger-workflow-ref.ts` 의 `TRIGGER_SECRET_COLUMNS`)의
  값·순서 동일성을 정적으로 강제할 뿐, 컬럼 수준 `select: false` 로 되돌리거나 원칙을
  우회하지 않는다.
- **"런타임 공유 대신 정적 가드" 설계 선택은 무근거 번복이 아니다.** diff 자체가 "정본이
  export 가 아니고 `shared/testing/` → `modules/` 역방향 의존을 피한다" 는 이유를 명시하며,
  `CREATOR_PROJECTION`(동일 리터럴 4중 복사가 실제 Critical 로 터진 뒤 단일 상수로 통합된
  선례, `git log -S` 로 실재 확인)과의 차이를 스스로 설명한다 — 다른 처방을 택했음을
  숨기지 않고 근거를 남긴 사례다.
- **AST vs 정규식 경계 판단이 저장소 선례와 일치.** 신규 가드는 `redis-fail-open-catalog-guard.ts`
  와 동일하게 `ts.createSourceFile` 기반 AST 파싱을 쓰며 "정규식이면 JSDoc 예시 문자열이
  값으로 잡혀 가드가 자기 오판을 사실로 굳힌다" 는 동일 근거를 명시한다 — "TS 소스는 정본
  파서(AST) 승" 이라는 합의된 경계와 정합.
- **`review-citations.md` 와 충돌 없음.** `trigger-workflow-ref.spec.ts` 헤더에서 전체경로
  리뷰 인용 두 건(`review/code/2026/09/10/{15_52_06,16_26_57}`)이 삭제됐으나, §1 의 요지는
  "`review/**` 산출물이 커밋되어 이력으로 해소된다" 이고 §4 는 **bare 인용의 일괄 치환
  금지**만 다룬다 — 전체경로 인용을 코드 자체가 설명해야 하는 불변식 서술로 대체하고
  자기수정 서술은 트래커로 옮긴 이번 편집은 둘 다 금지하지 않는다. 새로 추가된 인용
  (`review/code/2026/09/14/{11_27_40,11_52_13}` — WARNING 번호 포함, 전체경로 형식)도 §2 의
  권장 형식을 그대로 따른다.
- **라운드 2(`3f5e451b3`) 변경분도 새 Rationale 충돌을 만들지 않는다.** 중첩 템플릿 리터럴
  잔재 제거, 대조군(파일 부재 시 메시지 판별) 테스트 1건 추가는 기존 설계 원칙(정본/사본
  구분, AST 파서, 응답 경계 strip)을 그대로 유지하는 순수 테스트 견고화다.

## 참고 (Rationale 연속성 범위 밖 — 이미 등재됨)

- 신규 `trigger-secret-columns-guard.ts`/`.spec.ts` 가 어떤 spec 의 `code:` 프론트매터에도
  아직 등재되지 않은 점, `secret-store.md §R4` 의 `delete()`→`remove()` 오기는 모두
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대상으로 이미
  기록돼 있다 — spec-impl-evidence 커버리지/오탈자 성격이며 Rationale 위반이 아니다.

## 요약

이 diff(`trigger-canary-hardening`, 최종 커밋 `3f5e451b3` 포함)는 `spec/conventions/` 를
전혀 편집하지 않는 순수 코드 하드닝이며, `secret-store.md §R4`·`1-data-model.md` 응답 경계
원칙·`review-citations.md`·repo-guard AST 경계 등 기존 `## Rationale`/합의 원칙과 대조한
결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 어느 것도
발견되지 않았다. 오히려 이 배치는 (1) 과거 "미검증" 으로 남아 있던 secret_store teardown
판단을 두 실측으로 보강하며 R4 의 적용 범위(프로덕션 경로 한정)를 명시적으로 좁혔고, (2) 그
과정에서 드러난 R4 본문 자체의 기존 오기를 spec 을 직접 건드리지 않고 절차대로
planner-턴 항목으로 등재했으며, (3) 이전 라운드가 이미 확정한 "정적 가드" 처방을 근거와
함께 이행한다 — 세 경우 모두 "결정을 뒤집었는데 새 Rationale 이 없는" 패턴이 아니라 "같은
결정에 근거를 보강하거나 이미 합의된 처방을 실행" 한 패턴이다. 앞선 세 라운드의 결론(LOW→
NONE→NONE)과 일치하며, 이번 재검토도 독립적으로 같은 결론에 도달했다.

## 위험도

NONE
