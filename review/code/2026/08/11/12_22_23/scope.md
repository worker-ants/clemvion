# 변경 범위(Scope) 리뷰 — trigger-rotation-audit

## 조사 방법 메모

프롬프트의 unified diff·게이트 숫자만으로 판단하지 않고, 워크트리에서 `git log origin/main..HEAD`
로 실제 커밋 경계를 확인했다. 이 PR 은 3개 커밋으로 구성된다.

| 커밋 | 제목 | 파일 수 |
|---|---|---|
| `d71a53127` | `docs(spec): 트리거 시크릿/토큰 회전 3종을 감사 카탈로그에` | spec 6곳 + `plan/` 없음 + `review/consistency/**` 8개 |
| `bc569b089` | `fix(harness): 번들 랭킹 테스트의 자매 클래스에도 같은 결합이 남아 있었다` | `.claude/tests/test_consistency_bundle_priority.py` 1개 |
| `8b2ae7164` | `feat(audit): 트리거 시크릿/토큰 회전 3종을 감사에 기록` | 백엔드 코드 5개 + `plan/in-progress/spec-sync-auth-gaps.md` |

세 관심사(spec 결정 / 하네스 자가 결함 / 코드 구현)가 **커밋 단위로 깔끔히 분리**돼 있다는 점을
먼저 확인했다 — 이는 스코프 판정에서 중요한 완화 요인이다.

---

## 발견사항

### [INFO] 하네스 테스트 수정(`bc569b089`)은 PR 관심사와 다른 영역이지만 인과관계가 실측으로 뒷받침된다

- 위치: `.claude/tests/test_consistency_bundle_priority.py` (게이트 504-529, 552-568)
- 상세: 커밋 메시지가 "#1144 에서 `TheDiffOutranksTheFolderDumpTest` 의 스텁 결합을 고쳤는데
  자매 클래스 `TheDocumentBeingEditedIsNeverOmittedTest` 는 그대로 뒀다 — 이번엔 **내 fix
  안에서** 났다" 라고 명시하고, 테스트 주석도 "실측 2026-08-11 — `1-auth.md` 를 커밋한 브랜치에서
  재현" 이라고 구체적 재현 경로를 남겼다. 실제로 이 PR 의 `d71a53127` 커밋이 `spec/5-system/`
  하위 3개 문서(`1-auth.md`/`14-external-interaction-api.md`/`15-chat-channel.md`)를 동시에
  커밋하므로, `_edited_rels`(커밋 ∪ 미커밋) 기준 tier 0 이 여럿이 되어 `rank == 0` 가정이
  깨지는 시나리오가 이 브랜치 자신의 작업으로 실제 발생한다 — 인위적으로 끼워 넣은 무관한
  리팩토링이 아니라 **이 PR 자신의 spec 커밋이 유발한 하네스 자가 결함**이다.
  `.gitignore` 확인 결과 `review/**/_prompts/` 만 제외되고 하네스 테스트·`review/consistency/**`
  본문은 정상적으로 버전관리 대상이라, 이 파일이 diff 에 실리는 것 자체는 이상하지 않다.
- 판단: 별도 커밋(`bc569b089`)으로 완전히 분리돼 있고, spec/코드 커밋과 파일 하나도 겹치지 않는다.
  "같은 PR 에 다른 관심사가 섞였다"는 형태적 관찰은 유효하지만, 원인이 이 PR 자신의 spec 편집이고
  프로젝트에 이미 기록된 교훈(`feedback_mutation_coverage_multiarm_operators` 류의 "자매
  함수/클래스 전수 확인" 관행, #1144 자매 클래스 잔여분)과 정확히 일치해 **자체 완결적인 정당한
  포함**으로 판단한다. 스코프 위반으로 보지 않는다.
- 제안: 없음 — 현재 상태(별도 커밋 + 구체적 재현 근거 주석)로 충분하다.

### [INFO] spec 6곳 동시 갱신은 과하지 않다 — 착수 전 consistency-check 게이트가 요구한 정확한 범위

- 위치: `spec/5-system/1-auth.md`(게이트 431), `spec/conventions/audit-actions.md`(게이트 58,
  72-80), `spec/data-flow/1-audit.md`(게이트 78-80, 101-102), `spec/5-system/15-chat-channel.md`
  (게이트 378), `spec/2-navigation/2-trigger-list.md`(게이트 156-158),
  `spec/5-system/14-external-interaction-api.md`(게이트 65, 95)
- 상세: `review/consistency/2026/08/11/11_48_48/SUMMARY.md` (게이트 28-35)가 "게이트가 요구하는
  동반 갱신 6곳" 을 정확히 이 6개 문서로 지목했고, 각 항목은 `cross_spec`(CRITICAL 3, 게이트
  cross_spec.md #1-#3) 또는 `plan_coherence`(WARNING, 게이트 plan_coherence.md 42-70)가
  개별적으로 근거를 댄다. `data-flow/1-audit.md` 의 "남은 갭은 두 가지" 문구 정정(게이트
  101-102)도 새 writer 행 3개를 추가하는 같은 표를 설명하는 서두 문장이라, 손대지 않으면 즉시
  새 drift 가 생긴다고 게이트 자신이 지적했다(`plan_coherence.md` 게이트 56-70). CLAUDE.md 의
  project-planner 의무("spec 쓰기 직전 consistency-check --spec 의무")와도 정확히 일치하는
  절차다.
- 판단: 6곳은 임의로 늘어난 범위가 아니라 **의무 게이트의 산출물이 지정한 최소 범위**다. 이
  저장소에 이미 기록된 선례("spec SoT 4곳 동기화", 2026-08-06)와 같은 패턴이며, 이번엔 대상
  액션이 3개(2026-08-06 은 CRUD 13개 정정)라 companion 문서가 2곳(EIA·chat-channel 기존 결함)
  더 늘어난 것으로 설명된다. 과한 확장으로 보지 않는다.

### [INFO] `15-chat-channel.md:378` 1줄 수정은 기존 결함이지만 이번 신규 액션명과 직접 충돌하는 자리라 동시 정정이 맞다

- 위치: `spec/5-system/15-chat-channel.md`(게이트 378)
- 상세: consistency 게이트 `cross_spec.md` #3(CRITICAL, 게이트 42-50)이 "PR 과 무관한 기존 결함"
  으로 명시 분류했다. 그러나 이 줄이 인용하는 잘못된 예시 액션명(`chat-channel.rotate-bot-token`)
  이 바로 이 PR 이 확정하는 올바른 액션명(`trigger.chat_channel_bot_token_rotated`, 게이트
  audit-actions.md 58)과 나란히 spec 안에 공존하면 "같은 사건을 가리키는 두 이름" 모순이
  즉시 생긴다. 1줄, 각주 형태로만 정정했고 그 외 본문·구조는 손대지 않았다.
- 판단: 무관한 정리가 아니라 이번 변경이 만드는 신규 모순을 막기 위한 필수 동반 수정. 스코프
  내로 판단한다.

### [INFO] 코드 diff 는 목표 메서드 3개(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)로 정확히 국한

- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts`(게이트 195, 223, 251),
  `triggers.service.ts`(게이트 905, 949, 1003, 1113-1119)
- 상세: `@CurrentUser('sub')` 데코레이터는 이미 `import { CurrentUser, WorkspaceId } from
  '../../common/decorators'`(파일 상단, 이번 diff 밖)로 기존에 import 돼 있었다(`create`/
  `update`/`remove` 에서 이미 사용 중 — W8 6차 리뷰 완료 항목). 이번 diff 는 새 import 를
  추가하지 않았고, 대상 3개 메서드 시그니처와 `recordAudit` 호출부만 건드렸다. drive-by
  리팩토링·포맷팅·주석 정리 없음.
- 판단: 스코프 이탈 없음.

### 판정 (a)/(b)/(c) 요약

- **(a) 응집성**: `plan/in-progress/spec-sync-auth-gaps.md` 의 나머지 6항목(LDAP/SAML,
  `workflow.executed`, `saveCanvas`, `recordAudit` 팩토리, 동시삭제 중복)은 이 PR 이 다루는
  "감사 로깅 3종 신설" 과 각각 **독립적인 차단 사유**(별도 백엔드 인프라 필요, 보존 정책 미정,
  다른 엔드포인트, 추출 이득 없음, 우선순위 낮음)를 이미 plan 본문에 명시하고 있다. 함께
  처리했어야 할 항목은 없다 — 오히려 2026-08-06 결정("번들되지 않았다. 별도 planner 턴이
  필요하다 ... 정정 작업과 새 설계는 성격이 다르다")과 같은 원칙을 이번에도 지켰다.
- **(b) 하네스 테스트 수정**: 위 첫 발견사항대로 정당하다 — 이 PR 자신의 spec 커밋이 유발한
  실측 결함의 자가 수정이며 별도 커밋으로 완전히 격리돼 있다.
- **(c) spec 6곳 동시 갱신**: 과하지 않다 — 착수 전 consistency-check 게이트가 지정한 정확한
  범위이며, 그중 2곳(chat-channel 기존 오기, data-flow 서두 stale 문구)은 이번 신규 액션명과
  즉시 충돌하므로 동시 정정이 필수였다.

---

## 요약

이 PR 은 겉보기 파일 수(21개)에 비해 스코프 이탈이 거의 없다. 커밋 3개(spec 결정 / 하네스 자가
결함 수정 / 코드 구현)가 관심사별로 완전히 분리돼 있고, `git diff --stat origin/main...HEAD`
로 확인한 실제 변경 파일 집합이 리뷰 프롬프트가 제시한 21개 파일과 정확히 일치해 프롬프트에
없는 숨은 변경도 없다. spec 6곳 동시 갱신은 project-planner 의무 게이트(`review/consistency/
2026/08/11/11_48_48/`)가 명시적으로 요구한 최소 범위이고, 그중 `15-chat-channel.md`/
`data-flow/1-audit.md` 의 기존 결함 정정 1~2줄은 신규 액션명과의 즉각적 모순을 막기 위한
필수 동반 수정이다. `.claude/tests/test_consistency_bundle_priority.py` 하네스 수정은 관심사
자체는 다르지만 이 PR 의 spec 커밋이 실측으로 유발한 자가 결함이며 별도 커밋으로 격리돼 있어
스코프 위반으로 보지 않는다. plan 의 나머지 6개 미착수 항목은 각각 독립된 차단 사유가 있어
이번에 함께 처리하지 않은 것이 오히려 이 저장소의 기존 원칙(정정과 새 설계를 한 턴에 섞지
않는다)과 일치한다. CRITICAL/WARNING 급 스코프 위반은 발견하지 못했다.

## 위험도

NONE
