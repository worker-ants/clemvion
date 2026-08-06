# Rationale 연속성 검토 — `spec/conventions/audit-actions.md`

## 검토 방법

target 문서(`spec/conventions/audit-actions.md`, `--spec` 모드)를 프롬프트에 번들된 관련
Rationale 발췌(`spec/5-system/1-auth.md` §Rationale 4.1.A/4.1.B, `spec/data-flow/1-audit.md`
§Rationale, `spec/2-navigation/2-trigger-list.md`·`15-chat-channel.md`·`0-overview.md`·
`1-data-model.md`·`1-workflow-list.md` 의 Rationale)와 대조했다. 번들에서 컨텍스트 예산 초과로
생략된 `spec/data-flow/12-workspace.md`(target 이 `workspace.deleted` 제외 근거로 직접 인용)와
구현 SoT 코드(`codebase/backend/src/modules/audit-logs/audit-action.const.ts`)는 저장소에서
직접 열어 대조했다(생략 사실을 "내용 없음" 으로 취급하지 않았다).

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 INFO 1건뿐이다.

- **[INFO]** 동일 결정(`workspace.deleted` 감사 구조적 제외, 짝 리소스 감사 정책)이 5곳에 중복 서술됨
  - target 위치: `spec/conventions/audit-actions.md` §3 표 하단 주석("`workspace.deleted` 는 레지스트리에 없다") 및 "짝 리소스는 호출된 엔드포인트 쪽만 기록한다" 주석
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "workspace.deleted 감사 제외", `spec/data-flow/1-audit.md` §1.1 각주, `spec/5-system/1-auth.md` §4.1 카탈로그 각주, `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 상단 주석
  - 상세: target 문서의 서술 자체는 위 4곳과 **완전히 정합**하며 모순이 없다(직접 대조 확인). 다만 같은 "구조적 제약" 논거(`ON DELETE CASCADE` → 삭제 감사 row 영속 불가)와 "짝 리소스는 호출된 엔드포인트만 기록" 논거가 spec 4곳 + 코드 주석 1곳, 총 5곳에 산문으로 반복돼 있다. `spec/1-data-model.md` §Rationale "WorkflowVersion.snapshot 구성 서술 정정" 이 스스로 기록한 선례 — "2026-06-10 spec↔code 전수 감사가 `data-flow/11-workflow.md` 를 정정하면서 **본 문서 §2.15 만 함께 고치지 않아** drift 가 생겼다" — 가 바로 이런 다중 중복 서술의 실패 모드를 보여준다. 현재는 5곳이 모두 일치하지만, 향후 이 결정 중 하나(예: pruner 도입으로 `workspace.deleted` 감사가 가능해지는 경우)가 바뀔 때 5곳 전부를 동시에 갱신하지 못하면 동일한 drift 가 재발할 위험이 있다.
  - 제안: 필수 조치는 아님(현재 정합 상태이므로 CRITICAL/WARNING 아님). 다만 향후 이 결정을 변경할 계획이 생기면, target 의 §3 각주를 SoT 로 지정하고 나머지 4곳은 링크만 남기는 방향으로 정리하면 drift 재발을 구조적으로 줄일 수 있다.

## 정합성 확인 요약 (참고, 발견사항 아님)

target 이 기존 Rationale 과 충돌하지 않음을 아래 세 축에서 명시적으로 확인했다:

1. **기각된 대안 재도입 없음** — target §Rationale "기각된 대안" 의 두 항목
   (`workspace.transfer_ownership → ownership_transferred` 정규화 기각, §4.1 본문에 시제 규약 잔류)
   은 `1-auth.md §4.1.A`(`workspace.transfer_ownership 분류`, `append-only 원칙`)와 `data-flow/1-audit.md`
   (`audit 불변 원칙상 레거시 row 는 그대로 둔다`)에 실제로 기록된 이력과 일치한다 — 지어낸 대안이
   아니다.
2. **합의된 원칙 준수** — "resource dot-prefix 필수"(cross-audit G-02 정정 계승), "DB 는 자유
   문자열·application union 으로 강제"(`data-flow/1-audit.md` §Rationale "Action 은 application
   union 으로 강제"), "분류 기준은 resource 가 아니라 verb 성격"(`1-auth.md §4.1.A`) 세 원칙 모두
   target 본문·Rationale 이 그대로 계승한다.
3. **구현 코드와의 3중 일치** — target §3 레지스트리, `data-flow/1-audit.md` §1.1 표,
   `audit-action.const.ts` 의 `AUDIT_ACTIONS` 상수가 34개 액션·시제·분류 전부 1:1 일치했다
   (workflow.executed·workspace.deleted 의 "의도적 미구현/제외" 서술 포함).

## 요약

target 문서는 기존 Rationale(특히 `1-auth.md §4.1.A/4.1.B`, `data-flow/1-audit.md`,
`data-flow/12-workspace.md`)에서 이미 확정·기각된 결정들을 정확히 계승하고 있으며, 기각된 대안을
재도입하거나 합의된 명명 원칙(dot-prefix·application union 강제·verb 성격 기준 분류·append-only)을
위반하는 지점을 찾지 못했다. "기각된 대안" 서술도 실제 이력에 근거해 지어낸 것이 없다. 유일한
관찰은 동일 근거(workspace.deleted 구조적 제외 등)가 spec 4곳 + 코드 1곳에 중복 서술돼 있어
장기적으로 drift 위험의 씨앗이 된다는 점이며, 이는 정보성(INFO) 관찰일 뿐 현재 시점의 결함은
아니다.

## 위험도
NONE
