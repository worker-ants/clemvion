# 신규 식별자 충돌 검토 — `spec/conventions/audit-actions.md`

## 검토 방법 메모

target 문서 스냅샷과 `origin/main` 대비 실제 diff(`git diff origin/main -- spec/conventions/audit-actions.md`)를 대조했다. 실제 변경분은:

1. `workflow`/`trigger`/`schedule`/`model_config` 4개 레지스트리 행의 상태 컬럼 `미구현` → `구현` (액션명 자체는 변경 없음 — 기존에 이미 카탈로그에 있던 이름)
2. 신규 blockquote 설명 2개 (`workflow.executed` 유예 사유, "짝 리소스는 호출된 엔드포인트 쪽만 기록" 원칙) — 둘 다 기존 용어(`workflow.executed`, `audit_log`, `login_history`)만 사용하며 새 식별자를 만들지 않음

즉 이 target 은 **신규 식별자를 도입하지 않는** 순수 상태-동기화 + rationale 승격 커밋이다 (동일 커밋 `e1ed4f0dc`: "감사 로깅 SoT 3곳이 이미 병합된 구현을 '미구현' 으로 적고 있었다"). 아래는 6개 관점을 형식적으로 점검한 결과다.

## 발견사항

- **[INFO]** 신규 식별자 없음 — 검토 대상 자체가 상태 동기화
  - target 신규 식별자: 없음. 레지스트리 표의 `created`/`updated`/`deleted`/`executed`(workflow), `created`/`updated`/`deleted`(trigger, schedule), `create`/`update`/`delete`/`set_default`(model_config) 는 모두 diff 이전부터 존재하던 이름이며, 이번 변경은 상태 컬럼(`미구현`→`구현`)만 갱신했다.
  - 기존 사용처: `spec/5-system/1-auth.md:425` (`trigger.created`/`updated`/`deleted`), `spec/data-flow/1-audit.md:76-77` (`trigger.updated`/`trigger.deleted`), `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AUDIT_ACTIONS` union — code SoT).
  - 상세: `id: audit-actions` frontmatter 도 신규가 아니다 — `spec/` 전수 검색 결과 이 id 를 쓰는 문서는 자기 자신 하나뿐이며, 파일(`spec/conventions/audit-actions.md`) 도 커밋 `b1b0fa3bd`(2026-07 이전)부터 이미 존재해온 파일이다. 새 파일 생성이 아니라 기존 파일의 인라인 수정.
  - 제안: 없음(수정 불필요).

- **[INFO]** 신규 blockquote 2건의 용어 재사용 확인 — 충돌 없음
  - target 신규 식별자(엄밀히는 식별자가 아니라 서술 용어): "짝 리소스"(paired resource), `workflow.executed` 유예 사유 서술.
  - 기존 사용처: `spec/conventions/audit-actions.md:63` 자기 자신이 최초 사용. `spec/` 전수 grep(`짝 리소스`, `짝 row`) 결과 다른 문서에서 이 표현을 다른 의미로 쓰는 곳 없음. `workflow.executed` 는 `spec/5-system/1-auth.md:437,439`, `spec/data-flow/1-audit.md:98` 와 정확히 같은 의미·같은 사유(카디널리티·보존 정책 미정)로 3-way 동기화되어 있어 의미 충돌 없음.
  - 상세: "짝 리소스"는 포멀 식별자(ID·타입명·endpoint·이벤트명·ENV)가 아니라 산문 서술이므로 애초에 본 체크리스트의 충돌 대상 범주(요구사항 ID/엔티티명/endpoint/이벤트명/ENV/파일경로)에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** 동일 커밋의 typo 수정(`trigger.delete`→`trigger.deleted`, `trigger.update`→`trigger.updated`, 둘 다 target 파일 밖)이 카탈로그와 일관되게 반영됐는지 교차 확인
  - target 신규 식별자: 해당 없음 (이 typo 수정은 `spec/2-navigation/2-trigger-list.md`, `spec/5-system/15-chat-channel.md` 변경이며 `audit-actions.md` 자체는 아님. 참고로만 확인).
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md:182,252`, `spec/5-system/15-chat-channel.md:377` 모두 이제 `trigger.deleted`/`trigger.updated` 로 정정되어 있고, 잘못된 형태(`trigger.delete`/`trigger.update`)는 `spec/` 전수 재검색에서 0건.
  - 상세: 이 3곳은 target 문서가 아니라 같은 커밋의 다른 파일이라 엄밀히는 본 checker 의 스코프(target=`audit-actions.md`) 밖이지만, "충돌 없음"을 뒷받침하는 교차검증으로 기록한다.
  - 제안: 없음(이미 정합).

## 요약

target `spec/conventions/audit-actions.md` 의 실제 변경분은 이미 카탈로그에 존재하던 4개 리소스(`workflow`/`trigger`/`schedule`/`model_config`)의 상태 컬럼을 `미구현`→`구현`으로 정정하고, 기존에 코드 주석에만 있던 두 설계 결정(짝 리소스 단일 기록 원칙, `workflow.executed` 유예 사유)을 산문으로 승격한 것뿐이다. 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 중 어느 것도 신규 도입되지 않았으며, 재사용된 모든 액션명·용어는 `5-system/1-auth.md`·`data-flow/1-audit.md`·code SoT(`audit-action.const.ts`)와 의미가 일치한다. 신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING 없음.

## 위험도
NONE
